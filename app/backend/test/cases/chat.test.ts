import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LlmUnavailableError } from '../../src/ai/steps/types.ts';
import { MANDATORY_NOTICE } from '../../src/ai/compose/firstMessageComposer.ts';
import type { ChatContext } from '../../src/ai/domain/types.ts';
import {
  createCaseViaApi,
  createFakeSteps,
  createHarness,
  deferred,
  fakeEvaluation,
  postMessage,
  readSse,
  type Harness,
  jsonOf,
} from './support.ts';

let h: Harness;
afterEach(async () => {
  expect(h.invariants()).toEqual([]); // TAC-003-02 (I1-I4)
  expect(h.guardRules()).toEqual([]); // TAC-002-02 (G1/G3 re-checked on persisted rows)
  await h.close();
});

const rows = (h: Harness, id: string) => h.db.prepare('SELECT * FROM messages WHERE case_id = ? ORDER BY id').all(id);

describe('POST /api/cases/:id/messages — unchanged assessment', () => {
  let id: string;
  beforeEach(async () => {
    h = await createHarness();
    id = await createCaseViaApi(h);
  });

  it('streams tokens then completed; persists customer + agent message (2 rows, no assessment)', async () => {
    const res = await postMessage(h.baseUrl, id, { content: '  Ile to potrwa?  ' });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/event-stream;charset=UTF-8');
    const events = await readSse(res);
    expect(events.map((e) => e.event)).toEqual(['token', 'token', 'completed']);
    expect(events.slice(0, 2).map((e) => e.data.text)).toEqual(['Odpowiedź ', 'testowa.']);
    const done = events[2]!.data;
    expect(done.currentCategory).toBe('ACCEPT');
    expect(done.message).toMatchObject({ role: 'AGENT', content: 'Odpowiedź testowa.' });
    expect(done.message.assessmentCategory).toBeUndefined();
    expect(typeof done.message.id).toBe('number');
    expect(typeof done.message.createdAt).toBe('string');

    const m = rows(h, id);
    expect(m.map((r) => r.role)).toEqual(['AGENT', 'CUSTOMER', 'AGENT']);
    expect(m[1]!.content).toBe('Ile to potrwa?'); // trimmed
    expect(m[2]!.content).toBe('Odpowiedź testowa.');
    expect(m[2]!.id).toBe(done.message.id);
    expect(m[2]!.assessment_id).toBeNull();
    expect(h.tableCounts().assessments).toBe(1);
  });

  it('gives the steps the full context: form, analysis, current assessment, earlier messages, today (AC-26)', async () => {
    await readSse(await postMessage(h.baseUrl, id, { content: 'Jaką datę podałem?' }));
    const [ctx, text, signal] = h.fake.evaluate.mock.calls[0]! as [ChatContext, string, AbortSignal];
    expect(text).toBe('Jaką datę podałem?');
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(ctx.today).toBe('2026-11-26');
    expect(ctx.form).toMatchObject({ caseType: 'RETURN', purchaseDate: '2026-11-20', modelName: 'ThinkPad X1' });
    expect(ctx.analysis.usable).toBe(true);
    expect(ctx.currentAssessment).toMatchObject({ category: 'ACCEPT', source: 'DECISION', previousCategory: null });
    expect(ctx.messages).toHaveLength(1);
    expect(ctx.messages[0]!.author).toBe('AGENT');
    // second turn sees the first turn
    await readSse(await postMessage(h.baseUrl, id, { content: 'A druga sprawa' }));
    const ctx2 = h.fake.evaluate.mock.calls[1]![0] as ChatContext;
    expect(ctx2.messages.map((m) => m.author)).toEqual(['AGENT', 'CUSTOMER', 'AGENT']);
    expect(ctx2.messages[1]!.text).toBe('Jaką datę podałem?');
  });
});

