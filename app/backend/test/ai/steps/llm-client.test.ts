import { describe, expect, it } from 'vitest';
import { createLlmClient } from '../../../src/ai/client/llm-client.ts';
import { testConfig } from '../../support/test-config.ts';

describe('createLlmClient (ADR-002 §3.1 / ADR-005)', () => {
  it('uses OPENROUTER_BASE_URL, the explicit key, no retries and the per-step timeout', () => {
    const client = createLlmClient(testConfig({ OPENROUTER_BASE_URL: 'http://127.0.0.1:9/api/v1', LLM_TIMEOUT_SECONDS: '7' }));
    expect(client.baseURL).toBe('http://127.0.0.1:9/api/v1');
    expect(client.apiKey).toBe('test-key-not-real');
    expect(client.maxRetries).toBe(0);
    expect(client.timeout).toBe(7000);
  });
});
