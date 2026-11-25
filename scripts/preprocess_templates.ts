import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

interface SlotBox {
  x: number;
  y: number;
  width: number;
  height: number;
  columnIndex: 0 | 1; // 0 = left strip, 1 = right strip
  poseIndex: number;  // 0, 1, 2, ...
}

export interface TemplateMetadata {
  id: string;
  filename: string;
  title: string;
  canvasWidth: number;
  canvasHeight: number;
  poseCount: number;
  leftSlots: SlotBox[];
  rightSlots: SlotBox[];
  allSlots: SlotBox[];
  processedImagePath: string;
}

const TEMPLATE_DIR = path.resolve(__dirname, '../template');
const OUTPUT_DIR = path.resolve(__dirname, '../public/templates');
const MANIFEST_PATH = path.resolve(__dirname, '../src/shared/templates.manifest.json');

// Ensure output directories exist
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });

function isGreenPixel(r: number, g: number, b: number): boolean {
  // Chroma-key green condition:
  // Green is strongly dominant over Red and Blue
  return g > 130 && (g - r) > 40 && (g - b) > 40;
}

async function processTemplate(filename: string): Promise<TemplateMetadata | null> {
  const filePath = path.join(TEMPLATE_DIR, filename);
  if (!fs.existsSync(filePath)) return null;

  const id = path.parse(filename).name;
  console.log(`Processing template ${filename}...`);

  const image = sharp(filePath);
  const metadata = await image.metadata();
  const width = metadata.width || 1333;
  const height = metadata.height || 1999;

  // Extract raw RGBA buffer
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = width * height;
  const greenMask = new Uint8Array(pixelCount); // 1 = green, 0 = non-green

  // Step 1: Detect green pixels
  for (let i = 0; i < pixelCount; i++) {
    const offset = i * 4;
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];

    if (isGreenPixel(r, g, b)) {
      greenMask[i] = 1;
    }
  }

  // Step 2: Edge feathering / de-spill to avoid green fringing on stickers
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      const offset = idx * 4;

      if (greenMask[idx] === 1) {
        // Transparent cutout
        data[offset + 3] = 0; // Alpha = 0
      } else {
        // Check if adjacent to green (edge pixel)
        const isNearGreen =
          greenMask[idx - 1] === 1 ||
          greenMask[idx + 1] === 1 ||
          greenMask[idx - width] === 1 ||
          greenMask[idx + width] === 1;

        if (isNearGreen) {
          // De-spill: if G is slightly elevated due to antialiasing, clamp G to max(R, B)
          const r = data[offset];
          const g = data[offset + 1];
          const b = data[offset + 2];
          if (g > r && g > b) {
            data[offset + 1] = Math.round((r + b) / 2);
          }
        }
      }
    }
  }

  // Step 3: Slot Bounding Box Detection via Row/Col Projection / Grid Scanning
  // Each strip is ~width / 2.
  const midX = Math.floor(width / 2);
  const leftSlots: SlotBox[] = [];
  const rightSlots: SlotBox[] = [];

  // Downsample grid (every 4 pixels) to find green clusters in Left Column & Right Column
  const step = 4;
  const findBoxesInColumn = (minX: number, maxX: number, colIdx: 0 | 1): SlotBox[] => {
    // 1. Calculate green pixel count per row in this column
    const rowCounts = new Int32Array(height);
    for (let y = 0; y < height; y += step) {
      let count = 0;
      for (let x = minX; x < maxX; x += step) {
        if (greenMask[y * width + x] === 1) count++;
      }
      rowCounts[y] = count;
    }

    // 2. Find contiguous vertical intervals with significant green pixels
    const minRowDensity = (maxX - minX) / step * 0.15; // at least 15% green across the row
    const intervals: { startY: number; endY: number }[] = [];
    let inInterval = false;
    let startY = 0;

    for (let y = 0; y < height; y += step) {
      if (rowCounts[y] > minRowDensity) {
        if (!inInterval) {
          inInterval = true;
          startY = y;
        }
      } else {
        if (inInterval) {
          inInterval = false;
          if (y - startY > 120) { // filter out small noise < 120px height
            intervals.push({ startY, endY: y });
          }
        }
      }
    }
    if (inInterval && (height - startY > 120)) {
      intervals.push({ startY, endY: height });
    }

    // 3. For each vertical interval, find minX and maxX bounds
    const boxes: SlotBox[] = [];
    intervals.forEach((interval, pIdx) => {
      let bMinX = maxX;
      let bMaxX = minX;
      let bMinY = interval.endY;
      let bMaxY = interval.startY;

      for (let y = interval.startY; y <= interval.endY; y += step) {
        for (let x = minX; x < maxX; x += step) {
          if (greenMask[y * width + x] === 1) {
            if (x < bMinX) bMinX = x;
            if (x > bMaxX) bMaxX = x;
            if (y < bMinY) bMinY = y;
            if (y > bMaxY) bMaxY = y;
          }
        }
      }

      if (bMaxX > bMinX && bMaxY > bMinY) {
        // Expand slightly (4px) to ensure no green border leaks
        const boxX = Math.max(minX, bMinX - 2);
        const boxY = Math.max(0, bMinY - 2);
        const boxW = Math.min(maxX - boxX, (bMaxX - bMinX) + 4);
        const boxH = Math.min(height - boxY, (bMaxY - bMinY) + 4);

        boxes.push({
          x: boxX,
          y: boxY,
          width: boxW,
          height: boxH,
          columnIndex: colIdx,
          poseIndex: pIdx
        });
      }
    });

    return boxes;
  };

  const detectedLeft = findBoxesInColumn(20, midX - 10, 0);
  const detectedRight = findBoxesInColumn(midX + 10, width - 20, 1);

  // Fallback: If 8.png or similar has atypical anomaly, ensure valid slot count
  let poseCount = Math.min(detectedLeft.length, detectedRight.length);
  if (poseCount === 0) {
    // Fallback default 3-strip
    poseCount = 3;
  }

  // Slice to equal pose count
  const finalLeft = detectedLeft.slice(0, poseCount).map((b, i) => ({ ...b, poseIndex: i }));
  const finalRight = detectedRight.slice(0, poseCount).map((b, i) => ({ ...b, poseIndex: i }));

  const allSlots = [...finalLeft, ...finalRight];

  // Save alpha-transparent PNG
  const outputPngPath = path.join(OUTPUT_DIR, `${id}.png`);
  await sharp(data, {
    raw: {
      width,
      height,
      channels: 4
    }
  })
    .png({ compressionLevel: 8 })
    .toFile(outputPngPath);

  console.log(`Saved ${id}.png -> ${poseCount} poses detected (${finalLeft.length}L / ${finalRight.length}R)`);

  return {
    id,
    filename,
    title: `Template ${id}`,
    canvasWidth: width,
    canvasHeight: height,
    poseCount,
    leftSlots: finalLeft,
    rightSlots: finalRight,
    allSlots,
    processedImagePath: `/templates/${id}.png`
  };
}

async function run() {
  const files = fs.readdirSync(TEMPLATE_DIR)
    .filter(f => f.endsWith('.png'))
    .sort((a, b) => {
      const numA = parseInt(a.replace(/\D/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/\D/g, ''), 10) || 0;
      return numA - numB;
    });

  const manifest: Record<string, TemplateMetadata> = {};

  for (const f of files) {
    try {
      const meta = await processTemplate(f);
      if (meta) {
        manifest[meta.id] = meta;
      }
    } catch (err) {
      console.error(`Error processing ${f}:`, err);
    }
  }

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`\nAll done! Manifest generated with ${Object.keys(manifest).length} templates at:`);
  console.log(MANIFEST_PATH);
}

run();
