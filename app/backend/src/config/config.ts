import { resolve } from 'node:path';

/** Typed application configuration from environment variables (ADR-000 §7). */
export type AppConfig = {
  readonly openRouterApiKey: string;
  readonly openRouterBaseUrl: string;
  readonly llmModel: string;
  readonly llmVisionModel: string;
  readonly llmTimeoutSeconds: number;
  readonly appTitle: string | null;
  readonly dataDir: string;
  readonly serverPort: number;
};

export class ConfigError extends Error {
  override name = 'ConfigError';
}

type Env = Record<string, string | undefined>;

function value(env: Env, key: string): string | undefined {
  const v = env[key]?.trim();
  return v ? v : undefined;
}

function positiveInt(env: Env, key: string, fallback: number): number {
  const raw = value(env, key);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new ConfigError(`${key} must be a positive integer`);
  return n;
}

/** Reads and validates config. Error messages name the variable but never echo its value. */
export function loadConfig(env: Env): AppConfig {
  const openRouterApiKey = value(env, 'OPENROUTER_API_KEY');
  if (!openRouterApiKey) {
    throw new ConfigError('OPENROUTER_API_KEY is required (set it in the checkout-root .env, see .env.example)');
  }
  const llmModel = value(env, 'LLM_MODEL') ?? 'openai/gpt-6-luna';
  return {
    openRouterApiKey,
    openRouterBaseUrl: value(env, 'OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1',
    llmModel,
    llmVisionModel: value(env, 'LLM_VISION_MODEL') ?? llmModel,
    llmTimeoutSeconds: positiveInt(env, 'LLM_TIMEOUT_SECONDS', 60),
    appTitle: value(env, 'OPENROUTER_APP_TITLE') ?? null,
    dataDir: resolve(value(env, 'APP_DATA_DIR') ?? './data'),
    serverPort: positiveInt(env, 'SERVER_PORT', 8080),
  };
}
