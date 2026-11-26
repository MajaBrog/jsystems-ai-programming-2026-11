import { LlmInvalidOutputError, LlmUnavailableError } from '../ai/steps/types.ts';

export type StreamErrorCode = 'LLM_UNAVAILABLE' | 'LLM_INVALID_OUTPUT' | 'INTERNAL_ERROR';

/** One user-facing text for every SSE `error` event (ADR-001 §4, AC-30). */
export const STREAM_ERROR_MESSAGE = 'Usługa jest chwilowo niedostępna. Spróbuj ponownie.';

export function toStreamErrorCode(error: unknown): StreamErrorCode {
  if (error instanceof LlmUnavailableError) return 'LLM_UNAVAILABLE';
  if (error instanceof LlmInvalidOutputError) return 'LLM_INVALID_OUTPUT';
  return 'INTERNAL_ERROR';
}