describe('POST /api/cases/:id/messages — assessment changed (AC-28)', () => {
  it('emits assessment_changed before any token, notice first, mandatory notice last; persists everything', async () => {
    const order: string[] = [];
    h = await createHarness({
      fake: createFakeSteps({
        evaluate: async () =>
          fakeEvaluation({
            categoryChanged: true,
            newCategory: 'REJECT',
            justification: [{ ruleId: 'Z-2.1', text: 'Termin minął.' }],
            nextSteps: ['Skontaktuj się z serwisem.'],
            guardApplied: ['G1'],
          }),
        stream: async (_c, _t, _e, onToken) => {
          order.push('stream-start');
          onToken('Uzasadnienie ');
          onToken('zmiany.');
          return 'Uzasadnienie zmiany.';
        },
      }),
    });
    const id = await createCaseViaApi(h);
    const res = await postMessage(h.baseUrl, id, { content: 'Kupiłem w sklepie stacjonarnym.' });
    const events = await readSse(res);
    expect(events[0]).toMatchObject({ event: 'assessment_changed', data: { from: 'ACCEPT', to: 'REJECT' } });
    expect(events.filter((e) => e.event === 'assessment_changed')).toHaveLength(1);
    const tokens = events.filter((e) => e.event === 'token').map((e) => e.data.text as string);
    expect(tokens[0]).toContain('Wstępna ocena zmieniona: Przyjęte wstępnie → Odrzucone wstępnie');
    expect(tokens.at(-1)).toContain(MANDATORY_NOTICE);
    expect(events.at(-1)!.event).toBe('completed');

    const done = events.at(-1)!.data;
    const expected = `Wstępna ocena zmieniona: Przyjęte wstępnie → Odrzucone wstępnie\n\nUzasadnienie zmiany.\n\n${MANDATORY_NOTICE}`;
    expect(done.message.content).toBe(expected);
    expect(tokens.join('')).toBe(expected);
    expect(done.currentCategory).toBe('REJECT');
    expect(done.message.assessmentCategory).toBe('REJECT');

    const a = h.db.prepare("SELECT * FROM assessments WHERE source = 'CHAT_REVISION'").all();
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ category: 'REJECT', previous_category: 'ACCEPT', guard_applied: 'G1', case_id: id });
    expect(JSON.parse(a[0]!.justification_json as string)).toEqual([{ ruleId: 'Z-2.1', text: 'Termin minął.' }]);
    expect(h.db.prepare('SELECT current_category FROM cases WHERE id = ?').get(id)!.current_category).toBe('REJECT');
    const m = rows(h, id);
    expect(m).toHaveLength(3);
    expect(m[2]!.content).toBe(expected);
    expect(m[2]!.assessment_id).toBe(a[0]!.id);
    expect(m[1]!.assessment_id).toBeNull();

    const view = await jsonOf(await fetch(`${h.baseUrl}/api/cases/${id}`));
    expect(view.currentCategory).toBe('REJECT');
    expect(view.assessments.map((x: any) => x.source)).toEqual(['INITIAL', 'CHAT_REVISION']);
    expect(view.messages.at(-1).assessmentCategory).toBe('REJECT');
  });

  it('drops a change line the model repeated at the start of its reply (seen in real E2E runs)', async () => {
    h = await createHarness({
      fake: createFakeSteps({
        evaluate: async () =>
          fakeEvaluation({
            categoryChanged: true,
            newCategory: 'REJECT',
            justification: [{ ruleId: 'Z-6.1', text: 'Zakup stacjonarny.' }],
            nextSteps: ['Skontaktuj się z obsługą.'],
          }),
        // Model text shape observed in data/copilot.db after the E2E run (duplicate, slightly different wording).
        stream: async (_c, _t, _e, onToken) => {
          const reply = 'Wstępna ocena zmieniona: Przyjęte wstępnie → Odrzucona.\n\nZakup stacjonarny nie podlega zwrotowi.';
          onToken(reply);
          return reply;
        },
      }),
    });
    const id = await createCaseViaApi(h);
    const events = await readSse(await postMessage(h.baseUrl, id, { content: 'Kupiłem w sklepie stacjonarnym.' }));
    const content = events.at(-1)!.data.message.content as string;
    expect(content.match(/Wstępna ocena zmieniona:/g)).toHaveLength(1);
    expect(content).toBe(`Wstępna ocena zmieniona: Przyjęte wstępnie → Odrzucone wstępnie\n\nZakup stacjonarny nie podlega zwrotowi.\n\n${MANDATORY_NOTICE}`);
    expect(rows(h, id)[2]!.content).toBe(content);
  });

  it('a "changed" evaluation equal to the current category is treated as unchanged', async () => {
    h = await createHarness({
      fake: createFakeSteps({ evaluate: async () => fakeEvaluation({ categoryChanged: true, newCategory: 'ACCEPT', justification: [{ ruleId: 'Z-7.1', text: 'x' }] }) }),
    });
    const id = await createCaseViaApi(h);
    const events = await readSse(await postMessage(h.baseUrl, id, { content: 'Hej' }));
    expect(events.map((e) => e.event)).not.toContain('assessment_changed');
    expect(h.tableCounts().assessments).toBe(1);
  });
});

