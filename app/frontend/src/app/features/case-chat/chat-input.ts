import { TextFieldModule } from '@angular/cdk/text-field';
import { Component, computed, input, model, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export const MAX_MESSAGE_LENGTH = 2000;

/** Multiline input: Enter sends, Shift+Enter newline, 1-2000 chars (AC-25). */
@Component({
  selector: 'app-chat-input',
  imports: [MatFormFieldModule, MatInputModule, MatButtonModule, TextFieldModule],
  styleUrl: './chat-input.scss',
  template: `
    <form class="input" (submit)="$event.preventDefault(); trySend()">
      <mat-form-field appearance="outline" class="field" subscriptSizing="dynamic">
        <mat-label>Napisz wiadomość</mat-label>
        <textarea
          matInput
          cdkTextareaAutosize
          cdkAutosizeMinRows="1"
          cdkAutosizeMaxRows="6"
          [attr.maxlength]="max"
          [value]="text()"
          (input)="text.set($any($event.target).value)"
          (keydown.enter)="onEnter($event)"
        ></textarea>
        <mat-hint align="end">{{ text().length }}/{{ max }}</mat-hint>
      </mat-form-field>
      <button
        mat-flat-button
        type="submit"
        class="btn btn-primary"
        data-testid="send"
        [disabled]="!canSend()"
      >
        Wyślij
      </button>
    </form>
  `,
})
export class ChatInput {
  readonly text = model('');
  readonly busy = input(false);
  readonly send = output<void>();
  protected readonly max = MAX_MESSAGE_LENGTH;
  protected readonly canSend = computed(() => {
    const t = this.text().trim();
    return !this.busy() && t.length > 0 && this.text().length <= MAX_MESSAGE_LENGTH;
  });

  protected onEnter(event: Event) {
    if ((event as KeyboardEvent).shiftKey) return; // newline
    event.preventDefault();
    this.trySend();
  }

  protected trySend() {
    if (this.canSend()) this.send.emit();
  }
}
