import { ICameraProvider, CameraHealth, CaptureResult } from './types';
import { spawn, execSync, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

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
      const output = execSync('gphoto2 --auto-detect', { encoding: 'utf-8', timeout: 4000 });
      const hasCanon = output.toLowerCase().includes('canon');

      return {
        connected: hasCanon,
        model: hasCanon ? 'Canon EOS 6D (gphoto2)' : 'gphoto2 (No Canon detected)',
        isLiveViewActive: false,
        temperatureSafe: true,
      };
    } catch (err: any) {
      return {
        connected: false,
        model: 'gphoto2 error',
        isLiveViewActive: false,
        lastError: err?.message || 'gphoto2 not found or camera disconnected',
      };
    }
  }

  private killMacPtpDaemons(): void {
    try {
      execSync('killall -9 ptpcamerad PTPCamera 2>/dev/null || true');
    } catch {
      // ignore
    }
  }

  async startLiveView(onFrame: (jpegBuffer: Buffer) => void): Promise<void> {
    if (this.isEvfActive) return;
    this.killMacPtpDaemons();
    this.isEvfActive = true;

    // Use gphoto2 movie stream over stdout
    this.evfProcess = spawn('gphoto2', ['--capture-movie', '--stdout'], {
      stdio: ['ignore', 'pipe', 'ignore'],
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
      try {
        this.evfProcess.kill('SIGTERM');
      } catch {
        // ignore
      }
      this.evfProcess = null;
    }
  }

  async capturePhoto(targetPath: string): Promise<CaptureResult> {
    const start = Date.now();
    // Live View MUST be paused/stopped before shutter release on Canon 6D to prevent USB lock
    await this.stopLiveView();
    this.killMacPtpDaemons();

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    const dir = path.dirname(targetPath);
    const baseName = path.basename(targetPath);

    // Capture and download
    execSync(`gphoto2 --capture-image-and-download --filename "${baseName}" --force-overwrite`, {
      cwd: dir,
      timeout: 10000,
    });

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
      execSync('gphoto2 --reset 2>/dev/null || true');
    } catch {
      // ignore
    }
  }

  async dispose(): Promise<void> {
    await this.stopLiveView();
  }
}