describe('POST /api/cases/:id/messages — content length in code points', () => {
  it('2000 emoji are accepted, 2001 rejected', async () => {
    h = await createHarness();
    const id = await createCaseViaApi(h);
    expect((await readSse(await postMessage(h.baseUrl, id, { content: '📱'.repeat(2000) }))).at(-1)!.event).toBe('completed');
    expect((await postMessage(h.baseUrl, id, { content: '📱'.repeat(2001) })).status).toBe(400);
  });
});

describe('POST /api/cases/:id/messages — G5 on an unchanged evaluation (AC-22)', () => {
  it('persists a guard-made ACCEPT -> NEEDS_REVIEW as assessment_changed + CHAT_REVISION', async () => {
    h = await createHarness({
      fake: createFakeSteps({
        evaluate: async () =>
          fakeEvaluation({
            categoryChanged: true,
            newCategory: 'NEEDS_REVIEW',
            justification: [{ ruleId: 'Z-7.3', text: 'Dane są sprzeczne.' }],
            nextSteps: ['Zespół serwisowy zweryfikuje zgłoszenie.'],
            unclearPoints: ['Sprzeczna data zakupu.'],
            contradictions: ['Sprzeczna data zakupu.'],
            guardApplied: ['G5'],
          }),
      }),
    });
    const id = await createCaseViaApi(h);
    const events = await readSse(await postMessage(h.baseUrl, id, { content: 'Kupiłem to jednak wcześniej.' }));
    expect(events[0]).toMatchObject({ event: 'assessment_changed', data: { from: 'ACCEPT', to: 'NEEDS_REVIEW' } });
    expect(events.at(-1)!.data.currentCategory).toBe('NEEDS_REVIEW');
    const a = h.db.prepare("SELECT * FROM assessments WHERE source = 'CHAT_REVISION'").all();
    expect(a).toHaveLength(1);
    expect(a[0]).toMatchObject({ category: 'NEEDS_REVIEW', previous_category: 'ACCEPT', guard_applied: 'G5' });
    expect(h.db.prepare('SELECT current_category FROM cases WHERE id = ?').get(id)!.current_category).toBe('NEEDS_REVIEW');
  });
});

