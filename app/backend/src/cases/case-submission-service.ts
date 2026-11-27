import type { DatabaseSync } from 'node:sqlite';
import { composeFirstMessage } from '../ai/compose/firstMessageComposer.ts';
import type { CaseForm, UnusableReason } from '../ai/domain/types.ts';
import { LlmInvalidOutputError, type AiSteps } from '../ai/steps/types.ts';
import { ApiError } from '../config/errors.ts';
import type { Clock } from '../config/clock.ts';
import { compressForModel } from '../imaging/image-compressor.ts';
import { validateImage } from '../imaging/image-validator.ts';
import type { PhotoStore } from '../imaging/photo-store.ts';
import {
  createAssessmentRepository,
  createCaseRepository,
  createMessageRepository,
  newCaseId,
  transaction,
} from '../persistence/index.ts';
import { STREAM_ERROR_MESSAGE, toStreamErrorCode, type StreamErrorCode } from './stream-errors.ts';
import { UNUSABLE_PHOTO_MESSAGES } from './unusable-photo-messages.ts';

export type SubmissionStage = 'ANALYZING_PHOTO' | 'ASSESSING';

/** Progress callbacks (ADR-001 §5). Exactly one of photoUnusable / completed / error is the last call. */
export type SubmissionListener = {
  stage(stage: SubmissionStage): void;
  photoUnusable(reason: UnusableReason, message: string): void;
  completed(caseId: string): void;
  error(code: StreamErrorCode, message: string): void;
};

export type ModelNames = { vision: string; decision: string };

export type CaseSubmissionService = {
  /** Pre-stream check: throws ApiError 413 / 415 (format by content, size, decodable). */
  validatePhoto(photo: Buffer): Promise<void>;
  /** Never throws: every outcome is reported through the listener. Nothing is persisted unless `completed`. */
  submit(input: { form: CaseForm; photo: Buffer }, listener: SubmissionListener, signal: AbortSignal): Promise<void>;
};

export function createCaseSubmissionService(deps: {
  db: DatabaseSync;
  photoStore: PhotoStore;
  steps: AiSteps;
  clock: Clock;
  models?: ModelNames;
}): CaseSubmissionService {
  const { db, photoStore, steps, clock } = deps;
  const models = deps.models ?? { vision: 'unspecified', decision: 'unspecified' };
  const cases = createCaseRepository(db);
  const assessments = createAssessmentRepository(db);
  const messages = createMessageRepository(db);

  return {
    async validatePhoto(photo) {
      const result = await validateImage(photo);
      if (result.ok) return;
      if (result.reason === 'FILE_TOO_LARGE') throw ApiError.fileTooLarge();
      throw ApiError.unsupportedImage();
    },

    async submit({ form, photo }, listener, signal) {
      let savedPath: string | undefined;
      try {
        listener.stage('ANALYZING_PHOTO');
        const { jpeg } = await compressForModel(photo);
        const analysis = await steps.imageAnalysis.analyse(form, jpeg, signal);
        if (!analysis.usable) {
          if (!analysis.unusableReason) throw new LlmInvalidOutputError('usable=false without unusableReason');
          listener.photoUnusable(analysis.unusableReason, UNUSABLE_PHOTO_MESSAGES[analysis.unusableReason]);
          return;
        }

        listener.stage('ASSESSING');
        const assessment = await steps.decision.decide(form, analysis, clock.today(), signal);
        if (signal.aborted) return; // client is gone: persist nothing
        const firstMessage = composeFirstMessage(form, assessment);

        // One unit of work: photo file + (case, assessment, first message) in one transaction.
        const caseId = newCaseId();
        savedPath = await photoStore.save(caseId, jpeg);
        const createdAt = clock.now();
        transaction(db, () => {
          cases.insert({
            id: caseId,
            caseType: form.caseType,
            deviceCategory: form.deviceCategory,
            modelName: form.modelName,
            purchaseDate: form.purchaseDate,
            description: form.description,
            photoPath: savedPath!,
            imageAnalysis: analysis,
            currentCategory: assessment.category,
            visionModel: models.vision,
            decisionModel: models.decision,
            createdAt,
          });
          const assessmentId = assessments.insert({
            caseId,
            category: assessment.category,
            previousCategory: null,
            source: 'INITIAL',
            justification: assessment.justification,
            nextSteps: assessment.nextSteps,
            guardApplied: assessment.guardApplied,
            createdAt,
          });
          messages.insert({ caseId, role: 'AGENT', content: firstMessage, assessmentId, createdAt });
        });
        savedPath = undefined; // committed
        listener.completed(caseId);
      } catch (error) {
        if (savedPath) await photoStore.delete(savedPath).catch(() => undefined);
        if (signal.aborted) return;
        listener.error(toStreamErrorCode(error), STREAM_ERROR_MESSAGE);
      }
    },
  };
}
