import OpenAI from 'openai';
import type { AppConfig } from '../../config/config.ts';

/**
 * The single OpenRouter client (ADR-002 §3.1, ADR-005): explicit key and base URL (never the
 * SDK's OPENAI_API_KEY/OPENAI_BASE_URL fallback), no SDK retries (AC-30 wants a visible failure),
 * per-step timeout for non-streaming calls. The streaming reply bounds inactivity itself.
 */
export function createLlmClient(config: AppConfig): OpenAI {
  const defaultHeaders: Record<string, string> = {};
  if (config.appTitle) {
    // Attribution: both documented header names (ADR-002 §3.1; recorded in the T05 captures).
    defaultHeaders['X-Title'] = config.appTitle;
    defaultHeaders['X-OpenRouter-Title'] = config.appTitle;
  }
  return new OpenAI({
    apiKey: config.openRouterApiKey,
    baseURL: config.openRouterBaseUrl,
    maxRetries: 0,
    timeout: config.llmTimeoutSeconds * 1000,
    defaultHeaders,
  });
}