describe('POST /api/cases/:id/messages — failures (AC-31)', () => {
  it('stream failure mid-way -> error LLM_UNAVAILABLE after partial tokens; nothing persisted, lock released', async () => {
    h = await createHarness({
      fake: createFakeSteps({
        stream: async (_c, _t, _e, onToken) => {
          onToken('Część ');
          throw new LlmUnavailableError('stream broke');
        },
      }),
    });
    const id = await createCaseViaApi(h);
    const before = h.tableCounts();
    const events = await readSse(await postMessage(h.baseUrl, id, { content: 'Pytanie' }));
    expect(events.map((e) => e.event)).toEqual(['token', 'error']);
    expect(events[1]!.data).toEqual({ code: 'LLM_UNAVAILABLE', message: 'Usługa jest chwilowo niedostępna. Spróbuj ponownie.' });
    expect(h.tableCounts()).toEqual(before);
    expect(h.locks.isLocked(id)).toBe(false);
  });

  it('failure after a changed evaluation persists neither the message nor the new assessment', async () => {
    h = await createHarness({
      fake: createFakeSteps({
        evaluate: async () => fakeEvaluation({ categoryChanged: true, newCategory: 'REJECT', justification: [{ ruleId: 'Z-2.1', text: 'x' }], nextSteps: ['y'] }),
        stream: async () => {
          throw new LlmUnavailableError('down');
        },
      }),
    });
    const id = await createCaseViaApi(h);
    const before = h.tableCounts();
    const events = await readSse(await postMessage(h.baseUrl, id, { content: 'Pytanie' }));
    expect(events.map((e) => e.event)).toEqual(['assessment_changed', 'token', 'error']);
    expect(h.tableCounts()).toEqual(before);
    expect(h.db.prepare('SELECT current_category FROM cases WHERE id = ?').get(id)!.current_category).toBe('ACCEPT');
  });

  it('evaluate failure -> error, no tokens, nothing persisted', async () => {
    h = await createHarness({ fake: createFakeSteps({ evaluate: async () => { throw new LlmUnavailableError('x'); } }) });
    const id = await createCaseViaApi(h);
    const before = h.tableCounts();
    const events = await readSse(await postMessage(h.baseUrl, id, { content: 'Pytanie' }));
    expect(events.map((e) => e.event)).toEqual(['error']);
    expect(h.tableCounts()).toEqual(before);
  });

  it('DB failure while persisting the turn -> error INTERNAL_ERROR, nothing written', async () => {
    h = await createHarness();
    const id = await createCaseViaApi(h);
    h.db.exec('CREATE TRIGGER fail_agent BEFORE INSERT ON messages WHEN NEW.role = \'AGENT\' BEGIN SELECT RAISE(ABORT, \'boom\'); END');
    const before = h.tableCounts();
    const events = await readSse(await postMessage(h.baseUrl, id, { content: 'Pytanie' }));
    expect(events.at(-1)).toMatchObject({ event: 'error', data: { code: 'INTERNAL_ERROR' } });
    h.db.exec('DROP TRIGGER fail_agent');
    expect(h.tableCounts()).toEqual(before); // customer message rolled back too
  });

  it('client disconnect mid-stream aborts the step signal and persists nothing', async () => {
    const entered = deferred();
    let seen: AbortSignal | undefined;
    h = await createHarness({
      fake: createFakeSteps({
        stream: (_c, _t, _e, onToken, signal) => {
          seen = signal;
          onToken('Początek ');
          entered.resolve();
          return new Promise((_res, rej) => signal?.addEventListener('abort', () => rej(new LlmUnavailableError('aborted'))));
        },
      }),
    });
    const id = await createCaseViaApi(h);
    const before = h.tableCounts();
    const ac = new AbortController();
    const res = await postMessage(h.baseUrl, id, { content: 'Pytanie' }, ac.signal);
    await entered.promise;
    expect(seen!.aborted).toBe(false);
    ac.abort();
    await res.body?.cancel().catch(() => undefined);
    await expect.poll(() => seen!.aborted).toBe(true);
    await expect.poll(() => h.locks.isLocked(id)).toBe(false);
    expect(h.tableCounts()).toEqual(before);
  });

  it('client disconnect after the last token but before persistence still persists nothing', async () => {
    const entered = deferred();
    const release = deferred();
    let seen: AbortSignal | undefined;
    h = await createHarness({
      fake: createFakeSteps({
        // The step finishes normally (ignores abort) — the race where the client leaves right at the end.
        stream: async (_c, _t, _e, onToken, signal) => {
          seen = signal;
          onToken('Pełna odpowiedź.');
          entered.resolve();
          await release.promise;
          return 'Pełna odpowiedź.';
        },
      }),
    });
    const id = await createCaseViaApi(h);
    const before = h.tableCounts();
    const ac = new AbortController();
    const res = await postMessage(h.baseUrl, id, { content: 'Pytanie' }, ac.signal);
    await entered.promise;
    ac.abort();
    await res.body?.cancel().catch(() => undefined);
    await expect.poll(() => seen!.aborted).toBe(true);
    release.resolve();
    await expect.poll(() => h.locks.isLocked(id)).toBe(false);
    expect(h.tableCounts()).toEqual(before);
  });
});

