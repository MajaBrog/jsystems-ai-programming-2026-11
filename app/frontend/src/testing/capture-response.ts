import health from './captures/health.json';
import caseView200 from './captures/case-view-200.json';
import caseView404 from './captures/case-view-404.json';
import caseViewReturnPhone3 from './captures/case-view-return-phone-3.json';
import chat409Conflict from './captures/chat-409-conflict.json';
import chat409First from './captures/chat-409-first.json';
import chatAssessmentChanged from './captures/chat-assessment-changed.json';
import chatError from './captures/chat-error.json';
import chatUnchanged from './captures/chat-unchanged.json';
import submit400 from './captures/submit-400-validation.json';
import submitComplaint from './captures/submit-completed-complaint.json';
import submitReturn from './captures/submit-completed-return-phone-3.json';
import submitError from './captures/submit-error.json';
import submitUnusable from './captures/submit-photo-unusable.json';

export interface Capture {
  name: string;
  response: { status: number; headers: Record<string, string>; body: string };
}

export const CAPTURES = {
  health,
  'case-view-200': caseView200,
  'case-view-404': caseView404,
  'case-view-return-phone-3': caseViewReturnPhone3,
  'chat-409-conflict': chat409Conflict,
  'chat-409-first': chat409First,
  'chat-assessment-changed': chatAssessmentChanged,
  'chat-error': chatError,
  'chat-unchanged': chatUnchanged,
  'submit-400-validation': submit400,
  'submit-completed-complaint': submitComplaint,
  'submit-completed-return-phone-3': submitReturn,
  'submit-error': submitError,
  'submit-photo-unusable': submitUnusable,
} satisfies Record<string, Capture>;

export type CaptureName = keyof typeof CAPTURES;

/** Builds a real Response from a recorded capture; body optionally split into `chunkSize`-byte chunks. */
export function captureResponse(name: CaptureName, chunkSize?: number): Response {
  const { status, headers, body } = CAPTURES[name].response;
  const bytes = new TextEncoder().encode(body);
  const chunks: Uint8Array[] = [];
  const size = chunkSize && chunkSize > 0 ? chunkSize : bytes.length || 1;
  for (let i = 0; i < bytes.length; i += size) chunks.push(bytes.slice(i, i + size));
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(c);
      controller.close();
    },
  });
  const h = new Headers(headers);
  h.delete('content-length');
  h.delete('transfer-encoding');
  h.delete('connection');
  h.delete('keep-alive');
  return new Response(status === 204 ? null : stream, { status, headers: h });
}

/** Fetch stub always answering with the given capture (fresh Response per call). */
export function captureFetch(name: CaptureName, chunkSize?: number): typeof fetch {
  return () => Promise.resolve(captureResponse(name, chunkSize));
}

/** The raw SSE bytes event names, in order, as recorded. */
export function recordedEventNames(name: CaptureName): string[] {
  return [...CAPTURES[name].response.body.matchAll(/^event: (.+)$/gm)].map((m) => m[1]);
}
