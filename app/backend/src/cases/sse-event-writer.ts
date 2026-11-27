import type { FastifyReply, FastifyRequest } from 'fastify';
import type { CompletedTurn, ReplyListener } from './chat-turn-service.ts';
import type { SubmissionListener } from './case-submission-service.ts';
import type { StreamErrorCode } from './stream-errors.ts';

export type SseStream = {
  /** Aborted when the client disconnects before a terminal event was written. Pass it to the AI steps. */
  signal: AbortSignal;
  submission: SubmissionListener;
  reply: ReplyListener;
  /** Guarantees exactly one terminal event (TAC-001-03): writes `error INTERNAL_ERROR` if none was sent. */
  finish(): void;
};

/**
 * The only module that knows SSE (ADR-001 §3). Takes over the raw response (`reply.hijack()`),
 * writes named events with single-line JSON data, allows exactly one terminal event and then ends.
 */
export function openSseStream(request: FastifyRequest, reply: FastifyReply): SseStream {
  reply.hijack();
  const raw = reply.raw;
  const controller = new AbortController();
  let terminated = false;
  let closed = false;

  // `reply.raw` (not `request.raw`): since Node 16 IncomingMessage 'close' fires once the request
  // body is consumed, long before the client leaves. ServerResponse 'close' means the connection ended.
  raw.on('close', () => {
    closed = true;
    if (!terminated) controller.abort();
  });
  // The client may already be gone (close fired before the listener was attached).
  if (raw.destroyed || request.raw.socket?.destroyed) {
    closed = true;
    controller.abort();
  }
  request.raw.socket?.setNoDelay(true);

  raw.writeHead(200, {
    'Content-Type': 'text/event-stream;charset=UTF-8',
    'Cache-Control': 'no-cache',
    'X-Accel-Buffering': 'no',
  });
  raw.flushHeaders();

  const write = (event: string, data: unknown, terminal: boolean): void => {
    if (terminated || closed || raw.destroyed) return;
    if (terminal) terminated = true;
    try {
      raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      if (terminal) raw.end();
    } catch {
      // client gone; the close handler aborts the work
    }
  };

  const error = (code: StreamErrorCode, message: string) => write('error', { code, message }, true);

  return {
    signal: controller.signal,
    submission: {
      stage: (stage) => write('stage', { stage }, false),
      photoUnusable: (reason, message) => write('photo_unusable', { reason, message }, true),
      completed: (caseId) => write('completed', { caseId }, true),
      error,
    },
    reply: {
      assessmentChanged: (from, to) => write('assessment_changed', { from, to }, false),
      token: (text) => write('token', { text }, false),
      completed: (turn: CompletedTurn) => write('completed', turn, true),
      error,
    },
    finish() {
      error('INTERNAL_ERROR', 'Usługa jest chwilowo niedostępna. Spróbuj ponownie.');
    },
  };
}
