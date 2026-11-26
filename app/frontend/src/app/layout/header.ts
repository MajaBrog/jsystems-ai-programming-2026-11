import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  imports: [RouterLink],
  styleUrl: './header.scss',
  template: `
    <header class="header">
      <a class="brand" routerLink="/" aria-label="Strona główna">
        <span class="logo" role="img" aria-label="DevPowers"></span>
        <span class="product">Hardware Service Decision Copilot</span>
      </a>
      <a class="btn btn-primary" routerLink="/">Nowe zgłoszenie</a>
    </header>
  `,
})
export class AppHeader {}
