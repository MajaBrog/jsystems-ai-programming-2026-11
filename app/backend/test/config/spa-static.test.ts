import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { testConfig } from '../support/test-config.ts';

// A minimal static folder standing in for app/frontend/dist/frontend/browser (our own build output, not an endpoint).
async function staticDir() {
  const dir = await mkdtemp(join(tmpdir(), 'spa-'));
  await writeFile(join(dir, 'index.html'), '<!doctype html><app-root></app-root>');
  await writeFile(join(dir, 'main.js'), 'console.log(1)');
  return dir;
}

describe('bundled mode (ADR-005 TAC-005-04, ADR-001 TAC-001-06)', () => {
  it('serves index.html at / and for client routes such as /case/<uuid>', async () => {
    const app = await buildApp({ config: testConfig(), frontendDir: await staticDir() });
    for (const url of ['/', '/case/0b9a3f0e-4a8e-4c2b-9d61-2f4f1c0b7a11']) {
      const res = await app.inject({ url });
      expect(res.statusCode, url).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.body).toContain('<app-root>');
    }
    await app.close();
  });

  it('serves real files and 404s missing files with an extension', async () => {
    const app = await buildApp({ config: testConfig(), frontendDir: await staticDir() });
    expect((await app.inject({ url: '/main.js' })).body).toBe('console.log(1)');
    expect((await app.inject({ url: '/missing.js' })).statusCode).toBe(404);
    await app.close();
  });

  it('keeps unknown /api routes as 404 JSON and health working', async () => {
    const app = await buildApp({ config: testConfig(), frontendDir: await staticDir() });
    const res = await app.inject({ url: '/api/unknown' });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('NOT_FOUND');
    expect((await app.inject({ url: '/api/health' })).json()).toEqual({ status: 'UP' });
    await app.close();
  });

  it('without frontendDir, / is a 404 JSON (dev mode: Angular serves the SPA)', async () => {
    const app = await buildApp({ config: testConfig() });
    expect((await app.inject({ url: '/' })).statusCode).toBe(404);
    await app.close();
  });
});
