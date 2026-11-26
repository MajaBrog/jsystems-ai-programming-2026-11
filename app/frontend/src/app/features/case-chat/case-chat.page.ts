import { Component, input } from '@angular/core';

// Placeholder: the real chat is implemented by a later task.
@Component({
  selector: 'app-case-chat-page',
  template: `
    <section class="page">
      <h1>Zgłoszenie</h1>
      <p>Numer zgłoszenia: {{ id() }}</p>
    </section>
  `,
})
export class CaseChatPage {
  readonly id = input.required<string>();
}
