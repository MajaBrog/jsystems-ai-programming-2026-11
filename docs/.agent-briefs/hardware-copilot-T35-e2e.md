# Brief T35 — E2E suite on the real stack

Plan row T35. Worker: Claude Sonnet subagent. Checkout: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/prd-hardware-copilot`, branch `feat/hardware-copilot-poc`.
**Read first:** `docs/ADR/004-frontend.md` §9 (all E2E rows, TAC-004-04/-06/-07), `docs/ADR/000-main-architecture.md` §10, `docs/PRD.md` §6 (AC-18, AC-20, AC-23, AC-24, AC-28, AC-29, AC-33…AC-37) and §9 (exact Polish texts), `assets/example-images/README.md` (rules!), `docs/ADR/005-backend-runtime-node.md` §6 (real model observations), `app/AGENTS.md`.

## Setup (already done, commit 55fccc6)
`app/e2e/` with `@playwright/test@1.65.1`, `playwright.config.ts` (Chromium + Firefox, workers 1, webServer `npm run dev` from `app/` with `reuseExistingServer: true`, baseURL `http://localhost:4200`), `tests/smoke.spec.ts`. Browsers installed. **A dev stack with the real OpenRouter key is already running on :4200/:8080** — the config reuses it. Run from `app/e2e`: `npx playwright test` (both browsers) or `--project=chromium`.

## Hard rules
- Real stack only: **no `page.route`, `route.fulfill`, request interception or mocks**. `grep -rE "page\.route|route\.fulfill" app/e2e` must be empty.
- Photos only from `assets/example-images/` via `setInputFiles`; never assume what the model sees; assert **structure and guard-enforced outcomes only** (badge never "Przyjęte wstępnie" when a date rule forbids it, rule id cited, sections present, Polish), never a specific model category unless the guard forces it.
- Real model is non-deterministic: write assertions that hold for every valid model answer.

## Scenarios (one spec file per area)
1. **Full return flow** (today−3 d): each example photo used at least once across the suite (`laptop-1.png` JPEG-as-png accepted, `laptop-2.webp`, `phone-1.jpg`, `phone-2.jpeg`, `phone-3.jpeg`); stage text visible; lands on `/case/{uuid}`; first message has greeting, "Wstępna ocena", "Uzasadnienie", "Następne kroki" and ends with the mandatory notice (AC-23/24/29); badge shows one of the three Polish categories; summary panel shows form data. If the model returns `photo_unusable` for a photo, the test asserts the unusable state instead (values kept, photo cleared, AC-14) — both outcomes valid.
2. **Late return** (today−30 d): badge is not "Przyjęte wstępnie"; text cites `Z-2.1` (AC-18).
3. **Old complaint** (today−3 y, description filled): badge not "Przyjęte wstępnie"; cites `R-2.1` (AC-20).
4. **Physical-store revision (AC-28, required change)**: create RETURN cases (today−3 d) trying photos in order until the initial badge is **not** "Odrzucone wstępnie" (observed: `phone-3.jpeg` as SMARTPHONE gave "Wymaga weryfikacji"); then send "Kupiłem to urządzenie w sklepie stacjonarnym, nie przez internet."; assert the agent message starts with "Wstępna ocena zmieniona:" and the badge changes to "Odrzucone wstępnie" (Z-6.1 rule, guard-consistent). If no photo yields a non-REJECT start, fail with a clear message (do not skip silently).
5. **Chat context (AC-26)**: ask "Jaką datę zakupu podałem?" → reply contains the date in any Polish/numeric format matching the form date.
6. **Session (AC-33/34/35)**: reload the chat → identical history; open the same URL in a new page → identical; unknown UUID → "Nie znaleziono zgłoszenia"; "Nowe zgłoszenie" → empty form, old case unchanged on revisit.
7. **Responsive (AC-37)**: viewport 360×740 on both screens → `document.documentElement.scrollWidth <= window.innerWidth`.
8. **Console (TAC-004-06)**: collect `console` errors and `pageerror` in every test; fail on any.
9. **Language (AC-36)**: agent messages contain Polish section headings, no English section headings.
Screenshots of form, submitting, chat, unusable (if obtained) and not-found into `app/e2e/screenshots/` (gitignored).

Add `"e2e": "cd e2e && npx playwright test"` is the orchestrator's job — do not edit `app/package.json`.

## Editable files
`app/e2e/**` only (keep `playwright.config.ts` unless a change is required — report it). Do not commit.

## Done when
`npx playwright test` green **twice in a row** on Chromium + Firefox. Report both runs' summaries, total duration, any flaky assertion you hardened (and why it stays honest).
