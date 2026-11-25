import ffmpegPath from 'ffmpeg-static';
import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_OUTPUT_BYTES = 8 * 1024 * 1024;
const MAX_INPUT_BYTES = 200 * 1024 * 1024;
const MAX_CLIP_SECONDS = 30;
const TRANSCODE_TIMEOUT_MS = 180_000;

export async function transcodeVideoToMp4(input, startSeconds, endSeconds) {
  if (!ffmpegPath) throw new Error('FFmpeg runtime is not installed for this platform.');
  const inputSize = Buffer.isBuffer(input) || input instanceof Uint8Array ? input.byteLength : Number(input?.size);
  if (!Number.isFinite(inputSize) || inputSize < 1 || inputSize > MAX_INPUT_BYTES) throw new Error('Input video must be between 1 byte and 200 MiB.');
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds) ||
      startSeconds < 0 || endSeconds <= startSeconds || endSeconds - startSeconds > MAX_CLIP_SECONDS) {
    throw new Error('Clip range must be positive and no longer than 30 seconds.');
  }

  const workDir = await mkdtemp(join(tmpdir(), 'bankresaneh-video-'));
  const inputPath = join(workDir, 'source-video');
  const outputPath = join(workDir, 'edited-video.mp4');
  try {
    if (Buffer.isBuffer(input) || input instanceof Uint8Array) {
      await writeFile(inputPath, input);
    } else if (typeof input?.stream === 'function') {
      await pipeline(Readable.fromWeb(input.stream()), createWriteStream(inputPath));
    } else {
      throw new Error('Unsupported video input stream.');
    }
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-ss', startSeconds.toFixed(3),
      '-i', inputPath,
      '-t', (endSeconds - startSeconds).toFixed(3),
      '-filter_complex',
      '[0:v]split=2[bgsrc][fgsrc];[bgsrc]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,boxblur=12:2,eq=brightness=-0.15:saturation=0.85[bg];[fgsrc]scale=720:1280:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=30[v]',
      '-map', '[v]',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-profile:v', 'baseline',
      '-level', '3.1',
      '-pix_fmt', 'yuv420p',
      '-b:v', '900k',
      '-maxrate', '1100k',
      '-bufsize', '1800k',
      '-c:a', 'aac',
      '-b:a', '96k',
      '-ac', '2',
      '-movflags', '+faststart',
      '-f', 'mp4',
      outputPath,
    ];

    let stderr = '';
    let timedOut = false;
    const child = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    child.stderr.on('data', chunk => {
      if (stderr.length < 12_000) stderr += chunk.toString();
    });
    const exitCode = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
      }, TRANSCODE_TIMEOUT_MS);
      child.once('error', error => {
        clearTimeout(timer);
        reject(error);
      });
      child.once('close', code => {
        clearTimeout(timer);
        resolve(code);
      });
    });

    if (timedOut) throw new Error('Video conversion exceeded the 180-second processing limit.');
    if (exitCode !== 0) throw new Error('FFmpeg could not decode or convert this video: ' + stderr.slice(-1200));
    const output = await readFile(outputPath);
    if (output.length < 12 || output.subarray(4, 8).toString('ascii') !== 'ftyp') {
      throw new Error('FFmpeg output is not a valid MP4 file.');
    }
    if (output.length > MAX_OUTPUT_BYTES) {
      throw new Error('The MP4 output is larger than 8 MiB. Choose a shorter clip or a smaller source video.');
    }
    return output;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export const VIDEO_TRANSCODE_LIMITS = Object.freeze({
  maxInputBytes: MAX_INPUT_BYTES,
  maxOutputBytes: MAX_OUTPUT_BYTES,
  maxClipSeconds: MAX_CLIP_SECONDS,
});
