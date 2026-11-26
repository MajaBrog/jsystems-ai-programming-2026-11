import type { DatabaseSync } from 'node:sqlite';
import { changeNoticeLine, MANDATORY_NOTICE } from '../ai/compose/firstMessageComposer.ts';
import type { Assessment, Category, ChatContext, ImageAnalysis } from '../ai/domain/types.ts';
import { LlmInvalidOutputError, type AiSteps } from '../ai/steps/types.ts';
import type { Clock } from '../config/clock.ts';
import {
  createAssessmentRepository,
  createCaseRepository,
  createMessageRepository,
  transaction,
} from '../persistence/index.ts';
import { STREAM_ERROR_MESSAGE, toStreamErrorCode, type StreamErrorCode } from './stream-errors.ts';

export type CompletedTurn = {
  message: { id: number; role: 'AGENT'; content: string; createdAt: string; assessmentCategory?: Category };
  currentCategory: Category;
};

/** Reply callbacks (ADR-001 §5). `assessmentChanged` comes at most once and before any `token`. */
export type ReplyListener = {
  assessmentChanged(from: Category, to: Category): void;
  token(text: string): void;
  completed(turn: CompletedTurn): void;
  error(code: StreamErrorCode, message: string): void;
};

export type ChatTurnService = {
  /** Never throws. The caller holds the per-case lock. Nothing is persisted unless `completed` is reported. */
  runTurn(caseId: string, customerText: string, listener: ReplyListener, signal: AbortSignal): Promise<void>;
};

export function createChatTurnService(deps: {
  db: DatabaseSync;
  steps: AiSteps;
  clock: Clock;
}): ChatTurnService {
  const { db, steps, clock } = deps;
  const cases = createCaseRepository(db);
  const assessments = createAssessmentRepository(db);
  const messages = createMessageRepository(db);

  function loadContext(caseId: string): { ctx: ChatContext; current: Category } {
    const record = cases.findById(caseId);
    if (!record) throw new Error('case disappeared');
    const latest = assessments.findByCase(caseId).at(-1);
    if (!latest) throw new Error('case has no assessment');
    const currentAssessment: Assessment = {
      category: latest.category,
      justification: latest.justification,
      nextSteps: latest.nextSteps,
      unclearPoints: [], // not stored (ADR-003); the first message text carries them
      contradictions: [],
      source: latest.source === 'INITIAL' ? 'DECISION' : 'CHAT',
      previousCategory: latest.previousCategory,
      guardApplied: latest.guardApplied ?? [],
    };
    return {
      current: record.currentCategory,
      ctx: {
        form: {
          caseType: record.caseType,
          deviceCategory: record.deviceCategory,
          modelName: record.modelName,
          purchaseDate: record.purchaseDate,
          description: record.description,
        },
        analysis: record.imageAnalysis as ImageAnalysis,
        currentAssessment,
        messages: messages.findByCase(caseId).map((m) => ({ author: m.role, text: m.content })),
        today: clock.today(),
      },
    };
  }

  return {
    async runTurn(caseId, customerText, listener, signal) {
      try {
        const { ctx, current } = loadContext(caseId);
        const evaluation = await steps.chatEvaluate.evaluate(ctx, customerText, signal);
        const newCategory = evaluation.categoryChanged ? evaluation.newCategory : null;
        const changedTo = newCategory !== null && newCategory !== current ? newCategory : null;

        let content = '';
        const emit = (text: string) => {
          content += text;
          listener.token(text);
        };

        if (changedTo) {
          listener.assessmentChanged(current, changedTo); // before any token (AC-28)
          emit(`${changeNoticeLine(current, changedTo)}\n\n`); // ADR-002 §3.6 step 2
        }
        const streamed = content;
        const reply = await steps.chatReply.stream(ctx, customerText, evaluation, emit, signal);
        if (reply.trim() === '') throw new LlmInvalidOutputError('empty reply');
        if (changedTo) emit(`\n\n${MANDATORY_NOTICE}`); // ADR-002 §3.6 step 4
        // The reply text returned by the step is authoritative for the stored message.
        const finalContent = changedTo ? `${streamed}${reply}\n\n${MANDATORY_NOTICE}` : reply;
        if (signal.aborted) return; // client is gone: persist nothing

        const createdAt = clock.now();
        const turn = transaction(db, () => {
          let assessmentId: number | null = null;
          if (changedTo) {
            assessmentId = assessments.insert({
              caseId,
              category: changedTo,
              previousCategory: current,
              source: 'CHAT_REVISION',
              justification: evaluation.justification,
              nextSteps: evaluation.nextSteps,
              guardApplied: evaluation.guardApplied,
              createdAt,
            });
            if (cases.updateCurrentCategory(caseId, changedTo) !== 1) throw new Error('case update failed');
          }
          messages.insert({ caseId, role: 'CUSTOMER', content: customerText, assessmentId: null, createdAt });
          const id = messages.insert({ caseId, role: 'AGENT', content: finalContent, assessmentId, createdAt });
          return { id, createdAt };
        });

        listener.completed({
          message: {
            id: turn.id,
            role: 'AGENT',
            content: finalContent,
            createdAt: turn.createdAt,
            ...(changedTo ? { assessmentCategory: changedTo } : {}),
          },
          currentCategory: changedTo ?? current,
        });
      } catch (error) {
        if (signal.aborted) return;
        listener.error(toStreamErrorCode(error), STREAM_ERROR_MESSAGE);
      }
    },
  };
}
