import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrinterStatus } from '../../shared/types';

export class PrinterService {
  private static instance: PrinterService;
  private isPrinting = false;
  private paperRemaining = 300; // default roll counter
  private dryRun = true;
  private printerName = 'Default_Photo_Printer';
  private lastDetectTime = 0;
  private cachedHardwareConnected = false;
  private cachedPrinters: string[] = [];

  private constructor() {
    this.dryRun = process.env.PRINTER_DRY_RUN !== 'false';
    this.printerName = process.env.PRINTER_NAME || 'Default_Photo_Printer';
    this.detectHardwarePrinters();
  }

  public static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  public detectHardwarePrinters(): { connected: boolean; printers: string[]; activeName: string } {
    const now = Date.now();
    // Cache for 3 seconds to avoid subprocess spamming
    if (now - this.lastDetectTime < 3000 && this.lastDetectTime > 0) {
      return {
        connected: this.cachedHardwareConnected,
        printers: this.cachedPrinters,
        activeName: this.printerName,
      };
    }

    this.lastDetectTime = now;
    const detected: string[] = [];

    try {
      if (process.platform === 'darwin') {
        try {
          const out = execSync('lpstat -e 2>/dev/null', { timeout: 2000 }).toString();
          const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
          detected.push(...lines);
        } catch {
          // Fallback to system_profiler
          try {
            const profilerOut = execSync('system_profiler SPPrintersDataType 2>/dev/null', { timeout: 2500 }).toString();
            if (!profilerOut.includes('The printers list is empty')) {
              const matches = profilerOut.match(/^ {4}([A-Za-z0-9_.-]+):$/gm);
              if (matches) {
                detected.push(...matches.map((m) => m.trim().replace(':', '')));
              }
            }
          } catch {}
        }
      } else if (process.platform === 'win32') {
        try {
          const out = execSync(
            'powershell -NoProfile -Command "Get-CimInstance Win32_Printer | Select-Object -ExpandProperty Name"',
            { timeout: 3000 }
          ).toString();
          const lines = out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
          detected.push(...lines);
        } catch {}
      } else {
        try {
          const out = execSync('lpstat -e 2>/dev/null', { timeout: 2000 }).toString();
          const lines = out.split('\n').map((l) => l.trim()).filter(Boolean);
          detected.push(...lines);
        } catch {}
      }
    } catch {}

    this.cachedPrinters = detected;
    this.cachedHardwareConnected = detected.length > 0;

    if (detected.length > 0) {
      if (detected.includes(this.printerName)) {
        // Keeps selected printerName
      } else if (this.printerName === 'Default_Photo_Printer' || !this.printerName) {
        this.printerName = detected[0];
      }
    }

    return {
      connected: this.cachedHardwareConnected,
      printers: this.cachedPrinters,
      activeName: this.printerName,
    };
  }

  public getStatus(): PrinterStatus {
    const hw = this.detectHardwarePrinters();
    const isActuallyConnected = this.dryRun ? true : hw.connected;

    return {
      connected: isActuallyConnected,
      hardwareConnected: hw.connected,
      name: hw.connected
        ? hw.activeName
        : this.dryRun
        ? `${this.printerName} (Simulasi)`
        : 'Tidak Ada Printer Terhubung',
      isPrinting: this.isPrinting,
      paperRemaining: this.paperRemaining,
      mode: this.dryRun
        ? 'dry-run'
        : process.platform === 'win32'
        ? 'windows-spooler'
        : 'cups',
      detectedPrinters: hw.printers,
      message: hw.connected
        ? `Printer ${hw.activeName} terhubung`
        : this.dryRun
        ? 'Mode simulasi Dry-Run aktif (tanpa printer fisik)'
        : 'Tidak ada printer fisik terdeteksi di sistem OS',
    };
  }

  public setDryRun(enabled: boolean): void {
    this.dryRun = enabled;
  }

  public setPrinterName(name: string): void {
    this.printerName = name;
  }

  public resetPaperCounter(count = 700): void {
    this.paperRemaining = count;
  }

  public async print(filePath: string, copies = 1): Promise<{ success: boolean; message: string }> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File to print does not exist: ${filePath}`);
    }

    if (this.isPrinting) {
      throw new Error('Printer is currently busy with another print job.');
    }

    if (!this.dryRun) {
      const hw = this.detectHardwarePrinters();
      if (!hw.connected) {
        return {
          success: false,
          message:
            'Gagal mencetak: Tidak ada printer fisik yang terhubung ke kiosk. Pastikan kabel printer USB terhubung atau aktifkan Mode Dry-Run.',
        };
      }
    }

    this.isPrinting = true;
    console.log(`[Printer] Received print job for ${filePath} (${copies} copies, mode: ${this.dryRun ? 'DRY-RUN' : 'HARDWARE'})`);

    try {
      if (this.dryRun) {
        // Simulate printer spooling delay
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.paperRemaining = Math.max(0, this.paperRemaining - copies);
        return {
          success: true,
          message: `Simulasi cetak ${copies} lembar berhasil diselesaikan (Mode Dry-Run).`,
        };
      }

      // Windows Production Silent Print via SumatraPDF or native spooler
      if (process.platform === 'win32') {
        const sumatraPath = path.resolve(__dirname, '../../../bin/SumatraPDF.exe');
        if (fs.existsSync(sumatraPath)) {
          for (let i = 0; i < copies; i++) {
            execSync(`"${sumatraPath}" -print-to "${this.printerName}" -silent "${filePath}"`);
          }
        } else {
          // Fallback to powershell print
          for (let i = 0; i < copies; i++) {
            execSync(`powershell -Command "Start-Process -FilePath '${filePath}' -Verb Print -PassThru | Out-Null"`);
          }
        }
      } else {
        // macOS Dev / Linux CUPS 'lp'
        for (let i = 0; i < copies; i++) {
          execSync(`lp -d "${this.printerName}" -o media=4x6 -o fit-to-page "${filePath}"`);
        }
      }

      this.paperRemaining = Math.max(0, this.paperRemaining - copies);
      return {
        success: true,
        message: `Berhasil mencetak ${copies} lembar ke ${this.printerName}.`,
      };
    } catch (err: any) {
      console.error('[Printer] Print job failed:', err);
      return {
        success: false,
        message: err?.message || 'Print job failed.',
      };
    } finally {
      this.isPrinting = false;
    }
  }
}
