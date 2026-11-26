import { loadConfig, type AppConfig } from '../../src/config/config.ts';

/** Config for tests: a dummy key (never sent anywhere — tests use the replay server or no LLM at all). */
export function testConfig(overrides: Record<string, string> = {}): AppConfig {
  return loadConfig({ OPENROUTER_API_KEY: 'test-key-not-real', APP_DATA_DIR: '/tmp/copilot-test-unused', ...overrides });
}
