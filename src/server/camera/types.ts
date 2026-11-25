export interface CameraHealth {
  connected: boolean;
  model: string;
  isLiveViewActive: boolean;
  batteryLevel?: string;
  temperatureSafe?: boolean;
  lastError?: string;
}

export interface CaptureResult {
  filePath: string;
  width?: number;
  height?: number;
  captureTimeMs: number;
}

export interface ICameraProvider {
  readonly name: 'mock' | 'gphoto2' | 'edsdk';
  initialize(): Promise<CameraHealth>;
  startLiveView(onFrame: (jpegBuffer: Buffer) => void): Promise<void>;
  stopLiveView(): Promise<void>;
  capturePhoto(targetPath: string): Promise<CaptureResult>;
  getHealth(): Promise<CameraHealth>;
  resetConnection(): Promise<void>;
  dispose(): Promise<void>;
}
