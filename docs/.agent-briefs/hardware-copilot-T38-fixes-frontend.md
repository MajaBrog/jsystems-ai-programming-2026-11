# Brief T38b — Review fixes (frontend + E2E helper)

Worker: Claude Sonnet subagent. Checkout `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/prd-hardware-copilot`, branch `feat/hardware-copilot-poc`. Read `app/frontend/AGENTS.md`. TDD: failing test first (record red output), fix, green. Backend responses in unit tests only via `src/testing/capture-response.ts` + real captures (a stream can be truncated/gated from a real capture as existing specs do). Commands from `app/frontend`: `npx ng test --no-watch`, `npx ng build` (no warnings). Do not commit.

Concurrent: T38a edits `app/backend/**`, `app/package.json`, `app/AGENTS.md` — do not touch them.

## Fixes (from `/code-review high`)
1. **Badge after failed turn (important)** — `src/app/features/case-chat/case-chat.page.ts` (~l.168–180): remember `currentCategory()` before sending; on any failure branch (SSE `error`, thrown `ApiError` incl. STREAM_INTERRUPTED/NETWORK) restore it. Test: replay `chat-assessment-changed` truncated after the `assessment_changed` event and first tokens (derived from the real capture, no terminal event) → badge returns to the original category, text restored, "Wyślij ponownie" shown.
2. **Code points (important)** — the form's model-name validator (2–100) and description counter/limit (2000), and the chat input limit (2000): count Unicode code points (`[...s].length`) to match the backend. Tests: `'📱'` invalid model name; `'📱📱'` valid; counter shows code points.
3. **E2E helper (nit)** — `app/e2e/tests/helpers.ts` (~l.69) `submit()`: recognise the photo-unusable alert specifically (add `data-testid="photo-unusable"` to that alert in the case-form template), treat the service-error alert as a test failure with its text, and avoid a dangling `waitForURL` promise (await/cancel the losing branch). Verify with `npx playwright test tests/return-flow.spec.ts --project=chromium` (real stack already running on :4200/:8080 — reuse it, do not stop it).

## Editable files
`app/frontend/src/**`, `app/e2e/tests/**`.

## Return
Per fix: test name(s), red output line, green; full `ng test` counts; build result; the Playwright run summary; `git status --short`.