describe('POST /api/cases/:id/messages — validation, 404, 409', () => {
  beforeEach(async () => {
    h = await createHarness();
  });

  it.each([
    ['empty', { content: '' }],
    ['whitespace', { content: '   ' }],
    ['too long', { content: 'a'.repeat(2001) }],
    ['missing', {}],
    ['not a string', { content: 5 }],
  ])('400 VALIDATION_FAILED for %s content, steps not called', async (_l, body) => {
    const id = await createCaseViaApi(h);
    const res = await postMessage(h.baseUrl, id, body);
    expect(res.status).toBe(400);
    const json = await jsonOf(res);
    expect(json.code).toBe('VALIDATION_FAILED');
    expect(json.fieldErrors[0].field).toBe('content');
    expect(h.fake.evaluate).not.toHaveBeenCalled();
    expect(h.tableCounts().messages).toBe(1);
  });

  it('exactly 2000 characters is accepted', async () => {
    const id = await createCaseViaApi(h);
    const events = await readSse(await postMessage(h.baseUrl, id, { content: 'a'.repeat(2000) }));
    expect(events.at(-1)!.event).toBe('completed');
  });

  it('400 for malformed JSON', async () => {
    const id = await createCaseViaApi(h);
    const res = await postMessage(h.baseUrl, id, '{nie json');
    expect(res.status).toBe(400);
    expect((await jsonOf(res)).code).toBe('VALIDATION_FAILED');
  });

  it('404 CASE_NOT_FOUND for unknown and malformed ids', async () => {
    for (const id of ['0b6f1c1e-47f0-4d9b-9c36-5b8f5d1c2a11', 'nie-uuid']) {
      const res = await postMessage(h.baseUrl, id, { content: 'Hej' });
      expect(res.status).toBe(404);
      expect((await jsonOf(res)).code).toBe('CASE_NOT_FOUND');
    }
  });
});

describe('POST /api/cases/:id/messages — concurrency (D4)', () => {
  it('a parallel turn gets 409 REPLY_IN_PROGRESS; after the first finishes a new turn works', async () => {
    const entered = deferred();
    const release = deferred();
    h = await createHarness({
      fake: createFakeSteps({
        stream: async (_c, _t, _e, onToken) => {
          onToken('Wolna ');
          entered.resolve();
          await release.promise;
          onToken('odpowiedź');
          return 'Wolna odpowiedź';
        },
      }),
    });
    const id = await createCaseViaApi(h);
    const first = await postMessage(h.baseUrl, id, { content: 'Pierwsza' });
    await entered.promise;

    const second = await postMessage(h.baseUrl, id, { content: 'Druga' });
    expect(second.status).toBe(409);
    expect(await jsonOf(second)).toMatchObject({ code: 'REPLY_IN_PROGRESS' });

    release.resolve();
    const events = await readSse(first);
    expect(events.at(-1)!.event).toBe('completed');
    expect(h.tableCounts().messages).toBe(3); // first turn only

    const third = await readSse(await postMessage(h.baseUrl, id, { content: 'Trzecia' }));
    expect(third.at(-1)!.event).toBe('completed');
    expect(h.tableCounts().messages).toBe(5);
  });

  it('turns on different cases do not block each other', async () => {
    h = await createHarness();
    const a = await createCaseViaApi(h);
    const b = await createCaseViaApi(h);
    expect(h.locks.tryAcquire(a)).toBe(true);
    const res = await postMessage(h.baseUrl, b, { content: 'Hej' });
    expect(res.status).toBe(200);
    await readSse(res);
    h.locks.release(a);
  });
});
