import sharp from 'sharp';

export const MAX_LONG_EDGE = 1568;
export const JPEG_QUALITY = 80; // ADR-001 D2 (0.8)

export async function compressForModel(buf: Buffer): Promise<{ jpeg: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(buf)
    .rotate() // apply EXIF orientation, drops the tag
    .flatten({ background: '#ffffff' })
    .resize({ width: MAX_LONG_EDGE, height: MAX_LONG_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer({ resolveWithObject: true });
  return { jpeg: data, width: info.width, height: info.height };
}
