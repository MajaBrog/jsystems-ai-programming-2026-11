import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// TAC-002-04 / TAC-005-02: committed captures (OpenRouter and our own backend) carry provenance
// metadata and no secrets or account identifiers.
const OPENROUTER = join(import.meta.dirname, '..', 'captures', 'openrouter');
const BACKEND = join(import.meta.dirname, '..', '..', '..', 'frontend', 'src', 'testing', 'captures');
const FORBIDDEN = [/sk-or-v1-[A-Za-z0-9]{20,}/, /"authorization"/i, /bearer\s+sk-/i, /"user_id"\s*:\s*"(?!user_REDACTED)/];

async function files(dir: string) {
  return (await readdir(dir)).map((f) => join(dir, f));
}

describe('capture hygiene (TAC-002-04, TAC-005-02)', () => {
  it('no capture file contains an API key, Authorization header or OpenRouter account id', async () => {
    const all = [...(await files(OPENROUTER)), ...(await files(BACKEND))];
    expect(all.length).toBeGreaterThan(20);
    for (const f of all) {
      const text = await readFile(f, 'utf8');
      for (const re of FORBIDDEN) expect(re.test(text), `${f} matches ${re}`).toBe(false);
    }
  });

  it('every OpenRouter capture records date, target, request summary and response status', async () => {
    const metas = (await files(OPENROUTER)).filter((f) => f.endsWith('.meta.json'));
    expect(metas.length).toBeGreaterThanOrEqual(10);
    for (const f of metas) {
      const m = JSON.parse(await readFile(f, 'utf8'));
      expect(m.capturedAt, f).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(m.target, f).toBe('https://openrouter.ai');
      expect(m.request?.path, f).toBe('/api/v1/chat/completions');
      expect(typeof m.response?.status, f).toBe('number');
      if (m.response.status === 200) expect(m.model, f).toBeTruthy();
    }
  });
});
