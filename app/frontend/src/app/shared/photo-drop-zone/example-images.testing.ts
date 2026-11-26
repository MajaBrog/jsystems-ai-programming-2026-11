/** Test-only helper: loads real photos from `assets/example-images/` (no generated images). */
const DIR = '../../assets/example-images/';
const TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

export async function loadExampleImage(name: string, type?: string): Promise<File> {
  // Variable specifier keeps the bundler from resolving a Node built-in; tests run under Node.
  const fsModule = 'node:fs';
  const { readFileSync } = await import(/* @vite-ignore */ fsModule);
  const bytes: Uint8Array = readFileSync(DIR + name);
  const ext = name.split('.').pop()!.toLowerCase();
  return new File([new Uint8Array(bytes)], name, { type: type ?? TYPES[ext] ?? '' });
}
