export type PhotoboothState =
  | 'IDLE'
  | 'SELECT_TEMPLATE'
  | 'LIVEVIEW_PREP'
  | 'COUNTDOWN'
  | 'CAPTURING'
  | 'REVIEW_SHOT'
  | 'PROCESSING'
  | 'RESULT_SHARE'
  | 'ERROR';

export type ColorFilter = 'original' | 'bw' | 'vintage' | 'bright';

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
}

export interface PhotoSession {
  id: string;
  createdAt: number;
  templateId: string;
  poseCount: number;
  currentPose: number; // 0-based
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
}
