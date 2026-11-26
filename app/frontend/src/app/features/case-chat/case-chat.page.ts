import { afterRenderEffect, Component, DestroyRef, ElementRef, effect, inject, input, signal, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { CaseApi } from '../../core/case-api';
import { ApiError, AssessmentCategory, CaseView, ChatEvent, MessageView } from '../../core/models';
import { AppMarkdown } from '../../shared/markdown/markdown';
import { CaseSummaryPanel } from './case-summary-panel';
import { ChatInput } from './chat-input';

interface ChatMessageVm {
  key: number;
  role: 'AGENT' | 'CUSTOMER';
  content: string;
  status: 'sent' | 'pending' | 'streaming';
}

type LoadState = 'loading' | 'ready' | 'not-found' | 'error';

const UNAVAILABLE = 'Usługa jest chwilowo niedostępna. Spróbuj ponownie.';
const REPLY_IN_PROGRESS = 'Poprzednia odpowiedź jest jeszcze generowana.';

@Component({
  selector: 'app-case-chat-page',
  imports: [RouterLink, MatButtonModule, MatProgressBarModule, AppMarkdown, CaseSummaryPanel, ChatInput],
  styleUrl: './case-chat.page.scss',
  template: `
    @switch (state()) {
      @case ('loading') {
        <mat-progress-bar mode="indeterminate" aria-label="Wczytywanie zgłoszenia" />
      }
      @case ('not-found') {
        <section class="page state-card">
          <h1>Nie znaleziono zgłoszenia</h1>
          <p>Link jest nieprawidłowy lub zgłoszenie nie istnieje.</p>
          <a mat-flat-button class="btn btn-primary" routerLink="/">Nowe zgłoszenie</a>
        </section>
      }
      @case ('error') {
        <section class="page state-card">
          <h1>{{ loadError() }}</h1>
          <button mat-flat-button class="btn btn-primary" type="button" (click)="load()">Spróbuj ponownie</button>
        </section>
      }
      @default {
        @if (caseView(); as view) {
          <section class="page chat">
            <app-case-summary-panel [data]="view" [category]="currentCategory()" />

            <div class="messages" aria-live="polite">
              @for (m of messages(); track m.key) {
                @if (m.role === 'AGENT' && m.status === 'streaming' && !m.content) {
                  <div class="bubble agent typing" data-role="AGENT" data-testid="typing" role="status" aria-label="Asystent pisze">
                    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                  </div>
                } @else {
                  <div class="bubble" [class.agent]="m.role === 'AGENT'" [class.customer]="m.role === 'CUSTOMER'" [attr.data-role]="m.role">
                    @if (m.role === 'AGENT') {
                      <app-markdown [data]="m.content" [throttle]="m.status === 'streaming'" />
                    } @else {
                      <p class="plain">{{ m.content }}</p>
                    }
                  </div>
                }
              }
              <div #end></div>
            </div>

            @if (sendError(); as err) {
              <div class="send-error" role="alert" data-testid="send-error">
                <span>{{ err }}</span>
                <button mat-stroked-button class="btn btn-light" type="button" [disabled]="streaming()" (click)="send()">
                  Wyślij ponownie
                </button>
              </div>
            }

            <app-chat-input [(text)]="draft" [busy]="streaming()" (send)="send()" />
          </section>
        }
      }
    }
  `,
})
export class CaseChatPage {
  readonly id = input.required<string>();

  private readonly api = inject(CaseApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly endMarker = viewChild<ElementRef<HTMLElement>>('end');
  private nextKey = 1;
  private loadAbort?: AbortController;
  private sendAbort?: AbortController;

  protected readonly state = signal<LoadState>('loading');
  protected readonly loadError = signal(UNAVAILABLE);
  protected readonly caseView = signal<CaseView | null>(null);
  protected readonly currentCategory = signal<AssessmentCategory>('NEEDS_REVIEW');
  protected readonly messages = signal<ChatMessageVm[]>([]);
  protected readonly draft = signal('');
  protected readonly streaming = signal(false);
  protected readonly sendError = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.loadAbort?.abort();
      this.sendAbort?.abort();
    });
    effect(() => {
      this.id();
      void this.load();
    });
    afterRenderEffect(() => {
      this.messages();
      const el = this.endMarker()?.nativeElement;
      if (el && nearBottom()) el.scrollIntoView?.({ block: 'end' });
    });
  }

  protected async load(): Promise<void> {
    this.loadAbort?.abort();
    const abort = (this.loadAbort = new AbortController());
    this.state.set('loading');
    try {
      const view = await this.api.getCase(this.id(), abort.signal);
      if (abort.signal.aborted) return;
      this.caseView.set(view);
      this.currentCategory.set(view.currentCategory);
      this.messages.set(view.messages.map((m) => this.fromView(m)));
      this.state.set('ready');
    } catch (e) {
      if (abort.signal.aborted) return;
      if (e instanceof ApiError && e.code === 'CASE_NOT_FOUND') this.state.set('not-found');
      else {
        this.loadError.set(UNAVAILABLE);
        this.state.set('error');
      }
    }
  }

  protected async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.streaming() || text.length > 2000) return;

    const customer: ChatMessageVm = { key: this.nextKey++, role: 'CUSTOMER', content: text, status: 'pending' };
    const agent: ChatMessageVm = { key: this.nextKey++, role: 'AGENT', content: '', status: 'streaming' };
    this.messages.update((l) => [...l, customer, agent]);
    this.draft.set('');
    this.sendError.set(null);
    this.streaming.set(true);

    const abort = (this.sendAbort = new AbortController());
    let failure: string | null = null;
    let done = false;
    try {
      for await (const event of this.api.sendMessage(this.id(), text, abort.signal)) {
        failure = this.apply(event, customer, agent);
        if (event.type === 'completed') done = true;
      }
    } catch (e) {
      failure = e instanceof ApiError && e.code === 'REPLY_IN_PROGRESS' ? REPLY_IN_PROGRESS : e instanceof ApiError && e.code !== 'NETWORK' && e.code !== 'STREAM_INTERRUPTED' && e.code !== 'UNKNOWN' ? e.message : UNAVAILABLE;
    }
    if (abort.signal.aborted) return; // page left: nothing to update
    this.streaming.set(false);
    if (!done && !failure) failure = UNAVAILABLE; // ended without a terminal event
    if (failure) {
      // AC-31: drop the local messages, give the text back, offer a resend.
      this.messages.update((l) => l.filter((m) => m.key !== customer.key && m.key !== agent.key));
      this.draft.set(text);
      this.sendError.set(failure);
    }
  }

  /** Applies one event; returns an error text for an `error` event, otherwise null. */
  private apply(event: ChatEvent, customer: ChatMessageVm, agent: ChatMessageVm): string | null {
    switch (event.type) {
      case 'assessment_changed':
        this.currentCategory.set(event.to);
        return null;
      case 'token':
        this.patch(agent.key, (m) => ({ ...m, content: m.content + event.text }));
        return null;
      case 'completed':
        this.messages.update((l) =>
          l.map((m) =>
            m.key === customer.key ? { ...m, status: 'sent' as const } : m.key === agent.key ? this.fromView(event.message, agent.key) : m,
          ),
        );
        this.currentCategory.set(event.currentCategory);
        return null;
      case 'error':
        return event.message || UNAVAILABLE;
    }
  }

  private patch(key: number, fn: (m: ChatMessageVm) => ChatMessageVm) {
    this.messages.update((l) => l.map((m) => (m.key === key ? fn(m) : m)));
  }

  private fromView(m: MessageView, key = this.nextKey++): ChatMessageVm {
    return { key, role: m.role, content: m.content, status: 'sent' };
  }
}

function nearBottom(): boolean {
  const doc = document.documentElement;
  return window.innerHeight + window.scrollY >= doc.scrollHeight - 200;
}
