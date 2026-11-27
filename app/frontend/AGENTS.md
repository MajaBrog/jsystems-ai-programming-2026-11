# app/frontend — Angular 22.3 + Angular Material 22.3

Pinned: `@angular/*` 22.3.0, `@angular/material` 22.3.0, `ngx-markdown` 22.1.1 + `marked` 18, `date-fns` 4 + `@angular/material-date-fns-adapter` 22.3.0. Standalone, zoneless, signals. Package manager: npm.

## Commands (from `app/frontend`)
- `npx ng test --no-watch` — Vitest unit tests (use Material test harnesses for components).
- `npx ng build` — must finish without warnings.
- `npx ng serve` — dev server `:4200`, `/api` proxied to `:8080` via `proxy.conf.json`.

## Layout
`src/styles/` brand tokens (`tokens.scss`) mapped onto Material M3 (`material-theme.scss`) — change colors only there. `src/app/core/` API, SSE client, models · `features/case-form`, `features/case-chat` · `shared/` badge, labels, markdown, drop zone · `layout/` header.

## Rules
- UI text in Polish. Brand reference: `assets/homepage.png`, `docs/design-guidelines.md`.
- SSE over POST via our own `fetch` client (ADR-004 D2); no `EventSource`, no chat UI library.
- Test data for API responses comes only from `src/testing/captures/` (real recorded backend responses); never hand-write response fixtures.
- `angular.json` lists `marked-katex-extension` in `externalDependencies` (optional ngx-markdown import, KaTeX unused) — keep it.
