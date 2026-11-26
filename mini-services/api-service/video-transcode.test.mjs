import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ffmpegPath from 'ffmpeg-static';
import sharp from 'sharp';
import { transcodeVideoToMp4 } from './video-transcode.mjs';

test('server transcoder produces a real H.264 MP4 clip from a browser-supported source', async () => {
  assert.ok(ffmpegPath, 'ffmpeg-static must provide a platform binary');
  const dir = mkdtempSync(join(tmpdir(), 'bankresaneh-transcode-test-'));
  const input = join(dir, 'source.webm');
  try {
    const generated = spawnSync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=24:duration=2',
      '-an', '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8',
      '-f', 'webm', input,
    ], { encoding: 'utf8', timeout: 60000 });
    assert.equal(generated.status, 0, generated.stderr || 'Could not generate WebM fixture');
    const output = await transcodeVideoToMp4(readFileSync(input), 0.25, 1.75);
    assert.equal(output.subarray(4, 8).toString('ascii'), 'ftyp', 'output must be an MP4 container, not a renamed WebM file');
    assert.ok(output.length > 1000 && output.length <= 8 * 1024 * 1024);
    const outputPath = join(dir, 'edited.mp4');
    writeFileSync(outputPath, output);
    const frame = spawnSync(ffmpegPath, [
      '-hide_banner', '-loglevel', 'error', '-i', outputPath,
      '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', 'pipe:1',
    ], { encoding: 'buffer', timeout: 60000, maxBuffer: 10 * 1024 * 1024 });
    assert.equal(frame.status, 0, frame.stderr?.toString() || 'Could not decode output MP4');
    const dimensions = await sharp(frame.stdout).metadata();
    assert.equal(dimensions.width, 720);
    assert.equal(dimensions.height, 1280, 'social export must be vertical 9:16');

  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('server transcoder rejects invalid trim ranges before starting FFmpeg', async () => {
  await assert.rejects(() => transcodeVideoToMp4(Buffer.from('x'), -1, 1), /Clip range/);
  await assert.rejects(() => transcodeVideoToMp4(Buffer.from('x'), 0, 31), /Clip range/);
});
