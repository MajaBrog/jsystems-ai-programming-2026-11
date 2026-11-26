# Brief T15 + T16 — Case submission and chat turn API (service + HTTP + SSE), steps injected

Plan rows T15, T16 + plan §0 (Rev. 3). Worker: Claude Sonnet subagent. Checkout: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/prd-hardware-copilot`, branch `feat/hardware-copilot-poc`.
**Read first:** `docs/ADR/005-backend-runtime-node.md`, `app/backend/AGENTS.md`, `docs/ADR/001-backend-api.md` (all), `docs/ADR/000-main-architecture.md` §6 and §9.3 sequence diagrams, `docs/ADR/002-ai-llm-integration.md` §3.3, §3.5, §3.6, §5, D3, `docs/ADR/003-persistence-and-storage.md` §3–§5, PRD §4, §6 (AC-02, AC-04, AC-05, AC-07, AC-08, AC-11…AC-14, AC-25…AC-28, AC-30…AC-34).

## Existing code you build on (do not modify; ask via your report if a change is needed)
- `src/ai/steps/types.ts` — step contracts `AiSteps` (ImageAnalysisStep, DecisionStep, ChatEvaluateStep, ChatReplyStep) and `LlmUnavailableError` / `LlmInvalidOutputError`. **T13 (real OpenRouter implementation) is not done yet** — inject steps.
- `src/ai/compose/firstMessageComposer.ts` (`composeFirstMessage`, `changeNoticeLine`, `categoryLabel`), `src/ai/domain/types.ts`, `src/ai/guard/policyGuard.ts` (`GuardedEvaluation`).
- `src/imaging/*` (`validateImage`, `compressForModel`, `createPhotoStore` with save/read/delete), `src/persistence/*` (openDatabase, transaction, three repositories, `newCaseId`), `src/config/*` (`ApiError`, error handler, `Clock`, `AppConfig`), `src/app.ts` (`buildApp`), `test/support/test-config.ts`, `test/support/invariants.ts` (`checkInvariants(db, dataDir)`).
- Note: AI `Assessment.source` is `'DECISION' | 'CHAT'`; persistence uses `'INITIAL' | 'CHAT_REVISION'` (ADR-003) — map in `cases`.

## Goal
`app/backend/src/cases/`:
- `case-submission-service.ts` — validate → compress → vision → (unusable → `photoUnusable`, nothing persisted) → decision (guarded) → compose first message → persist case + assessment + first message + photo in **one** unit of work (photo deleted if the transaction fails). Emits via a `SubmissionListener` (`stage`, `photoUnusable`, `completed`, `error`) — no SSE inside the service.
- `chat-turn-service.ts` — load context → evaluate (guarded) → if changed emit `assessmentChanged` before any token → stream reply via `ReplyListener` (`assessmentChanged`, `token`, `completed`, `error`) → persist customer message + agent message (+ new assessment, `CHAT_REVISION`, and case `currentCategory`) in one transaction **after** the stream succeeded; nothing persisted on failure or disconnect. Agent message content when changed: `changeNoticeLine(from,to)` + reply per ADR-002 §3.6.
- `case-locks.ts` — in-memory per-case lock → 409 `REPLY_IN_PROGRESS`.
- `sse-event-writer.ts` — the only module that knows SSE: headers (`text/event-stream;charset=UTF-8`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`), `event:` + single-line JSON `data:`, exactly one terminal event, then end. Uses `reply.hijack()` + `reply.raw`. Detects client disconnect (`request.raw.on('close')`) → aborts an `AbortController` passed to steps.
- `unusable-photo-messages.ts` — fixed Polish message per `reason` (ADR-001 §4: reason + tips).
- `case-routes.ts` — Fastify plugin: `POST /api/cases` (multipart; field validation with Zod → 400 with all field errors in Polish per PRD texts, size → 413, type by content → 415, then SSE), `GET /api/cases/:id` (CaseView, 404 for unknown/malformed id; image analysis never exposed), `GET /api/cases/:id/photo` (`image/jpeg`, `Cache-Control: private, max-age=3600`), `POST /api/cases/:id/messages` (JSON `{content}` 1–2000 trimmed; 400/404/409 pre-stream, then SSE).
- Wiring: export `registerCaseRoutes(app, deps)` where deps = `{ db, photoStore, steps: AiSteps, clock, locks }`. The orchestrator will call it from `app.ts`/`server.ts` (you may add an optional `cases` deps field to `AppOptions` in `src/app.ts` — the only allowed edit outside your folders; keep the change minimal).

## Editable files (only)
`app/backend/src/cases/**`, `app/backend/test/cases/**`, minimal optional-deps addition in `app/backend/src/app.ts`. Do not commit or `git add`.

## Tests (TDD: red first, report failure output)
- **Unit/HTTP tests with fake steps** — the steps are our own internal modules, so fakes implementing `AiSteps` are allowed (AGENTS.md: unit tests mock all deps). Fakes must return values that pass the domain types (`ImageAnalysis`, guarded `Assessment`, `GuardedEvaluation`) — do NOT invent OpenRouter HTTP responses; no HTTP mocking of OpenRouter at all (real-capture integration tests come in a later task).
- Use real SQLite (temp dir), real photo store, real example photos from `assets/example-images/` for uploads (README rules: no generated images; non-image rejection with text/PDF bytes; 413 via `buildApp({maxPhotoBytes})` small limit + a real photo).
- Required: ADR-001 §8 submission + GET rows and chat rows that do not depend on real LLM bytes: happy path event order `stage ANALYZING_PHOTO` → `stage ASSESSING` → `completed`; complaint without description → 400 with field `description`, steps not called; future purchase date → 400 Polish text; `.png` with JPEG content accepted (laptop-1.png); unusable photo → `photo_unusable` with Polish message, no DB rows, no photo file; step throws `LlmUnavailableError` → `error LLM_UNAVAILABLE`, nothing persisted; GET case view shape (no imageAnalysis); photo endpoint; chat unchanged / changed (assessment_changed first, then tokens, completed with full content and currentCategory); stream failure mid-way → `error`, nothing persisted (AC-31); client disconnect aborts the step signal and persists nothing; 409 on parallel turn; invariants helper clean after every successful test (TAC-002-02, TAC-003-02).
- SSE tests need a listening server (`app.listen({port:0})`) + `fetch` reading the body; parse events.
- Commands from `app/backend`: `npm test`, `npm run typecheck` (0 errors).

## Rules
Node runs `.ts` natively: no enums/parameter properties; `import type`; relative imports end in `.ts`. Polish user-facing texts must match PRD/ADR exactly where given. Never log photo bytes or prompts. Context7 is out of quota: read installed `.d.ts` (`node_modules/fastify`, `@fastify/multipart`).

## Return
Files, red output, green counts, typecheck, `git status --short`, any contract ambiguity you resolved, and anything T13 must honor (e.g. abort/timeout semantics you relied on).
