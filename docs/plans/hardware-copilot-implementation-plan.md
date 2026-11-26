# Implementation Plan — Hardware Service Decision Copilot PoC

> **Status: DRAFT — awaiting human review.** Planning does not authorize execution, new agents, publication or merge. Execution starts only after the human approves this plan (Review gate, §11).

| | |
|---|---|
| Plan name | `hardware-copilot` |
| Scope | The **whole PoC** defined by [`docs/PRD.md`](../PRD.md) (AC-01 … AC-37), implemented **in one run** (e.g. `/goal implement this plan: @docs/plans/hardware-copilot-implementation-plan.md`), delivered as **one implementation PR at the end** |
| Sources of truth | PRD [`docs/PRD.md`](../PRD.md); ADRs [`000`](../ADR/000-main-architecture.md), [`001`](../ADR/001-backend-api.md), [`002`](../ADR/002-ai-llm-integration.md), [`003`](../ADR/003-persistence-and-storage.md), [`004`](../ADR/004-frontend.md); design [`docs/design-guidelines.md`](../design-guidelines.md), [`assets/design-tokens.json`](../../assets/design-tokens.json), [`assets/homepage.png`](../../assets/homepage.png); rules [`AGENTS.md`](../../AGENTS.md), [`CLAUDE.md`](../../CLAUDE.md) |
| Orchestrator | Claude Opus 5.5 (architecture decisions, contradictions, briefs, acceptance, all Git index operations) |
| Created | 2026-11-26 |

---

## 1. Current state (verified 2026-11-26)

**Checkout:** worktree `.claude/worktrees/prd-hardware-copilot`, branch `docs/hardware-copilot-prd-adr-plan` (stacked on local `design-system` @ `1c86086`). Working tree clean except this plan. This worktree is the **single checkout** for execution (see C2 in §9).

**What exists:**
- `app/README.md` only — no application code, no build descriptors, no tests, no entry points.
- `docs/PRD.md`, `docs/ADR/000–004`, `docs/design-guidelines.md`, `assets/` (tokens, logo, favicon, homepage screenshot).
- `.env.example` with `OPENROUTER_API_KEY=` and `LLM_MODEL=openai/gpt-6-luna`.
- `.claude/settings.json`: allows npm/npx/node/git (non-destructive), **denies** `curl`, `sudo`, `rm`, `chmod`, `Read(.env)`; a `PreToolUse` agent hook reviews every `pom.xml` edit for dependency security (up to 120 s).
- `.gitignore`: ignores `.agent-briefs/` at every level (conflicts with this plan — fixed in T00), `*.db` (but not `data/uploads/`), `**/target/`, Playwright outputs.
- No `.claude/agents/` custom roles; `.codex/` config present (not used by this plan).

**Commands verified:**

| Command | Result |
|---|---|
| `node --version` / `npm --version` | v24.21.0 / 11.19.0 (Angular 22 requires `^24.15.0` ✓) |
| `java`, `mvn`, `sqlite3`, `pnpm` | **missing** (no JDK under `/usr/lib/jvm`, no SDKMAN) |
| `opencode --version`, `opencode run --help`, `opencode models` | 1.19.0; free models available (e.g. `opencode/deepseek-v4.1-flash-free`, `opencode/mimo-v2.6-flash-free`); **no OpenRouter provider connected**; `~/.config/opencode/opencode.jsonc` is empty |
| `gh auth status` | logged in; fork `MajaBrog/jsystems-ai-programming-2026-11`, viewer permission ADMIN, **Issues disabled** |
| `playwright-cli --version` | 0.1.25 (Manual QA tool required by AGENTS.md) |

**Baseline failures:** no application build/test exists to run. Blocking environment gap: **no JDK 21** (and `sudo` is denied to the agent) → human prerequisite H1.

---

## 2. Decisions taken for this plan (human, 2026-11-26)

| # | Decision |
|---|---|
| P1 | Whole PoC planned and implemented at once; phases below are internal checkpoints of one run, not separate deliveries. |
| P2 | Agent briefs are **committed** in `docs/.agent-briefs/` during the work (T00 un-ignores the folder); worker logs go to `.agent-logs/` (ignored). |
| P3 | After plan approval: enable GitHub Issues on the fork (`gh repo edit --enable-issues`), create **one issue per task row**, and use `T<nn> (#<issue>)` in this plan and in the agent task list. |
| P4 | Implementation is delivered as **one PR at the end** (local commits during the run; push + PR in T41 after the Definition of Done checks, with a final human confirmation before push). |
| P5 | OpenCode is used only with **free built-in models** and only for **read-only research/audit** tasks; all code is written by Claude Code subagents or the orchestrator. |
| P6 | This plan, the PRD and the ADRs are reviewed in a separate docs PR (branch `docs/hardware-copilot-prd-adr-plan` → `design-system`) before execution. Implementation then runs on a new branch `feat/hardware-copilot-poc` created from the merged docs branch. |

---

## 3. Human prerequisites (blocking, cannot be done by the agent)

