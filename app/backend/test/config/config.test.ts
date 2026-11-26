import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config/config.ts';

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
    expect(c.dataDir).toMatch(/data$/);
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
