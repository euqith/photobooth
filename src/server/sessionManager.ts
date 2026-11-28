import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { PhotoSession, PhotoboothState, ColorFilter } from '../shared/types';
import { CameraManager } from './camera/cameraManager';
import { TemplateCompositor } from './template/compositor';
import { BoomerangService } from './template/boomerangService';
import { PrinterService } from './printer/printerService';
import { PaymentManager } from './payment/paymentManager';
import { SettingsManager } from './config/settingsManager';

export class SessionManager {
  private io: SocketIOServer;
  private currentSession: PhotoSession | null = null;
  private cameraManager = CameraManager.getInstance();
  private printerService = PrinterService.getInstance();
  private paymentManager = PaymentManager.getInstance();
  private settingsManager = SettingsManager.getInstance();
  private countdownTimer: NodeJS.Timeout | null = null;
  private countdownVal = 5;

  private sessionsDir = path.resolve(__dirname, '../../output/sessions');
  private isStartingSession = false;

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

  public async startNewSession(): Promise<PhotoSession | null> {
    if (this.isStartingSession) {
      console.warn('[SessionManager] startNewSession ignored: session already starting');
      return this.currentSession;
    }
    if (this.currentSession && this.currentSession.state !== 'IDLE') {
      console.warn('[SessionManager] startNewSession: active session already exists in state', this.currentSession.state);
      this.broadcastState();
      return this.currentSession;
    }

    this.isStartingSession = true;
    try {
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
      this.updateActiveSlot();

      // Ensure session directory exists
      const sessionDir = path.join(this.sessionsDir, id);
      fs.mkdirSync(sessionDir, { recursive: true });

      const paymentSettings = this.settingsManager.getSettings().payment;
      // Commercial Flow: QRIS Payment BEFORE template selection
      if (paymentSettings.mode === 'paid') {
        this.io.emit('session:loading', {
          active: true,
          message: 'Menyiapkan Kode QRIS Pembayaran...',
          subMessage: 'Menghubungkan ke gateway pembayaran dan men-generate QRIS...',
        });
        await this.requestPayment();
        this.io.emit('session:loading', { active: false });
        return this.currentSession;
      }

      // Free Mode: Directly open template selection
      this.broadcastState();
      return this.currentSession;
    } finally {
      this.isStartingSession = false;
    }
  }

  private updateActiveSlot(): void {
    if (!this.currentSession) return;
    const template = TemplateCompositor.getTemplate(this.currentSession.templateId);
    if (!template) return;
    this.currentSession.activeSlot =
      template.leftSlots.find((s) => s.poseIndex === this.currentSession?.currentPose) ||
      template.leftSlots[0];
  }

  public selectTemplate(templateId: string): void {
    if (!this.currentSession) return;
    const template = TemplateCompositor.getTemplate(templateId);
    if (!template) return;

    this.currentSession.templateId = templateId;
    this.currentSession.poseCount = template.poseCount;
    this.currentSession.currentPose = 0;
    this.updateActiveSlot();
    this.currentSession.state = 'SELECT_TEMPLATE';
    this.broadcastState();
  }

  public async proceedToLiveView(): Promise<void> {
    if (!this.currentSession) return;

    const paymentSettings = this.settingsManager.getSettings().payment;
    // Check if Paid Mode is enabled
    if (paymentSettings.mode === 'paid' && (!this.currentSession.payment || this.currentSession.payment.status !== 'PAID')) {
      await this.requestPayment();
      return;
    }

    await this.enterLiveView();
  }

