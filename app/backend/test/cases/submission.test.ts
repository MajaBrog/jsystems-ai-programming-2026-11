import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LlmInvalidOutputError, LlmUnavailableError } from '../../src/ai/steps/types.ts';
import { composeFirstMessage } from '../../src/ai/compose/firstMessageComposer.ts';
import { makeAnalysis } from '../ai/support/fixtures.ts';
import {
  createFakeSteps,
  createHarness,
  examplePhoto,
  fakeAssessment,
  postCase,
  readSse,
  VALID_COMPLAINT_FIELDS,
  VALID_RETURN_FIELDS,
  type Harness,
  jsonOf,
} from './support.ts';

let h: Harness;
afterEach(async () => {
  expect(h.invariants()).toEqual([]); // TAC-002-02, TAC-003-02
  await h.close();
});

describe('POST /api/cases — happy path', () => {
  beforeEach(async () => {
    h = await createHarness();
  });

  it('streams stage ANALYZING_PHOTO, stage ASSESSING, completed and persists one unit of work', async () => {
    const res = await postCase(h.baseUrl, VALID_RETURN_FIELDS, await examplePhoto('phone-1.jpg'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream;charset=UTF-8');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('x-accel-buffering')).toBe('no');

    const events = await readSse(res);
    expect(events.map((e) => e.event)).toEqual(['stage', 'stage', 'completed']);
    expect(events[0]!.data).toEqual({ stage: 'ANALYZING_PHOTO' });
    expect(events[1]!.data).toEqual({ stage: 'ASSESSING' });
    const caseId = events[2]!.data.caseId as string;
    expect(caseId).toMatch(/^[0-9a-f-]{36}$/);

    expect(h.tableCounts()).toEqual({ cases: 1, assessments: 1, messages: 1 });
    expect(h.uploadFiles()).toEqual([`${caseId}.jpg`]);

    const c = h.db.prepare('SELECT * FROM cases WHERE id = ?').get(caseId)!;
    expect(c.current_category).toBe('ACCEPT');
    expect(c.photo_path).toBe(`uploads/${caseId}.jpg`);
    expect(c.description).toBeNull();
    const a = h.db.prepare('SELECT * FROM assessments WHERE case_id = ?').get(caseId)!;
    expect(a.source).toBe('INITIAL');
    expect(a.previous_category).toBeNull();
    const m = h.db.prepare('SELECT * FROM messages WHERE case_id = ?').get(caseId)!;
    expect(m.role).toBe('AGENT');
    expect(m.assessment_id).toBe(a.id);
    expect(m.content).toBe(
      composeFirstMessage(
        { caseType: 'RETURN', deviceCategory: 'LAPTOP', modelName: 'ThinkPad X1', purchaseDate: '2026-11-20', description: null },
        fakeAssessment(),
      ),
    );
  });

  it('passes the form, a JPEG <= 1568 px and today to the steps (AC-11, TAC-001-04)', async () => {
    await readSse(await postCase(h.baseUrl, VALID_COMPLAINT_FIELDS, await examplePhoto('laptop-1.png')));
    const [form, jpeg] = h.fake.analyse.mock.calls[0]!;
    expect(form).toEqual({
      caseType: 'COMPLAINT',
      deviceCategory: 'LAPTOP',
      modelName: 'ThinkPad X1',
      purchaseDate: '2026-11-20',
      description: 'Ekran przestał działać po tygodniu.',
    });
    const sharp = (await import('sharp')).default;
    const meta = await sharp(jpeg as Buffer).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(1568);
    expect(h.fake.decide.mock.calls[0]![2]).toBe('2026-11-26');
    expect(h.fake.analyse.mock.calls[0]![2]).toBeInstanceOf(AbortSignal);
  });

  it('accepts laptop-1.png (JPEG content, .png name) and laptop-2.webp', async () => {
    for (const name of ['laptop-1.png', 'laptop-2.webp']) {
      const events = await readSse(await postCase(h.baseUrl, VALID_RETURN_FIELDS, await examplePhoto(name)));
      expect(events.at(-1)!.event, name).toBe('completed');
    }
    expect(h.tableCounts().cases).toBe(2);
  });

  it('accepts an empty description for RETURN and purchase date = today', async () => {
    const res = await postCase(h.baseUrl, { ...VALID_RETURN_FIELDS, description: '', purchaseDate: '2026-11-26' }, await examplePhoto('phone-2.jpeg'));
    expect((await readSse(res)).at(-1)!.event).toBe('completed');
  });

  it('stores a NEEDS_REVIEW first assessment with its guard ids', async () => {
    await h.close();
    h = await createHarness({
      fake: createFakeSteps({
        decide: async () => fakeAssessment({ category: 'NEEDS_REVIEW', unclearPoints: ['Przyczyna niejasna.'], guardApplied: ['G5'] }),
      }),
    });
    const events = await readSse(await postCase(h.baseUrl, VALID_RETURN_FIELDS, await examplePhoto('phone-3.jpeg')));
    expect(events.at(-1)!.event).toBe('completed');
    expect(h.db.prepare('SELECT guard_applied, category FROM assessments').get()).toMatchObject({ guard_applied: 'G5', category: 'NEEDS_REVIEW' });
  });
});

describe('POST /api/cases — pre-stream validation', () => {
  beforeEach(async () => {
    h = await createHarness();
  });

  it('complaint without description -> 400 with field description, steps not called (AC-02)', async () => {
    const { description: _omit, ...fields } = VALID_COMPLAINT_FIELDS;
    for (const description of [undefined, '', '   ']) {
      const res = await postCase(h.baseUrl, description === undefined ? fields : { ...fields, description }, await examplePhoto('phone-1.jpg'));
      expect(res.status).toBe(400);
      expect(res.headers.get('content-type')).toContain('application/json');
      const body = await jsonOf(res);
      expect(body.code).toBe('VALIDATION_FAILED');
      expect(body.fieldErrors.map((f: any) => f.field)).toEqual(['description']);
      expect(body.fieldErrors[0].message.length).toBeGreaterThan(5);
    }
    expect(h.fake.analyse).not.toHaveBeenCalled();
    expect(h.tableCounts()).toEqual({ cases: 0, assessments: 0, messages: 0 });
  });

  it('future purchase date -> 400 with the PRD text (AC-04); tomorrow invalid, today valid', async () => {
    const res = await postCase(h.baseUrl, { ...VALID_RETURN_FIELDS, purchaseDate: '2026-11-27' }, await examplePhoto('phone-1.jpg'));
    expect(res.status).toBe(400);
    const body = await jsonOf(res);
    expect(body.fieldErrors).toEqual([{ field: 'purchaseDate', message: 'Data zakupu nie może być z przyszłości.' }]);
    expect(h.fake.analyse).not.toHaveBeenCalled();
  });

  it('reports every invalid field at once (including a missing photo)', async () => {
    const res = await postCase(h.baseUrl, { caseType: 'REFUND', modelName: 'X', purchaseDate: 'nie-data' });
    expect(res.status).toBe(400);
    const fields = (await jsonOf(res)).fieldErrors.map((f: any) => f.field).sort();
    expect(fields).toEqual(['caseType', 'deviceCategory', 'modelName', 'photo', 'purchaseDate']);
  });

  it.each([
    ['1 char', 'A', false],
    ['2 chars', 'AB', true],
    ['100 chars', 'x'.repeat(100), true],
    ['101 chars', 'x'.repeat(101), false],
    ['padded 1 char', '  A  ', false],
  ])('model name %s', async (_label, modelName, valid) => {
    const res = await postCase(h.baseUrl, { ...VALID_RETURN_FIELDS, modelName }, await examplePhoto('phone-2.jpeg'));
    if (valid) expect((await readSse(res)).at(-1)!.event).toBe('completed');
    else {
      expect(res.status).toBe(400);
      expect((await jsonOf(res)).fieldErrors[0].field).toBe('modelName');
    }
  });

  it('rejects a description longer than 2000 characters', async () => {
    const res = await postCase(h.baseUrl, { ...VALID_RETURN_FIELDS, description: 'a'.repeat(2001) }, await examplePhoto('phone-2.jpeg'));
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).fieldErrors[0].field).toBe('description');
  });

  it('non-image bytes (text, PDF) named .jpg -> 415 UNSUPPORTED_IMAGE (AC-07)', async () => {
    for (const bytes of [Buffer.from('to nie jest obraz, tylko tekst'), Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n')]) {
      const res = await postCase(h.baseUrl, VALID_RETURN_FIELDS, { name: 'foto.jpg', bytes, type: 'image/jpeg' });
      expect(res.status).toBe(415);
      expect(await jsonOf(res)).toMatchObject({ code: 'UNSUPPORTED_IMAGE', message: 'Dozwolone formaty: JPG, PNG, WEBP.' });
    }
    expect(h.fake.analyse).not.toHaveBeenCalled();
    expect(h.uploadFiles()).toEqual([]);
  });

  it('truncated JPEG with a valid header -> 415', async () => {
    const photo = await examplePhoto('phone-1.jpg');
    const res = await postCase(h.baseUrl, VALID_RETURN_FIELDS, { name: 'phone-1.jpg', bytes: photo.bytes.subarray(0, 4000) });
    expect(res.status).toBe(415);
  });

  it('non-multipart request -> 400 VALIDATION_FAILED', async () => {
    const res = await fetch(`${h.baseUrl}/api/cases`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).code).toBe('VALIDATION_FAILED');
  });
});

