import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { TemplateMetadata, SlotBox } from '../../shared/types';
import templatesManifestRaw from '../../shared/templates.manifest.json';

const MANIFEST_PATH = path.resolve(__dirname, '../../shared/templates.manifest.json');
const PUBLIC_TEMPLATES_DIR = path.resolve(__dirname, '../../../public/templates');

export class TemplateInspectorService {
  private static manifest: Record<string, TemplateMetadata> = { ...templatesManifestRaw } as Record<string, TemplateMetadata>;

  public static getManifest(): Record<string, TemplateMetadata> {
    return this.manifest;
  }

  public static getAllTemplates(): TemplateMetadata[] {
    return Object.values(this.manifest);
  }

  /**
   * Process an uploaded 1333x1999 PNG image:
   * 1. Detect green Chroma-Key pixels (#00FF00) and convert to alpha = 0 (or keep transparent if already alpha)
   * 2. Detect bounding box slots via connected components scanning
   * 3. Save processed transparent PNG to public/templates/<id>.png
   * 4. Update manifest and write to disk
   */
  public static async processAndSaveTemplate(
    templateId: string,
    title: string,
    tempFilePath: string
  ): Promise<TemplateMetadata> {
    fs.mkdirSync(PUBLIC_TEMPLATES_DIR, { recursive: true });
    const targetPngPath = path.join(PUBLIC_TEMPLATES_DIR, `${templateId}.png`);

    const image = sharp(tempFilePath);
    const meta = await image.metadata();
    const width = meta.width || 1333;
    const height = meta.height || 1999;

    // Convert raw input into RGBA raw buffer
    const { data, info } = await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true });

    const totalPixels = info.width * info.height;
    const mask = new Uint8Array(totalPixels); // 1 = transparent slot, 0 = frame

    // Chroma-Key green detection: G > 120 and G - R > 40 and G - B > 40 OR already alpha == 0
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];

      if (a < 50 || (g > 120 && g - r > 40 && g - b > 40)) {
        mask[i] = 1;
        // Make pixel completely transparent
        data[idx + 3] = 0;
      }
    }

    // Save alpha transparent template PNG
    await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 4,
      },
    })
      .png({ compressionLevel: 8 })
      .toFile(targetPngPath);

    // Detect slot bounding boxes
    const detectedSlots = this.detectSlotBoxes(mask, info.width, info.height);

    const templateMeta: TemplateMetadata = {
      id: templateId,
      filename: `${templateId}.png`,
      title: title || `Template ${templateId}`,
      canvasWidth: width,
      canvasHeight: height,
      poseCount: detectedSlots.leftSlots.length || 3,
      leftSlots: detectedSlots.leftSlots,
      rightSlots: detectedSlots.rightSlots,
      allSlots: detectedSlots.allSlots,
      processedImagePath: `/templates/${templateId}.png`,
      isActive: true,
    };

    this.manifest[templateId] = templateMeta;
    this.persistManifest();

    return templateMeta;
  }

  private static detectSlotBoxes(
    mask: Uint8Array,
    width: number,
    height: number
  ): { leftSlots: SlotBox[]; rightSlots: SlotBox[]; allSlots: SlotBox[] } {
    const visited = new Uint8Array(mask.length);
    const minBlobPixels = (width * height) * 0.015; // at least 1.5% of canvas area
    const rawBoxes: { minX: number; maxX: number; minY: number; maxY: number }[] = [];

    // Simple Connected-Component Bounding-Box Scan
    for (let y = 0; y < height; y += 4) {
      for (let x = 0; x < width; x += 4) {
        const idx = y * width + x;
        if (mask[idx] === 1 && visited[idx] === 0) {
          // BFS explore blob
          let count = 0;
          let minX = x;
          let maxX = x;
          let minY = y;
          let maxY = y;

          const queue: number[] = [idx];
          visited[idx] = 1;

          while (queue.length > 0) {
            const curr = queue.pop()!;
            count++;
            const cy = Math.floor(curr / width);
            const cx = curr % width;

            if (cx < minX) minX = cx;
            if (cx > maxX) maxX = cx;
            if (cy < minY) minY = cy;
            if (cy > maxY) maxY = cy;

            // Check 4-connected neighbors with step of 4 for speed
            const neighbors = [
              cy > 3 ? (cy - 4) * width + cx : -1,
              cy < height - 4 ? (cy + 4) * width + cx : -1,
              cx > 3 ? cy * width + (cx - 4) : -1,
              cx < width - 4 ? cy * width + (cx + 4) : -1,
            ];

            for (const n of neighbors) {
              if (n !== -1 && mask[n] === 1 && visited[n] === 0) {
                visited[n] = 1;
                queue.push(n);
              }
            }
          }

          if (count > minBlobPixels / 16) {
            rawBoxes.push({ minX, maxX, minY, maxY });
          }
        }
      }
    }

    // Sort into left strip (centerX < width / 2) and right strip (centerX >= width / 2)
    const midX = width / 2;
    const leftBoxes = rawBoxes
      .filter((b) => (b.minX + b.maxX) / 2 < midX)
      .sort((a, b) => a.minY - b.minY);

    const rightBoxes = rawBoxes
      .filter((b) => (b.minX + b.maxX) / 2 >= midX)
      .sort((a, b) => a.minY - b.minY);

    // Fallback if auto-detection couldn't identify clean blobs (e.g. standard 3-pose layout)
    const count = Math.max(leftBoxes.length, 3);
    const leftSlots: SlotBox[] = [];
    const rightSlots: SlotBox[] = [];

    if (leftBoxes.length >= 2) {
      leftBoxes.forEach((b, i) => {
        leftSlots.push({
          x: b.minX,
          y: b.minY,
          width: b.maxX - b.minX,
          height: b.maxY - b.minY,
          columnIndex: 0,
          poseIndex: i,
        });
      });
      rightBoxes.forEach((b, i) => {
        rightSlots.push({
          x: b.minX,
          y: b.minY,
          width: b.maxX - b.minX,
          height: b.maxY - b.minY,
          columnIndex: 1,
          poseIndex: i,
        });
      });
    } else {
      // Default 3 standard slots fallback for 1333x1999
      const slotH = 430;
      const slotW = 576;
      for (let i = 0; i < 3; i++) {
        const yPos = 370 + i * 440;
        leftSlots.push({ x: 22, y: yPos, width: slotW, height: slotH, columnIndex: 0, poseIndex: i });
        rightSlots.push({ x: 730, y: yPos, width: slotW, height: slotH, columnIndex: 1, poseIndex: i });
      }
    }

    return {
      leftSlots,
      rightSlots,
      allSlots: [...leftSlots, ...rightSlots],
    };
  }

  public static toggleTemplateActive(templateId: string, isActive: boolean): boolean {
    if (this.manifest[templateId]) {
      this.manifest[templateId].isActive = isActive;
      this.persistManifest();
      return true;
    }
    return false;
  }

  public static deleteTemplate(templateId: string): boolean {
    if (this.manifest[templateId]) {
      delete this.manifest[templateId];
      const imgPath = path.join(PUBLIC_TEMPLATES_DIR, `${templateId}.png`);
      if (fs.existsSync(imgPath)) {
        try { fs.unlinkSync(imgPath); } catch {}
      }
      this.persistManifest();
      return true;
    }
    return false;
  }

  private static persistManifest(): void {
    try {
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify(this.manifest, null, 2), 'utf-8');
    } catch (err) {
      console.error('[TemplateInspector] Failed to write manifest:', err);
    }
  }
}
