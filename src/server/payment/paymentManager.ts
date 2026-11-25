import { IPaymentProvider } from './types';
import { SandboxPaymentProvider } from './sandboxProvider';
import { MidtransPaymentProvider } from './midtransProvider';
import { XenditPaymentProvider } from './xenditProvider';
import { QrisTransaction, PaymentProviderType, TransactionStatus } from '../../shared/types';
import { SettingsManager } from '../config/settingsManager';
import fs from 'fs';
import path from 'path';

const LEDGER_PATH = path.resolve(__dirname, '../../../output/transactions_ledger.json');

export class PaymentManager {
  private static instance: PaymentManager;
  private sandboxProvider = new SandboxPaymentProvider();
  private midtransProvider = new MidtransPaymentProvider();
  private xenditProvider = new XenditPaymentProvider();

  private activePoller: NodeJS.Timeout | null = null;
  private currentTransaction: QrisTransaction | null = null;
  private onPaymentSettledCallback: ((tx: QrisTransaction) => void) | null = null;
  private onPaymentExpiredCallback: (() => void) | null = null;

  private constructor() {
    this.ensureLedgerExists();
  }

  public static getInstance(): PaymentManager {
    if (!PaymentManager.instance) {
      PaymentManager.instance = new PaymentManager();
    }
    return PaymentManager.instance;
  }

  private ensureLedgerExists(): void {
    try {
      if (!fs.existsSync(LEDGER_PATH)) {
        fs.mkdirSync(path.dirname(LEDGER_PATH), { recursive: true });
        fs.writeFileSync(LEDGER_PATH, '[]', 'utf-8');
      }
    } catch (err) {
      console.warn('[PaymentManager] Ledger init warning:', err);
    }
  }

  public getProvider(type?: PaymentProviderType): IPaymentProvider {
    const selected = type || SettingsManager.getInstance().getSettings().payment.provider;
    switch (selected) {
      case 'midtrans':
        return this.midtransProvider;
      case 'xendit':
        return this.xenditProvider;
      case 'sandbox':
      default:
        return this.sandboxProvider;
    }
  }

