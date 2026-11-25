import { ICameraProvider, CameraHealth, CaptureResult } from './types';
import { spawn, execFile, ChildProcess } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

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
 * Uses non-blocking async execFile so Socket.io and UI clicks are NEVER frozen.
 */
export class MacGphotoProvider implements ICameraProvider {
  readonly name = 'gphoto2' as const;
  private isEvfActive = false;
  private evfProcess: ChildProcess | null = null;
  private isDroppingMirror = false;

  async initialize(): Promise<CameraHealth> {
    await this.killMacPtpDaemons();

    try {
      const { stdout } = await execFileAsync(GPHOTO_BIN, ['--auto-detect'], {
        timeout: 4000,
        env: EXEC_ENV,
      });
      const hasCanon = stdout.toLowerCase().includes('canon');

      return {
        connected: hasCanon,
        model: hasCanon ? 'Canon EOS 6D (gphoto2)' : 'gphoto2 (No Canon detected)',
        isLiveViewActive: this.isEvfActive,
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

  private async killMacPtpDaemons(): Promise<void> {
    try {
      await execFileAsync('killall', ['-9', 'ptpcamerad', 'PTPCamera'], {
        timeout: 1500,
        env: EXEC_ENV,
      });
    } catch {
      // ignore when processes are not running
    }
  }

  async startLiveView(onFrame: (jpegBuffer: Buffer) => void): Promise<void> {
    if (this.isEvfActive) return;
    await this.killMacPtpDaemons();
    this.isEvfActive = true;

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

      if (buffer.length > 5 * 1024 * 1024) {
        buffer = Buffer.alloc(0);
      }
    });

    this.evfProcess.on('close', () => {
      this.isEvfActive = false;
    });
  }

  private async turnOffCameraEvf(): Promise<void> {
    if (this.isDroppingMirror) return;
    this.isDroppingMirror = true;
    try {
      await this.killMacPtpDaemons();
      await execFileAsync(
        GPHOTO_BIN,
        ['--set-config', '/main/actions/viewfinder=0', '--set-config', '/main/settings/output=Off'],
        {
          timeout: 5000,
          env: EXEC_ENV,
        }
      );
    } catch {
      // ignore if camera is disconnected or busy
    } finally {
      this.isDroppingMirror = false;
    }
  }

  async stopLiveView(dropMirror = true): Promise<void> {
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

      await new Promise((r) => setTimeout(r, 350));
    }

    // Explicitly turn off Canon EVF / drop mirror asynchronously without freezing UI
    if (dropMirror) {
      await this.turnOffCameraEvf();
    }
  }

  async capturePhoto(targetPath: string): Promise<CaptureResult> {
    const start = Date.now();
    await this.stopLiveView(false);
    await this.killMacPtpDaemons();

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    const dir = path.dirname(targetPath);
    const baseName = path.basename(targetPath);

    let captured = false;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await execFileAsync(
          GPHOTO_BIN,
          ['--capture-image-and-download', '--filename', baseName, '--force-overwrite'],
          {
            cwd: dir,
            timeout: 12000,
            env: EXEC_ENV,
          }
        );
        captured = true;
        break;
      } catch (err: any) {
        lastErr = err;
        console.warn(`[Camera] Capture attempt ${attempt} failed: ${err.message}. Retrying...`);
        await this.killMacPtpDaemons();
        await new Promise((r) => setTimeout(r, 600));
      }
    }

    if (!captured) {
      throw lastErr || new Error('Capture failed after 2 attempts.');
    }

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
    await this.stopLiveView(true);
    await this.killMacPtpDaemons();
    try {
      await execFileAsync(GPHOTO_BIN, ['--reset'], { timeout: 4000, env: EXEC_ENV });
    } catch {
      // ignore
    }
  }

  async dispose(): Promise<void> {
    await this.stopLiveView(true);
  }
}
