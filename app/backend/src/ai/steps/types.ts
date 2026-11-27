import type { GuardedEvaluation } from '../guard/policyGuard.ts';
import type { Assessment, CaseForm, ChatContext, ImageAnalysis, IsoDate } from '../domain/types.ts';

/**
 * Step contracts — ADR-002 §5 is the single source. The `cases` package depends only on these
 * types; T13 implements them against OpenRouter.
 */

/** OpenRouter unreachable, HTTP error, timeout or mid-stream failure → SSE `error` LLM_UNAVAILABLE. */
export class LlmUnavailableError extends Error {
  override name = 'LlmUnavailableError';
}

/** Output still invalid after the single repair call (ADR-002 D5) → SSE `error` LLM_INVALID_OUTPUT. */
export class LlmInvalidOutputError extends Error {
  override name = 'LlmInvalidOutputError';
}

export type ImageAnalysisStep = {
  analyse(form: CaseForm, jpeg: Buffer, signal?: AbortSignal): Promise<ImageAnalysis>;
};

export type DecisionStep = {
  /** Returns the guarded assessment (PolicyGuard already applied). */
  decide(form: CaseForm, analysis: ImageAnalysis, today: IsoDate, signal?: AbortSignal): Promise<Assessment>;
};

export type ChatEvaluateStep = {
  /** Returns the guarded evaluation with `categoryChanged` normalized (ADR-002 §3.3). */
  evaluate(ctx: ChatContext, customerText: string, signal?: AbortSignal): Promise<GuardedEvaluation>;
};

export type ChatReplyStep = {
  /**
   * Streams the reply; calls `onToken` per chunk and resolves with the full text.
   * Rejects with LlmUnavailableError on HTTP error, mid-stream error or inactivity timeout.
   * Aborting `signal` (client disconnect) stops the upstream stream.
   */
  stream(
    ctx: ChatContext,
    customerText: string,
    evaluation: GuardedEvaluation,
    onToken: (text: string) => void,
    signal?: AbortSignal,
  ): Promise<string>;
};

export type AiSteps = {
  imageAnalysis: ImageAnalysisStep;
  decision: DecisionStep;
  chatEvaluate: ChatEvaluateStep;
  chatReply: ChatReplyStep;
};
