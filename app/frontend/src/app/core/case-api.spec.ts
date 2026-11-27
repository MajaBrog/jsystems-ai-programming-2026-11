import { TestBed } from '@angular/core/testing';
import { CAPTURES, CaptureName, captureFetch, recordedEventNames } from '../../testing/capture-response';
import { CaseApi, FETCH } from './case-api';
import { ApiError, CaseView, ChatEvent, SubmissionEvent } from './models';

function setup(name: CaptureName, chunk?: number) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const inner = captureFetch(name, chunk);
  const fetchStub: typeof fetch = (u, i) => {
    calls.push({ url: String(u), init: i });
    return inner(u, i);
  };
  TestBed.configureTestingModule({ providers: [{ provide: FETCH, useValue: fetchStub }] });
  return { api: TestBed.inject(CaseApi), calls };
}

async function collect<T>(it: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const e of it) out.push(e);
  return out;
}

describe('CaseApi', () => {
  it('getCase returns the recorded CaseView', async () => {
    const { api, calls } = setup('case-view-200');
    const view: CaseView = await api.getCase('abc');
    expect(calls[0].url).toBe('/api/cases/abc');
    expect(view).toEqual(JSON.parse(CAPTURES['case-view-200'].response.body));
    expect(view.assessments[0].category).toBe('NEEDS_REVIEW');
  });

  it('getCase throws typed CASE_NOT_FOUND for 404', async () => {
    const { api } = setup('case-view-404');
    const err = await api.getCase('nope').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 404, code: 'CASE_NOT_FOUND', message: 'Nie znaleziono zgłoszenia.' });
  });

  it('photoUrl builds the photo path', () => {
    const { api } = setup('health');
    expect(api.photoUrl('abc')).toBe('/api/cases/abc/photo');
  });

  it('submitCase posts FormData without a manual Content-Type and streams events', async () => {
    const { api, calls } = setup('submit-completed-return-phone-3', 5);
    const form = new FormData();
    form.set('caseType', 'RETURN');
    const events: SubmissionEvent[] = await collect(api.submitCase(form));
    expect(calls[0].url).toBe('/api/cases');
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.body).toBe(form);
    expect(calls[0].init?.headers).toBeUndefined();
    expect(events.map((e) => e.type)).toEqual(recordedEventNames('submit-completed-return-phone-3'));
  });

  it('submitCase throws validation error with field errors for 400', async () => {
    const { api } = setup('submit-400-validation');
    const err = await collect(api.submitCase(new FormData())).catch((e) => e);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.fieldErrors.map((f: { field: string }) => f.field)).toEqual(['modelName', 'purchaseDate', 'description']);
  });

  it('submitCase surfaces the error event capture', async () => {
    const { api } = setup('submit-error');
    const events = await collect(api.submitCase(new FormData()));
    expect(events.at(-1)).toMatchObject({ type: 'error', code: 'LLM_UNAVAILABLE' });
  });

  it('sendMessage sends JSON body and streams chat events', async () => {
    const { api, calls } = setup('chat-assessment-changed', 7);
    const events: ChatEvent[] = await collect(api.sendMessage('abc', 'Cześć', undefined));
    expect(calls[0].url).toBe('/api/cases/abc/messages');
    expect(JSON.parse(calls[0].init?.body as string)).toEqual({ content: 'Cześć' });
    expect((calls[0].init?.headers as Record<string, string>)['Accept']).toBe('text/event-stream');
    expect(events[0].type).toBe('assessment_changed');
    expect(events.at(-1)?.type).toBe('completed');
  });

  it('sendMessage throws REPLY_IN_PROGRESS for the 409 capture', async () => {
    const { api } = setup('chat-409-conflict');
    const err = await collect(api.sendMessage('abc', 'x')).catch((e) => e);
    expect(err).toMatchObject({ status: 409, code: 'REPLY_IN_PROGRESS' });
  });
});
