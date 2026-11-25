import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export interface BoomerangResult {
  mp4Path: string;
  gifPath: string;
}

export class BoomerangService {
  /**
   * Generates a forward+reverse looping MP4 and animated GIF from captured session poses
   */
  public static async generateBoomerang(
    photoPaths: string[],
    outputDir: string,
    width = 720,
    height = 1080
  ): Promise<BoomerangResult> {
    if (!photoPaths || photoPaths.length === 0) {
      throw new Error('No photos provided for boomerang generation.');
    }

    fs.mkdirSync(outputDir, { recursive: true });
    const tempFramesDir = path.join(outputDir, '_temp_boomerang');
    fs.mkdirSync(tempFramesDir, { recursive: true });

    // Step 1: Normalize all photos to standard size (e.g. 720x1080)
    const normalizedFrames: string[] = [];
    for (let i = 0; i < photoPaths.length; i++) {
      const targetFrame = path.join(tempFramesDir, `norm_${i}.jpg`);
      await sharp(photoPaths[i])
        .rotate()
        .resize(width, height, { fit: 'cover', position: 'center' })
        .jpeg({ quality: 90 })
        .toFile(targetFrame);
      normalizedFrames.push(targetFrame);
    }

    // Step 2: Create a ping-pong sequence: 0, 1, 2, ... N-1, N-2, ... 1
    // Loop it 3 times for a pleasant 3-4 second animation
    const sequence: string[] = [];
    const forward = [...normalizedFrames];
    const reverse = [...normalizedFrames].reverse().slice(1, -1);
    const loopCycle = [...forward, ...reverse];

    const REPEATS = 3;
    for (let r = 0; r < REPEATS; r++) {
      sequence.push(...loopCycle);
    }

    // Write sequenced frames as frame_%03d.jpg
    for (let idx = 0; idx < sequence.length; idx++) {
      const seqPath = path.join(tempFramesDir, `frame_${String(idx).padStart(3, '0')}.jpg`);
      fs.copyFileSync(sequence[idx], seqPath);
    }

    const mp4Path = path.join(outputDir, 'boomerang.mp4');
    const gifPath = path.join(outputDir, 'boomerang.gif');

    // Step 3: Render MP4 via FFmpeg (H.264, 4 frames per second)
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(path.join(tempFramesDir, 'frame_%03d.jpg'))
        .inputFPS(3.5)
        .outputOptions([
          '-c:v libx264',
          '-pix_fmt yuv420p',
          '-preset fast',
          '-movflags +faststart',
        ])
        .output(mp4Path)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    // Step 4: Render GIF via FFmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(path.join(tempFramesDir, 'frame_%03d.jpg'))
        .inputFPS(3.5)
        .outputOptions([
          '-vf scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse',
        ])
        .output(gifPath)
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    // Clean up temporary frame folder
    try {
      fs.rmSync(tempFramesDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup error
    }

    return {
      mp4Path,
      gifPath,
    };
  }
}