  public async createTransaction(
    sessionId: string,
    amount?: number
  ): Promise<QrisTransaction> {
    this.stopPolling();

    const settings = SettingsManager.getInstance().getSettings().payment;
    const finalAmount = amount || settings.sessionPrice;
    const orderId = `PB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const provider = this.getProvider(settings.provider);
    const tx = await provider.createQris(orderId, finalAmount, sessionId);
    this.currentTransaction = tx;
    this.appendLedger(tx);

    return tx;
  }

  public startStatusPolling(
    orderId: string,
    onSuccess: (tx: QrisTransaction) => void,
    onExpired?: () => void
  ): void {
    this.stopPolling();
    this.onPaymentSettledCallback = onSuccess;
    this.onPaymentExpiredCallback = onExpired || null;

    const settings = SettingsManager.getInstance().getSettings().payment;
    const interval = Math.max(1500, settings.pollingIntervalMs || 2500);

    console.log(`[PaymentManager] Starting adaptive polling for order ${orderId} every ${interval}ms`);

    this.activePoller = setInterval(async () => {
      try {
        const provider = this.getProvider(settings.provider);
        const status = await provider.checkStatus(orderId);

        if (status === 'PAID') {
          console.log(`[PaymentManager] Payment SETTLED for order ${orderId}`);
          this.settlePayment(orderId);
        } else if (status === 'EXPIRED' || status === 'CANCELLED') {
          console.log(`[PaymentManager] Payment ${status} for order ${orderId}`);
          this.stopPolling();
          if (this.currentTransaction) {
            this.currentTransaction.status = status;
            this.updateLedger(this.currentTransaction);
          }
          if (this.onPaymentExpiredCallback) {
            this.onPaymentExpiredCallback();
          }
        }
      } catch (err) {
        console.warn(`[PaymentManager] Polling tick error:`, err);
      }
    }, interval);
  }

  public settlePayment(orderId: string, bypassVoucher?: string): boolean {
    if (!this.currentTransaction || this.currentTransaction.orderId !== orderId) {
      return false;
    }

    if (this.currentTransaction.status === 'PAID') {
      return true; // Idempotent lock: already settled
    }

    this.stopPolling();
    this.currentTransaction.status = bypassVoucher ? 'VOUCHER' : 'PAID';
    this.currentTransaction.paidAt = Date.now();
    this.updateLedger(this.currentTransaction);

    if (this.onPaymentSettledCallback) {
      this.onPaymentSettledCallback(this.currentTransaction);
    }
    return true;
  }

  public handleWebhookNotification(payload: any): boolean {
    const orderId = payload.order_id || payload.external_id;
    if (!orderId) return false;

    // Check Midtrans or Xendit status
    const status = payload.transaction_status || payload.status;
    if (status === 'settlement' || status === 'capture' || status === 'COMPLETED') {
      return this.settlePayment(orderId);
    }
    return false;
  }

  public stopPolling(): void {
    if (this.activePoller) {
      clearInterval(this.activePoller);
      this.activePoller = null;
    }
  }

  public getCurrentTransaction(): QrisTransaction | null {
    return this.currentTransaction;
  }

  public simulateSandboxSuccess(): boolean {
    if (this.currentTransaction) {
      this.sandboxProvider.simulatePaymentSuccess(this.currentTransaction.orderId);
      return this.settlePayment(this.currentTransaction.orderId);
    }
    return false;
  }

  public async simulateMidtransQrPayment(qrCodeUrl: string): Promise<{ success: boolean; message: string }> {
    try {
      const scanRes = await fetch('https://simulator.sandbox.midtrans.com/v2/qris/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'qrCodeUrl=' + encodeURIComponent(qrCodeUrl),
      });
      const scanHtml = await scanRes.text();
      const formMatch = scanHtml.match(/<form[^>]*action=\"([^\"]+)\"[^>]*method=\"post\"([\s\S]*?)<\/form>/);
      if (!formMatch) {
        throw new Error('Gagal membaca form scan simulator Midtrans. Pastikan URL QRIS valid.');
      }
      const action = formMatch[1];
      const formBody = formMatch[2];
      const inputMatches = [...formBody.matchAll(/<input\s+name=\"([^\"]+)\"\s+type=\"hidden\"\s+value=\"([^\"]*)\"/g)];
      const params = new URLSearchParams();
      for (const m of inputMatches) {
        params.set(m[1], this.unescapeHtml(m[2]));
      }
      params.set('issuer', 'gopay');

      const payUrl = new URL(action, 'https://simulator.sandbox.midtrans.com/v2/qris/payment').toString();
      const payRes = await fetch(payUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const payHtml = await payRes.text();
      const isPaid = payHtml.includes('PAID') || payHtml.includes('Status PAID');

      if (this.currentTransaction) {
        const status = await this.getProvider('midtrans').checkStatus(this.currentTransaction.orderId);
        if (status === 'PAID') {
          this.settlePayment(this.currentTransaction.orderId);
        }
      }

      return {
        success: isPaid,
        message: isPaid
          ? 'Sukses! Transaksi berhasil diselesaikan di Midtrans Sandbox (Status: PAID).'
          : 'Transaksi selesai dikirim ke simulator Midtrans.',
      };
    } catch (err: any) {
      console.error('[PaymentManager] Error in simulateMidtransQrPayment:', err);
      throw err;
    }
  }

  private unescapeHtml(str: string): string {
    return str
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'");
  }

  public cancelCurrentTransaction(): void {
    if (this.currentTransaction && this.currentTransaction.status === 'PENDING') {
      const provider = this.getProvider(this.currentTransaction.provider);
      provider.cancelQris(this.currentTransaction.orderId).catch(() => {});
      this.currentTransaction.status = 'CANCELLED';
      this.updateLedger(this.currentTransaction);
    }
    this.stopPolling();
    this.currentTransaction = null;
  }

  // --- Transaction Ledger Persistence ---
  private appendLedger(tx: QrisTransaction): void {
    try {
      this.ensureLedgerExists();
      const list = this.getAllTransactions();
      list.push(tx);
      fs.writeFileSync(LEDGER_PATH, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[PaymentManager] Error writing ledger:', err);
    }
  }

  private updateLedger(tx: QrisTransaction): void {
    try {
      this.ensureLedgerExists();
      const list = this.getAllTransactions();
      const idx = list.findIndex((t) => t.orderId === tx.orderId);
      if (idx !== -1) {
        list[idx] = tx;
      } else {
        list.push(tx);
      }
      fs.writeFileSync(LEDGER_PATH, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('[PaymentManager] Error updating ledger:', err);
    }
  }

  public getAllTransactions(): QrisTransaction[] {
    try {
      if (fs.existsSync(LEDGER_PATH)) {
        return JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf-8'));
      }
    } catch {
      // ignore
    }
    return [];
  }

  public getDailyRevenue(): {
    totalAmount: number;
    totalGrossAmount: number;
    count: number;
    paidCount: number;
    voucherCount: number;
    totalTransactions: number;
  } {
    const all = this.getAllTransactions();
    const today = new Date().toDateString();

    let totalAmount = 0;
    let count = 0;
    let voucherCount = 0;

    for (const t of all) {
      const d = new Date(t.paidAt || t.expiresAt).toDateString();
      if (d === today) {
        if (t.status === 'PAID') {
          totalAmount += (t.amount || 0);
          count++;
        } else if (t.status === 'VOUCHER') {
          voucherCount++;
        }
      }
    }

    return {
      totalAmount,
      totalGrossAmount: totalAmount,
      count,
      paidCount: count,
      voucherCount,
      totalTransactions: all.length,
    };
  }
}
