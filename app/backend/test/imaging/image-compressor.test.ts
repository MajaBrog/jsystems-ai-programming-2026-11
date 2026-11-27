import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { compressForModel } from '../../src/imaging/image-compressor.ts';
import { examplePhoto } from './fixtures.ts';

async function inspect(buf: Buffer) {
  const m = await sharp(buf).metadata();
  return { format: m.format, width: m.width, height: m.height };
}

describe('compressForModel', () => {
  it('downsizes laptop-1.png (JPEG 3024x3135) to long edge 1568, as JPEG', async () => {
    const out = await compressForModel(await examplePhoto('laptop-1.png'));
    expect(Math.max(out.width, out.height)).toBe(1568);
    expect(out.height).toBeGreaterThan(out.width);
    expect(await inspect(out.jpeg)).toEqual({ format: 'jpeg', width: out.width, height: out.height });
  });
  it('decodes WebP (laptop-2.webp) to JPEG without enlarging', async () => {
    const out = await compressForModel(await examplePhoto('laptop-2.webp'));
    expect(await inspect(out.jpeg)).toEqual({ format: 'jpeg', width: 863, height: 843 });
    expect([out.width, out.height]).toEqual([863, 843]);
  });
  it('does not enlarge small JPEGs (phone-2.jpeg 387x516)', async () => {
    const out = await compressForModel(await examplePhoto('phone-2.jpeg'));
    expect([out.width, out.height]).toEqual([387, 516]);
  });
  it('keeps a 900x1200 photo within bounds and unchanged in size', async () => {
    const out = await compressForModel(await examplePhoto('phone-1.jpg'));
    expect([out.width, out.height]).toEqual([900, 1200]);
  });
  it('encodes at JPEG quality 80', async () => {
    const src = await examplePhoto('phone-1.jpg');
    const out = await compressForModel(src);
    const q = (n: number) => sharp(src).jpeg({ quality: n }).toBuffer();
    expect(out.jpeg.length).toBe((await q(80)).length);
  });
  it('applies EXIF orientation (rotated pixels, no orientation tag left)', async () => {
    const src = await examplePhoto('phone-2.jpeg');
    const rotatedSrc = await sharp(src).withMetadata({ orientation: 6 }).toBuffer();
    expect((await sharp(rotatedSrc).metadata()).orientation).toBe(6);
    const out = await compressForModel(rotatedSrc);
    expect([out.width, out.height]).toEqual([516, 387]);
    expect((await sharp(out.jpeg).metadata()).orientation).toBeUndefined();
  });
  it('flattens alpha on white (transparent pixel from a real photo re-encoded with alpha)', async () => {
    const src = await examplePhoto('laptop-2.webp');
    const withAlpha = await sharp(src).ensureAlpha(0).png().toBuffer(); // fully transparent copy of a real photo
    const out = await compressForModel(withAlpha);
    const { data, info } = await sharp(out.jpeg).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(3);
    for (const i of [0, 1, 2, 300, 301, 302]) expect(data[i]).toBeGreaterThanOrEqual(253);
  });
});
