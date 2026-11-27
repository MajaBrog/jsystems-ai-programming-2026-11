# PR: Hardware Service Decision Copilot PoC

Branch `feat/hardware-copilot-poc` → base `design-system` (fork `MajaBrog/jsystems-ai-programming-2026-11`).
Contains the PRD, ADR-000…005, the implementation plan and the whole implementation (plan `docs/plans/hardware-copilot-implementation-plan.md`, rev. 3).

## What
A customer fills a return/complaint form with a device photo; the backend analyses the photo and decides a preliminary category (Przyjęte wstępnie / Odrzucone wstępnie / Wymaga weryfikacji) with a policy rule for every point, then a streamed Polish chat answers follow-up questions and can revise the assessment (e.g. physical-store purchase → Z-6.1).

- **Backend** (`app/backend`): Node 24 + TypeScript + Fastify (ADR-005 replaces Java/Spring — no JDK on the VM), OpenAI SDK → OpenRouter Chat Completions with strict JSON schemas, deterministic PolicyGuard G1–G6, SQLite (`node:sqlite`), sharp image pipeline, SSE over POST.
- **Frontend** (`app/frontend`): Angular 22.3 + Material 22.3, own fetch-based SSE client, brand theme from `docs/design-guidelines.md`.
- **E2E** (`app/e2e`): Playwright on the real stack, Chromium + Firefox.

## How to run
```bash
cp .env.example .env            # add OPENROUTER_API_KEY (main checkout root)
cd app && npm install && npm --prefix backend install && npm --prefix frontend install
npm run dev                     # :8080 backend, :4200 app
npm test                        # backend + frontend unit/integration (offline)
npm run e2e                     # real stack, real model (~11 min)
cd backend && npm run start:bundled   # single process serving the built SPA
```

## Verification (2026-11-26)
| Check | Result |
|---|---|
| Backend `npm test` / `npm run typecheck` | 27 files, 316 tests passed / 0 errors, no warnings |
| Frontend `npx ng test --no-watch` / `npx ng build` | 15 files, 125 tests / no warnings, initial 495 kB |
| Startup | `npm run dev` → `/api/health` UP through the :4200 proxy |
| E2E (real OpenRouter, Chromium + Firefox) | 28 passed (11.1 min), 28 passed (11.4 min) — consecutive |
| Live capture spike | 11/11 real OpenRouter captures; mocks only derived from them (ADR-002 D6) |
| Real backend captures for frontend tests | 14 (T19 probe), incl. assessment_changed, 409, errors |
| `/code-review high` | 8 findings fixed (51227de, efc66ad) |
| `/security-review` | no findings ≥ 8/10 |
| Secrets | key absent from `dist`, logs, captures (test-enforced) |

## Manual QA (orchestrator, `app/e2e/screenshots/qa-*.png`, not committed)
Form empty/filled/submitting, chat first message (sections + notice), chat context (purchase date answered), agent rules (instruction override and off-topic declined, no personal data, new photo → new case), photo_unusable (phone as TV: values kept, photo cleared), AC-30/AC-31 with an invalid key (values kept / text restored + "Wyślij ponownie"), keyboard tab order, brand comparison with `assets/homepage.png` (inputs and primary button fixed in 636fd5f).

## Known limitations / open items
- **Edge** not tested by the agent (H7) — please check manually.
- **T01** GitHub issues not created (`gh repo edit --enable-issues` denied by the auto-mode classifier).
- Accepted test gaps: TAC-002-05 "+2 s" bound, TAC-004-03 500 ms token latency (not automated).
- `R-4.5` battery threshold 70 % is an invented PoC value; PRD §11.2 still says the agent writes the final notice while ADR-002 has the code add it — PRD wording to align.
- Model non-determinism: E2E asserts structure and guard-enforced outcomes only.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
