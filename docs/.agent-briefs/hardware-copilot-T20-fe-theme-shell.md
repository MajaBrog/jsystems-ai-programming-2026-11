# Brief T20 — FE theming + app shell

Plan: `docs/plans/hardware-copilot-implementation-plan.md` row T20. Worker: Claude Sonnet subagent.
Checkout: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/prd-hardware-copilot`, branch `feat/hardware-copilot-poc`. Predecessor: T03 scaffold (commit `ec440e5`), Angular 22.3.0, Material 22.3.0, Vitest via `ng test`, ngx-markdown 22.1.1 + marked 18, date-fns 4 + `@angular/material-date-fns-adapter`.

## Goal (observable)
Brand tokens as CSS variables mapped onto Material M3 system tokens, fonts, providers (Polish locale `pl`, `provideMarkdown` sanitized, date-fns adapter with `pl` locale and Polish date formats), routes with placeholder pages, header with the logo. App builds, tests pass, and the shell visually matches the brand reference.

## Read first
- `docs/ADR/004-frontend.md` §3.1, §3.2 (routes), §3.6 (theming), D4, D5, §9 rows that concern routing/providers.
- `docs/design-guidelines.md`, `assets/design-tokens.json`, `assets/homepage.png` (look at it), `assets/logo.svg`, `assets/favicon.svg`.
- `docs/PRD.md` §9 (UI wireframes, Polish texts), §9.4 navigation.

## Editable files (only these)
`app/frontend/src/styles/**`, `app/frontend/src/styles.scss`, `app/frontend/src/index.html`, `app/frontend/angular.json`, `app/frontend/package.json`, `app/frontend/package-lock.json`, `app/frontend/src/app/app.config.ts`, `app/frontend/src/app/app.routes.ts`, `app/frontend/src/app/app.ts` (+ `app.html`, `app.scss`, `app.spec.ts`), `app/frontend/src/app/layout/**`, placeholders `app/frontend/src/app/features/case-form/case-form.page.ts`, `app/frontend/src/app/features/case-chat/case-chat.page.ts` (+ their specs), `app/frontend/public/**`.
Replace the 20 KB default `app.html` placeholder. Do not create `core/**`, `shared/**` or feature logic (other tasks own them).

## TDD (Red → Green → Refactor)
1. Write failing tests first: routes (`''` → case form page, `case/:id` → chat page, unknown → redirect per ADR-004 §3.2), app config provides `LOCALE_ID = 'pl'` and the date adapter / formats, header renders the logo with an accessible name and a "Nowe zgłoszenie" link if ADR/PRD require it in the header. Run `npx ng test --no-watch` and record the expected failure.
2. Implement minimum. 3. Refactor with tests green.

## Commands (from `app/frontend`)
`npx ng test --no-watch`, `npx ng build` (no new warnings; if a font/budget warning appears, fix or report).
Visual check: start `npx ng serve --port 4300` in the background, then `playwright-cli --help` first and take a screenshot of `http://localhost:4300/` into `/home/labuser/.claude/jobs/e2490b75/tmp/t20-shell.png`; compare against `assets/homepage.png` (colors, typography, header/logo placement). Stop the dev server afterwards (kill the process you started; `rm` is denied — do not delete files).

## Rules
- Package manager npm. Library APIs: Context7 quota is exhausted today — use the installed packages' `.d.ts` files in `node_modules` and CLI `--help`; web search (vendor docs: angular.dev, material.angular.dev) last.
- Fonts: if guidelines name a Google font, load it via `<link>` in `index.html` (or self-host only if guidelines require). Polish UI text only.
- Do not commit or `git add`. `rm`, `curl`, `chmod`, `sudo` denied.

## Return
Diff summary (files), test counts before (red) and after (green), build output tail, screenshot path + your comparison notes vs `assets/homepage.png`, `git status --short`, any contradiction between ADR-004, design-guidelines and PRD.
