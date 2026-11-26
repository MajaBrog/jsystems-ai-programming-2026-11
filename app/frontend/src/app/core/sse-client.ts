import { ApiError, ApiErrorCode, FieldError, SseEvent } from './models';

export type FetchFn = typeof fetch;

const TERMINAL = new Set(['completed', 'photo_unusable', 'error']);

interface Frame {
  event: string;
  data: string;
}

/** Parses one SSE frame (text between blank lines); returns null for comment-only/empty frames. */
function parseFrame(block: string): Frame | null {
  let event = 'message';
  const data: string[] = [];
  let seen = false;
  for (const line of block.split(/\r\n|\n|\r/)) {
    if (line === '' || line.startsWith(':')) continue;
    const idx = line.indexOf(':');
    const field = idx === -1 ? line : line.slice(0, idx);
    let value = idx === -1 ? '' : line.slice(idx + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') {
      event = value;
      seen = true;
    } else if (field === 'data') {
      data.push(value);
      seen = true;
    }
  }
  return seen ? { event, data: data.join('\n') } : null;
}

function toEvent(frame: Frame): SseEvent {
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(frame.data) as Record<string, unknown>;
  } catch {
    throw new ApiError(200, 'STREAM_INTERRUPTED', 'Nieprawidłowa odpowiedź serwera.');
  }
  switch (frame.event) {
    case 'completed':
      return ('caseId' in payload
        ? { type: 'completed', caseId: payload['caseId'] }
        : { type: 'completed', message: payload['message'], currentCategory: payload['currentCategory'] }) as SseEvent;
    case 'stage':
    case 'photo_unusable':
    case 'assessment_changed':
    case 'token':
    case 'error':
      return { type: frame.event, ...payload } as SseEvent;
    default:
      throw new ApiError(200, 'STREAM_INTERRUPTED', `Nieznane zdarzenie: ${frame.event}`);
  }
}

/** Reads a non-2xx response as the ADR-001 JSON error model. */
export async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      code?: ApiErrorCode;
      message?: string;
      fieldErrors?: FieldError[];
    };
    return new ApiError(
      response.status,
      body.code ?? 'UNKNOWN',
      body.message ?? 'Wystąpił błąd.',
      body.fieldErrors ?? [],
    );
  } catch {
    return new ApiError(response.status, 'UNKNOWN', 'Wystąpił błąd.');
  }
}

/**
 * Async iterator over the events of an SSE response. Ends after the terminal event
 * (completed | photo_unusable | error); ends silently when `signal` is aborted;
 * throws ApiError('STREAM_INTERRUPTED') when the stream ends without a terminal event.
 */
export async function* readSseEvents(response: Response, signal?: AbortSignal): AsyncGenerator<SseEvent> {
  if (!response.body) throw new ApiError(response.status, 'STREAM_INTERRUPTED', 'Połączenie zostało przerwane.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const onAbort = () => void reader.cancel().catch(() => undefined);
  signal?.addEventListener('abort', onAbort);
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch (e) {
        if (signal?.aborted) return;
        throw new ApiError(0, 'STREAM_INTERRUPTED', 'Połączenie zostało przerwane.');
      }
      if (signal?.aborted) return;
      if (chunk.done) {
        buffer += decoder.decode();
        if (buffer.trim() !== '') buffer += '\n\n';
      } else {
        buffer += decoder.decode(chunk.value, { stream: true });
      }
      buffer = buffer.replace(/\r\n|\r/g, '\n');
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = parseFrame(buffer.slice(0, sep));
        buffer = buffer.slice(sep + 2);
        if (!frame) continue;
        const event = toEvent(frame);
        yield event;
        if (TERMINAL.has(frame.event)) {
          await reader.cancel().catch(() => undefined);
          return;
        }
      }
      if (chunk.done) {
        throw new ApiError(200, 'STREAM_INTERRUPTED', 'Połączenie zostało przerwane.');
      }
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
    reader.releaseLock?.();
  }
}

/**
 * POSTs and streams SSE. Non-2xx responses and network failures throw ApiError before any event.
 */
export async function* postSse(
  fetchFn: FetchFn,
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
  let response: Response;
  try {
    response = await fetchFn(url, { ...init, method: 'POST', signal });
  } catch (e) {
    if (signal?.aborted) return;
    throw new ApiError(0, 'NETWORK', 'Brak połączenia z serwerem.');
  }
  if (!response.ok) throw await toApiError(response);
  yield* readSseEvents(response, signal);
}
