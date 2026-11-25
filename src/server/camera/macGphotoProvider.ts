import { ICameraProvider, CameraHealth, CaptureResult } from './types';
import { spawn, execSync, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

const GPHOTO_BIN = fs.existsSync('/opt/homebrew/bin/gphoto2')
  ? '/opt/homebrew/bin/gphoto2'
  : fs.existsSync('/usr/local/bin/gphoto2')
  ? '/usr/local/bin/gphoto2'
  : 'gphoto2';

const EXEC_ENV = {
  ...process.env,
  PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}`,
};

/**
 * MacGphotoProvider
 * Connects to Canon EOS 6D Mark I on macOS Apple Silicon via gphoto2.
 * Automatically kills macOS ptpcamerad to prevent USB interface lockups.
 */
export class MacGphotoProvider implements ICameraProvider {
  readonly name = 'gphoto2' as const;
  private isEvfActive = false;
  private evfProcess: ChildProcess | null = null;

  async initialize(): Promise<CameraHealth> {
    this.killMacPtpDaemons();

    try {
      const output = execSync(`${GPHOTO_BIN} --auto-detect`, {
        encoding: 'utf-8',
        timeout: 4000,
        env: EXEC_ENV,
      });
      const hasCanon = output.toLowerCase().includes('canon');

      return {
        connected: hasCanon,
        model: hasCanon ? 'Canon EOS 6D (gphoto2)' : 'gphoto2 (No Canon detected)',
        isLiveViewActive: false,
        temperatureSafe: true,
        lastError: hasCanon ? undefined : 'Kamera Canon belum terdeteksi di port USB.',
      };
    } catch (err: any) {
      return {
        connected: false,
        model: 'gphoto2 error',
        isLiveViewActive: false,
        lastError: err?.message || 'gphoto2 error or camera disconnected',
      };
    }
  }

  private killMacPtpDaemons(): void {
    try {
      execSync('killall -9 ptpcamerad PTPCamera 2>/dev/null || true', { env: EXEC_ENV });
    } catch {
      // ignore
    }
  }

  async startLiveView(onFrame: (jpegBuffer: Buffer) => void): Promise<void> {
    if (this.isEvfActive) return;
    this.killMacPtpDaemons();
    this.isEvfActive = true;

    // Use gphoto2 movie stream over stdout
    this.evfProcess = spawn(GPHOTO_BIN, ['--capture-movie', '--stdout'], {
      stdio: ['ignore', 'pipe', 'ignore'],
      env: EXEC_ENV,
    });

    let buffer = Buffer.alloc(0);
    const SOI = Buffer.from([0xff, 0xd8]);
    const EOI = Buffer.from([0xff, 0xd9]);

    this.evfProcess.stdout?.on('data', (chunk: Buffer) => {
      if (!this.isEvfActive) return;
      buffer = Buffer.concat([buffer, chunk]);

      let startIndex = buffer.indexOf(SOI);
      let endIndex = buffer.indexOf(EOI, startIndex + 2);

      while (startIndex !== -1 && endIndex !== -1) {
        const frame = buffer.subarray(startIndex, endIndex + 2);
        onFrame(frame);

        buffer = buffer.subarray(endIndex + 2);
        startIndex = buffer.indexOf(SOI);
        if (startIndex !== -1) {
          endIndex = buffer.indexOf(EOI, startIndex + 2);
        } else {
          endIndex = -1;
        }
      }

      // Safeguard buffer overflow
      if (buffer.length > 5 * 1024 * 1024) {
        buffer = Buffer.alloc(0);
      }
    });

    this.evfProcess.on('close', () => {
      this.isEvfActive = false;
    });
  }

  async stopLiveView(): Promise<void> {
    this.isEvfActive = false;
    if (this.evfProcess) {
      const proc = this.evfProcess;
      this.evfProcess = null;

      await new Promise<void>((resolve) => {
        let finished = false;
        const fallbackTimer = setTimeout(() => {
          if (!finished) {
            finished = true;
            try {
              proc.kill('SIGKILL');
            } catch {
              // ignore
            }
            resolve();
          }
        }, 1200);

        proc.once('close', () => {
          if (!finished) {
            finished = true;
            clearTimeout(fallbackTimer);
            resolve();
          }
        });

        try {
          proc.kill('SIGTERM');
        } catch {
          if (!finished) {
            finished = true;
            clearTimeout(fallbackTimer);
            resolve();
          }
        }
      });

      // Small 350ms buffer for USB controller & Canon 6D to settle
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  async capturePhoto(targetPath: string): Promise<CaptureResult> {
    const start = Date.now();
    // 1. Ensure Live View process has 100% exited and USB bus is free
    await this.stopLiveView();
    this.killMacPtpDaemons();

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    const dir = path.dirname(targetPath);
    const baseName = path.basename(targetPath);

    // 2. Capture and download with retry if USB is transiently busy
    let captured = false;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        execSync(`${GPHOTO_BIN} --capture-image-and-download --filename "${baseName}" --force-overwrite`, {
          cwd: dir,
          timeout: 12000,
          env: EXEC_ENV,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
        captured = true;
        break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`[Camera] Capture attempt ${attempt} failed: ${err.message}. Retrying...`);
        this.killMacPtpDaemons();
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    if (!captured) {
      throw lastErr || new Error('Capture failed after 2 attempts.');
    }

    // 3. Post-capture settling delay before next Live View can start
    await new Promise((r) => setTimeout(r, 400));

    return {
      filePath: targetPath,
      captureTimeMs: Date.now() - start,
    };
  }

  async getHealth(): Promise<CameraHealth> {
    return this.initialize();
  }

  async resetConnection(): Promise<void> {
    await this.stopLiveView();
    this.killMacPtpDaemons();
    try {
      execSync(`${GPHOTO_BIN} --reset 2>/dev/null || true`, { env: EXEC_ENV });
    } catch {
      // ignore
    }
  }

  async dispose(): Promise<void> {
    await this.stopLiveView();
  }
}
