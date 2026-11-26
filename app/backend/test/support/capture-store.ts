import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * A verbatim HTTP capture (AGENTS.md mock rule, ADR-002 D6, ADR-005):
 *  - `<name>.meta.json` — date, target, request summary (no Authorization, image data summarized),
 *    response status + headers, optional `derivedFrom` + `changes` for derived variants;
 *  - `<name>.body` — the raw response bytes (JSON or SSE stream) exactly as received.
 */
export type CaptureMeta = {
  name: string;
  capturedAt: string;
  target: string;
  model?: string | null;
  note?: string;
  derivedFrom?: string;
  changes?: string[];
  request: { method: string; path: string; headers: Record<string, string>; body: unknown };
  response: { status: number; headers: Record<string, string> };
};

export type Capture = { meta: CaptureMeta; body: Buffer };

const SECRET_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'proxy-authorization']);

export function safeHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (v === undefined || SECRET_HEADERS.has(k.toLowerCase())) continue;
    out[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}

/** Replaces base64 data URLs with a size summary so captures stay small and never embed photos. */
export function summarizeRequestBody(raw: string): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw, (_k, v) =>
      typeof v === 'string' && v.startsWith('data:') && v.includes(';base64,')
        ? `${v.slice(0, v.indexOf(';base64,'))};base64, ${v.length - v.indexOf(';base64,') - 8} chars`
        : v,
    );
  } catch {
    return `<non-JSON body, ${raw.length} chars>`;
  }
}

export async function saveCapture(dir: string, capture: Capture): Promise<void> {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${capture.meta.name}.meta.json`), JSON.stringify(capture.meta, null, 2) + '\n');
  await writeFile(join(dir, `${capture.meta.name}.body`), capture.body);
}

export async function loadCapture(dir: string, name: string): Promise<Capture> {
  const meta = JSON.parse(await readFile(join(dir, `${name}.meta.json`), 'utf8')) as CaptureMeta;
  const body = await readFile(join(dir, `${name}.body`));
  return { meta, body };
}
