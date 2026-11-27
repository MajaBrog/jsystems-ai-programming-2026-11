import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { ApiError } from '../../src/config/errors.ts';
import { testConfig } from '../support/test-config.ts';

async function appWithProbeRoutes() {
  const app = await buildApp({ config: testConfig() });
  app.get('/api/probe/not-found', async () => { throw ApiError.caseNotFound(); });
  app.get('/api/probe/conflict', async () => { throw ApiError.replyInProgress(); });
  app.get('/api/probe/validation', async () => {
    throw ApiError.validation([{ field: 'modelName', message: 'Podaj model urządzenia.' }]);
  });
  app.get('/api/probe/crash', async () => { throw new Error('secret internal detail sk-or-xyz'); });
  return app;
}

describe('error model (ADR-001 §4)', () => {
  it('maps domain errors to status + JSON body', async () => {
    const app = await appWithProbeRoutes();
    const nf = await app.inject({ url: '/api/probe/not-found' });
    expect(nf.statusCode).toBe(404);
    expect(nf.json()).toEqual({ code: 'CASE_NOT_FOUND', message: 'Nie znaleziono zgłoszenia.', fieldErrors: [] });

    const conflict = await app.inject({ url: '/api/probe/conflict' });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().code).toBe('REPLY_IN_PROGRESS');

    const val = await app.inject({ url: '/api/probe/validation' });
    expect(val.statusCode).toBe(400);
    expect(val.json()).toMatchObject({ code: 'VALIDATION_FAILED', fieldErrors: [{ field: 'modelName' }] });
    await app.close();
  });

  it('hides internal errors behind INTERNAL_ERROR with a Polish message', async () => {
    const app = await appWithProbeRoutes();
    const res = await app.inject({ url: '/api/probe/crash' });
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ code: 'INTERNAL_ERROR', message: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie.', fieldErrors: [] });
    expect(res.body).not.toContain('secret');
    await app.close();
  });

  it('unknown /api route → 404 JSON', async () => {
    const app = await appWithProbeRoutes();
    const res = await app.inject({ url: '/api/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json().code).toBe('NOT_FOUND');
    await app.close();
  });

  it('sends no CORS headers (ADR-001: same origin via proxy)', async () => {
    const app = await appWithProbeRoutes();
    const res = await app.inject({ url: '/api/health', headers: { origin: 'http://evil.example' } });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    await app.close();
  });

  it('only FST_REQ_FILE_TOO_LARGE maps to 413; other limit errors are 400 VALIDATION_FAILED', async () => {
    const app = await buildApp({ config: testConfig() });
    app.get('/api/probe/too-large', async () => { throw Object.assign(new Error('x'), { code: 'FST_REQ_FILE_TOO_LARGE', statusCode: 413 }); });
    app.get('/api/probe/files-limit', async () => { throw Object.assign(new Error('x'), { code: 'FST_FILES_LIMIT', statusCode: 413 }); });
    app.get('/api/probe/body-too-large', async () => { throw Object.assign(new Error('x'), { code: 'FST_ERR_CTP_BODY_TOO_LARGE', statusCode: 413 }); });
    const big = await app.inject({ url: '/api/probe/too-large' });
    expect(big.statusCode).toBe(413);
    expect(big.json().code).toBe('FILE_TOO_LARGE');
    for (const url of ['/api/probe/files-limit', '/api/probe/body-too-large']) {
      const res = await app.inject({ url });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toMatchObject({ code: 'VALIDATION_FAILED', message: 'Nieprawidłowe żądanie.' });
    }
    await app.close();
  });
});
