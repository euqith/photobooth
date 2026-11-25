import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { TemplateMetadata, ColorFilter } from '../../shared/types';
import templatesManifestRaw from '../../shared/templates.manifest.json';

const templatesManifest = templatesManifestRaw as Record<string, TemplateMetadata>;

export interface CompositeResult {
  printPath: string;        // 1333 x 1999 full 4R 2-up strip
  singleStripPath: string;  // 666 x 1999 single strip for digital sharing
  thumbnailPath: string;    // preview thumbnail
}

export class TemplateCompositor {
  private static templatesDir = path.resolve(__dirname, '../../../public/templates');

  public static getTemplate(templateId: string): TemplateMetadata | null {
    return templatesManifest[templateId] || null;
  }

  public static getAllTemplates(): TemplateMetadata[] {
    return Object.values(templatesManifest);
  }

  public static async compositePhotos(
    templateId: string,
    photoPaths: string[],
    outputPath: string,
    filter: ColorFilter = 'original'
  ): Promise<CompositeResult> {
    const template = templatesManifest[templateId];
    if (!template) {
      throw new Error(`Template with id '${templateId}' not found in manifest.`);
    }

    const templateImagePath = path.join(this.templatesDir, `${templateId}.png`);
    if (!fs.existsSync(templateImagePath)) {
      throw new Error(`Pre-processed template image '${templateImagePath}' does not exist.`);
    }

    const { canvasWidth, canvasHeight, allSlots } = template;

    // Step 1: Pre-process each photo (apply color filter)
    const processedPhotos = await Promise.all(
      photoPaths.map(async (p) => {
        let pipeline = sharp(p).rotate(); // auto-orient

        if (filter === 'bw') {
          pipeline = pipeline.grayscale();
        } else if (filter === 'vintage') {
          // Warm sepia/vintage matrix
          pipeline = pipeline
            .modulate({ saturation: 0.85, brightness: 1.05 })
            .tint({ r: 240, g: 220, b: 200 });
        } else if (filter === 'bright') {
          // High-key bright & crisp
          pipeline = pipeline
            .modulate({ saturation: 1.15, brightness: 1.1 })
            .sharpen();
        }

        return pipeline.toBuffer();
      })
    );

    // Step 2: Prepare composite layers for bottom layer (slots)
    const compositeOps: sharp.OverlayOptions[] = [];

    for (const slot of allSlots) {
      const photoBuffer = processedPhotos[slot.poseIndex];
      if (!photoBuffer) continue;

      // Crop photo with 'cover' into exact slot width & height
      const croppedBuffer = await sharp(photoBuffer)
        .resize(slot.width, slot.height, {
          fit: 'cover',
          position: 'center',
        })
        .toBuffer();

      compositeOps.push({
        input: croppedBuffer,
        left: slot.x,
        top: slot.y,
      });
    }

    // Step 3: Layer transparent template PNG on TOP of the cropped photos
    // This guarantees non-rectangular frames, oval masks, and stickers overlap user photos cleanly!
    compositeOps.push({
      input: templateImagePath,
      left: 0,
      top: 0,
    });

    // Step 4: Create full 1333x1999 4R print canvas
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });

    await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite(compositeOps)
      .jpeg({ quality: 96, chromaSubsampling: '4:4:4' })
      .toFile(outputPath);

    // Step 5: Generate single-strip cut (666 x 1999) for digital sharing
    const singleStripPath = outputPath.replace(/\.jpe?g$/i, '_strip.jpg');
    const halfWidth = Math.floor(canvasWidth / 2);

    await sharp(outputPath)
      .extract({ left: 0, top: 0, width: halfWidth, height: canvasHeight })
      .jpeg({ quality: 92 })
      .toFile(singleStripPath);

    // Step 6: Generate quick thumbnail for UI display
    const thumbnailPath = outputPath.replace(/\.jpe?g$/i, '_thumb.jpg');
    await sharp(outputPath)
      .resize(400)
      .jpeg({ quality: 80 })
      .toFile(thumbnailPath);

    return {
      printPath: outputPath,
      singleStripPath,
      thumbnailPath,
    };
  }
}
