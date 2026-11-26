import { mkdtempSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import type { FastifyInstance } from 'fastify';
import { vi } from 'vitest';
import { buildApp } from '../../src/app.ts';
import { createCaseLocks, type CaseLocks } from '../../src/cases/case-locks.ts';
import { fixedClock } from '../../src/config/clock.ts';
import { createPhotoStore, type PhotoStore } from '../../src/imaging/photo-store.ts';
import { openDatabase } from '../../src/persistence/index.ts';
import type { AiSteps } from '../../src/ai/steps/types.ts';
import type { Assessment, ChatContext, ImageAnalysis } from '../../src/ai/domain/types.ts';
import type { GuardedEvaluation } from '../../src/ai/guard/policyGuard.ts';
import { makeAnalysis } from '../ai/support/fixtures.ts';
import { checkInvariants } from '../support/invariants.ts';
import { testConfig } from '../support/test-config.ts';

export const TODAY = '2026-11-26';
export const EXAMPLE_IMAGES = join(import.meta.dirname, '../../../../assets/example-images');

export function fakeAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    category: 'ACCEPT',
    justification: [{ ruleId: 'Z-7.1', text: 'Warunki polityki są spełnione.' }],
    nextSteps: ['Odeślij urządzenie na wskazany adres.'],
    unclearPoints: [],
    contradictions: [],
    source: 'DECISION',
    previousCategory: null,
    guardApplied: [],
    ...overrides,
  };
}

export function fakeEvaluation(overrides: Partial<GuardedEvaluation> = {}): GuardedEvaluation {
  return {
    categoryChanged: false,
    newCategory: null,
    justification: [],
    nextSteps: [],
    contradictions: [],
    offTopic: false,
    guardApplied: [],
    unclearPoints: [],
    ...overrides,
  };
}

export type FakeSteps = {
  steps: AiSteps;
  analyse: ReturnType<typeof vi.fn>;
  decide: ReturnType<typeof vi.fn>;
  evaluate: ReturnType<typeof vi.fn>;
  stream: ReturnType<typeof vi.fn>;
};

/** Fakes of OUR OWN step contracts (ADR-005/AGENTS.md unit-test rule); no OpenRouter bytes are invented. */
export function createFakeSteps(
  overrides: {
    analyse?: (...args: any[]) => Promise<ImageAnalysis>;
    decide?: (...args: any[]) => Promise<Assessment>;
    evaluate?: (ctx: ChatContext, text: string, signal?: AbortSignal) => Promise<GuardedEvaluation>;
    stream?: (
      ctx: ChatContext,
      text: string,
      evaluation: GuardedEvaluation,
      onToken: (t: string) => void,
      signal?: AbortSignal,
    ) => Promise<string>;
  } = {},
): FakeSteps {
  const analyse = vi.fn(overrides.analyse ?? (async () => makeAnalysis()));
  const decide = vi.fn(overrides.decide ?? (async () => fakeAssessment()));
  const evaluate = vi.fn(overrides.evaluate ?? (async () => fakeEvaluation()));
  const stream = vi.fn(
    overrides.stream ??
      (async (_c: ChatContext, _t: string, _e: GuardedEvaluation, onToken: (t: string) => void) => {
        onToken('Odpowiedź ');
        onToken('testowa.');
        return 'Odpowiedź testowa.';
      }),
  );
  return {
    steps: {
      imageAnalysis: { analyse },
      decision: { decide },
      chatEvaluate: { evaluate },
      chatReply: { stream },
    } as AiSteps,
    analyse,
    decide,
    evaluate,
    stream,
  };
}

export type Harness = {
  app: FastifyInstance;
  baseUrl: string;
  db: DatabaseSync;
  dataDir: string;
  photoStore: PhotoStore;
  locks: CaseLocks;
  fake: FakeSteps;
  uploadFiles(): string[];
  invariants(): string[];
  tableCounts(): { cases: number; assessments: number; messages: number };
  close(): Promise<void>;
};

