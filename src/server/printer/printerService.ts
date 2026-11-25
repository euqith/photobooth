import { execFile, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrinterStatus } from '../../shared/types';

export class PrinterService {
  private static instance: PrinterService;
  private isPrinting = false;
  private paperRemaining = 300; // default roll counter
  private dryRun = true;
  private printerName = 'Default_Photo_Printer';

  private constructor() {
    this.dryRun = process.env.PRINTER_DRY_RUN !== 'false';
    this.printerName = process.env.PRINTER_NAME || 'Default_Photo_Printer';
  }

  public static getInstance(): PrinterService {
    if (!PrinterService.instance) {
      PrinterService.instance = new PrinterService();
    }
    return PrinterService.instance;
  }

  public getStatus(): PrinterStatus {
    return {
      connected: true,
      name: this.printerName,
      isPrinting: this.isPrinting,
      paperRemaining: this.paperRemaining,
      mode: this.dryRun
        ? 'dry-run'
        : process.platform === 'win32'
        ? 'windows-spooler'
        : 'cups',
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

    this.isPrinting = true;
    console.log(`[Printer] Received print job for ${filePath} (${copies} copies, mode: ${this.dryRun ? 'DRY-RUN' : 'HARDWARE'})`);

    try {
      if (this.dryRun) {
        // Simulate printer spooling delay
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.paperRemaining = Math.max(0, this.paperRemaining - copies);
        return {
          success: true,
          message: `Simulated print of ${copies} copies completed successfully (Dry-Run Mode).`,
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
        message: `Printed ${copies} copies to ${this.printerName}.`,
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
