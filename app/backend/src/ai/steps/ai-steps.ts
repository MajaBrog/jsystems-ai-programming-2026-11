import OpenAI from 'openai';
import type { AppConfig } from '../../config/config.ts';
import type { Assessment, CaseType, ImageAnalysis } from '../domain/types.ts';
import { applyPolicyGuard, GuardInvalidOutputError, guardChatEvaluation } from '../guard/policyGuard.ts';
import type { PromptRepository } from '../prompt/promptRepository.ts';
import { validateAssessmentProposal, validateChatEvaluation, validateImageAnalysis, type ValidationResult } from '../validate/outputValidator.ts';
import {
  buildDecisionRequest,
  buildEvaluateRequest,
  buildReplyRequest,
  buildVisionRequest,
  type WireRequest,
} from './requests.ts';
import { type AiSteps, LlmInvalidOutputError, LlmUnavailableError } from './types.ts';

export type AiStepsDeps = { client: OpenAI; config: AppConfig; prompts: PromptRepository };

type Params = Parameters<OpenAI['chat']['completions']['create']>[0];

function unavailable(cause: unknown, what: string): LlmUnavailableError {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new LlmUnavailableError(`${what}: ${detail}`, { cause });
}

/** Reads the assistant JSON content; anything that is not valid JSON text is reported as validator errors. */
function parseContent(raw: string | null | undefined, finishReason: string | null | undefined): { json: unknown } | { errors: string[] } {
  if (finishReason === 'length') return { errors: ['output was cut off (finish_reason=length)'] };
  if (!raw || raw.trim() === '') return { errors: ['output is empty'] };
  try {
    return { json: JSON.parse(raw) };
  } catch {
    return { errors: ['output is not valid JSON'] };
  }
}

/** Composition of the four AI steps over one OpenAI-compatible client (ADR-002 §3, §5). */
export function createAiSteps({ client, config, prompts }: AiStepsDeps): AiSteps {
  const timeoutMs = config.llmTimeoutSeconds * 1000;

  async function complete(req: WireRequest, signal: AbortSignal | undefined) {
    try {
      return await client.chat.completions.create(req as unknown as Params & { stream?: false }, { signal, timeout: timeoutMs }) as OpenAI.Chat.ChatCompletion;
    } catch (e) {
      if (signal?.aborted || !(e instanceof OpenAI.APIError)) throw e;
      throw unavailable(e, 'OpenRouter call failed');
    }
  }

  /** One call + validation; on invalid output exactly one repair call (ADR-002 D5). */
  async function structured<T>(
    req: WireRequest,
    signal: AbortSignal | undefined,
    validate: (raw: unknown) => ValidationResult<T>,
  ): Promise<T> {
    const attempt = async (r: WireRequest): Promise<{ value: T } | { content: string; errors: string[] }> => {
      const res = await complete(r, signal);
      const choice = res.choices?.[0];
      const content = choice?.message?.content ?? '';
      const parsed = parseContent(content, choice?.finish_reason);
      if ('errors' in parsed) return { content, errors: parsed.errors };
      try {
        const v = validate(parsed.json);
        return v.ok ? { value: v.value } : { content, errors: v.errors };
      } catch (e) {
        if (e instanceof GuardInvalidOutputError) return { content, errors: [e.message] };
        throw e;
      }
    };

    const first = await attempt(req);
    if ('value' in first) return first.value;
    const repairReq: WireRequest = {
      ...req,
      messages: [
        ...req.messages,
        { role: 'assistant', content: first.content },
        {
          role: 'user',
          content: `Your previous output was invalid:\n- ${first.errors.join('\n- ')}\nReturn the corrected JSON only, following the same schema and rules.`,
        },
      ],
    };
    const second = await attempt(repairReq);
    if ('value' in second) return second.value;
    throw new LlmInvalidOutputError(`Output invalid after repair: ${second.errors.join('; ')}`);
  }

  const ids = (t: CaseType) => prompts.ruleIds(t);

  return {
    imageAnalysis: {
      analyse: (form, jpeg, signal) =>
        structured(buildVisionRequest({ config, prompts, form, jpeg }), signal, validateImageAnalysis),
    },

    decision: {
      decide: (form, analysis: ImageAnalysis, today, signal) =>
        structured<Assessment>(buildDecisionRequest({ config, prompts, form, analysis, today }), signal, (raw) => {
          const v = validateAssessmentProposal(raw, ids(form.caseType));
          if (!v.ok) return v;
          const guarded = applyPolicyGuard({
            proposal: v.value, caseType: form.caseType, purchaseDate: form.purchaseDate, today, analysis,
            limits: prompts.limits, ruleIds: ids(form.caseType),
          });
          const { guardApplied, ...proposal } = guarded;
          return { ok: true, value: { ...proposal, source: 'DECISION', previousCategory: null, guardApplied } };
        }),
    },

    chatEvaluate: {
      evaluate: (ctx, customerText, signal) =>
        structured(buildEvaluateRequest({ config, prompts, ctx, customerText }), signal, (raw) => {
          const v = validateChatEvaluation(raw, ids(ctx.form.caseType));
          if (!v.ok) return v;
          return {
            ok: true,
            value: guardChatEvaluation({
              evaluation: v.value, currentCategory: ctx.currentAssessment.category, caseType: ctx.form.caseType,
              purchaseDate: ctx.form.purchaseDate, today: ctx.today, analysis: ctx.analysis,
              limits: prompts.limits, ruleIds: ids(ctx.form.caseType),
            }),
          };
        }),
    },

    chatReply: {
      async stream(ctx, customerText, evaluation, onToken, signal) {
        const req = buildReplyRequest({ config, prompts, ctx, customerText, evaluation });
        const ac = new AbortController();
        const onCallerAbort = () => ac.abort(signal?.reason);
        if (signal?.aborted) ac.abort(signal.reason);
        else signal?.addEventListener('abort', onCallerAbort, { once: true });

        let timedOut = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const arm = () => {
          clearTimeout(timer);
          timer = setTimeout(() => { timedOut = true; ac.abort(); }, timeoutMs);
        };

        let callbackError: { error: unknown } | undefined;
        let text = '';
        let finished = false;
        try {
          arm(); // inactivity timer also covers the wait for the first chunk
          const stream = await client.chat.completions.create(req as unknown as Params & { stream: true }, { signal: ac.signal, timeout: timeoutMs }) as AsyncIterable<OpenAI.Chat.ChatCompletionChunk>;
          for await (const chunk of stream) {
            arm();
            const choice = chunk.choices?.[0];
            const delta = choice?.delta?.content;
            if (delta) {
              try { onToken(delta); } catch (e) { callbackError = { error: e }; throw e; }
              text += delta;
            }
            if ((choice?.finish_reason as string | null | undefined) === 'error') throw new LlmUnavailableError('OpenRouter stream ended with finish_reason=error');
            if (choice?.finish_reason) finished = true;
          }
          if (!finished) throw new LlmUnavailableError('OpenRouter stream ended before a finish_reason arrived');
          return text;
        } catch (e) {
          if (callbackError) throw callbackError.error;
          if (signal?.aborted && !timedOut) throw e;
          if (e instanceof LlmUnavailableError) throw e;
          if (timedOut) throw unavailable(e, `No data from OpenRouter for ${config.llmTimeoutSeconds}s`);
          throw unavailable(e, 'OpenRouter stream failed');
        } finally {
          clearTimeout(timer);
          signal?.removeEventListener('abort', onCallerAbort);
          ac.abort(); // release the connection on every exit path
        }
      },
    },
  };
}
