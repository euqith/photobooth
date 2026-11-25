import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import { PhotoSession, PhotoboothState, ColorFilter } from '../shared/types';
import { CameraManager } from './camera/cameraManager';
import { TemplateCompositor } from './template/compositor';
import { BoomerangService } from './template/boomerangService';
import { PrinterService } from './printer/printerService';

export class SessionManager {
  private io: SocketIOServer;
  private currentSession: PhotoSession | null = null;
  private cameraManager = CameraManager.getInstance();
  private printerService = PrinterService.getInstance();
  private countdownTimer: NodeJS.Timeout | null = null;
  private countdownVal = 5;

  private sessionsDir = path.resolve(__dirname, '../../output/sessions');

  constructor(io: SocketIOServer) {
    this.io = io;
    fs.mkdirSync(this.sessionsDir, { recursive: true });
  }

  public getCurrentSession(): PhotoSession | null {
    return this.currentSession;
  }

  public getBoothState(): PhotoboothState {
    return this.currentSession?.state || 'IDLE';
  }

  public broadcastState(): void {
    this.io.emit('session:state', {
      session: this.currentSession,
      state: this.getBoothState(),
      countdown: this.countdownVal,
    });
  }

  public async startNewSession(): Promise<PhotoSession> {
    const id = Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    this.currentSession = {
      id,
      createdAt: Date.now(),
      templateId: '1',
      poseCount: 3,
      currentPose: 0,
      capturedPhotos: [],
      retakeCountForCurrentPose: 0,
      filter: 'original',
      printCopies: 1,
      state: 'SELECT_TEMPLATE',
    };

    // Ensure session directory exists
    const sessionDir = path.join(this.sessionsDir, id);
    fs.mkdirSync(sessionDir, { recursive: true });

    this.broadcastState();
    return this.currentSession;
  }

  public selectTemplate(templateId: string): void {
    if (!this.currentSession) return;
    const template = TemplateCompositor.getTemplate(templateId);
    if (!template) return;

    this.currentSession.templateId = templateId;
    this.currentSession.poseCount = template.poseCount;
    this.currentSession.currentPose = 0;
    this.currentSession.state = 'SELECT_TEMPLATE';
    this.broadcastState();
  }

  public async proceedToLiveView(): Promise<void> {
    await this.enterLiveViewAndCountdown();
  }

  private async enterLiveViewAndCountdown(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.state = 'LIVEVIEW_PREP';
    this.countdownVal = 0;
    this.broadcastState();

    // Start Live View stream
    await this.cameraManager.startLiveView((frameBuffer) => {
      this.io.emit('camera:frame', frameBuffer);
    });

    // 2.5 second breather: camera mirror flips up, sensor stabilizes, and user gets ready
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Ensure session is still active and in LIVEVIEW_PREP before starting countdown
    if (this.currentSession && this.currentSession.state === 'LIVEVIEW_PREP') {
      this.startCountdown();
    }
  }

  public startCountdown(): void {
    if (!this.currentSession) return;
    this.clearCountdown();

    this.currentSession.state = 'COUNTDOWN';
    this.countdownVal = 5;
    this.broadcastState();

    this.countdownTimer = setInterval(async () => {
      this.countdownVal--;
      this.io.emit('session:countdown_tick', { count: this.countdownVal });

      if (this.countdownVal <= 0) {
        this.clearCountdown();
        await this.triggerCapture();
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  public async triggerCapture(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.state = 'CAPTURING';
    this.io.emit('session:flash'); // White Screen Flash cue
    this.broadcastState();

    const poseNum = this.currentSession.currentPose + 1;
    const sessionDir = path.join(this.sessionsDir, this.currentSession.id);
    const photoPath = path.join(sessionDir, `pose_${poseNum}.jpg`);

    try {
      await this.cameraManager.capturePhoto(photoPath);
      this.currentSession.capturedPhotos[this.currentSession.currentPose] = photoPath;

      // Transition to Quick Review (3s preview with retake option)
      this.currentSession.state = 'REVIEW_SHOT';
      this.broadcastState();
    } catch (err: any) {
      console.error('Capture error:', err);
      this.currentSession.state = 'ERROR';
      this.broadcastState();
    }
  }

  public async retakeCurrentPose(): Promise<void> {
    if (!this.currentSession || this.currentSession.state !== 'REVIEW_SHOT') return;
    this.currentSession.retakeCountForCurrentPose++;
    await this.enterLiveViewAndCountdown();
  }

  public async acceptPoseAndContinue(): Promise<void> {
    if (!this.currentSession) return;

    const nextPose = this.currentSession.currentPose + 1;
    if (nextPose < this.currentSession.poseCount) {
      // More poses remaining
      this.currentSession.currentPose = nextPose;
      this.currentSession.retakeCountForCurrentPose = 0;
      await this.enterLiveViewAndCountdown();
    } else {
      // All poses captured! Transition to Processing
      await this.processSessionResult();
    }
  }

  public async processSessionResult(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.state = 'PROCESSING';
    this.broadcastState();

    // Immediately stop DSLR Live View to cool the sensor
    await this.cameraManager.stopLiveView();

    try {
      const sessionDir = path.join(this.sessionsDir, this.currentSession.id);
      const printOutputPath = path.join(sessionDir, 'print_4x6_2up.jpg');

      // Run sharp collage compositing and FFmpeg boomerang generation in parallel
      const [composite, boomerang] = await Promise.all([
        TemplateCompositor.compositePhotos(
          this.currentSession.templateId,
          this.currentSession.capturedPhotos,
          printOutputPath,
          this.currentSession.filter
        ),
        BoomerangService.generateBoomerang(
          this.currentSession.capturedPhotos,
          sessionDir
        ).catch((err) => {
          console.warn('Boomerang generation warning:', err);
          return { mp4Path: '', gifPath: '' };
        }),
      ]);

      this.currentSession.printPath = composite.printPath;
      this.currentSession.singleStripPath = composite.singleStripPath;
      this.currentSession.boomerangMp4Path = boomerang.mp4Path;
      this.currentSession.boomerangGifPath = boomerang.gifPath;
      this.currentSession.state = 'RESULT_SHARE';
      this.broadcastState();
    } catch (err) {
      console.error('Processing collage error:', err);
      this.currentSession.state = 'ERROR';
      this.broadcastState();
    }
  }

  public async applyFilter(filter: ColorFilter): Promise<void> {
    if (!this.currentSession || !this.currentSession.printPath) return;

    this.currentSession.filter = filter;
    const sessionDir = path.join(this.sessionsDir, this.currentSession.id);
    const printOutputPath = path.join(sessionDir, 'print_4x6_2up.jpg');

    const composite = await TemplateCompositor.compositePhotos(
      this.currentSession.templateId,
      this.currentSession.capturedPhotos,
      printOutputPath,
      filter
    );

    this.currentSession.printPath = composite.printPath;
    this.currentSession.singleStripPath = composite.singleStripPath;
    this.broadcastState();
  }

  public async printCollage(copies = 1): Promise<{ success: boolean; message: string }> {
    if (!this.currentSession || !this.currentSession.printPath) {
      return { success: false, message: 'No print file available.' };
    }

    this.currentSession.printCopies = copies;
    const res = await this.printerService.print(this.currentSession.printPath, copies);
    this.broadcastState();
    return res;
  }

  public resetToIdle(): void {
    this.clearCountdown();
    this.cameraManager.stopLiveView().catch(() => {});
    this.currentSession = null;
    this.io.emit('session:state', {
      session: null,
      state: 'IDLE',
      countdown: 0,
    });
  }
}