| ID | Action | Why | Unblocks |
|---|---|---|---|
| H1 | Install JDK 21: `! sudo apt install -y openjdk-21-jdk` (or SDKMAN), then `! java -version` | `sudo` denied to the agent; ADR-000 D2 | T02 and all backend tasks |
| H2 | Generate the Spring Boot project (agent cannot `curl`): run the exact `curl` command that T02 prints (from ADR-000 D2) with `!`, or add a narrow allow rule `Bash(curl -sS https://start.spring.io/*)` for the run | `Bash(curl:*)` denied | T02 |
| H3 | Put a valid `OPENROUTER_API_KEY` in the repo-root `.env` (agent cannot read `.env`); confirm with `! grep -c '^OPENROUTER_API_KEY=sk-' .env` → `1` | Spike, smoke, E2E use the real model | T05, T19, T35–T37 |
| H4 | Approve test photo fixtures proposed by T07 (license + content) | AGENTS.md synthetic-data rule vs. need for realistic device photos (A7) | T05, T35 |
| H5 | Answer open decisions D-1…D-3 (§10) at plan review | Policy content and fixtures | T06, T07 |

---

## 4. Workers and models

The active harness supports Claude Code subagents via the `Agent` tool with a `model` override (`sonnet`, `haiku`) — verified in this session. OpenCode is installed (1.19.0). If subagents become unavailable, the orchestrator executes the same matrix **sequentially** in the same order.

| Worker | Model | Use for | Not for |
|---|---|---|---|
| Orchestrator | Claude Opus 5.5 | Shared files (pom.xml, application.yml, .gitignore, root package.json), integration checkpoints, Manual QA, acceptance, all commits, ADR/PRD amendments | — |
| Claude subagent (ad hoc) | Sonnet 5.5 | TDD implementation of bounded packages/components, spike, prompts/policies drafting, E2E suite | Shared hotspot files; accepting own work |
| Claude subagent (ad hoc) | Haiku 5.5 | Small mechanical tasks with exact briefs (root scripts, label maps, fixture README) | Streaming/concurrency code, prompts |
| OpenCode headless | `opencode/deepseek-v4.1-flash-free` (fallback `opencode/mimo-v2.6-flash-free`; check `opencode models` before dispatch) | Read-only research and audits that read much text (license research for fixtures, AC→test traceability audit) | Editing files, anything needing secrets |
| Independent review | `/code-review high` + `/security-review` run by the orchestrator, then the human | Final review | — |

**Escalation rule:** if a worker's diff fails the reproduced checks twice, or it reports it cannot satisfy the brief, the orchestrator re-dispatches with Sonnet (from Haiku/OpenCode) or takes the task itself (from Sonnet), and records it in the Status column.

**Custom roles:** none. Every task uses an **ad hoc** subagent with a self-contained brief; no `.claude/agents/*.md` files are created (no recurring role with special tool restrictions exists in this plan).

### OpenCode headless — how to run (read-only tasks only)
- **Command:** `opencode run -m opencode/deepseek-v4.1-flash-free -f docs/.agent-briefs/hardware-copilot-<brief>.md "Do the task described in the attached brief. Do not edit files; print the report to stdout." </dev/null 2>&1 | tee .agent-logs/hardware-copilot-<brief>.log`
- **Model flag:** `-m provider/model` (verify the id in `opencode models` right before dispatch; free models change).
- **Brief:** attached with `-f`; the positional message only points at it.
- **Permissions:** no `--auto`. T00 adds a project `opencode.json` that denies `edit` and `bash` and allows read/web fetch (exact keys verified against OpenCode docs via Context7 in T00; a headless run cannot answer prompts, so anything not allowed fails closed).
- **Output:** stdout tee'd to `.agent-logs/` (git-ignored). The orchestrator copies the accepted findings into the task's handoff, never the raw log.

---

## 5. Phases (internal checkpoints of one run)

| Phase | Goal | Tasks | Exit check |
|---|---|---|---|
| P0 Foundation | Repo hygiene, scaffolds, real OpenRouter captures, policies/prompts, fixtures | T00–T07 | Both scaffolds build and test green; captures saved; policies accepted |
| P1 Backend | Persistence, imaging, AI, API with TDD; backend smoke with real model | T10–T19 | `./mvnw verify` green; real submission + chat via `:8080` |
| P2 Frontend | Theming, SSE client, form, chat with TDD | T20–T25 | `npx ng test --no-watch` + `npx ng build` green |
| P3 Integration & acceptance | Full stack, bundled mode, E2E with real model, Manual QA, review, PR | T30–T41 | Definition of Done (§8) |

**Commit boundary:** one task row = one focused commit `Area: summary` (`Build:`, `Backend:`, `Frontend:`, `Test:`, `Docs:`), staged by named paths only, made by the orchestrator after reproducing the row's verification (AGENTS.md Commit Rules).

---

## 6. Dependency matrix (authoritative)

Status values: `Todo`, `Briefed`, `In progress`, `Review`, `Done`, `Blocked (<reason>)`, `Escalated (<to>)`. Issue numbers are added after approval (P3). Paths are relative to the repo root; `BE` = `app/backend`, `FE` = `app/frontend`, `pkg` = `BE/src/main/java/com/devpowers/copilot`, `tpkg` = `BE/src/test/java/com/devpowers/copilot`.

| Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Status |
|---|---|---|---|---|---|---|---|
| **T00** Repo hygiene | `.gitignore` commits `docs/.agent-briefs/`, ignores `.agent-logs/`, `data/`; `.env.example` lists all ADR env vars; read-only `opencode.json` | ADR-000 §3 (layout), §7 (env vars); P2, P5 | Plan approved | Orchestrator — shared root files | `.gitignore`, `.env.example`, `opencode.json` | `git check-ignore -v docs/.agent-briefs/x.md` → not ignored; `git check-ignore data/copilot.db .agent-logs/a.log` → ignored; `opencode run -m <free> "list files in docs/ADR"` works and an edit attempt is denied. Commit `Build: prepare repo for agent workflow` | Todo |
| **T01** Issues | Issues enabled; one issue per row T00–T42; IDs written into this table | P3 | Plan approved | Orchestrator | this plan | `gh issue list` count = number of rows; Status column shows `#n`. Commit `Docs: link plan tasks to issues` | Todo |
| **T02** Backend scaffold | `app/backend` Maven project from Initializr (Boot 4.2.x, Java 21) + manual deps; empty context test passes | ADR-000 D2, §2 versions; ADR-003 §2 | H1, H2, T00 | Orchestrator (pom.xml hotspot + security hook) | `BE/**` (generated), `BE/pom.xml` | `cd BE && ./mvnw -v` (or `sh mvnw -v` if exec bit lost — `chmod` denied); `./mvnw verify` green (1 test); `./mvnw dependency:tree` shows one Jackson line set ≥ 2.13.4. Commit `Build: scaffold Spring Boot backend` | Todo |
| **T03** Frontend scaffold | `app/frontend` Angular 22.3 + Material 22.3 + ngx-markdown + date-fns adapter + proxy; default app test/build green | ADR-004 §6.1, §2 | T00 | Sonnet subagent (concurrent with T02; disjoint folder) | `FE/**` incl. `FE/package.json`, `FE/package-lock.json` | `npx @angular/cli@22.3.0 new --help` checked first; `cd FE && npx ng test --no-watch` and `npx ng build` green; record actual `test` script in handoff (resolves A11). Commit `Build: scaffold Angular frontend` | Todo |
| **T04** Root dev tooling + nested AGENTS | `cd app && npm run dev` starts both processes with `.env` loaded and `APP_DATA_DIR=<repo>/data`; `app/AGENTS.md`, `BE/AGENTS.md`, `FE/AGENTS.md` with verified commands and pinned versions | ADR-000 D5, TAC-05; AGENTS.md (nested scope) | T02, T03 | Orchestrator (uses `write-agents-md` skill) | `app/package.json`, `app/package-lock.json`, `app/AGENTS.md`, `BE/AGENTS.md`, `FE/AGENTS.md` | `npm run dev` → `http://localhost:4200` serves default page and `http://localhost:4200/api/health` returns `UP` (after T14; until then backend starts without error). Commit `Build: add root dev scripts and scoped agent instructions` | Todo |
| **T05** OpenRouter spike + captures | Real calls (synthetic data) for vision+json_schema, decision+json_schema, streaming reply via openai-java 4.113.0 → verbatim captures with metadata, no secrets | ADR-002 D6, D1, §5 wire contract; AGENTS.md mock rule | T02, H3, H4 (one fixture) | Sonnet subagent | `tpkg/spike/**`, `BE/src/test/resources/openrouter-captures/**` | Spike test tagged `@Tag("live")`, excluded from default `verify`; captures include status, headers (Authorization removed), body/SSE stream, date, model, request summary; `grep -ri 'sk-or' captures/` empty; handoff states confirmed/refuted for: base-URL join, keep-alive comments, `finish_reason:error`, image+schema in one call. **Gate:** any refuted assumption → orchestrator amends ADR-002 before T13. Commit `Test: capture real OpenRouter responses` | Todo |
| **T06** Policies + prompts | `policies/return-policy.pl.md`, `policies/complaint-policy.pl.md` with stable rule ids; 7 prompt files per ADR-002 §3.7 | PRD §8, §11; ADR-002 §3.4 (rule ids), §3.7 | T02, D-1 answered | Sonnet subagent (concurrent with T05; disjoint files) | `BE/src/main/resources/policies/**`, `BE/src/main/resources/prompts/**` | Orchestrator checks: every PRD §8 minimum topic present; `Z-2.1` states 14 dni, `R-2.1` 2 lata; ids unique; prompts contain every PRD §11 "not allowed" item; human skim at checkpoint P0. Commit `Backend: add policy documents and prompts` | Todo |
| **T07** Test photo fixtures | 4–6 approved images (undamaged device, damaged device, user-caused damage, unusable black/blurred) with license/source README | PRD §8 functional (formats); ADR-000 §10; AGENTS.md synthetic data; D-2 | T00 | OpenCode free model (license research, read-only) → Haiku subagent writes files → human approves (H4) | `app/e2e/fixtures/**` | README lists source URL, license (CC0/public domain or own photo), checksum; no people/personal data visible; each ≤ 10 MB, JPEG/PNG/WEBP. Commit `Test: add approved photo fixtures` | Todo |
| **T10** Persistence | `schema.sql`, pragmas, `CaseRepository`, `AssessmentRepository`, `MessageRepository` with integration tests on temp SQLite | ADR-003 §3–§5, D1, D2, D4, TAC-003-01…05; PRD AC-32, AC-34 | T02, T14 | Sonnet subagent (concurrent with T11, T12) | `pkg/persistence/**`, `BE/src/main/resources/schema.sql`, `tpkg/persistence/**` | Red first: repository tests fail before code. `./mvnw -Dtest='*persistence*' verify` green; invariants helper I1–I4 present for later tests. Commit `Backend: add SQLite persistence` | Todo |
| **T11** Imaging | `ImageValidator`, `ImageCompressor`, `PhotoStore` | ADR-001 §3, D2, D3, TAC-001-04; ADR-003 §5 (PhotoStore); PRD AC-07, AC-08, AC-11 | T02 | Sonnet subagent (concurrent with T10, T12) | `pkg/imaging/**`, `tpkg/imaging/**`, `BE/src/test/resources/images/**` (generated test images) | Red first. Tests per ADR-001 §8 rows "Spoofed image", "WEBP input", path traversal (ADR-003 §8). Commit `Backend: add image validation and compression` | Todo |
| **T12** AI domain (pure Java) | Domain records, `PromptRepository`, `PolicyLimits`, `PolicyGuard` G1–G6, `OutputValidator`, `FirstMessageComposer`, `ContextBuilder` | ADR-002 §3.3–§3.7, §4, D2, D3; PRD AC-15…AC-23, AC-28 notice texts | T02, T06 | Sonnet subagent (concurrent with T10, T11) | `pkg/ai/domain/**`, `pkg/ai/guard/**`, `pkg/ai/prompt/**`, `pkg/ai/compose/**`, `tpkg/ai/**` (excluding `tpkg/ai/steps/**`) | Red first. All ADR-002 §8 unit rows G1–G6, "Guard never upgrades", "PolicyLimits match policy text", "First message order". Commit `Backend: add policy guard and message composition` | Todo |
| **T13** AI client + steps | `OpenRouterClientConfig`, `ImageAnalysisStep`, `DecisionStep`, `ChatEvaluateStep`, `ChatReplyStep` against WireMock stubs derived from T05 captures | ADR-002 §3.1, §3.2, §5, D1, D4, D5; TAC-002-01, -05, -06 | T05 (gate passed), T12, T14 | Sonnet subagent; escalate to orchestrator if streaming parsing differs from captures | `pkg/ai/client/**`, `pkg/ai/steps/**`, `tpkg/ai/steps/**`, `BE/src/test/resources/wiremock/**` | Red first. ADR-002 §8 integration rows (policy per type, image request shape, repair, mid-stream error, base URL join, no `OPENAI_API_KEY`). Every stub file names its source capture. Commit `Backend: add OpenRouter LLM steps` | Todo |
| **T14** Backend config | `application.yml`, `AppProperties`, `StartupChecks`, `ApiExceptionHandler` skeleton, virtual threads, multipart limits, `/api/health` | ADR-001 §3 configuration, §4 error model; ADR-000 §7, TAC-02, TAC-03 | T02 | Orchestrator (application.yml hotspot) | `BE/src/main/resources/application.yml`, `pkg/config/**`, `tpkg/config/**` | Red first: startup fails without key (TAC-03). `./mvnw verify` green; app starts with key and `GET :8080/api/health` → UP. Commit `Backend: add configuration and startup checks` | Todo |
| **T15** Case submission API | `POST /api/cases` (SSE), `GET /api/cases/{id}`, `GET /api/cases/{id}/photo`, `CaseSubmissionService`, `SseEventWriter` | ADR-001 §3–§5, D1; ADR-000 §6, §9.3 (submission diagrams); PRD AC-02, AC-04, AC-05, AC-07, AC-08, AC-11…AC-14, AC-30, AC-32, AC-34 | T10, T11, T13, T14 | Sonnet subagent | `pkg/cases/CaseController.java`, `pkg/cases/CaseSubmissionService.java`, `pkg/cases/SseEventWriter.java`, `pkg/cases/dto/**`, `tpkg/cases/submission/**` | Red first. ADR-001 §8 rows for submission + GET; TAC-001-02, -03; zero rows after failures. Commit `Backend: add case submission with SSE progress` | Todo |
| **T16** Chat turn API | `POST /api/cases/{id}/messages` (SSE), `ChatTurnService`, `CaseLocks`, evaluate-then-stream | ADR-001 §3 orchestration rules, D4; ADR-002 §3.6, D3; ADR-000 §9.3 (chat diagrams); PRD AC-25…AC-28, AC-31 | T15 (shares `cases` package and `SseEventWriter`) | Sonnet subagent | `pkg/cases/MessageController.java`, `pkg/cases/ChatTurnService.java`, `pkg/cases/CaseLocks.java`, `pkg/cases/SseEventWriter.java` (extend only), `tpkg/cases/chat/**` | Red first. ADR-001 §8 chat rows (no change, change, stream failure, concurrent 409). Commit `Backend: add streamed chat turns` | Todo |
| **T19** Backend checkpoint (real model) | Backend works end-to-end on `:8080` with real OpenRouter | ADR-000 §9.3; TAC-001-01; PRD AC-11…AC-28 (backend side) | T15, T16, H3, T07 | Orchestrator | `app/scripts/sse-probe.mjs` (Node fetch probe; `curl` is denied) | `./mvnw verify` (record test counts/skips); start app; probe submits a fixture and sends 2 chat messages: logs event names + first-token latency; inspect `data/copilot.db` via a JdbcClient test helper or the probe's GET. No commit unless the probe is added (`Test: add SSE probe script`) | Todo |
| **T20** FE theming + shell | `tokens.scss`, `material-theme.scss`, brand fonts, `app.config.ts` providers (pl locale, markdown, date-fns), routes with placeholder pages, header with logo | ADR-004 §3.1, §3.2, §3.6, D4, D5; design-guidelines.md; PRD §9 headers | T03 | Sonnet subagent (concurrent with T21) | `FE/src/styles/**`, `FE/src/styles.scss`, `FE/src/index.html`, `FE/angular.json`, `FE/src/app/app.config.ts`, `FE/src/app/app.routes.ts`, `FE/src/app/app.ts`(+html/scss), `FE/src/app/layout/**`, placeholder files `FE/src/app/features/case-form/case-form.page.ts`, `FE/src/app/features/case-chat/case-chat.page.ts`, `FE/public/**` (logo, favicon copies) | Red first: route + provider tests. `npx ng test --no-watch`, `npx ng build` green; playwright-cli screenshot of shell vs `assets/homepage.png`. Commit `Frontend: add brand theme and app shell` | Todo |
| **T21** FE core | `core/models`, `SseClient` (fetch + parser + abort), `CaseApi` | ADR-004 §3.3, §4, §5, D2; ADR-001 §4 SSE events | T03 | Sonnet subagent (concurrent with T20) | `FE/src/app/core/**` | Red first. ADR-004 §9 rows "SSE parser", "SSE abort" (chunk splits, multibyte, `:` comments, missing terminal, non-2xx). Commit `Frontend: add SSE client and case API` | Todo |
| **T22** Case form page | Form, `PhotoDropZone`, submission state machine, alerts | ADR-004 §3.4, D3; PRD AC-01…AC-10, AC-14, AC-30, §9.1 | T20, T21 | Sonnet subagent (concurrent with T23) | `FE/src/app/features/case-form/**`, `FE/src/app/shared/photo-drop-zone/**`, `FE/src/app/shared/labels/**` | Red first with Material harnesses: ADR-004 §9 form rows. Commit `Frontend: add case form` | Todo |
| **T23** Chat page | Summary panel, message list/bubble, chat input, badge, streaming state, not-found view | ADR-004 §3.3, §3.5; PRD AC-23…AC-29, AC-31, AC-33, §9.2, §9.3 | T20, T21 | Sonnet subagent (concurrent with T22) | `FE/src/app/features/case-chat/**`, `FE/src/app/shared/assessment-badge/**`, `FE/src/app/shared/markdown/**` | Red first: ADR-004 §9 chat rows. Must import labels from `shared/labels` read-only (owned by T22; if T22 not done, T23 uses a local temporary map and reports it). Commit `Frontend: add streamed chat screen` | Todo |
| **T25** Frontend checkpoint | FE complete against running backend | ADR-004 TAC-004-01…03, -05 | T22, T23, T19 | Orchestrator | — (fixes go back to T22/T23 owners) | `npx ng test --no-watch` (counts), `npx ng build` (no new warnings), `grep -r OPENROUTER FE/dist` empty; `npm run dev` + one manual flow with playwright-cli | Todo |
| **T30** Bundled mode | `-Pbundle-frontend` JAR serves SPA; `SpaForwardingController` | ADR-000 D5; ADR-001 §3, TAC-001-06; ADR-004 §6.2 | T25 | Orchestrator (pom.xml hotspot) | `BE/pom.xml`, `pkg/config/SpaForwardingController.java`, `tpkg/config/SpaForwardingTest.java` | Red first (forwarding test). `./mvnw -Pbundle-frontend package`; `java -jar` → `/case/<uuid>` returns index, `/api/unknown` 404 JSON. Commit `Build: add bundled frontend profile` | Todo |
| **T35** E2E suite (real stack) | Playwright 1.65.1 project in `app/e2e` running against `npm run dev` with real OpenRouter; no mocks/route interception | ADR-000 §10 cross-cutting scenarios; ADR-004 §9 E2E rows, TAC-004-04, -06; PRD AC-33, AC-36, AC-37 | T25, T07, H3 | Sonnet subagent | `app/e2e/**` (except `fixtures/**`, read-only), `app/package.json` script `e2e` only (orchestrator applies that one-line change) | Suite asserts structure, not model-specific categories, except guard-enforced cases (late return never "Przyjęte wstępnie"); no `page.route`/mock usage (`grep -r "route(" app/e2e` empty); run twice green; screenshots saved to `app/e2e/screenshots/` (git-ignored). Commit `Test: add end-to-end suite on the real stack` | Todo |
| **T36** AC traceability audit | Table mapping AC-01…AC-37 and all TACs to test names or Manual QA steps; gaps listed | PRD §6; ADR TACs; ADR-000 TAC-04 | T35 | OpenCode free model (read-only audit) → orchestrator verifies | — (report only; orchestrator records results in §7 of this plan) | Orchestrator spot-checks ≥ 10 mappings by opening the tests; every gap becomes a fix task or a Manual QA step | Todo |
| **T37** Manual QA | Real app driven with `playwright-cli`: every screen + state screenshotted and compared with brand reference; Polish text; no console errors | AGENTS.md Manual QA; design-guidelines.md; PRD §9; ADR-004 TAC-004-04 | T35, T36 | Orchestrator, then human | — | Checklist in §7.2 executed; screenshots listed in the PR description (stored outside Git or in PR comments); defects → fix tasks re-run through owners | Todo |
| **T38** Independent review | `/code-review high` + `/security-review` on the full implementation diff; findings fixed or justified | AGENTS.md Code Review Rules; ADR-000 TAC-02 | T37 | Orchestrator runs reviews; fixes dispatched to original owners | per finding | Re-run full verification (§8) after fixes; review log summarized in PR | Todo |
| **T41** Final PR + handoff | Branch `feat/hardware-copilot-poc` pushed (after human confirmation) and one PR opened with verification evidence, targeting the branch the docs PR was merged into (`design-system`, or `main` if `design-system` is merged by then) | P4, P6; AGENTS.md Commit Rules | T38, DoD §8 items 1–8 | Orchestrator; human approves/merges | PR description only | PR lists: commands + counts, E2E runs, Manual QA screenshots, review results, known limitations. Agent never merges | Todo |
| **T42** Cleanup after merge | Plan and briefs deleted (`git rm`), worktree removed | P2; AGENTS.md Git Worktrees | Human merged T41 PR | Orchestrator | `docs/plans/hardware-copilot-implementation-plan.md`, `docs/.agent-briefs/hardware-copilot-*` | `git rm` (plain `rm` is denied); commit `Docs: remove completed implementation plan`; `git worktree remove` + `git worktree prune` | Todo |

