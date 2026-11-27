import { Component, effect, input, signal, untracked } from '@angular/core';
import { MarkdownComponent } from 'ngx-markdown';

const THROTTLE_MS = 50;

/**
 * Sanitized markdown (ngx-markdown default sanitizer). With `throttle`, rapid `data`
 * changes (streamed tokens) re-render at most every 50 ms; the last value always lands.
 */
@Component({
  selector: 'app-markdown',
  imports: [MarkdownComponent],
  styleUrl: './markdown.scss',
  template: `<markdown [data]="rendered()"></markdown>`,
})
export class AppMarkdown {
  readonly data = input<string>('');
  readonly throttle = input(false);
  protected readonly rendered = signal('');
  private lastRender = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect((onCleanup) => {
      const value = this.data();
      const throttled = this.throttle();
      untracked(() => {
        const wait = THROTTLE_MS - (Date.now() - this.lastRender);
        if (!throttled || wait <= 0) return this.flush(value);
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => this.flush(value), wait);
      });
      onCleanup(() => {
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
      });
    });
  }

  private flush(value: string) {
    this.timer = null;
    this.lastRender = Date.now();
    this.rendered.set(value);
  }
}
