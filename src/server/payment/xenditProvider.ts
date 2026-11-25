import { IPaymentProvider } from './types';
import { QrisTransaction, TransactionStatus } from '../../shared/types';
import { SettingsManager } from '../config/settingsManager';
import qrcode from 'qrcode';

export class XenditPaymentProvider implements IPaymentProvider {
  readonly type = 'xendit' as const;

  private getAuthHeader(): string {
    const apiKey = SettingsManager.getInstance().getSettings().payment.xenditApiKey;
    return 'Basic ' + Buffer.from(apiKey + ':').toString('base64');
  }

  async createQris(orderId: string, amount: number, sessionId: string): Promise<QrisTransaction> {
    const url = 'https://api.xendit.co/qr_codes';
    const payload = {
      external_id: orderId,
      type: 'DYNAMIC',
      amount: amount,
      currency: 'IDR',
      metadata: { sessionId },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: this.getAuthHeader(),
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json() as any;

    if (!res.ok) {
      throw new Error(data.message || `Xendit API Error: ${res.status}`);
    }

    const qrString = data.qr_string || '';
    const qrImageUrl = qrString
      ? await qrcode.toDataURL(qrString, { margin: 1, width: 400 })
      : '';

    return {
      orderId,
      sessionId,
      amount,
      qrString,
      qrImageUrl,
      expiresAt: Date.now() + 5 * 60 * 1000,
      status: 'PENDING',
      provider: 'xendit',
    };
  }

  async checkStatus(orderId: string): Promise<TransactionStatus> {
    const url = `https://api.xendit.co/qr_codes/${orderId}`;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: this.getAuthHeader(),
        },
      });

      if (!res.ok) return 'PENDING';
      const data = await res.json() as any;
      if (data.status === 'COMPLETED') return 'PAID';
      if (data.status === 'EXPIRED') return 'EXPIRED';
      return 'PENDING';
    } catch {
      return 'PENDING';
    }
  }

  async cancelQris(orderId: string): Promise<boolean> {
    // Xendit QR codes auto-expire or can be marked
    return true;
  }
}
