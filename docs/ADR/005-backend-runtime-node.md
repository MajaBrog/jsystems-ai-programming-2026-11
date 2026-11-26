# ADR-005: Backend runtime — Node.js 24 + TypeScript instead of Java 21 + Spring Boot

**Status:** Accepted (human decision "A", 2026-11-26)
**Date:** 2026-11-26
**Supersedes:** ADR-000 D1, D2 (backend part), the backend rows of ADR-000 §2/§3 "Technology stack"; the Java/Spring/library specifics in ADR-001 (§2, §3 runtime notes, D2/D3 library choice), ADR-002 (§2, §3.1 SDK/Jackson notes, D6 recording mechanism), ADR-003 (§2, §3 DataSource/JdbcClient/`spring.sql.init`, D1 driver).
**Relates to:** [`000`](000-main-architecture.md), [`001`](001-backend-api.md), [`002`](002-ai-llm-integration.md), [`003`](003-persistence-and-storage.md), [`004`](004-frontend.md)

## 1. Context

Implementation of the PoC (plan `hardware-copilot`) stopped at T02: the course VM has no JDK, the agent may not run `sudo` or `curl`, and `sudo` needs an interactive password the human could not provide from the agent session. Node.js 24.21 and npm 11.19 are already installed and used by the frontend. The human chose to move the backend to Node.js/TypeScript (option "A").

Verified on the VM on 2026-11-26:
- `node:sqlite` (`DatabaseSync`) works in Node 24.21 without an experimental warning.
- Node 24.21 runs `.ts` files natively (type stripping) — no build step for dev and tests.
- `sharp@0.35.5` installs from prebuilt binaries (no install scripts) and decodes `assets/example-images/laptop-2.webp`.

## 2. Decision

| Concern | Was (Java) | Now (Node) | Version (npm, 2026-11-26) |
|---|---|---|---|
| Runtime / language | Java 21, Spring Boot 4.2 MVC, virtual threads | Node 24.21, TypeScript run by Node type stripping (erasable syntax only: no `enum`, no parameter properties, no namespaces); `tsc --noEmit` for type checking | `typescript` 7.0.2, `@types/node` |
| HTTP server | Spring MVC controllers, `SseEmitter` | Fastify 5 routes; SSE written on `reply.raw` (`reply.hijack()`) by one `SseEventWriter` module | `fastify` 5.12.8 |
| Multipart | Spring multipart | `@fastify/multipart` with `limits.fileSize = 10 MB` (AC-08 server-side) | 10.1.9 |
| Validation | Bean Validation | Zod schemas for form fields and chat body; same error JSON as ADR-001 §4 | `zod` 4.6.7 |
| LLM client | `openai-java` 4.113.0 + OkHttp | Official `openai` npm SDK, Chat Completions only, `baseURL` = `OPENROUTER_BASE_URL`, `maxRetries: 0`, explicit `apiKey` (never `OPENAI_API_KEY`), structured outputs via `response_format: json_schema` from Zod schemas (`zodResponseFormat`), streaming via `stream: true` | `openai` 7.65.0 |
| Images | ImageIO + TwelveMonkeys WebP + Thumbnailator | `sharp`: detect format by content (`metadata().format` ∈ jpeg, png, webp), `.rotate()` (EXIF), flatten alpha on white, resize long edge ≤ 1568 px (`fit: inside`, `withoutEnlargement`), JPEG quality 85 | `sharp` 0.35.5 |
| Database | `sqlite-jdbc` + `JdbcClient` + `spring.sql.init` | Built-in `node:sqlite` `DatabaseSync`, one connection, same pragmas (`foreign_keys=ON`, `journal_mode=WAL`, `busy_timeout`), same idempotent `schema.sql` executed at startup, hand-written SQL in one repository module per table; transactions with `BEGIN IMMEDIATE`/`COMMIT` | Node built-in |
| Static SPA (bundled mode) | Maven profile + frontend-maven-plugin + `SpaForwardingController` | `npm run start:bundled`: builds the Angular app, serves `app/frontend/dist/frontend/browser` with `@fastify/static`; non-`/api` GET routes fall back to `index.html`, unknown `/api/*` → 404 JSON | `@fastify/static` 10.1.12 |
| Tests | JUnit 5, Mockito, Spring Boot Test, WireMock | Vitest (unit + integration via `fastify.inject()` or a real listening port for SSE); OpenRouter replaced in integration tests by a local **replay HTTP server** that serves captured bytes | `vitest` 5.1.2 |
| OpenRouter capture (ADR-002 D6) | WireMock record/proxy mode, JUnit tag `live` | A recording proxy (`test/support/recording-proxy.ts`): a local HTTP server that forwards to `https://openrouter.ai` and saves status, headers (without `authorization`), raw body/SSE bytes, date, model and request summary. Live tests run only with `npm run test:live`; `npm test` never calls the network | — |
| Build / run commands | `./mvnw verify`, `./mvnw spring-boot:run` | `npm test`, `npm run typecheck`, `npm run dev` (`node --watch src/server.ts`), `npm start` | — |

