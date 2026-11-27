import { describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { testConfig } from '../support/test-config.ts';

describe('GET /api/health', () => {
  it('returns status UP as JSON', async () => {
    const app = await buildApp({ config: testConfig() });
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json()).toEqual({ status: 'UP' });
    await app.close();
  });
});
