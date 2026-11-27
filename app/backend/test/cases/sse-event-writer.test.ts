import Fastify, { type FastifyInstance } from 'fastify';
import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openSseStream } from '../../src/cases/sse-event-writer.ts';
import { parseSse } from './support.ts';

let app: FastifyInstance;
let baseUrl: string;
let script: (s: ReturnType<typeof openSseStream>) => void;

beforeEach(async () => {
  app = Fastify();
  app.get('/sse', async (request, reply) => {
    const sse = openSseStream(request, reply);
    script(sse);
    sse.finish();
    return reply;
  });
  await app.listen({ port: 0, host: '127.0.0.1' });
  const addr = app.server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`;
});
afterEach(async () => {
  await app.close();
});

describe('SseEventWriter', () => {
  it('writes the required headers and exact event:/data: lines (Polish characters UTF-8, single-line JSON)', async () => {
    script = (s) => {
      s.reply.assessmentChanged('ACCEPT', 'REJECT');
      s.reply.token('Zażółć\ngęślą "jaźń"');
      s.reply.completed({ message: { id: 7, role: 'AGENT', content: 'ą\nb', createdAt: 't' }, currentCategory: 'REJECT' });
    };
    const res = await fetch(`${baseUrl}/sse`);
    expect(res.headers.get('content-type')).toBe('text/event-stream;charset=UTF-8');
    expect(res.headers.get('cache-control')).toBe('no-cache');
    expect(res.headers.get('x-accel-buffering')).toBe('no');
    const body = await res.text();
    expect(body).toBe(
      'event: assessment_changed\ndata: {"from":"ACCEPT","to":"REJECT"}\n\n' +
        'event: token\ndata: {"text":"Zażółć\\ngęślą \\"jaźń\\""}\n\n' +
        'event: completed\ndata: {"message":{"id":7,"role":"AGENT","content":"ą\\nb","createdAt":"t"},"currentCategory":"REJECT"}\n\n',
    );
    for (const e of parseSse(body)) expect(e.raw.split('\n').filter((l) => l.startsWith('data: '))).toHaveLength(1);
  });

  it('emits exactly one terminal event: anything after the first terminal is dropped', async () => {
    script = (s) => {
      s.submission.stage('ANALYZING_PHOTO');
      s.submission.completed('abc');
      s.submission.error('INTERNAL_ERROR', 'x');
      s.submission.stage('ASSESSING');
    };
    const events = parseSse(await (await fetch(`${baseUrl}/sse`)).text());
    expect(events.map((e) => e.event)).toEqual(['stage', 'completed']);
  });

  it('maps photo_unusable and error payloads', async () => {
    script = (s) => s.submission.photoUnusable('TOO_DARK', 'Za ciemno.');
    expect(parseSse(await (await fetch(`${baseUrl}/sse`)).text())).toMatchObject([
      { event: 'photo_unusable', data: { reason: 'TOO_DARK', message: 'Za ciemno.' } },
    ]);
    script = (s) => s.reply.error('LLM_UNAVAILABLE', 'Usługa jest chwilowo niedostępna. Spróbuj ponownie.');
    expect(parseSse(await (await fetch(`${baseUrl}/sse`)).text())).toMatchObject([
      { event: 'error', data: { code: 'LLM_UNAVAILABLE' } },
    ]);
  });

  it('finish() without a terminal event closes the stream with INTERNAL_ERROR (TAC-001-03)', async () => {
    script = (s) => s.reply.token('x');
    const events = parseSse(await (await fetch(`${baseUrl}/sse`)).text());
    expect(events.map((e) => e.event)).toEqual(['token', 'error']);
    expect(events[1]!.data.code).toBe('INTERNAL_ERROR');
  });
});

describe('openSseStream early disconnect', () => {
  it('aborts the signal immediately when the socket is already destroyed (close fired before the listener)', () => {
    const raw = Object.assign(new EventEmitter(), {
      destroyed: true,
      writeHead: () => raw,
      flushHeaders: () => {},
      write: () => true,
      end: () => {},
    });
    const request = { raw: { socket: { destroyed: true, setNoDelay: () => {} } } };
    const reply = { hijack: () => {}, raw };
    const sse = openSseStream(request as never, reply as never);
    expect(sse.signal.aborted).toBe(true);
  });
});
