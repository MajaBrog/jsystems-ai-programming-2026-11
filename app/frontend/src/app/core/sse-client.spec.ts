import { CAPTURES, CaptureName, captureFetch, captureResponse, recordedEventNames } from '../../testing/capture-response';
import { ApiError, SseEvent } from './models';
import { postSse, readSseEvents } from './sse-client';

async function collect(it: AsyncIterable<SseEvent>): Promise<SseEvent[]> {
  const out: SseEvent[] = [];
  for await (const e of it) out.push(e);
  return out;
}

const SSE_CAPTURES: CaptureName[] = [
  'submit-completed-complaint',
  'submit-completed-return-phone-3',
  'submit-photo-unusable',
  'submit-error',
  'chat-unchanged',
  'chat-assessment-changed',
  'chat-error',
  'chat-409-first',
];

describe('readSseEvents', () => {
  for (const name of SSE_CAPTURES) {
    it(`yields the recorded event order for ${name}`, async () => {
      const events = await collect(readSseEvents(captureResponse(name)));
      expect(events.map((e) => e.type)).toEqual(recordedEventNames(name));
    });

    it(`gives identical events for 1-byte and 7-byte chunks (${name})`, async () => {
      const whole = await collect(readSseEvents(captureResponse(name)));
      expect(await collect(readSseEvents(captureResponse(name, 1)))).toEqual(whole);
      expect(await collect(readSseEvents(captureResponse(name, 7)))).toEqual(whole);
    });
  }

  it('parses payloads of a submission stream', async () => {
    const events = await collect(readSseEvents(captureResponse('submit-photo-unusable')));
    expect(events[0]).toEqual({ type: 'stage', stage: 'ANALYZING_PHOTO' });
    expect(events[1]).toMatchObject({ type: 'photo_unusable', reason: 'CATEGORY_MISMATCH' });
    const completed = await collect(readSseEvents(captureResponse('submit-completed-complaint')));
    const last = completed.at(-1)!;
    expect(last.type).toBe('completed');
    expect(typeof (last as { caseId: string }).caseId).toBe('string');
  });

  it('keeps multibyte Polish text intact and finishes with authoritative message', async () => {
    const events = await collect(readSseEvents(captureResponse('chat-unchanged', 1)));
    const last = events.at(-1)!;
    expect(last).toMatchObject({ type: 'completed', currentCategory: 'NEEDS_REVIEW' });
    const tokens = events.filter((e) => e.type === 'token').map((e) => (e as { text: string }).text).join('');
    expect(tokens).toContain('ę');
    expect(tokens).toBe((last as { message: { content: string } }).message.content);
  });

  it('assessment_changed precedes tokens', async () => {
    const events = await collect(readSseEvents(captureResponse('chat-assessment-changed')));
    expect(events[0]).toEqual({ type: 'assessment_changed', from: 'NEEDS_REVIEW', to: 'REJECT' });
  });

  it('turns the error capture into a typed terminal error event', async () => {
    const events = await collect(readSseEvents(captureResponse('chat-error')));
    expect(events).toEqual([
      { type: 'error', code: 'LLM_UNAVAILABLE', message: 'Usługa jest chwilowo niedostępna. Spróbuj ponownie.' },
    ]);
  });

  it('throws STREAM_INTERRUPTED when the stream ends without a terminal event', async () => {
    const body = CAPTURES['chat-unchanged'].response.body;
    const truncated = body.slice(0, body.indexOf('event: completed'));
    const res = new Response(truncated, { status: 200 });
    const seen: SseEvent[] = [];
    let error: unknown;
    try {
      for await (const e of readSseEvents(res)) seen.push(e);
    } catch (e) {
      error = e;
    }
    expect(seen.length).toBeGreaterThan(0);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('STREAM_INTERRUPTED');
  });

  it('ignores comment lines and CRLF line endings', async () => {
    const body = CAPTURES['submit-completed-return-phone-3'].response.body;
    const res = new Response(': keep-alive\n\n' + body.replace(/\n/g, '\r\n'), { status: 200 });
    const events = await collect(readSseEvents(res));
    expect(events.map((e) => e.type)).toEqual(recordedEventNames('submit-completed-return-phone-3'));
  });

  it('stops reading when aborted mid-stream', async () => {
    const encoder = new TextEncoder();
    const first = CAPTURES['chat-unchanged'].response.body.split('\n\n')[0] + '\n\n';
    let cancelled = false;
    let pulls = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls++;
        if (pulls === 1) {
          controller.enqueue(encoder.encode(first));
          return undefined;
        }
        return new Promise<void>(() => undefined); // never delivers more
      },
      cancel() {
        cancelled = true;
      },
    });
    const ac = new AbortController();
    const seen: SseEvent[] = [];
    for await (const e of readSseEvents(new Response(stream, { status: 200 }), ac.signal)) {
      seen.push(e);
      ac.abort();
    }
    expect(seen).toHaveLength(1);
    expect(seen[0].type).toBe('token');
    expect(cancelled).toBe(true);
  });
});

describe('postSse', () => {
  const init = { body: 'x' };

  it('throws typed validation error with Polish field errors for the 400 capture', async () => {
    const expected = JSON.parse(CAPTURES['submit-400-validation'].response.body);
    const err = await collect(postSse(captureFetch('submit-400-validation'), '/api/cases', init)).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_FAILED');
    expect(err.fieldErrors).toEqual(expected.fieldErrors);
    expect(err.fieldErrors[1].message).toBe('Data zakupu nie może być z przyszłości.');
  });

  it('throws typed REPLY_IN_PROGRESS for the 409 capture', async () => {
    const err = await collect(postSse(captureFetch('chat-409-conflict'), '/x', init)).catch((e) => e);
    expect(err).toMatchObject({ status: 409, code: 'REPLY_IN_PROGRESS', message: 'Poczekaj na zakończenie odpowiedzi.' });
  });

  it('throws typed CASE_NOT_FOUND for the 404 capture', async () => {
    const err = await collect(postSse(captureFetch('case-view-404'), '/x', init)).catch((e) => e);
    expect(err).toMatchObject({ status: 404, code: 'CASE_NOT_FOUND' });
  });

  it('maps network failure to NETWORK error', async () => {
    const failing: typeof fetch = () => Promise.reject(new TypeError('Failed to fetch'));
    const err = await collect(postSse(failing, '/x', init)).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('NETWORK');
  });

  it('POSTs with the given signal', async () => {
    let received: RequestInit | undefined;
    const ac = new AbortController();
    const f: typeof fetch = (_u, i) => {
      received = i;
      return Promise.resolve(captureResponse('chat-error'));
    };
    await collect(postSse(f, '/x', init, ac.signal));
    expect(received?.method).toBe('POST');
    expect(received?.signal).toBe(ac.signal);
  });
});
