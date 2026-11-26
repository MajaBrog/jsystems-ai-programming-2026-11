# app/backend — Node 24 + TypeScript + Fastify (ADR-005)

Pinned: `fastify` 5.12.8, `@fastify/multipart` 10.1.9, `@fastify/static` 10.1.12, `openai` 7.65.0, `zod` 4.6.7, `sharp` 0.35.5, `vitest` 5.1.2, `typescript` 7.0.2. SQLite = built-in `node:sqlite`. Package manager: npm.

## Commands (from `app/backend`)
- `npm test` — unit + integration (no network). `npm run typecheck` — must report 0 errors.
- `bash ../scripts/with-env.sh npm run test:live` — live OpenRouter capture tests only (`*.live.test.ts`), needs the key.
- `bash ../scripts/with-env.sh npm run dev` — server on `:8080` with `--watch`.

## TypeScript rules
Node runs `.ts` directly (type stripping): erasable syntax only — no `enum`, no parameter properties, no namespaces; use `import type` for types; relative imports end in `.ts`.

## Layout and rules
- `src/{cases,imaging,ai,persistence,config}` — dependency direction `cases → imaging | ai | persistence`; `ai`, `imaging`, `persistence` never import each other or `cases`.
- `resources/` policies, prompts, `schema.sql`. Contracts: ADR-001 §4–§5; LLM logic: ADR-002 §3–§5; schema: ADR-003. ADR-005 maps their Java names to modules here.
- OpenRouter in tests: only the replay server serving files from `test/captures/openrouter/`; every derived stub names its source capture. Never write a response from documentation.
- Never log or return the API key; never read `.env` directly (use `../scripts/with-env.sh`).