### 6.1 Parallel waves and concurrency notice
Each brief names the concurrent tasks of its wave and their folders. Max 3 workers at once.

| Wave | Concurrent tasks | Disjoint ownership |
|---|---|---|
| W1 | T02 (orchestrator) ‖ T03 ‖ T07 | `BE/**` ‖ `FE/**` ‖ `app/e2e/fixtures/**` |
| W2 | T04, T14 (orchestrator, sequential) ‖ T05 ‖ T06 | root/app files, config ‖ `tpkg/spike`, captures ‖ resources policies/prompts |
| W3 | T10 ‖ T11 ‖ T12 · then T13 · in parallel T20 ‖ T21 | separate packages / FE folders (max 3 workers: run T20 ‖ T21 when one backend worker finishes) |
| W4 | T15 → T16 (serial, shared package) ‖ T22 ‖ T23 | `pkg/cases` ‖ FE feature folders |
| W5 | T19 → T25 → T30 → T35 → T36 → T37 → T38 → T41 | serial integration |

### 6.2 Critical path
H1 → H2 → **T02** → **T05** (gate) → **T13** → **T15** → **T16** → **T19** → **T25** → **T35** → **T37** → **T38** → **T41**. Frontend (T20–T23) runs beside T10–T16 and joins at T25.

