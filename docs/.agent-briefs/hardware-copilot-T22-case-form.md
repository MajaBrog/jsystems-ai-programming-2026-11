# Brief T22 — Case form page

Plan row T22. Worker: Claude Sonnet subagent (concurrent with T23). Checkout: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/prd-hardware-copilot`, branch `feat/hardware-copilot-poc`.
**Read first:** `app/frontend/AGENTS.md`; `docs/PRD.md` §4.1, §4.4, §4.7, §6 (AC-01…AC-10, AC-14, AC-30, AC-35), §9.1 (exact Polish texts), §9.4; `docs/ADR/004-frontend.md` §3.4 (Material mapping), §3.5, D3, D4, §8 "Form submission state", §9 form rows (incl. "Validation on blur", `.png` with JPEG content accepted); `docs/design-guidelines.md`. Existing: `app/frontend/src/app/core/**` (T21: models, SSE client, `CaseApi` — read its files and use them, do not modify), `features/case-form/case-form.page.ts` placeholder (replace), theme in `src/styles/**`.

## Goal
`features/case-form/**`: reactive form (case type radio, device category select with Polish labels, model name, purchase date with Material datepicker + date-fns `pl`, description required for COMPLAINT, photo), `shared/photo-drop-zone/**` (drag & drop + click, client-side type check by content magic bytes JPEG/PNG/WEBP and 10 MB limit with exact PRD texts, preview), `shared/labels/**` (Polish labels for case types, device categories, assessment categories, stages — T23 reads these). Submission states: idle → submitting with stage texts ("Analizujemy zdjęcie…" / "Przygotowujemy ocenę…" per PRD) → navigate to `/case/{id}` on `completed`; `photo_unusable` → Polish message, form values kept, **photo cleared** (AC-14); `error` → AC-30 message, **all values incl. photo kept**; 400 → server field errors shown on fields. Validation on blur, submit disabled while submitting.

## Tests (red first; Material test harnesses)
ADR-004 §9 form rows; backend responses ONLY via `src/testing/capture-response.ts` + `src/testing/captures/*.json` (submit-completed-*, submit-photo-unusable, submit-error, submit-400-validation) — no hand-written responses. Upload inputs: real files from `assets/example-images/` read in tests (e.g. via a Vite `?url`/fetch or a test helper reading bytes) — no generated images; non-image rejection with text bytes. `laptop-1.png` (JPEG content) must be accepted.

## Editable files
`app/frontend/src/app/features/case-form/**`, `app/frontend/src/app/shared/photo-drop-zone/**`, `app/frontend/src/app/shared/labels/**`. Concurrent T23 owns `features/case-chat/**`, `shared/assessment-badge/**`, `shared/markdown/**`. Do not touch `core/**`, `app.config.ts`, routes, styles (report needed changes). Do not commit.

## Commands (from `app/frontend`)
`npx ng test --no-watch`, `npx ng build` (no warnings). Context7 out of quota → read `node_modules/@angular/material/**/*.d.ts`.

## Return
Files, red output, green counts, build, `git status --short`, PRD/ADR ambiguities.
