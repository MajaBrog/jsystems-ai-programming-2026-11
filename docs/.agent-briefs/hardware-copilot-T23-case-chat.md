# Brief T23 — Chat page

Plan row T23. Worker: Claude Sonnet subagent (concurrent with T22). Checkout: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/prd-hardware-copilot`, branch `feat/hardware-copilot-poc`.
**Read first:** `app/frontend/AGENTS.md`; `docs/PRD.md` §4.3, §4.6, §4.7, §4.8, §4.9, §6 (AC-23…AC-29, AC-31, AC-33…AC-35), §9.2, §9.3 (exact Polish texts); `docs/ADR/004-frontend.md` §3.3, §3.5 (chat streaming state), D1 (custom chat from Material primitives), §8 "Chat send with streaming", §9 chat rows (incl. "Enter / Shift+Enter"); `docs/design-guidelines.md`. Existing: `app/frontend/src/app/core/**` (T21 — use, do not modify), `features/case-chat/case-chat.page.ts` placeholder with required `id` input (replace), `provideMarkdown()` already in `app.config.ts`.

## Goal
`features/case-chat/**`: loads `GET /api/cases/{id}`; summary panel (form data, photo thumbnail from `photoUrl`, current category badge); message list (agent markdown rendered sanitized via ngx-markdown, customer plain text); input with Enter = send, Shift+Enter = newline, 1–2000 chars; streaming state: typing indicator until first token, tokens appended live, `assessment_changed` updates badge immediately (before tokens) and shows the change; `completed` replaces streamed text with the authoritative `message.content`; `error` → text restored in the input + "Wyślij ponownie" (AC-31); 409 → message; not-found → "Nie znaleziono zgłoszenia" with link to new case (§9.3). `shared/assessment-badge/**`, `shared/markdown/**` (wrapper component). Labels: read `shared/labels/**` from T22 read-only; if not there yet, a local temporary map, and report it.

## Tests (red first; Material harnesses)
ADR-004 §9 chat rows. Backend responses ONLY via `src/testing/capture-response.ts` + `src/testing/captures/*.json` (case-view-200, case-view-404, case-view-return-phone-3, chat-unchanged, chat-assessment-changed, chat-error, chat-409-conflict) — no hand-written responses.

## Editable files
`app/frontend/src/app/features/case-chat/**`, `app/frontend/src/app/shared/assessment-badge/**`, `app/frontend/src/app/shared/markdown/**`. Concurrent T22 owns `features/case-form/**`, `shared/photo-drop-zone/**`, `shared/labels/**`. Do not touch `core/**`, `app.config.ts`, routes, styles. Do not commit.

## Commands (from `app/frontend`)
`npx ng test --no-watch`, `npx ng build` (no warnings). Context7 out of quota → read installed `.d.ts`.

## Return
Files, red output, green counts, build, `git status --short`, PRD/ADR ambiguities.

## Notes from T21 (orchestrator, after acceptance)
- `core/` is flat: `core/models/index.ts`, `core/sse-client.ts` (`readSseEvents`, `postSse`, `toApiError`), `core/case-api.ts` (`CaseApi`, `FETCH` token). Async iterables, not Observables.
- An SSE `error` event is **yielded**; an interrupted stream or network failure **throws** `ApiError` (`STREAM_INTERRUPTED` / `NETWORK`). Both → AC-31 (restore text + "Wyślij ponownie").
- 409: the backend message is "Poczekaj na zakończenie odpowiedzi."; the UI shows the ADR-004 §3.5 text for code `REPLY_IN_PROGRESS` ("Poprzednia odpowiedź jest jeszcze generowana.") — a UI decision, not a capture edit.
- Tests: use `captureFetch` / `captureResponse`; provide the `FETCH` token.
- **Red first is mandatory**: run the failing tests and report the output before writing production code.
