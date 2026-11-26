import { describe, expect, it } from 'vitest';
import { validateImage } from '../../src/imaging/image-validator.ts';
import { examplePhoto } from './fixtures.ts';

describe('validateImage', () => {
  it('accepts JPEG content despite a .png file name (laptop-1.png)', async () => {
    expect(await validateImage(await examplePhoto('laptop-1.png'))).toEqual({ ok: true, format: 'jpeg' });
  });
  it('accepts .jpg and .jpeg photos as jpeg', async () => {
    for (const f of ['phone-1.jpg', 'phone-2.jpeg', 'phone-3.jpeg']) {
      expect(await validateImage(await examplePhoto(f))).toEqual({ ok: true, format: 'jpeg' });
    }
  });
  it('accepts WebP by content', async () => {
    expect(await validateImage(await examplePhoto('laptop-2.webp'))).toEqual({ ok: true, format: 'webp' });
  });
  it('rejects empty input', async () => {
    expect(await validateImage(Buffer.alloc(0))).toEqual({ ok: false, reason: 'EMPTY' });
  });
  it('rejects a UTF-8 text buffer', async () => {
    expect(await validateImage(Buffer.from('to nie jest zdjęcie', 'utf8'))).toEqual({
      ok: false,
      reason: 'UNSUPPORTED_TYPE',
    });
  });
  it('rejects a PDF buffer', async () => {
    expect(await validateImage(Buffer.from('%PDF-1.4\n%%EOF\n'))).toEqual({ ok: false, reason: 'UNSUPPORTED_TYPE' });
  });
  it('rejects a real JPEG with truncated bytes (magic ok, decode fails)', async () => {
    const full = await examplePhoto('phone-2.jpeg');
    expect(await validateImage(full.subarray(0, 64))).toEqual({ ok: false, reason: 'UNSUPPORTED_TYPE' });
  });
  it('rejects files over the limit (default 10 MB, overridable)', async () => {
    const photo = await examplePhoto('phone-1.jpg');
    expect(await validateImage(photo, { maxBytes: photo.length - 1 })).toEqual({ ok: false, reason: 'FILE_TOO_LARGE' });
    expect(await validateImage(photo, { maxBytes: photo.length })).toEqual({ ok: true, format: 'jpeg' });
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0xff);
    expect(await validateImage(big)).toEqual({ ok: false, reason: 'FILE_TOO_LARGE' });
  });
});
