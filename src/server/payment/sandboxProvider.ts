import { IPaymentProvider } from './types';
import { QrisTransaction, TransactionStatus } from '../../shared/types';
import qrcode from 'qrcode';

export class SandboxPaymentProvider implements IPaymentProvider {
  readonly type = 'sandbox' as const;
  private transactions = new Map<string, QrisTransaction>();

  async createQris(orderId: string, amount: number, sessionId: string): Promise<QrisTransaction> {
    const rawQrString = `00020101021226600016ID.CO.QRIS.WWW0118936009110000000000520458125303360540${amount}5802ID5919PHOTOBOOTH SANDBOX6007JAKARTA62070703A016304${orderId.substring(0, 4).toUpperCase()}`;

    const qrDataUri = await qrcode.toDataURL(rawQrString, {
      margin: 1,
      width: 400,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    const tx: QrisTransaction = {
      orderId,
      sessionId,
      amount,
      qrString: rawQrString,
      qrImageUrl: qrDataUri,
      expiresAt: Date.now() + 5 * 60 * 1000,
      status: 'PENDING',
      provider: 'sandbox',
    };

    this.transactions.set(orderId, tx);
    return tx;
  }

  async checkStatus(orderId: string): Promise<TransactionStatus> {
    const tx = this.transactions.get(orderId);
    if (!tx) return 'EXPIRED';
    if (Date.now() > tx.expiresAt && tx.status === 'PENDING') {
      tx.status = 'EXPIRED';
    }
    return tx.status;
  }

  async cancelQris(orderId: string): Promise<boolean> {
    const tx = this.transactions.get(orderId);
    if (tx && tx.status === 'PENDING') {
      tx.status = 'CANCELLED';
      return true;
    }
    return false;
  }

  // Simulator hook for developer / operator test
  simulatePaymentSuccess(orderId: string): boolean {
    const tx = this.transactions.get(orderId);
    if (tx && (tx.status === 'PENDING' || tx.status === 'EXPIRED')) {
      tx.status = 'PAID';
      tx.paidAt = Date.now();
      return true;
    }
    return false;
  }
}
