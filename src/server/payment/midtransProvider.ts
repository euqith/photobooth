import { IPaymentProvider } from './types';
import { QrisTransaction, TransactionStatus } from '../../shared/types';
import { SettingsManager } from '../config/settingsManager';
import qrcode from 'qrcode';

export class MidtransPaymentProvider implements IPaymentProvider {
  readonly type = 'midtrans' as const;

  private getBaseUrl(): string {
    const settings = SettingsManager.getInstance().getSettings().payment;
    return settings.environment === 'production'
      ? 'https://api.midtrans.com'
      : 'https://api.sandbox.midtrans.com';
  }

  private getAuthHeader(): string {
    const serverKey = SettingsManager.getInstance().getSettings().payment.midtransServerKey;
    return 'Basic ' + Buffer.from(serverKey + ':').toString('base64');
  }

  async createQris(orderId: string, amount: number, sessionId: string): Promise<QrisTransaction> {
    const url = `${this.getBaseUrl()}/v2/charge`;
    const payload = {
      payment_type: 'qris',
      transaction_details: {
        order_id: orderId,
        gross_amount: amount,
      },
      qris: {
        acquirer: 'gopay',
      },
      custom_field1: sessionId,
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

    if (!res.ok || (data.status_code && data.status_code !== '201')) {
      throw new Error(data.status_message || `Midtrans API Error: ${res.status}`);
    }

    const qrString = data.qr_string || '';
    const qrImageUrl = qrString
      ? await qrcode.toDataURL(qrString, { margin: 1, width: 400 })
      : (data.actions?.find((a: any) => a.name === 'generate-qr-code')?.url || '');

    return {
      orderId,
      sessionId,
      amount,
      qrString,
      qrImageUrl,
      expiresAt: Date.now() + 5 * 60 * 1000,
      status: 'PENDING',
      provider: 'midtrans',
    };
  }

  async checkStatus(orderId: string): Promise<TransactionStatus> {
    const url = `${this.getBaseUrl()}/v2/${orderId}/status`;

    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          Authorization: this.getAuthHeader(),
        },
      });

      if (!res.ok) return 'PENDING';
      const data = await res.json() as any;

      const txStatus = data.transaction_status;
      if (txStatus === 'settlement' || txStatus === 'capture') {
        return 'PAID';
      }
      if (txStatus === 'expire') return 'EXPIRED';
      if (txStatus === 'cancel' || txStatus === 'deny') return 'CANCELLED';
      return 'PENDING';
    } catch {
      return 'PENDING';
    }
  }

  async cancelQris(orderId: string): Promise<boolean> {
    const url = `${this.getBaseUrl()}/v2/${orderId}/cancel`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: this.getAuthHeader(),
        },
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
