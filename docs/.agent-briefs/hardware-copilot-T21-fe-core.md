# Brief T21 — Frontend core: models, SSE client, CaseApi

Plan row T21. Worker: Claude Sonnet subagent. Checkout: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/prd-hardware-copilot`, branch `feat/hardware-copilot-poc`.
**Read first:** `app/frontend/AGENTS.md`, `docs/ADR/004-frontend.md` (§3.3, §4 data structures, §5 interface contracts, D2 own fetch-based SSE client, §8 diagrams, §9 rows "SSE parser" and "SSE abort"), `docs/ADR/001-backend-api.md` §4 (CaseView, error model, SSE events) and §5.

## Real backend responses (the ONLY allowed test data for API responses)
`app/frontend/src/testing/captures/*.json` — recorded from the real backend with the real model (T19). Shape: `{ name, capturedAt, target, request, response: { status, headers, body } }`; `body` is the raw text (JSON or raw SSE bytes `event: …\ndata: …\n\n`). Files: health, submit-400-validation, submit-completed-complaint, submit-completed-return-phone-3, submit-photo-unusable, submit-error, case-view-200, case-view-404, case-view-return-phone-3, chat-unchanged, chat-assessment-changed, chat-error, chat-409-first, chat-409-conflict. Read-only. **No hand-written response fixtures.** Write a small test helper `src/testing/capture-response.ts` that turns a capture into a real `Response` (status, headers, body as a `ReadableStream`, optionally split into N-byte chunks to exercise chunk boundaries).

## Goal (`app/frontend/src/app/core/**` only)
- `models/` — TypeScript types for CaseView, assessment, message, categories, case type, device categories (ADR-001 §4 values), SSE event union, error model.
- `sse-client.ts` — fetch-based POST SSE reader (ADR-004 D2): parses `event:`/`data:` across arbitrary chunk boundaries, yields typed events, supports `AbortSignal`, surfaces non-2xx JSON error bodies (400/404/409/413/415) as typed errors before streaming, and network failure / stream end without a terminal event as an error.
- `case-api.ts` — `submitCase(formData, signal)` (multipart, returns async iterable of submission events or throws typed validation error with field errors), `getCase(id)`, `photoUrl(id)`, `sendMessage(id, content, signal)` (chat events). Injectable service (Angular `providedIn: 'root'`), using `fetch` (injectable/overridable for tests — e.g. an `InjectionToken<typeof fetch>`).
- Tests (`*.spec.ts` next to the code), red first: SSE parser over every SSE capture (event order and types exactly as recorded), chunk-boundary splitting (1-byte and 7-byte chunks give identical events), abort mid-stream stops reading, 400 capture → typed field errors (Polish messages kept), 404/409 captures → typed errors, `getCase` with case-view-200/404, error event capture → typed `error` event.

## Editable files
`app/frontend/src/app/core/**`, `app/frontend/src/testing/capture-response.ts` (+ spec). Concurrent: none. Do not touch `app.config.ts`, routes, features, styles. Do not commit or `git add`.

## Rules
Angular 22 standalone + signals, zoneless, Vitest via `npx ng test --no-watch` (run from `app/frontend`); `npx ng build` must stay warning-free. Library API: Context7 quota exhausted → read `node_modules/@angular/**/*.d.ts`. Polish UI texts unchanged from captures.

## Return
Files, red output, green counts, build result, `git status --short`, contract ambiguities.
