import { Injectable, InjectionToken, inject } from '@angular/core';
import { ApiError, CaseView, ChatEvent, SubmissionEvent } from './models';
import { FetchFn, postSse, toApiError } from './sse-client';

/** Overridable in tests. Wrapped so `fetch` keeps its `window` receiver. */
export const FETCH = new InjectionToken<FetchFn>('FETCH', {
  providedIn: 'root',
  factory: () => (input, init) => globalThis.fetch(input, init),
});

@Injectable({ providedIn: 'root' })
export class CaseApi {
  private readonly fetchFn = inject(FETCH);

  /** Multipart submission; throws ApiError (VALIDATION_FAILED with fieldErrors, 413, 415) before streaming. */
  submitCase(formData: FormData, signal?: AbortSignal): AsyncIterable<SubmissionEvent> {
    return postSse(this.fetchFn, '/api/cases', { body: formData }, signal) as AsyncIterable<SubmissionEvent>;
  }

  async getCase(id: string, signal?: AbortSignal): Promise<CaseView> {
    let response: Response;
    try {
      response = await this.fetchFn(`/api/cases/${encodeURIComponent(id)}`, {
        headers: { Accept: 'application/json' },
        signal,
      });
    } catch {
      throw new ApiError(0, 'NETWORK', 'Brak połączenia z serwerem.');
    }
    if (!response.ok) throw await toApiError(response);
    return (await response.json()) as CaseView;
  }

  photoUrl(id: string): string {
    return `/api/cases/${encodeURIComponent(id)}/photo`;
  }

  sendMessage(id: string, content: string, signal?: AbortSignal): AsyncIterable<ChatEvent> {
    return postSse(
      this.fetchFn,
      `/api/cases/${encodeURIComponent(id)}/messages`,
      {
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ content }),
      },
      signal,
    ) as AsyncIterable<ChatEvent>;
  }
}