### 6.3 Shared-file hotspots (single owner, others request changes via the orchestrator)
`BE/pom.xml` (orchestrator; security hook) · `FE/package.json` + `FE/package-lock.json` (T03, then T20 only) · `app/package.json` (orchestrator) · `application.yml` (T14) · `schema.sql` (T10) · `angular.json`, `app.config.ts`, `app.routes.ts`, `styles.scss` (T20) · `SseEventWriter.java` (T15, extended by T16 strictly after) · `shared/labels/**` (T22) · `.gitignore`, `.env.example`, `opencode.json` (T00) · `docs/PRD.md`, `docs/ADR/**`, this plan (orchestrator only).

---

## 7. Verification

### 7.1 Per-task protocol (every row)
1. Worker writes the failing behavioral test(s) from the linked AC/TAC, runs them and reports the expected failure output.
2. Worker implements the minimum, runs the row's commands, returns the diff + command output + contradictions found.
3. Orchestrator reads the diff, checks the editable-files boundary (`git status --short`), reproduces the row's commands, updates Status, commits by named paths.
4. A failing reproduction → back to the worker with the output (max 2 rounds) → escalation (§4).

### 7.2 Manual QA checklist (T37, real app, real model)
Run `cd app && npm run dev`; drive `http://localhost:4200` with `playwright-cli`; screenshot each item; compare with `assets/homepage.png` and design-guidelines tokens (colors, typography, spacing, buttons, logo placement).
1. Empty form; all validation errors (AC-02…AC-09) incl. exact Polish messages.
2. Return with undamaged fixture, purchase today−3 d → progress texts → chat; first message sections/order and notice (AC-23, AC-24, AC-29).
3. Return with purchase today−30 d → never "Przyjęte wstępnie", 14-day rule cited (AC-18).
4. Complaint with user-damage fixture → not accepted, "not covered" justification (AC-21).
5. Unusable black image → back on form, values kept, photo cleared, reason shown (AC-14).
6. Chat: question about entered date answered correctly (AC-26); new fact that changes the assessment → notice first, badge updated (AC-28); typing indicator (AC-27).
7. Reload chat and open the link in a new tab → identical history (AC-33, AC-34); unknown id → "Nie znaleziono zgłoszenia".
8. "Nowe zgłoszenie" → empty form, old case unchanged (AC-35).
9. Service error: start backend with an invalid key → form shows AC-30 message, values incl. photo kept; chat failure restores text (AC-31).
10. Viewport 360 px: no horizontal scroll on both screens (AC-37); browser console has no errors.
11. Keyboard-only pass (TAC-004-05).

