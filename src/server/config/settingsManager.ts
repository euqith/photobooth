import fs from 'fs';
import path from 'path';
import { ServerSettings } from '../../shared/types';

const CONFIG_PATH = path.resolve(__dirname, '../../../config/settings.json');

const DEFAULT_SETTINGS: ServerSettings = {
  countdownDuration: 5,
  reviewDuration: 3,
  allowRetake: true,
  maxRetakesPerPose: 1,
  maxPrintCopies: 2,
  autoPrint: false,
  adminPin: '1234',
  printerName: 'Default_Photo_Printer',
  dryRunPrinter: true,
  cameraProvider: 'gphoto2',
  payment: {
    mode: 'paid', // default commercial self-service mode
    provider: 'sandbox', // sandbox simulator default
    environment: 'sandbox',
    sessionPrice: 35000,
    extraPrintPrice: 10000,
    qrisTimeoutSeconds: 300,
    verificationMethod: 'polling',
    pollingIntervalMs: 2500,
    midtransServerKey: '',
    midtransClientKey: '',
    midtransMerchantId: '',
    xenditApiKey: '',
    cloudRelayUrl: '',
    webhookSecret: '',
    activeVouchers: ['VIPGUEST', 'CASH01', 'PROMO2026'],
  },
};

export class SettingsManager {
  private static instance: SettingsManager;
  private settings: ServerSettings;

  private constructor() {
    this.settings = this.loadSettings();
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  private loadSettings(): ServerSettings {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          payment: {
            ...DEFAULT_SETTINGS.payment,
            ...(parsed.payment || {}),
          },
        };
      }
    } catch (err) {
      console.warn('[SettingsManager] Failed to read settings, using defaults:', err);
    }

    this.saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }

  public getSettings(): ServerSettings {
    return { ...this.settings };
  }

  public updateSettings(partial: Partial<ServerSettings>): ServerSettings {
    this.settings = {
      ...this.settings,
      ...partial,
      payment: {
        ...this.settings.payment,
        ...(partial.payment || {}),
      },
    };
    this.saveSettings(this.settings);
    return this.getSettings();
  }

  private saveSettings(data: ServerSettings): void {
    try {
      fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SettingsManager] Failed to write settings to disk:', err);
    }
  }

  public validateVoucher(code: string): boolean {
    if (!code) return false;
    const clean = code.trim().toUpperCase();
    return this.settings.payment.activeVouchers.some((v) => v.toUpperCase() === clean);
  }
}
