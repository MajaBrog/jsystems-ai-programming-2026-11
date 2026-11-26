import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dir = new URL('../../../../assets/example-images/', import.meta.url);

/** Reads a real example photo (read-only; never modified, see assets/example-images/README.md). */
export function examplePhoto(name: string): Promise<Buffer> {
  return readFile(fileURLToPath(new URL(name, dir)));
}