### 7.3 Mocks policy
- E2E (T35) and Manual QA (T37): real backend, real SQLite, real OpenRouter, real decision steps — **no mocks, no request interception**.
- Integration tests mock **only** OpenRouter, with WireMock stubs derived from T05 captures (each stub references its capture file). New stub shapes require a new real capture first.
- Unit tests mock all dependencies.

---

## 8. Definition of Done (whole plan)

1. Every matrix row is `Done` (or explicitly descoped by the human with the reason in Status).
2. `cd app/backend && ./mvnw verify` green — counts recorded, live-tagged spike excluded and reported as skipped.
3. `cd app/frontend && npx ng test --no-watch` and `npx ng build` green with no new warnings.
4. `cd app && npm run dev` starts both processes; `/api/health` UP through the proxy (startup recorded separately from build/test).
5. `npx playwright test` (in `app/e2e`) green twice in a row against the real stack and real OpenRouter.
6. Manual QA checklist §7.2 completed with screenshots; brand comparison done; defects fixed.
7. AC traceability (T36): all AC-01…AC-37 and TACs mapped to a passing test or a completed Manual QA step.
8. `/code-review high` and `/security-review` findings resolved; API key absent from logs, responses and bundles (TAC-02).
9. One implementation PR open (base per T41) with evidence; human review and merge.
10. After merge: plan and briefs deleted, worktree removed (T42).

