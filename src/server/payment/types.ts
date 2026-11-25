import { QrisTransaction, PaymentProviderType, TransactionStatus } from '../../shared/types';

export interface IPaymentProvider {
  readonly type: PaymentProviderType;
  createQris(orderId: string, amount: number, sessionId: string): Promise<QrisTransaction>;
  checkStatus(orderId: string): Promise<TransactionStatus>;
  cancelQris(orderId: string): Promise<boolean>;
}
