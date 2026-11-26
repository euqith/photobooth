import fs from 'fs';
import path from 'path';
import { ServerSettings } from '../../shared/types';

const CONFIG_PATH = path.resolve(__dirname, '../../../config/settings.json');

const DEFAULT_SETTINGS: ServerSettings = {
  countdownDuration: 5,
  reviewDuration: 3,
  allowRetake: true,
  maxRetakesPerPose: 1,
  maxPrintCopies: 2,
  autoPrint: false,
  adminPin: '1234',
  printerName: 'Default_Photo_Printer',
  dryRunPrinter: true,
  cameraProvider: 'gphoto2',
  payment: {
    mode: 'paid', // default commercial self-service mode
    provider: 'sandbox', // sandbox simulator default
    environment: 'sandbox',
    sessionPrice: 35000,
    extraPrintPrice: 10000,
    qrisTimeoutSeconds: 300,
    verificationMethod: 'polling',
    pollingIntervalMs: 2500,
    midtransServerKey: '',
    midtransClientKey: '',
    midtransMerchantId: '',
    xenditApiKey: '',
    cloudRelayUrl: '',
    webhookSecret: '',
    vouchers: [
      { code: 'VIPGUEST', type: 'percentage', value: 100, label: 'Tamu VIP (Gratis 100%)' },
      { code: 'CASH01', type: 'percentage', value: 100, label: 'Pembayaran Kasir Tunai' },
      { code: 'PROMO20', type: 'percentage', value: 20, label: 'Diskon Promo 20%' },
      { code: 'POTONGAN10K', type: 'fixed', value: 10000, label: 'Potongan Rp 10.000' },
    ],
    activeVouchers: ['VIPGUEST', 'CASH01', 'PROMO20', 'POTONGAN10K'],
  },
};

export class SettingsManager {
  private static instance: SettingsManager;
  private settings: ServerSettings;

  private constructor() {
    this.settings = this.loadSettings();
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  private loadSettings(): ServerSettings {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        const payment = {
          ...DEFAULT_SETTINGS.payment,
          ...(parsed.payment || {}),
        };

        // Auto-migration: if vouchers is missing or empty, build from activeVouchers
        if (!payment.vouchers || !Array.isArray(payment.vouchers) || payment.vouchers.length === 0) {
          if (Array.isArray(payment.activeVouchers) && payment.activeVouchers.length > 0) {
            payment.vouchers = payment.activeVouchers.map((code: string) => ({
              code: code.trim().toUpperCase(),
              type: 'percentage' as const,
              value: 100,
              label: 'Gratis 100% / Kasir Bypass',
            }));
          } else {
            payment.vouchers = [...DEFAULT_SETTINGS.payment.vouchers];
          }
        }

        // Always keep activeVouchers in sync
        payment.activeVouchers = payment.vouchers.map((v: any) => v.code.toUpperCase());

        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          payment,
        };
      }
    } catch (err) {
      console.warn('[SettingsManager] Failed to read settings, using defaults:', err);
    }

    this.saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }

  public getSettings(): ServerSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<ServerSettings>): ServerSettings {
    const updatedPayment = {
      ...this.settings.payment,
      ...(partial.payment || {}),
    };

    // Ensure vouchers and activeVouchers stay synchronized
    if (updatedPayment.vouchers && Array.isArray(updatedPayment.vouchers)) {
      updatedPayment.activeVouchers = updatedPayment.vouchers.map((v) => v.code.trim().toUpperCase());
    }

    this.settings = {
      ...this.settings,
      ...partial,
      payment: updatedPayment,
    };
    this.saveSettings(this.settings);
    return this.getSettings();
  }

  private saveSettings(data: ServerSettings): void {
    try {
      fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SettingsManager] Failed to write settings to disk:', err);
    }
  }

  public getVouchers() {
    return this.settings.payment.vouchers || [];
  }

  public findVoucher(code: string) {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    const vouchers = this.getVouchers();
    return vouchers.find((v) => v.code.trim().toUpperCase() === clean) || null;
  }

  public validateVoucher(code: string): boolean {
    return this.findVoucher(code) !== null;
  }

  public calculateDiscount(code: string, originalAmount: number): {
    valid: boolean;
    discountAmount: number;
    finalAmount: number;
    voucher?: { code: string; type: 'percentage' | 'fixed'; value: number; label?: string };
  } {
    const voucher = this.findVoucher(code);
    if (!voucher) {
      return { valid: false, discountAmount: 0, finalAmount: originalAmount };
    }

    let discountAmount = 0;
    if (voucher.type === 'percentage') {
      const pct = Math.max(0, Math.min(100, Number(voucher.value) || 0));
      discountAmount = Math.round((originalAmount * pct) / 100);
    } else {
      // Fixed nominal in IDR
      discountAmount = Math.max(0, Math.min(originalAmount, Number(voucher.value) || 0));
    }

    const finalAmount = Math.max(0, originalAmount - discountAmount);
    return {
      valid: true,
      discountAmount,
      finalAmount,
      voucher,
    };
  }
}