describe('POST /api/cases — size limit (AC-08)', () => {
  it('a real photo above the (test-lowered) limit -> 413 FILE_TOO_LARGE, nothing persisted', async () => {
    const photo = await examplePhoto('phone-1.jpg'); // ~107 KB
    h = await createHarness({ maxPhotoBytes: 50_000 });
    const res = await postCase(h.baseUrl, VALID_RETURN_FIELDS, photo);
    expect(res.status).toBe(413);
    expect(await jsonOf(res)).toMatchObject({ code: 'FILE_TOO_LARGE', message: 'Plik przekracza limit 10 MB.' });
    expect(h.fake.analyse).not.toHaveBeenCalled();
    expect(h.uploadFiles()).toEqual([]);
  });

  it('a real photo within the limit is accepted', async () => {
    h = await createHarness({ maxPhotoBytes: 200_000 });
    const events = await readSse(await postCase(h.baseUrl, VALID_RETURN_FIELDS, await examplePhoto('phone-1.jpg')));
    expect(events.at(-1)!.event).toBe('completed');
  });
});

describe('POST /api/cases — unusable photo and failures', () => {
  it('unusable photo -> photo_unusable with the Polish message, no decision, no rows, no file (AC-14)', async () => {
    h = await createHarness({
      fake: createFakeSteps({ analyse: async () => makeAnalysis({ usable: false, unusableReason: 'BLURRED', deviceVisible: false }) }),
    });
    const events = await readSse(await postCase(h.baseUrl, VALID_RETURN_FIELDS, await examplePhoto('phone-1.jpg')));
    expect(events.map((e) => e.event)).toEqual(['stage', 'photo_unusable']);
    expect(events[1]!.data.reason).toBe('BLURRED');
    expect(events[1]!.data.message).toMatch(/rozmyte/i);
    expect(h.fake.decide).not.toHaveBeenCalled();
    expect(h.tableCounts()).toEqual({ cases: 0, assessments: 0, messages: 0 });
    expect(h.uploadFiles()).toEqual([]);
  });

  it('usable=false without a reason is invalid output', async () => {
    h = await createHarness({ fake: createFakeSteps({ analyse: async () => makeAnalysis({ usable: false, unusableReason: null }) }) });
    const events = await readSse(await postCase(h.baseUrl, VALID_RETURN_FIELDS, await examplePhoto('phone-1.jpg')));
    expect(events.at(-1)).toMatchObject({ event: 'error', data: { code: 'LLM_INVALID_OUTPUT' } });
  });

  it.each([
    ['analyse unavailable', { analyse: async () => { throw new LlmUnavailableError('x'); } }, 'LLM_UNAVAILABLE', ['stage', 'error']],
    ['decide unavailable', { decide: async () => { throw new LlmUnavailableError('x'); } }, 'LLM_UNAVAILABLE', ['stage', 'stage', 'error']],
    ['decide invalid output', { decide: async () => { throw new LlmInvalidOutputError('x'); } }, 'LLM_INVALID_OUTPUT', ['stage', 'stage', 'error']],
    ['unexpected', { decide: async () => { throw new Error('boom secret detail'); } }, 'INTERNAL_ERROR', ['stage', 'stage', 'error']],
  ])('%s -> error %s, nothing persisted', async (_label, overrides, code, order) => {
    h = await createHarness({ fake: createFakeSteps(overrides as any) });
    const res = await postCase(h.baseUrl, VALID_RETURN_FIELDS, await examplePhoto('phone-1.jpg'));
    const events = await readSse(res);
    expect(events.map((e) => e.event)).toEqual(order);
    const err = events.at(-1)!;
    expect(err.data).toEqual({ code, message: 'Usługa jest chwilowo niedostępna. Spróbuj ponownie.' });
    expect(h.tableCounts()).toEqual({ cases: 0, assessments: 0, messages: 0 });
    expect(h.uploadFiles()).toEqual([]);
  });

  it('DB failure while persisting -> error INTERNAL_ERROR and the photo file is deleted (TAC-06)', async () => {
    h = await createHarness();
    h.db.exec('DROP TABLE messages'); // the transaction fails on the last insert
    const events = await readSse(await postCase(h.baseUrl, VALID_RETURN_FIELDS, await examplePhoto('phone-1.jpg')));
    expect(events.at(-1)).toMatchObject({ event: 'error', data: { code: 'INTERNAL_ERROR' } });
    expect(h.uploadFiles()).toEqual([]);
    expect(Number(h.db.prepare('SELECT count(*) AS n FROM cases').get()!.n)).toBe(0);
    h.db.exec(`CREATE TABLE messages (id INTEGER PRIMARY KEY AUTOINCREMENT, case_id TEXT, role TEXT, content TEXT, assessment_id INTEGER, created_at TEXT)`);
  });

  it('client disconnect during analysis aborts the step signal and persists nothing', async () => {
    let seen: AbortSignal | undefined;
    let entered!: () => void;
    const enteredP = new Promise<void>((r) => (entered = r));
    h = await createHarness({
      fake: createFakeSteps({
        analyse: (_f: unknown, _j: unknown, signal?: AbortSignal) => {
          seen = signal;
          entered();
          return new Promise((_res, rej) => signal?.addEventListener('abort', () => rej(new LlmUnavailableError('aborted'))));
        },
      }),
    });
    const ac = new AbortController();
    const pending = postCase(h.baseUrl, VALID_RETURN_FIELDS, await examplePhoto('phone-1.jpg'), ac.signal).then((r) => r.text()).catch(() => 'aborted');
    await enteredP;
    expect(seen!.aborted).toBe(false);
    ac.abort();
    await pending;
    await expect.poll(() => seen!.aborted).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(h.tableCounts()).toEqual({ cases: 0, assessments: 0, messages: 0 });
    expect(h.uploadFiles()).toEqual([]);
  });
});
