import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateShowVideos,
  MAX_VIDEO_CLIP_BYTES,
  MAX_TOTAL_VIDEO_CLIP_BYTES,
} from './video-validation.mjs';

const dataVideo = (bytes, mime = 'video/webm') => {
  const groups = Math.floor(bytes / 3);
  const remainder = bytes % 3;
  const payload = 'A'.repeat(groups * 4) + (remainder === 1 ? 'AA==' : remainder === 2 ? 'AAA=' : '');
  return `data:${mime};base64,${payload}`;
};

test('accepts omitted or empty video lists and ordinary hosted links', () => {
  assert.equal(validateShowVideos(undefined).valid, true);
  assert.equal(validateShowVideos([]).valid, true);
  assert.equal(validateShowVideos(['https://example.com/clip.mp4']).valid, true);
});

test('accepts a valid local WebM clip within the 8 MiB limit', () => {
  const result = validateShowVideos([dataVideo(1024)]);
  assert.equal(result.valid, true);
  assert.equal(result.localClipCount, 1);
});

test('rejects malformed or non-base64 data video references', () => {
  assert.equal(validateShowVideos(['data:video/webm,not-base64']).valid, false);
  assert.equal(validateShowVideos(['data:image/png;base64,AAAA']).valid, false);
});

test('rejects a local clip larger than 8 MiB', () => {
  assert.equal(validateShowVideos([dataVideo(MAX_VIDEO_CLIP_BYTES + 1)]).valid, false);
});

test('rejects more than five local clips and aggregate data above 40 MiB', () => {
  const small = dataVideo(1024);
  assert.equal(validateShowVideos(Array(6).fill(small)).valid, false);
  const large = dataVideo(Math.floor(MAX_TOTAL_VIDEO_CLIP_BYTES / 2) + 1);
  assert.equal(validateShowVideos([large, large]).valid, false);
});

test('rejects non-string and oversized references', () => {
  assert.equal(validateShowVideos([42]).valid, false);
  assert.equal(validateShowVideos(['x'.repeat(4097)]).valid, false);
});
