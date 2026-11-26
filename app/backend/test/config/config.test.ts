import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config/config.ts';

// app/backend/test/config -> checkout root is four levels up
const CHECKOUT_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const CHECKOUT_ROOT_DATA = resolve(CHECKOUT_ROOT, 'data');

describe('loadConfig (ADR-000 §7)', () => {
  it('fails fast without OPENROUTER_API_KEY and never echoes values', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({ OPENROUTER_API_KEY: '   ' })).toThrow(/OPENROUTER_API_KEY/);
  });

  it('applies documented defaults', () => {
    const c = loadConfig({ OPENROUTER_API_KEY: 'k' });
    expect(c.openRouterBaseUrl).toBe('https://openrouter.ai/api/v1');
    expect(c.llmModel).toBe('openai/gpt-6-luna');
    expect(c.llmVisionModel).toBe('openai/gpt-6-luna');
    expect(c.llmTimeoutSeconds).toBe(60);
    expect(c.serverPort).toBe(8080);
    expect(c.appTitle).toBeNull();
    expect(c.dataDir).toBe(CHECKOUT_ROOT_DATA);
  });

  it('resolves a relative APP_DATA_DIR against the checkout root, not the cwd', () => {
    const c = loadConfig({ OPENROUTER_API_KEY: 'k', APP_DATA_DIR: './data' });
    expect(c.dataDir).toBe(CHECKOUT_ROOT_DATA);
    expect(loadConfig({ OPENROUTER_API_KEY: 'k', APP_DATA_DIR: 'var/x' }).dataDir).toBe(resolve(CHECKOUT_ROOT, 'var/x'));
  });

  it('keeps an absolute APP_DATA_DIR as is', () => {
    expect(loadConfig({ OPENROUTER_API_KEY: 'k', APP_DATA_DIR: '/tmp/copilot-data' }).dataDir).toBe('/tmp/copilot-data');
  });

  it('vision model defaults to LLM_MODEL, empty strings count as unset', () => {
    const c = loadConfig({ OPENROUTER_API_KEY: 'k', LLM_MODEL: 'x/y', LLM_VISION_MODEL: '' });
    expect(c.llmVisionModel).toBe('x/y');
  });

  it('rejects a non-positive timeout or port', () => {
    expect(() => loadConfig({ OPENROUTER_API_KEY: 'k', LLM_TIMEOUT_SECONDS: '0' })).toThrow(/LLM_TIMEOUT_SECONDS/);
    expect(() => loadConfig({ OPENROUTER_API_KEY: 'k', SERVER_PORT: 'abc' })).toThrow(/SERVER_PORT/);
  });

  it('does not read OPENAI_API_KEY', () => {
    expect(() => loadConfig({ OPENAI_API_KEY: 'sk-x' })).toThrow(ConfigError);
  });
});
