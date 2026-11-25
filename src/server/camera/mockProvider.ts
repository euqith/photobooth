import { ICameraProvider, CameraHealth, CaptureResult } from './types';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * MockCameraProvider
 * Generates synthetic Live View JPEG frames with a moving timestamp & target reticle,
 * and generates high-res simulated portrait photos during capture.
 */
export class MockCameraProvider implements ICameraProvider {
  readonly name = 'mock' as const;
  private isEvfActive = false;
  private timer: NodeJS.Timeout | null = null;
  private frameCount = 0;

  async initialize(): Promise<CameraHealth> {
    return {
      connected: true,
      model: 'Simulated Canon EOS 6D (Mock Provider)',
      isLiveViewActive: false,
      batteryLevel: '100% (AC Dummy Battery)',
      temperatureSafe: true,
    };
  }

  async startLiveView(onFrame: (jpegBuffer: Buffer) => void): Promise<void> {
    if (this.isEvfActive) return;
    this.isEvfActive = true;

    // Stream 25 FPS synthetic live view frames
    this.timer = setInterval(async () => {
      if (!this.isEvfActive) return;
      this.frameCount++;
      const timeStr = new Date().toLocaleTimeString();

      // Render a simple SVG overlay to JPEG buffer
      const svg = `
        <svg width="640" height="426" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stop-color="#2D3748" />
              <stop offset="100%" stop-color="#1A202C" />
            </radialGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#bg)" />
          
          <!-- Silhouette & Pose Guide -->
          <circle cx="320" cy="160" r="70" fill="#4A5568" opacity="0.8" />
          <path d="M 220 380 C 220 260, 420 260, 420 380 Z" fill="#4A5568" opacity="0.8" />
          
          <!-- Focus Reticle -->
          <circle cx="320" cy="200" r="30" stroke="#00E5FF" stroke-width="2" fill="none" opacity="0.7" />
          <line x1="320" y1="160" x2="320" y2="185" stroke="#00E5FF" stroke-width="2" />
          <line x1="320" y1="215" x2="320" y2="240" stroke="#00E5FF" stroke-width="2" />
          <line x1="280" y1="200" x2="305" y2="200" stroke="#00E5FF" stroke-width="2" />
          <line x1="335" y1="200" x2="360" y2="200" stroke="#00E5FF" stroke-width="2" />

          <!-- Camera HUD -->
          <rect x="20" y="20" width="120" height="28" rx="6" fill="#000" opacity="0.6" />
          <text x="30" y="39" fill="#00FF66" font-family="monospace" font-size="14" font-weight="bold">● LIVE 25FPS</text>
          
          <rect x="500" y="20" width="120" height="28" rx="6" fill="#000" opacity="0.6" />
          <text x="510" y="39" fill="#FFB800" font-family="monospace" font-size="14">${timeStr}</text>
          
          <text x="320" y="405" text-anchor="middle" fill="#A0AEC0" font-family="sans-serif" font-size="14">
            Canon EOS 6D Tethered (Mock Live View)
          </text>
        </svg>
      `;

      try {
        const frameBuffer = await sharp(Buffer.from(svg))
          .jpeg({ quality: 75 })
          .toBuffer();
        onFrame(frameBuffer);
      } catch (err) {
        // ignore frame errors in mock
      }
    }, 40);
  }

  async stopLiveView(): Promise<void> {
    this.isEvfActive = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async capturePhoto(targetPath: string): Promise<CaptureResult> {
    const start = Date.now();
    // Simulate shutter delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Ensure output directory
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });

    // Generate high-resolution simulated portrait (1800 x 2700 px)
    const seedColor = ['#3182CE', '#D69E2E', '#E53E3E', '#805AD5', '#38A169'][
      Math.floor(Math.random() * 5)
    ];

    const svgPortrait = `
      <svg width="1800" height="2700" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="pbg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1A202C" />
            <stop offset="50%" stop-color="${seedColor}" />
            <stop offset="100%" stop-color="#2D3748" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#pbg)" />
        
        <!-- Stylized Portrait Subject -->
        <circle cx="900" cy="950" r="350" fill="#ED8936" />
        <circle cx="780" cy="900" r="40" fill="#2D3748" />
        <circle cx="1020" cy="900" r="40" fill="#2D3748" />
        <path d="M 750 1100 Q 900 1250 1050 1100" stroke="#2D3748" stroke-width="30" stroke-linecap="round" fill="none" />
        <path d="M 450 2700 C 450 1700, 1350 1700, 1350 2700 Z" fill="#4A5568" />
        
        <!-- Watermark / Info -->
        <text x="900" y="2550" text-anchor="middle" fill="#FFFFFF" font-family="sans-serif" font-size="52" font-weight="bold">
          PHOTOBOOTH HIGH-RES CAPTURE
        </text>
        <text x="900" y="2620" text-anchor="middle" fill="#CBD5E0" font-family="monospace" font-size="34">
          Canon EOS 6D • ISO 400 • f/4.0 • 1/125s • ${new Date().toISOString()}
        </text>
      </svg>
    `;

    await sharp(Buffer.from(svgPortrait))
      .jpeg({ quality: 95 })
      .toFile(targetPath);

    return {
      filePath: targetPath,
      width: 1800,
      height: 2700,
      captureTimeMs: Date.now() - start,
    };
  }

  async getHealth(): Promise<CameraHealth> {
    return {
      connected: true,
      model: 'Simulated Canon EOS 6D (Mock Provider)',
      isLiveViewActive: this.isEvfActive,
      batteryLevel: '100%',
      temperatureSafe: true,
    };
  }

  async resetConnection(): Promise<void> {
    await this.stopLiveView();
  }

  async dispose(): Promise<void> {
    await this.stopLiveView();
  }
}
