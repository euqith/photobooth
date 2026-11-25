import { ICameraProvider, CameraHealth, CaptureResult } from './types';
import { MockCameraProvider } from './mockProvider';
import { MacGphotoProvider } from './macGphotoProvider';

/**
 * CameraManager
 * Singleton managing active camera provider with:
 * 1. Single-Flight Mutex to serialize USB commands
 * 2. Thermal EVF Guard to prevent sensor overheating
 * 3. Cross-platform provider selection
 */
export class CameraManager {
  private static instance: CameraManager;
  private provider: ICameraProvider;
  private isBusy = false;
  private evfTimeoutTimer: NodeJS.Timeout | null = null;
  private readonly EVF_MAX_IDLE_MS = 60000; // 60s thermal auto-off

  private constructor() {
    const forced = process.env.CAMERA_PROVIDER;
    if (forced === 'mock') {
      this.provider = new MockCameraProvider();
    } else if (process.platform === 'darwin') {
      // macOS Apple Silicon dev/test
      this.provider = new MacGphotoProvider();
    } else {
      // Windows or default fallback
      this.provider = new MockCameraProvider();
    }
  }

  public static getInstance(): CameraManager {
    if (!CameraManager.instance) {
      CameraManager.instance = new CameraManager();
    }
    return CameraManager.instance;
  }

  public setProvider(type: 'mock' | 'gphoto2' | 'edsdk'): void {
    if (this.provider.name === type) return;
    this.provider.dispose().catch(() => {});

    if (type === 'mock') {
      this.provider = new MockCameraProvider();
    } else if (type === 'gphoto2') {
      this.provider = new MacGphotoProvider();
    } else {
      this.provider = new MockCameraProvider();
    }
  }

  public async initialize(): Promise<CameraHealth> {
    try {
      const health = await this.provider.initialize();
      if (!health.connected && this.provider.name !== 'mock') {
        console.warn(`Camera provider ${this.provider.name} not connected. Falling back to Mock.`);
        this.provider = new MockCameraProvider();
        return this.provider.initialize();
      }
      return health;
    } catch (err) {
      console.error('Camera init error, falling back to mock:', err);
      this.provider = new MockCameraProvider();
      return this.provider.initialize();
    }
  }

  public async startLiveView(onFrame: (frame: Buffer) => void): Promise<void> {
    if (this.isBusy) {
      console.warn('Camera is busy, skipping startLiveView request');
      return;
    }

    this.resetEvfTimeout();
    await this.provider.startLiveView((frame) => {
      this.resetEvfTimeout();
      onFrame(frame);
    });
  }

  public async stopLiveView(): Promise<void> {
    this.clearEvfTimeout();
    await this.provider.stopLiveView();
  }

  private resetEvfTimeout(): void {
    this.clearEvfTimeout();
    this.evfTimeoutTimer = setTimeout(async () => {
      console.log('Thermal EVF Guard triggered: Stopping Live View due to inactivity.');
      await this.stopLiveView();
    }, this.EVF_MAX_IDLE_MS);
  }

  private clearEvfTimeout(): void {
    if (this.evfTimeoutTimer) {
      clearTimeout(this.evfTimeoutTimer);
      this.evfTimeoutTimer = null;
    }
  }

  public async capturePhoto(targetPath: string): Promise<CaptureResult> {
    if (this.isBusy) {
      throw new Error('Camera is currently busy with another operation.');
    }
    this.isBusy = true;
    this.clearEvfTimeout();

    try {
      // Ensure Live View is paused/drained before sending capture command
      await this.provider.stopLiveView();
      const result = await this.provider.capturePhoto(targetPath);
      return result;
    } finally {
      this.isBusy = false;
    }
  }

  public async getHealth(): Promise<CameraHealth> {
    return this.provider.getHealth();
  }

  public async resetConnection(): Promise<void> {
    this.isBusy = false;
    this.clearEvfTimeout();
    await this.provider.resetConnection();
  }
}
