# Brief T10 — Persistence (node:sqlite)

Plan row T10 + plan §0 (Rev. 3). Worker: Claude Sonnet subagent. Checkout: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/prd-hardware-copilot`, branch `feat/hardware-copilot-poc`. **Read first:** `docs/ADR/005-backend-runtime-node.md`, `app/backend/AGENTS.md`, then `docs/ADR/003-persistence-and-storage.md` (all of it: §3 access/ids/pragmas, §4 schema, §5 storage, D1, D2, D4, TAC-003-01…05) and PRD AC-32, AC-34.

## Goal
- `app/backend/resources/schema.sql` — exactly the ADR-003 schema, idempotent (`CREATE TABLE IF NOT EXISTS …`).
- `app/backend/src/persistence/` — `openDatabase(dataDir)` using built-in `node:sqlite` `DatabaseSync` (file `{dataDir}/copilot.db`, pragmas per ADR-003 + `foreign_keys=ON`, `journal_mode=WAL`, `busy_timeout`), runs `schema.sql`; three repository modules (cases, assessments, messages) with hand-written SQL and explicit row mapping (camelCase domain objects, JSON columns parsed/serialized); a `transaction(db, fn)` helper (`BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK` on throw). Case id = `crypto.randomUUID()` (v4, lowercase).
- `app/backend/test/support/invariants.ts` — invariants helper I1–I4 from ADR-003 (e.g. latest assessment category == case currentCategory; every case has ≥ 1 assessment and the first message; message order; photo file exists for each case) callable from any integration test with a db + dataDir.

## Editable files (only)
`app/backend/src/persistence/**`, `app/backend/resources/schema.sql`, `app/backend/test/persistence/**`, `app/backend/test/support/invariants.ts`. Concurrent: T12 writes `src/ai/**`, `test/ai/**`. Orchestrator owns `src/app.ts`, `src/config/**`, `package.json`. Do not commit or `git add`.

## TDD
Red first (report failure output), minimum code, refactor. Tests use a temp dir (`mkdtemp`) and a real SQLite file — no DB mocks. Include: TAC-003-01 (fresh empty data dir → db + schema created; reopening keeps data), round-trip of each repository, ordering (`createdAt`, then `id`), rollback leaves nothing behind, FK enforcement, invariants helper detects a deliberately broken state (then reverted — controlled mutation). Commands from `app/backend`: `npm test`, `npm run typecheck` (0 errors).

## Rules
Node runs `.ts` natively: no enums/parameter properties/namespaces; `import type`; relative imports end in `.ts`. `node:sqlite` API: read `node_modules/@types/node/sqlite.d.ts` (Context7 quota exhausted; nodejs.org docs last). Synthetic test data only (no real personal data).

## Return
Files, red output, green counts, typecheck result, `git status --short`, any ADR-003 ambiguity and how you resolved it.
