export type PhotoboothState =
  | 'IDLE'
  | 'SELECT_TEMPLATE'
  | 'AWAITING_PAYMENT'
  | 'PAYMENT_SUCCESS'
  | 'LIVEVIEW_PREP'
  | 'COUNTDOWN'
  | 'CAPTURING'
  | 'REVIEW_SHOT'
  | 'PROCESSING'
  | 'RESULT_SHARE'
  | 'ERROR';

export type ColorFilter = 'original' | 'bw' | 'vintage' | 'bright';

export type PaymentMode = 'free' | 'paid';
export type PaymentProviderType = 'sandbox' | 'midtrans' | 'xendit';
export type VerificationMethod = 'polling' | 'relay';
export type TransactionStatus = 'PENDING' | 'PAID' | 'EXPIRED' | 'CANCELLED' | 'VOUCHER';

export interface QrisTransaction {
  orderId: string;
  sessionId: string;
  amount: number;
  qrString: string;
  qrImageUrl?: string;
  qrCodeUrl?: string; // Midtrans QR action URL for simulator or external preview
  expiresAt: number; // timestamp ms
  status: TransactionStatus;
  provider: PaymentProviderType;
  paidAt?: number;
}

export interface SlotBox {
  x: number;
  y: number;
  width: number;
  height: number;
  columnIndex: 0 | 1;
  poseIndex: number;
}

export interface TemplateMetadata {
  id: string;
  filename: string;
  title: string;
  canvasWidth: number;
  canvasHeight: number;
  poseCount: number;
  leftSlots: SlotBox[];
  rightSlots: SlotBox[];
  allSlots: SlotBox[];
  processedImagePath: string;
  isActive?: boolean;
}

export interface PhotoSession {
  id: string;
  createdAt: number;
  templateId: string;
  poseCount: number;
  currentPose: number; // 0-based
  activeSlot?: SlotBox;
  capturedPhotos: string[]; // absolute paths to raw high-res JPEGs
  retakeCountForCurrentPose: number;
  filter: ColorFilter;
  printPath?: string;
  singleStripPath?: string;
  boomerangMp4Path?: string;
  boomerangGifPath?: string;
  qrCodeUrl?: string;
  printCopies: number;
  state: PhotoboothState;
  payment?: QrisTransaction;
  errorMessage?: string;
}

export interface CameraStatus {
  connected: boolean;
  provider: 'mock' | 'gphoto2' | 'edsdk';
  model: string;
  isEvfActive: boolean;
  batteryLevel?: string;
  lastError?: string;
}

export interface PrinterStatus {
  connected: boolean;
  name: string;
  isPrinting: boolean;
  paperRemaining: number;
  mode: 'dry-run' | 'cups' | 'windows-spooler';
}

export interface PaymentSettings {
  mode: PaymentMode; // 'free' | 'paid'
  provider: PaymentProviderType; // 'sandbox' | 'midtrans' | 'xendit'
  environment: 'sandbox' | 'production';
  sessionPrice: number; // IDR e.g. 35000
  extraPrintPrice: number; // IDR e.g. 10000
  qrisTimeoutSeconds: number; // e.g. 300 (5 mins)
  verificationMethod: VerificationMethod; // 'polling' | 'relay'
  pollingIntervalMs: number; // e.g. 2500
  midtransServerKey: string;
  midtransClientKey: string;
  midtransMerchantId: string;
  xenditApiKey: string;
  cloudRelayUrl: string;
  webhookSecret: string;
  activeVouchers: string[]; // list of active promo/cash voucher codes
}

export interface ServerSettings {
  countdownDuration: number; // e.g. 5 seconds
  reviewDuration: number;    // e.g. 3 seconds
  allowRetake: boolean;
  maxRetakesPerPose: number; // e.g. 1
  maxPrintCopies: number;    // e.g. 2
  autoPrint: boolean;
  adminPin: string;
  printerName: string;
  dryRunPrinter: boolean;
  cameraProvider: 'mock' | 'gphoto2' | 'edsdk';
  payment: PaymentSettings;
}