  public async requestPayment(): Promise<void> {
    if (!this.currentSession) return;

    // Ensure camera LiveView is safely drained asynchronously without blocking QRIS generation
    this.cameraManager.stopLiveView().catch(() => {});

    try {
      let tx: any;
      try {
        tx = await this.paymentManager.createTransaction(this.currentSession.id);
      } catch (gatewayErr: any) {
        console.warn('[SessionManager] Primary gateway error, falling back to Sandbox QRIS:', gatewayErr?.message);
        const fallbackAmount = this.settingsManager.getSettings().payment.sessionPrice || 50000;
        tx = await this.paymentManager.createFallbackSandboxTransaction(this.currentSession.id, fallbackAmount);
      }

      if (!tx.expiresAt) {
        tx.expiresAt = Date.now() + 5 * 60 * 1000;
      }

      this.currentSession.payment = tx;
      this.currentSession.state = 'AWAITING_PAYMENT';
      this.broadcastState();

      // Start adaptive polling verification
      this.paymentManager.startStatusPolling(
        tx.orderId,
        async () => {
          await this.onPaymentSettled();
        },
        () => {
          if (this.currentSession && this.currentSession.state === 'AWAITING_PAYMENT') {
            const exp = this.currentSession.payment?.expiresAt;
            // Guard: Only reset to IDLE if the QRIS has genuinely expired or was explicitly cancelled
            if (exp && Date.now() >= exp) {
              console.warn('[SessionManager] QRIS transaction expired, resetting session to IDLE');
              this.resetToIdle();
            } else if (this.currentSession.payment?.status === 'CANCELLED') {
              console.warn('[SessionManager] QRIS transaction cancelled, resetting session to IDLE');
              this.resetToIdle();
            }
          }
        }
      );
    } catch (err: any) {
      console.error('[SessionManager] Payment request error:', err);
      this.io.emit('session:loading', { active: false, error: err?.message });
      this.currentSession.errorMessage = err?.message || 'Gagal memproses QRIS';
      this.currentSession.state = 'ERROR';
      this.broadcastState();
    }
  }

  public async onPaymentSettled(): Promise<void> {
    if (!this.currentSession) return;
    if (this.currentSession.payment) {
      this.currentSession.payment.status = 'PAID';
    }
    this.currentSession.state = 'PAYMENT_SUCCESS';
    this.broadcastState();

    // 1.5s celebratory cue, then proceed to template grid selection
    setTimeout(async () => {
      if (this.currentSession && (this.currentSession.state === 'PAYMENT_SUCCESS' || this.currentSession.state === 'AWAITING_PAYMENT')) {
        this.currentSession.state = 'SELECT_TEMPLATE';
        this.broadcastState();
      }
    }, 1500);
  }

