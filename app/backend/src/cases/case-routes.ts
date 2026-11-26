import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { CaseForm } from '../ai/domain/types.ts';
import type { AiSteps } from '../ai/steps/types.ts';
import type { Clock } from '../config/clock.ts';
import { ApiError, type FieldError } from '../config/errors.ts';
import type { PhotoStore } from '../imaging/photo-store.ts';
import {
  createAssessmentRepository,
  createCaseRepository,
  createMessageRepository,
} from '../persistence/index.ts';
import { buildCaseView, CASE_ID_PATTERN } from './case-view.ts';
import type { CaseLocks } from './case-locks.ts';
import { createCaseSubmissionService, type ModelNames } from './case-submission-service.ts';
import { createChatTurnService } from './chat-turn-service.ts';
import { openSseStream } from './sse-event-writer.ts';

export type CaseRoutesDeps = {
  db: DatabaseSync;
  photoStore: PhotoStore;
  steps: AiSteps;
  clock: Clock;
  locks: CaseLocks;
  /** Model ids stored with each case for the service team (ADR-003 §4); defaults to "unspecified". */
  models?: ModelNames;
};

export const DEVICE_CATEGORIES = [
  'SMARTPHONE', 'LAPTOP', 'TABLET', 'DESKTOP', 'MONITOR', 'TV', 'AUDIO', 'WEARABLE', 'CAMERA',
  'GAME_CONSOLE', 'PRINTER', 'SMALL_APPLIANCE', 'OTHER',
] as const;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
function isRealDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value);
}

function formSchema(today: string) {
  return z
    .object({
      caseType: z.enum(['COMPLAINT', 'RETURN'], { error: 'Wybierz rodzaj zgłoszenia.' }),
      deviceCategory: z.enum(DEVICE_CATEGORIES, { error: 'Wybierz kategorię urządzenia.' }),
      modelName: z
        .string({ error: 'Podaj model urządzenia.' })
        .trim()
        .min(2, 'Nazwa modelu musi mieć od 2 do 100 znaków.')
        .max(100, 'Nazwa modelu musi mieć od 2 do 100 znaków.'),
      purchaseDate: z
        .string({ error: 'Podaj datę zakupu.' })
        .refine(isRealDate, 'Podaj poprawną datę zakupu.')
        .refine((v) => !isRealDate(v) || v <= today, 'Data zakupu nie może być z przyszłości.'),
      description: z.string().trim().max(2000, 'Opis może mieć maksymalnie 2000 znaków.').optional(),
    })
    .superRefine((value, ctx) => {
      if (value.caseType === 'COMPLAINT' && !value.description) {
        ctx.addIssue({ code: 'custom', path: ['description'], message: 'Opisz usterkę i okoliczności jej powstania.' });
      }
    });
}

const messageSchema = z.object({
  content: z
    .string({ error: 'Wpisz wiadomość.' })
    .trim()
    .min(1, 'Wpisz wiadomość.')
    .max(2000, 'Wiadomość może mieć maksymalnie 2000 znaków.'),
});

/** First message per field (issues of one field are not repeated). */
function toFieldErrors(error: z.ZodError): FieldError[] {
  const seen = new Map<string, string>();
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form');
    if (!seen.has(field)) seen.set(field, issue.message);
  }
  return [...seen].map(([field, message]) => ({ field, message }));
}

async function readSubmissionParts(request: FastifyRequest): Promise<{ fields: Record<string, string>; photo?: Buffer }> {
  if (!request.isMultipart()) {
    throw ApiError.validation([{ field: 'photo', message: 'Wyślij formularz wraz ze zdjęciem.' }]);
  }
  const fields: Record<string, string> = {};
  let photo: Buffer | undefined;
  for await (const part of request.parts()) {
    if (part.type === 'file') {
      const bytes = await part.toBuffer(); // throws FST_REQ_FILE_TOO_LARGE -> 413 (AC-08)
      if (part.fieldname === 'photo' && photo === undefined) photo = bytes;
    } else if (typeof part.value === 'string') {
      fields[part.fieldname] = part.value;
    }
  }
  return photo ? { fields, photo } : { fields };
}

/** Registers the four case endpoints on `app` (multipart and the error handler come from buildApp). */
export async function registerCaseRoutes(app: FastifyInstance, deps: CaseRoutesDeps): Promise<void> {
  const { db, photoStore, locks, clock } = deps;
  const cases = createCaseRepository(db);
  const assessments = createAssessmentRepository(db);
  const messages = createMessageRepository(db);
  const submission = createCaseSubmissionService({
    db, photoStore, steps: deps.steps, clock, ...(deps.models ? { models: deps.models } : {}),
  });
  const chat = createChatTurnService({ db, steps: deps.steps, clock });

  const findCase = (id: string) => (CASE_ID_PATTERN.test(id) ? cases.findById(id) : undefined);

  app.post('/api/cases', async (request: FastifyRequest, reply: FastifyReply) => {
    const { fields, photo } = await readSubmissionParts(request);
    const parsed = formSchema(clock.today()).safeParse(fields);
    const fieldErrors = parsed.success ? [] : toFieldErrors(parsed.error);
    if (!photo || photo.length === 0) fieldErrors.push({ field: 'photo', message: 'Dodaj zdjęcie urządzenia.' });
    if (!parsed.success || !photo || photo.length === 0) throw ApiError.validation(fieldErrors);
    await submission.validatePhoto(photo); // 413 / 415 before the stream starts

    const form: CaseForm = {
      caseType: parsed.data.caseType,
      deviceCategory: parsed.data.deviceCategory,
      modelName: parsed.data.modelName,
      purchaseDate: parsed.data.purchaseDate,
      description: parsed.data.description ? parsed.data.description : null,
    };
    const sse = openSseStream(request, reply);
    await submission.submit({ form, photo }, sse.submission, sse.signal);
    sse.finish();
    return reply;
  });

  app.get<{ Params: { id: string } }>('/api/cases/:id', async (request) => {
    const record = findCase(request.params.id);
    if (!record) throw ApiError.caseNotFound();
    return buildCaseView(record, assessments, messages);
  });

  app.get<{ Params: { id: string } }>('/api/cases/:id/photo', async (request, reply) => {
    const record = findCase(request.params.id);
    if (!record) throw ApiError.caseNotFound();
    let bytes: Buffer;
    try {
      bytes = await photoStore.read(record.photoPath);
    } catch {
      throw ApiError.caseNotFound();
    }
    return reply.header('Cache-Control', 'private, max-age=3600').type('image/jpeg').send(bytes);
  });

  app.post<{ Params: { id: string } }>('/api/cases/:id/messages', async (request, reply) => {
    const record = findCase(request.params.id);
    if (!record) throw ApiError.caseNotFound();
    const parsed = messageSchema.safeParse(request.body ?? {});
    if (!parsed.success) throw ApiError.validation(toFieldErrors(parsed.error).map((e) => ({ ...e, field: 'content' })));
    if (!locks.tryAcquire(record.id)) throw ApiError.replyInProgress();
    try {
      const sse = openSseStream(request, reply);
      await chat.runTurn(record.id, parsed.data.content, sse.reply, sse.signal);
      sse.finish();
    } finally {
      locks.release(record.id);
    }
    return reply;
  });
}
