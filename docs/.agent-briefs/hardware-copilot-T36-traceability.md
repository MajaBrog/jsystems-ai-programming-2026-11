# Brief T36 — Traceability audit (read-only)

You are a read-only auditor. Do NOT edit any file and do not run shell commands. Print the report to stdout.
Research rules: read files only; no library API decisions are needed.

## Task
Map every acceptance criterion and technical acceptance criterion to the tests that verify it.
1. Read the acceptance criteria AC-01 … AC-37 in `docs/PRD.md` §6.
2. Read every `TAC-` item in `docs/ADR/000-main-architecture.md`, `001-backend-api.md`, `002-ai-llm-integration.md`, `003-persistence-and-storage.md`, `004-frontend.md`, `005-backend-runtime-node.md`.
3. Search the tests: `app/backend/test/**/*.test.ts`, `app/frontend/src/**/*.spec.ts`, `app/e2e/tests/*.spec.ts`. Match by AC/TAC ids mentioned in test names or comments, and by the behaviour described.
4. Output a Markdown table: `| ID | Short requirement | Verified by (file › test name) | Type (unit/integration/E2E) |`. One row per ID. If nothing verifies an ID, write `GAP` in the "Verified by" column.
5. After the table, list all GAP rows with one sentence each on what is missing.

Be precise: quote real file paths and real test names. Do not invent tests.