---

## 9. Contradictions and ambiguities found (plan × PRD × ADRs × AGENTS.md × environment)

| # | Where | Issue | Resolution in this plan / needed action |
|---|---|---|---|
| C1 | `.gitignore` vs planning prompt | `.agent-briefs/` ignored everywhere ("Private agent briefs") but briefs must be committed | Human chose commit (P2); T00 adds `!docs/.agent-briefs/` |
| C2 | AGENTS.md "Use this checkout by default; worktree only when requested" | Work runs in harness-created worktree `.claude/worktrees/prd-hardware-copilot` | This worktree is the single checkout for the run; no further worktrees; removed in T42 |
| C3 | AGENTS.md "Do not push unless asked" | PR requires push | Human chose one PR at the end (P4); orchestrator still asks before `git push` in T41 |
| C4 | ADR-000 D2 uses `curl` to start.spring.io; `.claude/settings.json` denies `curl` | Agent cannot generate the backend | H2 (human runs it with `!` or grants a narrow allow) |
| C5 | ADR-000 D2 requires JDK 21; none installed; `sudo` denied | Backend cannot build | H1 |
| C6 | ADR-001 TAC-001-01 uses `curl -N` | `curl` denied | T19 uses a Node `fetch` probe (`node` allowed); human may additionally run `! curl -N …` |
| C7 | PRD 4.6 notice text in English ("Preliminary assessment changed") vs AC-28 Polish ("Wstępna ocena zmieniona") | Two strings | Polish is authoritative (AC-36, ADR-002 §3.6). Propose PRD wording fix in the docs PR |
| C8 | PRD 4.1 step 4 progress texts in English vs PRD §9.1 Polish | Two strings | Polish §9.1 authoritative; same PRD wording fix |
| C9 | PRD AC-30 "does not respond within 60 seconds" vs ADR-002 D5 per-call 60 s (submission = 2 calls, chat = 2 calls) | Total wait can reach ~120 s | Plan follows ADR (per call). **Decision D-3** at review: keep per-call or add a 60 s total budget |
| C10 | AGENTS.md "synthetic data only" vs need for realistic device photos for the vision model | Fixture source unclear | **Decision D-2**; T07 + H4 |
| C11 | PRD §8 physical-store rule "according to the store rules in the return policy" | Store rule content not defined | **Decision D-1** before T06 |
| C12 | ADR-000 TAC-01 says `npm test -- --no-watch`; ADR-004 says `npx ng test --no-watch` | Two commands | T03 records the generated `test` script; plan uses `npx ng test --no-watch`; orchestrator aligns ADR-000 TAC-01 in the docs PR |
| C13 | ADR-000 §7 "root `dev` script exports `.env`" — mechanism unspecified; agent `Read(.env)` denied | How `.env` reaches Maven | T04: npm script sources `../.env` in bash (`set -a; . ../.env; set +a`) — no agent reads the file content |
| C14 | `.gitignore` ignores `*.db` but not `data/uploads/` | Photos could be committed | T00 adds `data/` |
| C15 | `.claude/settings.json` denies `rm`, `chmod` | Cleanup and `mvnw` exec bit | `git rm` in T42; `sh mvnw` fallback in T02 |
| C16 | `pom.xml` PreToolUse security hook (≤120 s per edit) | Slow/blocked dependency edits by workers | Only the orchestrator edits `pom.xml` (T02, T30) and batches dependency changes |
| C17 | AGENTS.md TDD "tests before production code" vs generated scaffolds (T02, T03) | Generated code has no prior failing test | Scaffolds exempt; their verification is the generated test + build. All later rows Red→Green |
| C18 | OpenCode has no permission config; headless runs cannot answer prompts | Runs could hang/fail | T00 adds read-only `opencode.json`; P5 restricts OpenCode to read-only tasks |
| C19 | PRD §8 table "Location: defined in ADR" | — | Resolved by ADR-002 §3.7 (`resources/policies/`); no action |
| C20 | ADR-002 G1 "> 14 days" uses submission date as delivery date (PRD §12 assumption) | Borderline cases | Covered by unit tests at exactly 14 days; no action |