Unchanged and still authoritative: the HTTP/SSE contract and error model (ADR-001 §4–§5), the step pipeline, schemas, PolicyGuard G1–G6, FirstMessageComposer, evaluate-then-stream and repair rule (ADR-002 §3–§5, D1–D5), the schema, invariants I1–I4 and storage layout (ADR-003 §3–§5), the frontend (ADR-004), environment variables (ADR-000 §7), and every testing rule about real captures and no mocks in E2E.

Package layout keeps ADR-000 §3 module boundaries: `app/backend/src/{cases,imaging,ai,persistence,config}/`, tests in `app/backend/test/` mirroring it, captures in `app/backend/test/captures/openrouter/`, resources (`policies/`, `prompts/`, `schema.sql`) in `app/backend/resources/`. Dependency direction unchanged: `cases → imaging | ai | persistence`.

Timeouts (AC-30, per step): non-streaming calls use the SDK `timeout` = `LLM_TIMEOUT_SECONDS`; the streaming reply aborts through an `AbortController` when no chunk arrives within `LLM_TIMEOUT_SECONDS`. Client disconnect (`request.raw` `close`) aborts the in-flight LLM call.

## 3. Rejected alternatives
- **Keep Java, JDK in the home directory (SDKMAN/tarball):** needs a human `curl`; the human chose to switch stacks.
- **Express 5:** fine for SSE, but Fastify gives `inject()` for fast HTTP tests and first-party multipart/static plugins.
- **`better-sqlite3`:** native addon; npm 11 on this VM warns about install scripts not covered by `allowScripts`; `node:sqlite` needs nothing.
- **Prisma/Drizzle:** ADR-003 already chose hand-written SQL for 3 tables.
- **MSW/nock for OpenRouter:** intercepting the SDK's `fetch` in-process is possible, but a real local HTTP replay server exercises the same network path as production (base URL join, SSE framing) — closer to the ADR-002 intent.

## 4. Consequences
- (+) No JDK, no `sudo`, no `curl`: every backend command runs in the agent session; one language and one package manager across the app.
- (+) TypeScript types shared conceptually with the frontend (no shared package in the PoC to keep builds independent).
- (-) `node:sqlite` is newer than `sqlite-jdbc`; mitigated by the small surface (3 tables, one process).
- (-) ADR-001…003 text still describes Java classes; read them through the mapping in §2 (class name → module of the same name in camelCase file, e.g. `CaseSubmissionService` → `src/cases/case-submission-service.ts`).

## 5. Technical acceptance criteria (replace the Java-specific commands)
- TAC-005-01: `cd app/backend && npm test` runs unit + integration tests without network access (no live tests); `npm run typecheck` reports 0 errors.
- TAC-005-02: `npm run test:live` records OpenRouter captures through the recording proxy; `grep -ri 'sk-or' test/captures` is empty.
- TAC-005-03: `cd app && npm run dev` starts backend `:8080` and frontend `:4200`; `GET /api/health` → `{"status":"UP"}` through the proxy.
- TAC-005-04: `npm run start:bundled` serves the SPA at `/`, `/case/<uuid>` returns `index.html`, `/api/unknown` returns 404 JSON.

**Review trigger:** if the course or team requires the JVM stack again, or `node:sqlite` shows data-integrity problems.
