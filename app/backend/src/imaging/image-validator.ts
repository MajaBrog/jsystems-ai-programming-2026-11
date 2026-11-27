import sharp from 'sharp';

export type ImageFormat = 'jpeg' | 'png' | 'webp';
export type ValidationResult =
  | { ok: true; format: ImageFormat }
  | { ok: false; reason: 'UNSUPPORTED_TYPE' | 'FILE_TOO_LARGE' | 'EMPTY' };

export const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
/** Decoded-size guard against pixel bombs (small file, huge canvas). */
export const DEFAULT_MAX_PIXELS = 40_000_000;

/** Detects the real format from content (magic bytes + successful header decode); name and Content-Type are ignored. */
export async function validateImage(
  buf: Buffer,
  options: { maxBytes?: number; maxPixels?: number } = {},
): Promise<ValidationResult> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxPixels = options.maxPixels ?? DEFAULT_MAX_PIXELS;
  if (buf.length === 0) return { ok: false, reason: 'EMPTY' };
  if (buf.length > maxBytes) return { ok: false, reason: 'FILE_TOO_LARGE' };
  const format = sniff(buf);
  if (!format) return { ok: false, reason: 'UNSUPPORTED_TYPE' };
  try {
    // Header first: reject huge canvases before any pixel is decoded.
    const meta = await sharp(buf, { failOn: 'error', limitInputPixels: maxPixels }).metadata();
    if (!meta.width || !meta.height || meta.width * meta.height > maxPixels) {
      return { ok: false, reason: 'UNSUPPORTED_TYPE' };
    }
    // Full decode (truncated/corrupt files must not reach the model or disk) into a discarded sink:
    // stats() reads every pixel without retaining the raw buffer.
    await sharp(buf, { failOn: 'error', limitInputPixels: maxPixels }).stats();
  } catch {
    return { ok: false, reason: 'UNSUPPORTED_TYPE' };
  }
  return { ok: true, format };
}

function sniff(b: Buffer): ImageFormat | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}