No missing architecture was found that requires a new ADR. If D-3 changes the timeout model, the orchestrator writes it as an amendment to ADR-002 D5 (status Proposed) before T13.

---

## 10. Unresolved decisions (answer at plan review)

| ID | Question | Proposed default |
|---|---|---|
| D-1 | Physical-store purchases in the return policy: goodwill return allowed? | No goodwill returns for physical-store purchases (rule `Z-6.1`); agent sets REJECT, or NEEDS_REVIEW when the channel is unclear |
| D-2 | Source of realistic device photos for spike/E2E/QA | CC0/public-domain photos from Wikimedia Commons (license recorded), plus generated black/blurred images for the unusable case; optionally the human's own photos of their devices without personal data |
| D-3 | AC-30 timeout: per LLM call (ADR) or total per user action | Per call (60 s) as in ADR-002 D5; PRD AC-30 reworded in the docs PR to "each analysis/decision step" |

---

## 11. Review gate, failure handling and fallback

**Review gate (now):** the human reviews this plan + PRD + ADRs in the docs PR. Approval = merge of the docs PR (or explicit written approval). Only then: T00, T01 (issues), briefs, workers.

**Brief protocol (after approval):** just before dispatch the orchestrator writes `docs/.agent-briefs/hardware-copilot-<task-id>-<slug>.md` containing: goal, linked PRD/ADR sections **with the relevant excerpts pasted**, current contracts (DTOs, SSE events, method signatures), predecessor outputs (e.g. capture file names), exact editable files, concurrent tasks and their folders, ordered steps (Red → Green → Refactor), test inputs and expected results, commands to run, what to return (diff, outputs, contradictions). Workers may not change scope or accept their own work. Briefs are committed (`Docs: add brief for T<nn>`) while work runs; worker logs stay in `.agent-logs/`.

**Failure / rollback:**
- Each row is one commit → a bad row is reverted with `git revert <sha>` (no history rewriting; `reset --hard` is denied).
- T05 gate failure (SDK cannot parse OpenRouter streaming, base URL mismatch) → stop, amend ADR-002 (e.g. fall back to raw OkHttp SSE for the reply step or switch API per D1 review trigger), get human OK, continue.
- OpenRouter outage or exhausted credit → continue unit/integration work on captures; mark T19/T35/T37 `Blocked (OpenRouter)`; never fake E2E with mocks.
- `data/` is disposable: delete `data/copilot.db` (by the human, or via a test helper) to reset local state.

**Smaller fallback (if time, tools or model access run out), in this order of cuts:**
1. Drop T30 (bundled JAR) — dev mode is sufficient for the PoC demo.
2. Drop T36 OpenCode audit — orchestrator does a manual AC mapping.
3. Reduce T35 E2E to the return happy path + unusable photo + reload.
4. Minimum viable slice: form → assessment → streamed chat **without** assessment revision (AC-28 deferred, documented as known limitation in the PR).
If subagents are unavailable, the orchestrator executes the matrix sequentially; if OpenCode free models are unavailable, T07/T36 research moves to a Haiku subagent.

**First bounded task after approval:** T00 — repo hygiene (`.gitignore`, `.env.example`, read-only `opencode.json`), orchestrator-owned, verified with `git check-ignore` and one read-only OpenCode run; in parallel the human completes H1–H3.
