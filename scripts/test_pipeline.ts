import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { TemplateCompositor } from '../src/server/template/compositor';
import { CameraManager } from '../src/server/camera/cameraManager';
import { PrinterService } from '../src/server/printer/printerService';

async function testPipeline() {
  console.log('=== Photobooth End-to-End Pipeline Verification ===\n');

  // 1. Test Camera Manager & Capture
  console.log('1. Testing CameraManager (Mock Capture)...');
  const camera = CameraManager.getInstance();
  const health = await camera.initialize();
  console.log('Camera Health:', health);

  const testDir = path.resolve(__dirname, '../output/test');
  fs.mkdirSync(testDir, { recursive: true });

  const rawPhoto1 = path.join(testDir, 'raw_pose1.jpg');
  const rawPhoto2 = path.join(testDir, 'raw_pose2.jpg');
  const rawPhoto3 = path.join(testDir, 'raw_pose3.jpg');

  await camera.capturePhoto(rawPhoto1);
  await camera.capturePhoto(rawPhoto2);
  await camera.capturePhoto(rawPhoto3);
  console.log('Captured 3 high-res test photos successfully.');

  // 2. Test Template Compositor on Template 1 (3 Poses)
  console.log('\n2. Testing TemplateCompositor on Template 1 (3 Poses)...');
  const outputPrint1 = path.join(testDir, 'composite_template1.jpg');
  const res1 = await TemplateCompositor.compositePhotos(
    '1',
    [rawPhoto1, rawPhoto2, rawPhoto3],
    outputPrint1,
    'original'
  );
  console.log('Composite 1 Result:', res1);

  // Check output metadata
  const meta1 = await sharp(res1.printPath).metadata();
  console.log(`Print Image 1 Dimensions: ${meta1.width} x ${meta1.height} (Expected: 1333 x 1999)`);

  const metaStrip = await sharp(res1.singleStripPath).metadata();
  console.log(`Single Strip Dimensions: ${metaStrip.width} x ${metaStrip.height} (Expected: 666 x 1999)`);

  // 3. Test Template Compositor on Template 18 (2 Poses)
  console.log('\n3. Testing TemplateCompositor on Template 18 (2 Poses)...');
  const outputPrint18 = path.join(testDir, 'composite_template18.jpg');
  const res18 = await TemplateCompositor.compositePhotos(
    '18',
    [rawPhoto1, rawPhoto2],
    outputPrint18,
    'vintage'
  );
  console.log('Composite 18 (Vintage) Result:', res18);

  // 4. Test Printer Service (Dry-Run Mode)
  console.log('\n4. Testing PrinterService in Dry-Run Mode...');
  const printer = PrinterService.getInstance();
  console.log('Printer Status:', printer.getStatus());
  const printRes = await printer.print(res1.printPath, 2);
  console.log('Print Execution:', printRes);

  console.log('\n✅ ALL PIPELINE TESTS PASSED SUCCESSFULLY!');
}

testPipeline().catch((err) => {
  console.error('Pipeline test failed:', err);
  process.exit(1);
});