  public async applyVoucherCode(code: string): Promise<{
    success: boolean;
    message: string;
    discountAmount?: number;
    finalAmount?: number;
  }> {
    if (!this.currentSession || this.currentSession.state !== 'AWAITING_PAYMENT') {
      const res = { success: false, message: 'Tidak ada sesi pembayaran aktif.' };
      this.io.emit('payment:voucherResult', res);
      return res;
    }

    const originalPrice =
      this.currentSession.payment?.originalAmount ||
      this.currentSession.payment?.amount ||
      this.settingsManager.getSettings().payment.sessionPrice ||
      50000;

    const discountInfo = this.settingsManager.calculateDiscount(code, originalPrice);
    if (!discountInfo.valid || !discountInfo.voucher) {
      const res = { success: false, message: 'Kode voucher tidak valid atau sudah tidak aktif.' };
      this.io.emit('payment:voucherResult', res);
      return res;
    }

    const { discountAmount, finalAmount, voucher } = discountInfo;

    // Case 1: 100% Free / Full discount (Lunas Langsung)
    if (finalAmount <= 0) {
      if (this.currentSession.payment) {
        this.currentSession.payment.originalAmount = originalPrice;
        this.currentSession.payment.discountAmount = discountAmount;
        this.currentSession.payment.amount = 0;
        this.currentSession.payment.voucherCode = voucher.code;
        this.currentSession.payment.status = 'PAID';
        this.paymentManager.settlePayment(this.currentSession.payment.orderId, voucher.code);
      }
      const res = {
        success: true,
        message: `Voucher ${voucher.code} berhasil! Diskon 100% (Gratis).`,
        discountAmount,
        finalAmount: 0,
      };
      this.io.emit('payment:voucherResult', res);
      await this.onPaymentSettled();
      return res;
    }

    // Case 2: Partial discount (Potongan sebagian)
    // Sisa pembayaran (finalAmount) harus dibayar via QRIS baru
    try {
      this.paymentManager.stopPolling();

      let newTx: any;
      try {
        newTx = await this.paymentManager.createTransaction(this.currentSession.id, finalAmount);
      } catch (err: any) {
        console.warn('[SessionManager] Primary gateway failed for partial voucher, using sandbox:', err);
        const fallback = this.paymentManager.getProvider('sandbox');
        newTx = await fallback.createQris(
          `FALLBACK-${this.currentSession.id}-${Date.now().toString(36)}`,
          finalAmount,
          this.currentSession.id
        );
      }

      newTx.originalAmount = originalPrice;
      newTx.discountAmount = discountAmount;
      newTx.voucherCode = voucher.code;
      if (!newTx.expiresAt) {
        newTx.expiresAt = Date.now() + 5 * 60 * 1000;
      }

      this.currentSession.payment = newTx;
      this.broadcastState();

      // Start status polling for the new discounted QRIS
      this.paymentManager.startStatusPolling(
        newTx.orderId,
        async () => {
          await this.onPaymentSettled();
        },
        () => {
          if (this.currentSession && this.currentSession.state === 'AWAITING_PAYMENT') {
            this.resetToIdle();
          }
        }
      );

      const discountLabel =
        voucher.type === 'percentage'
          ? `${voucher.value}% (-Rp ${discountAmount.toLocaleString('id-ID')})`
          : `-Rp ${discountAmount.toLocaleString('id-ID')}`;

      const resMsg = `Voucher ${voucher.code} diterapkan! Diskon ${discountLabel}. Sisa tagihan Rp ${finalAmount.toLocaleString('id-ID')}.`;

      const res = {
        success: true,
        message: resMsg,
        discountAmount,
        finalAmount,
      };
      this.io.emit('payment:voucherResult', res);
      return res;
    } catch (err: any) {
      console.error('[SessionManager] Error applying partial voucher:', err);
      const res = { success: false, message: 'Gagal memperbarui QRIS dengan voucher: ' + (err?.message || 'Error') };
      this.io.emit('payment:voucherResult', res);
      return res;
    }
  }

  public async enterLiveView(): Promise<void> {
    if (!this.currentSession) return;

    this.currentSession.state = 'LIVEVIEW_PREP';
    this.countdownVal = 0;
    this.updateActiveSlot();
    this.broadcastState();

    // Start Live View stream (Wake DSLR & Mirror UP)
    await this.cameraManager.startLiveView((frameBuffer) => {
      this.io.emit('camera:frame', frameBuffer);
    });
    // Camera is streaming in LIVEVIEW_PREP, waiting for user to press AMBIL FOTO button
  }

  public startUserCountdown(): void {
    if (!this.currentSession) return;
    if (this.currentSession.state !== 'LIVEVIEW_PREP') return;
    this.startCountdown();
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
    await this.enterLiveView();
  }

  public async acceptPoseAndContinue(): Promise<void> {
    if (!this.currentSession) return;

    const nextPose = this.currentSession.currentPose + 1;
    if (nextPose < this.currentSession.poseCount) {
      // More poses remaining
      this.currentSession.currentPose = nextPose;
      this.currentSession.retakeCountForCurrentPose = 0;
      await this.enterLiveView();
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

      // Generate lightweight web-optimized thumbnails for each pose so mobile gallery decodes without lag/crashes
      await Promise.all(
        this.currentSession.capturedPhotos.map(async (photoPath, idx) => {
          if (!fs.existsSync(photoPath)) return;
          const thumbPath = path.join(sessionDir, `pose_${idx + 1}_thumb.jpg`);
          await sharp(photoPath)
            .rotate()
            .resize(800, null, { withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toFile(thumbPath)
            .catch((err) => console.warn('Thumb gen warning:', err));
        })
      );

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
    this.paymentManager.cancelCurrentTransaction();
    this.cameraManager.stopLiveView().catch(() => {});
    this.currentSession = null;
    this.io.emit('session:state', {
      session: null,
      state: 'IDLE',
      countdown: 0,
    });
  }
}