export async function createHarness(
  opts: { fake?: FakeSteps; maxPhotoBytes?: number; photoStore?: PhotoStore } = {},
): Promise<Harness> {
  const dataDir = mkdtempSync(join(tmpdir(), 'copilot-cases-'));
  const db = openDatabase(dataDir);
  const photoStore = opts.photoStore ?? createPhotoStore(dataDir);
  const clock = fixedClock(TODAY);
  const locks = createCaseLocks();
  const fake = opts.fake ?? createFakeSteps();
  const app = await buildApp({
    config: testConfig(),
    clock,
    ...(opts.maxPhotoBytes !== undefined ? { maxPhotoBytes: opts.maxPhotoBytes } : {}),
    cases: { db, photoStore, steps: fake.steps, clock, locks },
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const address = app.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const count = (table: string) => Number(db.prepare(`SELECT count(*) AS n FROM ${table}`).get()?.n);
  return {
    app,
    baseUrl: `http://127.0.0.1:${port}`,
    db,
    dataDir,
    photoStore,
    locks,
    fake,
    uploadFiles: () => (existsSync(join(dataDir, 'uploads')) ? readdirSync(join(dataDir, 'uploads')) : []),
    invariants: () => checkInvariants(db, dataDir),
    tableCounts: () => ({ cases: count('cases'), assessments: count('assessments'), messages: count('messages') }),
    async close() {
      app.server.closeAllConnections(); // abandoned SSE clients must not block teardown
      await app.close();
      db.close();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

export const VALID_RETURN_FIELDS: Record<string, string> = {
  caseType: 'RETURN',
  deviceCategory: 'LAPTOP',
  modelName: 'ThinkPad X1',
  purchaseDate: '2026-11-20',
};

export const VALID_COMPLAINT_FIELDS: Record<string, string> = {
  ...VALID_RETURN_FIELDS,
  caseType: 'COMPLAINT',
  description: 'Ekran przestał działać po tygodniu.',
};

export type Photo = { name: string; bytes: Buffer; type?: string };

export async function examplePhoto(name: string): Promise<Photo> {
  return { name, bytes: await readFile(join(EXAMPLE_IMAGES, name)) };
}

export function postCase(
  baseUrl: string,
  fields: Record<string, string>,
  photo?: Photo,
  signal?: AbortSignal,
): Promise<Response> {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (photo) form.append('photo', new Blob([new Uint8Array(photo.bytes)], { type: photo.type ?? 'image/jpeg' }), photo.name);
  return fetch(`${baseUrl}/api/cases`, { method: 'POST', body: form, ...(signal ? { signal } : {}) });
}

export function postMessage(baseUrl: string, caseId: string, body: unknown, signal?: AbortSignal): Promise<Response> {
  return fetch(`${baseUrl}/api/cases/${caseId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    ...(signal ? { signal } : {}),
  });
}

export type SseEvent = { event: string; data: any; raw: string };

export function parseSse(text: string): SseEvent[] {
  return text
    .split('\n\n')
    .filter((block) => block.trim() !== '')
    .map((block) => {
      const lines = block.split('\n');
      const event = lines.find((l) => l.startsWith('event: '))?.slice(7) ?? '';
      const dataLines = lines.filter((l) => l.startsWith('data: '));
      if (dataLines.length !== 1) throw new Error(`event must have exactly one data line: ${block}`);
      return { event, data: JSON.parse(dataLines[0]!.slice(6)), raw: block };
    });
}

export async function readSse(response: Response): Promise<SseEvent[]> {
  return parseSse(await response.text());
}

/** Runs a valid submission through the HTTP API and returns the created case id. */
export async function createCaseViaApi(h: Harness, fields = VALID_RETURN_FIELDS, photoName = 'phone-1.jpg'): Promise<string> {
  const res = await postCase(h.baseUrl, fields, await examplePhoto(photoName));
  const events = await readSse(res);
  const done = events.find((e) => e.event === 'completed');
  if (!done) throw new Error(`submission did not complete: ${JSON.stringify(events)}`);
  return done.data.caseId as string;
}

export function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

export const jsonOf = (res: Response): Promise<any> => res.json();
