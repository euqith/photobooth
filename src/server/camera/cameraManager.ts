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

  public async setProvider(type: 'mock' | 'gphoto2' | 'edsdk'): Promise<CameraHealth & { provider: 'mock' | 'gphoto2' | 'edsdk' }> {
    if (this.provider.name !== type) {
      await this.provider.dispose().catch(() => {});

      if (type === 'mock') {
        this.provider = new MockCameraProvider();
      } else if (type === 'gphoto2') {
        this.provider = new MacGphotoProvider();
      } else {
        this.provider = new MockCameraProvider();
      }
    }

    const health = await this.provider.initialize();
    return {
      ...health,
      provider: this.provider.name,
    };
  }

  public async initialize(): Promise<CameraHealth & { provider: 'mock' | 'gphoto2' | 'edsdk' }> {
    try {
      const health = await this.provider.initialize();
      return {
        ...health,
        provider: this.provider.name,
      };
    } catch (err: any) {
      console.error('Camera init error:', err);
      return {
        connected: false,
        model: `${this.provider.name} error`,
        isLiveViewActive: false,
        lastError: err?.message || String(err),
        provider: this.provider.name,
      };
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

  public async getHealth(): Promise<CameraHealth & { provider: 'mock' | 'gphoto2' | 'edsdk' }> {
    const health = await this.provider.getHealth();
    return {
      ...health,
      provider: this.provider.name,
    };
  }

  public async resetConnection(): Promise<void> {
    this.isBusy = false;
    this.clearEvfTimeout();
    await this.provider.resetConnection();
  }
}
