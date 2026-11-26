import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { PrinterStatus } from '../../shared/types';

export class PrinterService {
  private static instance: PrinterService;
  private isPrinting = false;
  private paperRemaining = 330; // HiTi P510S standard roll capacity (330 prints)
  private rollCapacity = 330;
  private dryRun = true;
  private printerName = 'Default_Photo_Printer';
  private lastDetectTime = 0;
  private cachedHardwareConnected = false;
  private cachedPrinters: string[] = [];
  private isHiTiP510S = false;

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

  public detectHardwarePrinters(): { connected: boolean; printers: string[]; activeName: string; isHiTi: boolean } {
    const now = Date.now();
    // Cache for 3 seconds to avoid subprocess spamming
    if (now - this.lastDetectTime < 3000 && this.lastDetectTime > 0) {
      return {
        connected: this.cachedHardwareConnected,
        printers: this.cachedPrinters,
        activeName: this.printerName,
        isHiTi: this.isHiTiP510S,
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

    // Automatic Plug & Play Detection with HiTi P510S as Top Priority
    let autoMatchedHiTi = false;
    if (detected.length > 0) {
      // 1. Priority #1: Look for HiTi P510S specifically
      const hitiP510Match = detected.find((p) => /hiti.*p510|p510s/i.test(p));
      const generalHitiMatch = detected.find((p) => /hiti/i.test(p));
      const dyesubMatch = detected.find((p) => /dnp|rx1|ds620|citizen|sinfonia|selphy/i.test(p));

      if (hitiP510Match) {
        this.printerName = hitiP510Match;
        this.isHiTiP510S = true;
        this.rollCapacity = 330;
        autoMatchedHiTi = true;
      } else if (generalHitiMatch) {
        this.printerName = generalHitiMatch;
        this.isHiTiP510S = true;
        this.rollCapacity = 330;
        autoMatchedHiTi = true;
      } else if (detected.includes(this.printerName)) {
        // Operator manually selected an installed printer
        this.isHiTiP510S = /hiti.*p510|p510s/i.test(this.printerName);
      } else if (dyesubMatch) {
        this.printerName = dyesubMatch;
        this.isHiTiP510S = false;
      } else if (this.printerName === 'Default_Photo_Printer' || !this.printerName) {
        this.printerName = detected[0];
        this.isHiTiP510S = /hiti.*p510|p510s/i.test(this.printerName);
      }
    } else {
      this.isHiTiP510S = false;
    }

    return {
      connected: this.cachedHardwareConnected,
      printers: this.cachedPrinters,
      activeName: this.printerName,
      isHiTi: this.isHiTiP510S || autoMatchedHiTi,
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
        ? `${this.printerName} (Simulasi HiTi P510S)`
        : 'Tidak Ada Printer Terhubung',
      isPrinting: this.isPrinting,
      paperRemaining: this.paperRemaining,
      rollCapacity: this.rollCapacity,
      isHiTiP510S: hw.isHiTi,
      mode: this.dryRun
        ? 'dry-run'
        : process.platform === 'win32'
        ? 'windows-spooler'
        : 'cups',
      detectedPrinters: hw.printers,
      message: hw.connected
        ? hw.isHiTi
          ? `Printer HiTi P510S terhubung & siap mencetak (Auto-Detected Plug & Play)`
          : `Printer ${hw.activeName} terhubung`
        : this.dryRun
        ? 'Mode simulasi Dry-Run aktif (Profil: HiTi P510S 4x6)'
        : 'Tidak ada printer fisik terdeteksi di sistem OS (Colokkan kabel USB HiTi P510S)',
    };
  }

  public setDryRun(enabled: boolean): void {
    this.dryRun = enabled;
  }

  public setPrinterName(name: string): void {
    this.printerName = name;
    this.isHiTiP510S = /hiti.*p510|p510s/i.test(name);
  }

  public resetPaperCounter(count = 330): void {
    this.paperRemaining = count;
    this.rollCapacity = count;
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
            'Gagal mencetak: Tidak ada printer fisik yang terhubung ke kiosk. Hubungkan kabel USB HiTi P510S atau aktifkan Mode Dry-Run.',
        };
      }
    }

    this.isPrinting = true;
    console.log(`[Printer] Received print job for ${filePath} (${copies} copies, target: ${this.printerName}, mode: ${this.dryRun ? 'DRY-RUN' : 'HARDWARE'})`);

    try {
      if (this.dryRun) {
        // Simulate printer spooling delay for HiTi P510S (approx 12 seconds per 4x6 print)
        await new Promise((resolve) => setTimeout(resolve, 2000));
        this.paperRemaining = Math.max(0, this.paperRemaining - copies);
        return {
          success: true,
          message: `Simulasi cetak ${copies} lembar (HiTi P510S Profile) berhasil diselesaikan.`,
        };
      }

      // Windows Production Silent Print via Native .NET System.Drawing or SumatraPDF
      if (process.platform === 'win32') {
        const sumatraPath = path.resolve(__dirname, '../../../bin/SumatraPDF.exe');
        if (fs.existsSync(sumatraPath)) {
          for (let i = 0; i < copies; i++) {
            execSync(`"${sumatraPath}" -print-to "${this.printerName}" -print-settings "fit,paper=4x6" -silent "${filePath}"`);
          }
        } else {
          // Native Windows PowerShell C# silent print directly to the HiTi P510S driver
          const escapedPath = filePath.replace(/\\/g, '\\\\').replace(/'/g, "''");
          const escapedPrinter = this.printerName.replace(/'/g, "''");
          const psCommand = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Drawing; $p = '${escapedPrinter}'; $f = '${escapedPath}'; $doc = New-Object System.Drawing.Printing.PrintDocument; $doc.PrinterSettings.PrinterName = $p; $doc.PrinterSettings.Copies = ${copies}; $doc.DefaultPageSettings.Margins = New-Object System.Drawing.Printing.Margins(0,0,0,0); $doc.DefaultPageSettings.Landscape = $false; $img = [System.Drawing.Image]::FromFile($f); $doc.add_PrintPage({ param($s, $e) $e.Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; $e.Graphics.DrawImage($img, $e.PageBounds); }); $doc.Print(); $img.Dispose(); $doc.Dispose();"`;
          execSync(psCommand, { timeout: 20000 });
        }
      } else {
        // macOS Dev / Linux CUPS 'lp' for HiTi P510S borderless 4x6
        for (let i = 0; i < copies; i++) {
          try {
            execSync(`lp -d "${this.printerName}" -o media=4x6 -o fit-to-page -o landscape=false "${filePath}"`, { timeout: 15000 });
          } catch {
            // Gutenprint fallback option
            execSync(`lp -d "${this.printerName}" -o PageSize=w288h432 "${filePath}"`, { timeout: 15000 });
          }
        }
      }

      this.paperRemaining = Math.max(0, this.paperRemaining - copies);
      return {
        success: true,
        message: `Berhasil mencetak ${copies} lembar ke ${this.printerName}. Sisa kertas roll: ${this.paperRemaining}.`,
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
