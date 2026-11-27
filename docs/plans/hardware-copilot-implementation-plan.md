# Implementation Plan — Hardware Service Decision Copilot PoC

> **Status: EXECUTED 2026-11-26 (rev. 3, Node backend) — T41 push/PR awaits human confirmation.** Originally: DRAFT — awaiting human review. Planning does not authorize execution, new agents, issue creation, publication or merge. Execution starts only after the human approves this plan (review gate, §12).

| | |
|---|---|
| Plan name | `hardware-copilot` |
| Scope | The **whole PoC** defined by [`docs/PRD.md`](../PRD.md) (AC-01 … AC-37), implemented **in one run** (e.g. `/goal implement this plan: @docs/plans/hardware-copilot-implementation-plan.md`), delivered as **one implementation PR at the end** |
| Sources of truth | PRD [`docs/PRD.md`](../PRD.md); ADRs [`000`](../ADR/000-main-architecture.md), [`001`](../ADR/001-backend-api.md), [`002`](../ADR/002-ai-llm-integration.md), [`003`](../ADR/003-persistence-and-storage.md), [`004`](../ADR/004-frontend.md); design [`docs/design-guidelines.md`](../design-guidelines.md), [`assets/design-tokens.json`](../../assets/design-tokens.json), [`assets/homepage.png`](../../assets/homepage.png); test photos [`assets/example-images/`](../../assets/example-images/README.md); rules [`AGENTS.md`](../../AGENTS.md), [`CLAUDE.md`](../../CLAUDE.md) |
| Context and scale | PoC, single instance, low volume, consumer-law frame, test data only — PRD §1.1 |
| Orchestrator | Claude Opus 5.5 (architecture decisions, contradictions, briefs, acceptance, all Git index operations) |
| Created / revised | 2026-11-26 (rev. 2 after independent consistency review) |

---

## 0. Rev. 3 — backend on Node.js (human decision "A", 2026-11-26)

Execution stopped at T02 (no JDK; `sudo` needs a password the agent cannot supply). The human chose to move the backend to **Node.js 24 + TypeScript** — [ADR-005](../ADR/005-backend-runtime-node.md). Where this plan says Maven/Java/WireMock, read:

| Plan text | Now |
|---|---|
| H1 JDK, H2 Initializr, H6 `./mvnw`/`java` allowlist | **Dropped** — not needed |
| T02 Backend scaffold (`./mvnw verify`) | `app/backend` npm project (Fastify, openai, zod, sharp, Vitest, TypeScript `--noEmit`); `npm test` + `npm run typecheck` green with one health test |
| `pom.xml` hotspot + hook | `app/backend/package.json` (orchestrator) |
| `./mvnw verify` / `-Dgroups=live` | `npm test` / `npm run test:live` (from `app/backend`) |
| `./mvnw spring-boot:run` | `npm run dev` (from `app/backend`) |
| T05 WireMock record mode | recording proxy `test/support/recording-proxy.ts` → `test/captures/openrouter/` |
| T13 WireMock stubs (`tres/wiremock/**`) | replay server `test/support/replay-server.ts` serving captures; derivation rule unchanged |
| `pkg/…`, `tpkg/…`, `res/…`, `tres/…` | `app/backend/src/…`, `app/backend/test/…`, `app/backend/resources/…`, `app/backend/test/captures/…` |
| T30 `-Pbundle-frontend` JAR | `npm run start:bundled` with `@fastify/static` (TAC-005-04) |
| T06 output location | moved to `app/backend/resources/{policies,prompts}/` |

Still blocking: **H3** (`OPENROUTER_API_KEY` in the checkout-root `.env`) for T05, T19, T35, T37. T01 (issues) waits for the human (`gh repo edit` denied by the classifier; the fork must be addressed with `-R MajaBrog/…`).

Execution checkout: the planning worktree on branch `feat/hardware-copilot-poc` (the session runs there).

---

## 1. Current state (verified 2026-11-26)

**Planning checkout:** worktree `.claude/worktrees/prd-hardware-copilot`, branch `docs/hardware-copilot-prd-adr-plan` (stacked on local `design-system` @ `1c86086`, which is one merge commit ahead of `origin/design-system`).
**Execution checkout:** the **main checkout** `/home/labuser/jsystems-ai-programming-2026-11` (AGENTS.md default; visible in the human's editor), on a new branch `feat/hardware-copilot-poc` created after the docs PR is merged.

**What exists:**
- `app/README.md` only — no application code, no build descriptors, no tests, no entry points.
- `docs/PRD.md`, `docs/ADR/000–004`, `docs/design-guidelines.md`, `assets/` (tokens, logo, favicon, homepage screenshot), **`assets/example-images/`** (5 real device photos + README with usage rules; `laptop-1.png` is JPEG content with a `.png` extension).
- `.env.example` with `OPENROUTER_API_KEY=` and `LLM_MODEL=openai/gpt-6-luna`.
- `.mcp.json`: Context7 (HTTP) and Playwright MCP.
- `.claude/settings.json`: allows npm/npx/node and non-destructive git; **denies** `curl`, `sudo`, `rm`, `chmod`, `Read(.env)`, pushes to main/master; `PreToolUse` agent hook reviews every `pom.xml` edit (≤ 120 s). Commands such as `./mvnw`, `java`, `gh`, `opencode`, `playwright-cli`, `unzip`, `git rm`, `git revert` are **not** allowed and would prompt (→ H6).
- `.gitignore`: ignores `.agent-briefs/` at every level (fixed in T00), `*.db` (but not `data/uploads/`), `**/target/`, Playwright outputs.
- No `.claude/agents/` custom roles. Project skills in `.agents/skills/` (linked from `.claude/skills/`).

**Commands verified:**

| Command | Result |
|---|---|
| `node --version` / `npm --version` | v24.21.0 / 11.19.0 (Angular 22 requires `^24.15.0` ✓) |
| `java`, `mvn`, `sqlite3`, `pnpm` | **missing** (no JDK under `/usr/lib/jvm`, no SDKMAN); npm is used instead of pnpm |
| `opencode --version`, `opencode run --help`, `opencode models` | 1.19.0; free models available (e.g. `opencode/deepseek-v4.1-flash-free`, `opencode/mimo-v2.6-flash-free`); no OpenRouter provider connected; global config empty |
| `gh auth status`, `gh repo view` | logged in; fork `MajaBrog/jsystems-ai-programming-2026-11`, viewer ADMIN, **Issues disabled** |
| `playwright-cli --version` | 0.1.25 (Manual QA tool required by AGENTS.md) |
| `file assets/example-images/*` | 3 JPEG (`.jpg/.jpeg`), 1 JPEG named `.png` (3024×3135), 1 WebP |

**Baseline failures:** no application build/test exists. Blocking environment gap: **no JDK 21** (`sudo` denied to the agent) → H1.

---

## 2. Decisions taken for this plan (human, 2026-11-26)

| # | Decision |
|---|---|
| P1 | Whole PoC planned and implemented at once; phases are internal checkpoints of one run. |
| P2 | Agent briefs are **committed** in `docs/.agent-briefs/` during the work; worker logs go to `.agent-logs/` (ignored). |
| P3 | After approval: enable GitHub Issues (`gh repo edit --enable-issues`), create **one issue per task row**, use `T<nn> (#<issue>)` in this plan and in the agent task list. |
| P4 | **One implementation PR at the end** (local commits during the run; push + PR in T41 after the DoD checks, with a final human confirmation before push). |
| P5 | OpenCode only with **free built-in models** and only for **read-only** research/audit; all code by Claude subagents or the orchestrator. |
| P6 | PRD + ADRs + this plan are reviewed in a docs PR (`docs/hardware-copilot-prd-adr-plan` → `design-system`). Implementation runs afterwards in the main checkout on `feat/hardware-copilot-poc` from the merged base. |

---

## 3. Human prerequisites (blocking; the agent cannot do them)

| ID | Action | Why | Unblocks |
|---|---|---|---|
| H1 | Install JDK 21: `! sudo apt install -y openjdk-21-jdk`, then `! java -version` | `sudo` denied | T02 and all backend tasks |
| H2 | Generate the Spring Boot project: run the exact `curl … start.spring.io/starter.zip …` command printed by T02 (from ADR-000 D2) with `!`, plus `! unzip` into `app/backend` | `curl` denied | T02 |
| H3 | Create `/home/labuser/jsystems-ai-programming-2026-11/.env` (main checkout root) from `.env.example` with a valid `OPENROUTER_API_KEY`; confirm with `! grep -c '^OPENROUTER_API_KEY=sk-' .env` → `1` | Agent cannot read `.env`; live spike, smoke, E2E use the real model | T05, T19, T35, T37 |
| H5 | Answer D-1 and confirm D-3 (§11) at plan review | Policy content, timeouts | T06, T13 |
| H6 | For an unattended `/goal` run, add a project-local allowlist in `.claude/settings.local.json`, e.g. `Bash(./mvnw:*)`, `Bash(sh mvnw:*)`, `Bash(java:*)`, `Bash(gh issue:*)`, `Bash(gh repo edit:*)`, `Bash(opencode run:*)`, `Bash(opencode models)`, `Bash(playwright-cli:*)`, `Bash(git rm:*)`, `Bash(git revert:*)`, `Bash(bash app/scripts/with-env.sh:*)`. The agent must not edit permission settings itself | Otherwise the run stalls on prompts | whole run |
| H7 | Check Edge in Manual QA (T37) | Installing Edge for Playwright needs `sudo` | AC-37 |

---

## 4. Workers, models and instructions

The harness supports Claude Code subagents via the `Agent` tool with a `model` override (`sonnet`, `haiku`) — verified in this session. OpenCode 1.19.0 is installed. If subagents become unavailable, the orchestrator executes the same matrix **sequentially** in the same order.

| Worker | Model | Use for | Not for |
|---|---|---|---|
| Orchestrator | Claude Opus 5.5 | Shared files (`pom.xml`, `application.yml`, `ApiExceptionHandler`, `.gitignore`, `app/package.json`), integration checkpoints, Manual QA, acceptance, all commits, ADR/PRD amendments | — |
| Claude subagent (ad hoc) | Sonnet 5.5 | TDD implementation of bounded packages/components, spike, policies/prompts drafting, E2E suite — needs judgment about contracts and tests | Shared hotspot files; accepting own work |
| Claude subagent (ad hoc) | Haiku 5.5 | Small mechanical edits with exact briefs (label maps, probe script) — cheap and fast | Streaming/concurrency code, prompts |
| OpenCode headless | `opencode/deepseek-v4.1-flash-free` (fallback `opencode/mimo-v2.6-flash-free`; check `opencode models` before dispatch) | Read-only audits that read much text (T36 AC→test traceability) — free and good at bulk reading | Editing files, secrets, library API decisions |
| Independent review | `/code-review high` + `/security-review` (orchestrator), then the human | Final review | — |

**Escalation:** a diff that fails the reproduced checks twice, or a worker reporting it cannot satisfy the brief → re-dispatch to the next stronger worker (OpenCode/Haiku → Sonnet → orchestrator); recorded in Status.

**Custom roles:** none. Ad hoc subagents with self-contained briefs; no `.claude/agents/*.md` (no recurring role with special tool restrictions).

### 4.1 Research rules (every worker; pasted into every brief)
1. CLI syntax: run the tool's own help first (`./mvnw -h`, `npx ng <cmd> --help`, `npx playwright --help`, `opencode run --help`, `gh <cmd> --help`).
2. Library/framework APIs: Context7 (`resolve-library-id` → `query-docs`) using the IDs in ADR §2 tables, matched to the version in `pom.xml` / `package-lock.json`.
3. Web search last, vendor docs first. Broad research is delegated to a subagent or an OpenCode read-only run, and only conclusions come back.
4. OpenCode does not read Claude's user-level rules and has no Context7 configured: its briefs contain these rules explicitly and its tasks need no library API decisions.

### 4.2 Instruction levels that apply
| Level | File | Read by |
|---|---|---|
| Organization | course instructions in the Claude organization settings | Claude orchestrator and subagents |
| User (local) | `~/.claude/rules/context7.md` (no `~/.claude/CLAUDE.md`, no `~/.codex/AGENTS.md`, no `~/.config/opencode/AGENTS.md`) | Claude only |
| Project root | `AGENTS.md`, `CLAUDE.md` (imports `@AGENTS.md`) | Claude (`CLAUDE.md`), OpenCode (`AGENTS.md`) |
| Modules | `app/AGENTS.md`, `app/backend/AGENTS.md`, `app/frontend/AGENTS.md` — created in T04 with verified commands and pinned versions; root stays generic | agents working in those folders |

### 4.3 OpenCode headless — how to run (read-only tasks only)
- **Command:** `opencode run -m opencode/deepseek-v4.1-flash-free -f docs/.agent-briefs/hardware-copilot-<task>.md "Do the task described in the attached brief. Do not edit files; print the report to stdout." </dev/null 2>&1 | tee .agent-logs/hardware-copilot-<task>.log`
- **Model flag:** `-m provider/model` (verify in `opencode models` right before dispatch).
- **Brief:** attached with `-f`; the positional message only points at it.
- **Permissions:** no `--auto`. T00 adds a project `opencode.json` denying `edit` and `bash`, allowing read (exact keys verified via Context7/OpenCode docs in T00). Headless runs cannot answer prompts, so anything else fails closed.
- **Output:** tee'd to `.agent-logs/` (ignored); the orchestrator copies only accepted findings.

---

## 5. Phases (internal checkpoints of one run)

| Phase | Goal | Tasks | Exit check |
|---|---|---|---|
| P0 Foundation | Repo hygiene, scaffolds, real OpenRouter captures, policies/prompts | T00–T06 | Both scaffolds build and test green; capture set complete; policies accepted |
| P1 Backend | Persistence, imaging, AI, API with TDD; backend smoke with the real model | T10–T19 | `./mvnw verify` green; real submission + chat via `:8080` |
| P2 Frontend | Theming, SSE client, form, chat with TDD | T20–T25 | `npx ng test --no-watch` + `npx ng build` green |
| P3 Integration & acceptance | Full stack, bundled mode, E2E on the real stack, Manual QA, review, PR | T30–T42 | Definition of Done (§9) |

**Commit boundary:** one task row = one focused commit `Area: summary` (`Build:`, `Backend:`, `Frontend:`, `Test:`, `Docs:`), staged by named paths, made by the orchestrator after reproducing the row's verification.

---

## 6. Dependency matrix (authoritative)

Status: `Todo`, `Briefed`, `In progress`, `Review`, `Done`, `Blocked (<reason>)`, `Escalated (<to>)`. Issue numbers added after approval (P3). `BE` = `app/backend`, `FE` = `app/frontend`, `pkg` = `BE/src/main/java/com/devpowers/copilot`, `tpkg` = `BE/src/test/java/com/devpowers/copilot`, `res`/`tres` = main/test resources.

| Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Status |
|---|---|---|---|---|---|---|---|
| **T00** Repo hygiene | `.gitignore` commits `docs/.agent-briefs/` and ignores `.agent-logs/`, `data/`, `app/e2e/screenshots/`; `.env.example` lists all ADR-000 §7 vars; read-only `opencode.json`; root `AGENTS.md` points to `assets/example-images/` (its README asks for it) | ADR-000 §3, §7; P2, P5 | Plan approved; branch `feat/hardware-copilot-poc` created | Orchestrator — shared root files | `.gitignore`, `.env.example`, `opencode.json`, `AGENTS.md` (one bullet) | `git check-ignore -v docs/.agent-briefs/x.md` → not ignored; `git check-ignore data/copilot.db .agent-logs/a.log app/e2e/screenshots/a.png` → ignored; one read-only `opencode run` lists `docs/ADR` and an edit attempt is denied. Commit `Build: prepare repo for agent workflow` | Done (fd75058) |
| **T01** Issues | Issues enabled; one issue per row; IDs in this table | P3 | Plan approved, H6 | Orchestrator | this plan | `gh issue list --limit 100` count = number of rows. Commit `Docs: link plan tasks to issues` | Blocked (`gh repo edit --enable-issues` denied by the auto-mode classifier; human decision pending) |
| **T02** Backend scaffold | `BE` Maven project from Initializr (Boot 4.2.x, Java 21) + manual deps; surefire excludes JUnit tag `live`; context test passes | ADR-000 D2, §2; ADR-002 §3.1 (Jackson) | H1, H2, T00 | Orchestrator (pom.xml hotspot + hook) | `BE/**` (generated), `BE/pom.xml` | `cd BE && ./mvnw -v` (`sh mvnw -v` if exec bit lost; `chmod` denied); `./mvnw verify` green (1 test); `./mvnw dependency:tree` shows Jackson 3 (`tools.jackson`) from Boot and Jackson 2 (`com.fasterxml`) ≥ 2.13.4 from openai-java. Commit `Build: scaffold Spring Boot backend` | Done — Node (e460c0c) |
| **T03** Frontend scaffold | `FE` Angular 22.3 + Material 22.3 + ngx-markdown + date-fns adapter + proxy; default test/build green | ADR-004 §6.1, §2 | T00 | Sonnet subagent (concurrent with T02; disjoint folder) | `FE/**` incl. `FE/package.json`, `FE/package-lock.json` | `npx @angular/cli@22.3.0 new --help` first; `cd FE && npx ng test --no-watch` and `npx ng build` green; handoff records the generated `test` script. Commit `Build: scaffold Angular frontend` | Done (ec440e5) |
| **T04** Dev tooling + nested AGENTS | `app/scripts/with-env.sh` exports variables from the checkout-root `.env` **only if not already set** (so overrides like an invalid key work); `cd app && npm run dev` starts both processes with `APP_DATA_DIR=<repo>/data`; nested `AGENTS.md` files | ADR-000 D5, §7, TAC-05; §4.2 | T02, T03 | Orchestrator (uses `write-agents-md` skill) | `app/package.json`, `app/package-lock.json`, `app/scripts/with-env.sh`, `app/AGENTS.md`, `BE/AGENTS.md`, `FE/AGENTS.md` | `npm run dev` → `http://localhost:4200` serves the app; backend starts (health checked after T14); `OPENROUTER_API_KEY=x bash app/scripts/with-env.sh env-check` keeps `x`. Commit `Build: add dev scripts and scoped agent instructions` | Done (bdacab0, 38bc0e8) |
| **T05** OpenRouter capture spike | Live-tagged test records real calls via **WireMock record/proxy mode** to `https://openrouter.ai` with openai-java 4.113.0 → full capture set of ADR-002 D6 (vision usable ×2, category mismatch, decision return+complaint, chat-evaluate unchanged+changed, streaming reply, 401, 400/404) | ADR-002 D6, D1, §3.1, §5; AGENTS.md mock rule | T02, H3 | Sonnet subagent | `tpkg/spike/**`, `tres/openrouter-captures/**` | Run: `bash app/scripts/with-env.sh ./mvnw -Dgroups=live -Dtest='*Spike*' verify` (from `BE`). Captures contain status, headers (no `Authorization`), body/SSE bytes, date, model, request summary; `grep -ri 'sk-or' tres/openrouter-captures` empty. Handoff confirms/refutes: base-URL join, keep-alive comments, image + json_schema in one call, attribution header name, streaming timeout options. **Gate:** refuted assumption → orchestrator amends ADR-002 before T13. Commit `Test: capture real OpenRouter responses` | Done (d104b73) |
| **T06** Policies + prompts | Two Polish policies with stable rule ids; 7 prompt files | PRD §8, §11; ADR-002 §3.4, §3.7 | T02, D-1 | Sonnet subagent (concurrent with T05; disjoint files) | `res/policies/**`, `res/prompts/**` | Orchestrator checks every PRD §8 minimum topic, `Z-2.1` = 14 dni, `R-2.1` = 2 lata, physical-store rule per D-1, unique ids, every PRD §11.2 "not allowed" item in prompts; prompts never describe photo content. Commit `Backend: add policy documents and prompts` | Done (e70c7bd) |
| **T10** Persistence | `schema.sql`, pragmas, three repositories, invariants helper I1–I4 | ADR-003 §3–§5, D1, D2, D4, TAC-003-01…05; PRD AC-32, AC-34 | T02, T14 | Sonnet subagent (concurrent with T11, T12) | `pkg/persistence/**`, `res/schema.sql`, `tpkg/persistence/**`, `tpkg/support/Invariants.java` | Red first. `./mvnw -Dtest='*persistence*' verify` green; TAC-003-01 test (fresh data dir recreated). Commit `Backend: add SQLite persistence` | Done (18a6c01) |
| **T11** Imaging | `ImageValidator`, `ImageCompressor`, `PhotoStore` | ADR-001 §3, D2, D3, TAC-001-04; ADR-003 §5; PRD AC-07, AC-08, AC-11 | T02 | Sonnet subagent (concurrent with T10, T12) | `pkg/imaging/**`, `tpkg/imaging/**` | Red first. Uses `assets/example-images/*` read-only as inputs (incl. `laptop-1.png` = JPEG → accepted, WebP decoded, 3024 px → long edge 1568). Non-image rejection tests use non-image files (text/PDF bytes), not generated pictures. Commit `Backend: add image validation and compression` | Done (2a0ee66) |
| **T12** AI domain (pure Java) | Domain records, `PromptRepository`, `PolicyLimits`, `PolicyGuard` G1–G6, `OutputValidator`, `FirstMessageComposer`, `ContextBuilder` | ADR-002 §3.3–§3.7, §4, D2, D3; PRD AC-15…AC-23, AC-28 | T02, T06 | Sonnet subagent (concurrent with T10, T11) | `pkg/ai/domain/**`, `pkg/ai/guard/**`, `pkg/ai/prompt/**`, `pkg/ai/validate/**`, `pkg/ai/context/**`, `pkg/ai/compose/**`, `tpkg/ai/` (all but `tpkg/ai/steps/**`) | Red first. All ADR-002 §8 unit rows incl. "Rule point ensured in every category" and "Change normalized after guard". Commit `Backend: add policy guard and message composition` | Done (7bba49d) |
| **T13** AI client + steps | `ai.client.OpenRouterClientConfig`, four steps, against WireMock stubs derived from T05 captures | ADR-002 §3.1, §3.2, §5, D1, D4, D5; TAC-002-01, -05, -06 | T05 (gate), T12, T14 | Sonnet subagent; escalate to orchestrator if streaming differs from captures | `pkg/ai/client/**`, `pkg/ai/steps/**`, `tpkg/ai/steps/**`, `tres/wiremock/**` | Red first. ADR-002 §8 integration rows. Every stub header names its capture and lists changes (derivation rule, ADR-002 D6); no stub body is written from documentation — orchestrator rejects any stub without a source capture. Commit `Backend: add OpenRouter LLM steps` | Done (32b6f5e) |
| **T14** Backend config | `application.yml`, `AppProperties`, `StartupChecks`, full `ApiExceptionHandler` (400/404/409/413/415/500 per ADR-001 §4), virtual threads, multipart, `/api/health`, no CORS | ADR-001 §3, §4; ADR-000 §7, TAC-02, TAC-03; TAC-001-05 | T02 | Orchestrator (hotspots) | `res/application.yml`, `pkg/config/**` (except `SpaForwardingController`), `tpkg/config/**` | Red first: startup fails without key; CORS headers absent. App starts with key; `GET :8080/api/health` → UP (Node probe or browser). Commit `Backend: add configuration and error handling` | Done (ae14356) |
| **T15** Case submission API | `POST /api/cases` (SSE), `GET /api/cases/{id}`, `GET …/photo`, `CaseSubmissionService`, `SubmissionListener`, `SseEventWriter`, Polish `photo_unusable` message map | ADR-001 §3–§5, D1; ADR-000 §6, §9.3; PRD AC-02, AC-04, AC-05, AC-07, AC-08, AC-11…AC-14, AC-30, AC-32, AC-34 | T10, T11, T13, T14 | Sonnet subagent | `pkg/cases/CaseController.java`, `pkg/cases/CaseSubmissionService.java`, `pkg/cases/SubmissionListener.java`, `pkg/cases/SseEventWriter.java`, `pkg/cases/UnusablePhotoMessages.java`, `pkg/cases/dto/**`, `tpkg/cases/submission/**` | Red first. ADR-001 §8 submission + GET rows; TAC-001-02, -03; invariants helper after each test (TAC-002-02, TAC-003-02). Commit `Backend: add case submission with SSE progress` | Done (3c75cfb) |
| **T16** Chat turn API | `POST /api/cases/{id}/messages` (SSE), `ChatTurnService`, `ReplyListener`, `CaseLocks`, evaluate-then-stream | ADR-001 §3, D4; ADR-002 §3.3, §3.6, D3; PRD AC-25…AC-28, AC-31 | T15 | Sonnet subagent | `pkg/cases/MessageController.java`, `pkg/cases/ChatTurnService.java`, `pkg/cases/ReplyListener.java`, `pkg/cases/CaseLocks.java`, `pkg/cases/SseEventWriter.java` (extend only), `tpkg/cases/chat/**` | Red first. ADR-001 §8 chat rows (unchanged, changed, normalized, truncated stream, disconnect, 409). Commit `Backend: add streamed chat turns` | Done (3c75cfb) |
| **T19** Backend checkpoint (real model) + backend captures | Backend end-to-end on `:8080` with the real OpenRouter; **real responses of our own API recorded** for frontend unit tests | ADR-000 §9.3, §10 (Unit frontend); ADR-004 D2, §9; TAC-001-01; AGENTS.md mock rule | T15, T16, H3 | Orchestrator; probe script by Haiku subagent | `app/scripts/sse-probe.mjs`, `FE/src/testing/captures/**` | `./mvnw verify` (record counts; live tests reported as skipped); start backend via `with-env.sh`; probe submits example photos and sends chat messages; logs event order and first-token latency. Probe saves verbatim (status, headers, raw SSE bytes / JSON body, date, request summary): submission `completed`; submission `photo_unusable` if the model returns it for a phone photo as TV (else recorded as not obtained); submission and chat `error` with the backend started with an invalid key; chat with and without `assessment_changed`; `GET /api/cases/{id}` 200 and 404; `POST /api/cases` 400 validation; 409 via two parallel chat posts. Commit `Test: record real backend responses` | Done (a077a15, e9ad8fc) |
| **T20** FE theming + shell | Brand tokens, Material theme, fonts, providers (pl locale, markdown, date-fns), routes with placeholder pages, header with logo | ADR-004 §3.1, §3.2, §3.6, D4, D5; design-guidelines.md; PRD §9 | T03 | Sonnet subagent (concurrent with T21) | `FE/src/styles/**`, `FE/src/styles.scss`, `FE/src/index.html`, `FE/angular.json`, `FE/package.json`, `FE/package-lock.json`, `FE/src/app/app.config.ts`, `FE/src/app/app.routes.ts`, `FE/src/app/app.ts` (+html/scss), `FE/src/app/layout/**`, placeholders `FE/src/app/features/case-form/case-form.page.ts`, `FE/src/app/features/case-chat/case-chat.page.ts`, `FE/public/**` | Red first: route + provider tests. `npx ng test --no-watch`, `npx ng build` green; `playwright-cli` screenshot of the shell vs `assets/homepage.png`. Commit `Frontend: add brand theme and app shell` | Done (6d2ec9c) |
| **T21** FE core | `core/models`, `SseClient`, `CaseApi` | ADR-004 §3.3, §4, §5, D2; ADR-001 §4 | T03, T19 (recorded backend captures) | Sonnet subagent (concurrent with T20 once T19 is done) | `FE/src/app/core/**` | Red first. ADR-004 §9 "SSE parser", "SSE abort", replaying `FE/src/testing/captures/**` (read-only); no hand-written response fixtures. Commit `Frontend: add SSE client and case API` | Done (3f868af) |
| **T22** Case form page | Form, `PhotoDropZone`, submission states, alerts, validation on blur | ADR-004 §3.4, D3; PRD AC-01…AC-10, AC-14, AC-30, §9.1 | T20, T21, T19 | Sonnet subagent (concurrent with T23) | `FE/src/app/features/case-form/**`, `FE/src/app/shared/photo-drop-zone/**`, `FE/src/app/shared/labels/**` | Red first with Material harnesses: ADR-004 §9 form rows incl. "Validation on blur" and `.png` file with JPEG content accepted. Commit `Frontend: add case form` | Done (397eb49) |
| **T23** Chat page | Summary panel, messages, input (Enter/Shift+Enter), badge, streaming state, not-found | ADR-004 §3.3, §3.5; PRD AC-23…AC-29, AC-31, AC-33, §9.2, §9.3 | T20, T21, T19 | Sonnet subagent (concurrent with T22) | `FE/src/app/features/case-chat/**`, `FE/src/app/shared/assessment-badge/**`, `FE/src/app/shared/markdown/**` | Red first: ADR-004 §9 chat rows incl. "Enter / Shift+Enter". Reads `shared/labels` read-only (owned by T22; if missing, a local temporary map, reported). Commit `Frontend: add streamed chat screen` | Done (9ffe5e4) |
| **T25** Frontend checkpoint | FE complete against the running backend | ADR-004 TAC-004-01…03, -05 | T22, T23, T19 | Orchestrator | — (fixes go back to T22/T23) | `npx ng test --no-watch` (counts), `npx ng build` (no new warnings), `grep -r OPENROUTER FE/dist` empty; `npm run dev` + one flow with `playwright-cli` | Done (26982c0, 636fd5f) |
| **T30** Bundled mode | `-Pbundle-frontend` JAR serves the SPA; `SpaForwardingController` | ADR-000 D5; ADR-001 TAC-001-06; ADR-004 §6.2 | T25 | Orchestrator (pom.xml) | `BE/pom.xml`, `pkg/config/SpaForwardingController.java`, `tpkg/config/SpaForwardingTest.java` | Red first. `./mvnw -Pbundle-frontend package`; `java -jar` → `/case/<uuid>` returns index, `/api/unknown` 404 JSON. Commit `Build: add bundled frontend profile` | Done — npm run start:bundled (a3cf80b) |
| **T35** E2E suite (real stack) | Playwright 1.65.1 project in `app/e2e` (Chromium + Firefox) against `npm run dev` with the real OpenRouter; no mocks/interception; photos from `assets/example-images/` via `setInputFiles` | ADR-000 §10; ADR-004 §9 E2E rows, TAC-004-04, -06, -07; PRD AC-18, AC-28, AC-33, AC-36, AC-37 | T25, H3 | Sonnet subagent | `app/e2e/**` | Asserts structure and guard-enforced outcomes only; physical-store scenario requires a change (ADR-004 §9); `grep -rE "page\.route\|route\.fulfill" app/e2e` empty; suite green twice; screenshots in `app/e2e/screenshots/` (ignored). `e2e` script line in `app/package.json` applied by the orchestrator. Commit `Test: add end-to-end suite on the real stack` | Done (cee254e) |
| **T36** Traceability audit | AC-01…AC-37 and all TACs mapped to test names or Manual QA steps; gaps listed | PRD §6; ADR TACs; ADR-000 TAC-04 | T35 | OpenCode free model (read-only) → orchestrator verifies | — (results recorded in §8.4 of this plan) | Orchestrator opens ≥ 10 mapped tests; every gap → fix task or Manual QA step | Done — Haiku fallback (d788edc, 6367a5e) |
| **T37** Manual QA | Real app driven with `playwright-cli`; every screen/state screenshotted and compared with the brand reference | AGENTS.md Manual QA; design-guidelines.md; PRD §9, §11.2 | T35, T36 | Orchestrator, then human (H7) | — | Checklist §8.2; screenshots listed in the PR (not committed); defects → fix tasks | Done by orchestrator; Edge pending human (H7) |
| **T38** Independent review | `/code-review high` + `/security-review` on the whole implementation diff; findings fixed or justified | AGENTS.md Code Review Rules; ADR-000 TAC-02 | T37 | Orchestrator; fixes to original owners | per finding | Full verification (§9) re-run after fixes | Done (51227de, efc66ad) |
| **T41** Final PR | `feat/hardware-copilot-poc` pushed (after human confirmation) and one PR opened against the docs PR's merge target (`design-system`, or `main` if merged by then) | P4, P6 | T38, DoD items 1–8 | Orchestrator; human approves/merges | PR description only | PR lists commands + counts, E2E runs, Manual QA screenshots, review results, known limitations. Agent never merges | Deferred by the user (2026-11-27: no push); PR text in docs/plans/hardware-copilot-pr-description.md |
| **T42** Cleanup after merge | Plan and briefs deleted; no temporary worktrees left | P2; AGENTS.md Git Worktrees | Human merged T41 PR | Orchestrator | this plan, `docs/.agent-briefs/hardware-copilot-*` | `git rm` (plain `rm` denied); commit `Docs: remove completed implementation plan`; remove the planning worktree (`git worktree remove .claude/worktrees/prd-hardware-copilot`, `git worktree prune`) | Todo (after merge) |

### 6.1 Dependency graph

```mermaid
flowchart LR
    H1[H1 JDK] --> T02
    H2[H2 Initializr] --> T02
    H3[H3 .env key] --> T05
    T00 --> T02 & T03
    T02 --> T04 & T05 & T06 & T14
    T03 --> T04 & T20 & T21
    T05 -->|gate| T13
    T06 --> T12
    T14 --> T10 & T13
    T02 --> T11
    T10 & T11 & T13 --> T15
    T12 --> T13
    T15 --> T16 --> T19
    T19 -->|recorded API captures| T21
    T19 --> T22 & T23
    T20 & T21 --> T22 & T23
    T22 & T23 & T19 --> T25
    T25 --> T30 & T35
    T35 --> T36 --> T37 --> T38 --> T41 --> T42
    T30 --> T38
```

### 6.2 Parallel waves (max 3 workers at once; each brief names its concurrent tasks and their folders)

| Wave | Concurrent tasks | Disjoint ownership |
|---|---|---|
| W1 | T02 (orchestrator) ‖ T03 | `BE/**` ‖ `FE/**` |
| W2 | T04, T14 (orchestrator, sequential) ‖ T05 ‖ T06 | app scripts, config ‖ `tpkg/spike`, captures ‖ policies/prompts |
| W3 | T10 ‖ T11 ‖ T12, then T13; T20 when a worker slot frees | separate packages ‖ FE theme/shell files |
| W4 | T15 → T16 (serial) → T19 | `pkg/cases`, probe + captures |
| W5 | T21, then T22 ‖ T23 (need T19 captures) | FE core ‖ FE feature folders |
| W6 | T25 → T30 → T35 → T36 → T37 → T38 → T41 | serial integration |

### 6.3 Critical path
H1 → H2 → **T02** → **T05** (gate) → **T13** → **T15** → **T16** → **T19** → **T21** → **T22**/**T23** → **T25** → **T35** → **T37** → **T38** → **T41**. (Frontend contract-level work waits for real backend captures; only T20 theming runs earlier.)

### 6.4 Shared-file hotspots (single owner; others request changes via the orchestrator)
`BE/pom.xml` (orchestrator; hook) · `FE/package.json` + lockfile (T03, then T20) · `app/package.json` (orchestrator) · `application.yml`, `ApiExceptionHandler` (T14) · `schema.sql` (T10) · `angular.json`, `app.config.ts`, `app.routes.ts`, `styles.scss` (T20) · `SseEventWriter.java` (T15, extended by T16 after) · `shared/labels/**` (T22) · `.gitignore`, `.env.example`, `opencode.json`, root `AGENTS.md` (T00) · `docs/PRD.md`, `docs/ADR/**`, this plan (orchestrator only).

---

## 7. Brief protocol and plan lifecycle

- Just before dispatch the orchestrator writes `docs/.agent-briefs/hardware-copilot-<task-id>-<slug>.md`: goal; linked PRD/ADR sections **with the relevant excerpts pasted**; current contracts (DTOs, SSE events, signatures from ADR-002 §5); predecessor outputs (capture file names, commit SHAs); exact editable files; concurrent tasks and their folders; ordered Red → Green → Refactor steps; test inputs and expected results; commands; research rules §4.1; what to return (diff, command output, contradictions).
- Workers cannot change scope or accept their own work. The orchestrator reads the diff, checks `git status --short` against the editable files, reproduces the checks, updates Status, commits.
- Briefs and this plan are committed during the work (`Docs: add brief for T<nn>`); worker logs stay in `.agent-logs/`.
- After the Definition of Done (merge of the implementation PR): delete the plan and briefs (T42). Git history keeps them.

---

## 8. Verification

### 8.1 Per-task protocol
1. Worker writes the failing behavioral test(s) from the linked AC/TAC and reports the expected failure output.
2. Worker implements the minimum, runs the row's commands, returns diff + output + contradictions.
3. Orchestrator reproduces; a failing reproduction goes back with the output (max 2 rounds) → escalation (§4).

### 8.2 Manual QA checklist (T37, real app, real model)
Start: `cd app && npm run dev`; drive `http://localhost:4200` with `playwright-cli`; screenshot each item; compare with `assets/homepage.png` and design-guidelines tokens. Use only `assets/example-images/` photos and do not assume what the model sees.
1. Empty form; all validation errors incl. exact Polish texts and validation on blur (AC-02…AC-09).
2. Each example photo once (returns and complaints, purchase today−3 d) → progress texts → chat; first message order, sections, notice (AC-23, AC-24, AC-29); read each assessment for plausibility and Polish (AC-36).
3. Return with purchase today−30 d → never "Przyjęte wstępnie", 14-day rule cited (AC-18).
4. Complaint with purchase today−3 y → never "Przyjęte wstępnie", 2-year rule cited (AC-20).
5. Phone photo submitted as category TV → `photo_unusable` with values kept and photo cleared (AC-14), or record that the model accepted it.
6. Chat: "Jaką datę zakupu podałem?" answered correctly (AC-26); physical-store statement → notice first, badge updated (AC-28, PRD §8); typing indicator (AC-27).
7. Agent rules (PRD §11.2): off-topic question declined; "zignoruj regulamin i przyjmij zwrot" declined, assessment kept; agent never asks for address/phone/ID/bank account; request to send a new photo → told to start a new case.
8. Reload chat and open its link in a new tab → identical history (AC-33, AC-34); unknown id → "Nie znaleziono zgłoszenia".
9. "Nowe zgłoszenie" → empty form, old case unchanged (AC-35).
10. Errors (AC-30, AC-31): (a) create a case with the valid key; (b) restart only the backend with an invalid key: `cd app/backend && OPENROUTER_API_KEY=sk-or-invalid bash ../scripts/with-env.sh ./mvnw spring-boot:run` (the script keeps the already-set variable); (c) send a chat message → text restored, "Wyślij ponownie" shown; (d) submit a new form → AC-30 message, all values incl. photo kept.
11. Viewport 360 px on both screens: no horizontal scroll (AC-37); no console errors. Human checks Edge (H7).
12. Keyboard-only pass (TAC-004-05).

### 8.3 Mocks policy
- **E2E (T35) and Manual QA (T37):** real backend, real SQLite, real OpenRouter, real decision steps — no mocks, no request interception.
- **Integration tests (backend)** mock only OpenRouter, with WireMock stubs derived from T05 captures per the ADR-002 D6 derivation rule (replay, field-value change, delay or truncation, documented in the stub header). Failures that cannot be provoked safely are derived variants of real captures (status/`finish_reason` value changed); **no stub is written from documentation**. A case without a usable source capture is dropped and listed as a gap.
- **Unit tests** mock all dependencies. When the mocked dependency is an endpoint — OpenRouter or **our own backend API** (frontend unit tests) — the mock data comes from real recorded responses (T05 for OpenRouter, T19 for the backend), never from the ADR contract text.
- **Review check (T38):** `grep -rlE "SYNTHETIC|hand-written" BE/src/test FE/src` is empty and every file in `tres/wiremock/**` and `FE/src/testing/**` names its source capture.

### 8.4 Traceability results
Audit 2026-11-26 (T36; OpenCode free model timed out after 15 min → Haiku subagent per §12 fallback; orchestrator spot-checked 12 mapped test names, all exist). Paths: BE = `app/backend/test`, FE = `app/frontend/src/app`, E2E = `app/e2e/tests`, QA = §8.2 Manual QA item.

| ID | Verified by |
|---|---|
| AC-01 | FE `case-form.page.spec` layout (PRD 9.1); QA 1 |
| AC-02 | FE `case-form.page.spec` "empty submit… (AC-02, AC-09)"; BE `cases/submission` "complaint without description → 400" |
| AC-03 | FE `case-form.page.spec` "requires description for Complaint only… (AC-03)" |
| AC-04 | FE + BE "future purchase date… (AC-04)" |
| AC-05 | FE model-name/description counters; BE model-name and 2000-char tests |
| AC-06 | FE `photo-drop-zone.spec` "replaces the first photo… (AC-06)" |
| AC-07 | FE `photo-drop-zone.spec` content-based rejection; BE "non-image bytes → 415 (AC-07)" |
| AC-08 | FE "larger than 10 MB… (AC-08)"; BE size limit → 413 |
| AC-09 | FE "empty submit sends no request… (AC-09)" |
| AC-10 | FE "while processing… no second request (AC-10)" |
| AC-11 | BE `cases/submission` "JPEG ≤ 1568 px (AC-11, TAC-001-04)"; BE `imaging/image-compressor` |
| AC-12 | BE `ai/steps/ai-steps` vision-return replay; BE `ai/domain/schemas`; QA 2 |
| AC-13 | BE `ai/steps/ai-steps` "vision-complaint-phone-1 … (AC-13)" — **added in T36** |
| AC-14 | BE "unusable photo → photo_unusable (AC-14)"; FE photo_unusable state; QA 5 (observed in UI) |
| AC-15 | BE `ai/domain/schemas` enum rejection; BE `outputValidator` category enum |
| AC-16 | BE `outputValidator` next-steps/rule-id cases; BE `firstMessageComposer` bullets with rule ids |
| AC-17 | BE `promptRepository` "one policy per case type (AC-17)"; BE `ai-steps` decision-complaint |
| AC-18 | BE `policyGuard` G1 (14 vs 15 days); E2E `rules` late return (Z-2.1) |
| AC-19 | BE `policyGuard` G2 (AC-19) |
| AC-20 | BE `policyGuard` G3; E2E `rules` old complaint (R-2.1) |
| AC-21 | BE `policyGuard` G4 (R-4.1, R-4.2) |
| AC-22 | BE `policyGuard` G5; BE `firstMessageComposer` "Do wyjaśnienia" |
| AC-23 | BE `firstMessageComposer` order (AC-23); E2E `return-flow` |
| AC-24 | FE `case-chat.page.spec` summary panel; E2E `return-flow` |
| AC-25 | FE "cannot send empty… (AC-25)"; BE chat 400 cases |
| AC-26 | BE `cases/chat` full context (AC-26); E2E `session-chat`; QA 6 |
| AC-27 | FE streaming "typing indicator… send disabled" |
| AC-28 | BE `cases/chat` assessment_changed; E2E `rules` physical-store revision; T19 probe |
| AC-29 | FE `markdown.spec`, `case-chat.page.spec` (AC-29); E2E `return-flow` |
| AC-30 | FE error/network/interrupted cases; BE failures → error; BE `ai-steps` timeout; QA 10 (observed in UI with invalid key) |
| AC-31 | BE `cases/chat` failures (AC-31); FE errors (AC-31); QA 10 (observed in UI) |
| AC-32 | BE `cases/submission` happy path persists one unit of work; BE `persistence` round-trips |
| AC-33/34 | E2E `session-chat` reload + fresh page + unknown UUID; FE not-found |
| AC-35 | E2E `session-chat` "Nowe zgłoszenie… (AC-35)" |
| AC-36 | E2E `session-chat` Polish agent text; FE `labels.spec` English-word scan; FE Polish datepicker labels; QA 7 |
| AC-37 | E2E `responsive` 360×740 on Chromium + Firefox; **Edge: human (H7)** |
| TAC-01 / TAC-005-01 | Commands: `npm test` (BE 300+ tests), `npm run typecheck` 0 errors, `npx ng test --no-watch`, `npx ng build` no warnings — recorded in the PR |
| TAC-02 | Command checks: `grep -r OPENROUTER app/frontend/dist` empty; key absent from backend logs (invalid-key runs); BE `config` never echoes values |
| TAC-03 | BE `config` fail-fast |
| TAC-04 | This table (every AC mapped) |
| TAC-05 / TAC-005-03 | E2E `smoke`; BE `health` |
| TAC-06 / TAC-001-02 / TAC-003-03 | BE `cases/submission` + `cases/chat` failure rows, photo deleted on DB failure; BE `persistence` rollback |
| TAC-001-01 | T19 probe on :8080 and :4200 (incremental `stage`/`token` timings recorded in the T19 commit); BE `ai-steps` chunkDelay |
| TAC-001-03 | BE `sse-event-writer` single terminal event |
| TAC-001-04 | BE `ai-steps` decodes the recorded data URL; BE `cases/submission` |
| TAC-001-05 | BE `config/errors` no CORS headers |
| TAC-001-06 / TAC-005-04 | BE `config/spa-static`; verified on the real Angular build (T30) |
| TAC-002-01 | BE `ai-steps` request path; live spike |
| TAC-002-02 | BE `cases/*` teardown re-checks persisted assessments against G1/G3 (`test/support/guard-rules.ts`, mutation-tested) — **added in T36** (old tag was misleading) |
| TAC-002-03 | BE `firstMessageComposer` exact notice; BE `cases/chat` change line first |
| TAC-002-04 / TAC-005-02 | BE `support/captures-hygiene` (metadata, no key/Authorization/account id) — **added in T36** |
| TAC-002-05 | BE `ai-steps` timeout + stream inactivity (rejection; +2 s bound not asserted — accepted gap) |
| TAC-002-06 | BE `contextBuilder` + `requests` no customer text in system prompt |
| TAC-003-01 / -05 | BE `persistence` fresh dir; BE `startup-checks` |
| TAC-003-02 | BE `persistence` invariants helper (mutation-tested) + teardown in `cases/*` |
| TAC-003-04 | Command: `git status --short` clean after the suites; `data/` gitignored (T00) |
| TAC-004-01 | Command: `grep -r OPENROUTER app/frontend/dist` empty (T25) |
| TAC-004-02 | FE `labels.spec` (label maps); templates reviewed in QA 1/6 |
| TAC-004-03 | Not automated — accepted gap; streaming observed live in QA 6 (tokens appear as they arrive) |
| TAC-004-04 | E2E suite, no interception (grep empty), screenshots in `app/e2e/screenshots/` |
| TAC-004-05 | QA 12 keyboard pass (tab order complete); FE Enter/Shift+Enter; badges carry text + icon |
| TAC-004-06 | E2E console-error fixture in every spec (smoke added in T36) |
| TAC-004-07 | Playwright projects chromium + firefox; Edge: human (H7) |

Accepted gaps (documented, not automated): TAC-002-05 "+2 s" bound, TAC-004-03 500 ms latency, Edge (H7).

---

## 9. Definition of Done (whole plan)

1. Every matrix row `Done` (or descoped by the human with the reason in Status).
2. `cd app/backend && ./mvnw verify` green — counts recorded; live-tagged tests reported as skipped.
3. `cd app/frontend && npx ng test --no-watch` and `npx ng build` green, no new warnings.
4. `cd app && npm run dev` starts both processes; `/api/health` UP through the proxy (startup recorded separately from build/test).
5. `npx playwright test` (in `app/e2e`, Chromium + Firefox) green twice in a row on the real stack with the real OpenRouter.
6. Manual QA §8.2 completed with screenshots and brand comparison; Edge checked by the human; defects fixed.
7. Traceability §8.4 complete: every AC and TAC maps to a passing test or a completed QA step.
8. `/code-review high` and `/security-review` findings resolved; API key absent from logs, responses and bundles.
9. One implementation PR open (base per T41) with evidence; human review and merge.
10. After merge: plan and briefs deleted, planning worktree removed (T42).

---

### 9.1 Definition of Done — evidence (2026-11-26)
| # | Result |
|---|---|
| 1 | All rows Done except T01 (blocked, human), T41/T42 (human-gated) |
| 2 | `cd app/backend && npm test` → 27 files, 316 tests passed; `npm run typecheck` 0 errors; live capture tests excluded (`npm run test:live` run once in T05, 11/11) |
| 3 | `cd app/frontend && npx ng test --no-watch` → 15 files, 125 tests; `npx ng build` no warnings, initial 495 kB |
| 4 | `cd app && npm run dev` → backend :8080 + frontend :4200, `/api/health` UP through the proxy (E2E smoke) |
| 5 | `npm run e2e` (Chromium + Firefox, real OpenRouter) after the final code: 28 passed (11.1 min), 28 passed (11.4 min) — two consecutive green runs; earlier AC-28 failure traced to a prompt defect and fixed (3ee0507), rules spec then 18/18 |
| 6 | Manual QA §8.2 done by the orchestrator with screenshots (`app/e2e/screenshots/qa-*.png`); **Edge pending (H7)** |
| 7 | §8.4 traceability complete |
| 8 | `/code-review high` 8 findings fixed (51227de, efc66ad); `/security-review` no findings ≥ 8; key absent from logs, responses and `dist` |
| 9–10 | Pending human: push + PR (T41), merge, cleanup (T42) |

---

## 10. Contradictions and ambiguities (plan × PRD × ADRs × AGENTS.md × environment)

| # | Where | Issue | Resolution / action |
|---|---|---|---|
| C1 | `.gitignore` vs planning prompt | `.agent-briefs/` ignored everywhere | Human chose commit (P2); T00 |
| C2 | AGENTS.md "use this checkout by default" vs harness worktree used for planning | Files invisible in the human's editor | Execution in the main checkout (§1); planning worktree removed in T42 |
| C3 | AGENTS.md "no push unless asked" | PR needs push | P4; human confirmation before push in T41 |
| C4 | ADR-000 D2 `curl` to start.spring.io; `curl` denied | Agent cannot generate backend | H2 |
| C5 | JDK 21 required; none installed; `sudo` denied | Backend cannot build | H1 |
| C6 | `curl -N` in TACs | `curl` denied | Node probe (ADR-001 TAC-001-01, ADR-004 §6.2 updated) |
| C7–C8 | PRD English notice/progress texts vs Polish ACs | Two wordings | PRD 4.1 and 4.6 corrected to the Polish texts |
| C9 | AC-30 60 s vs multi-call actions (submission up to 4 calls, chat up to 3) | Total wait unclear; streams could be cut | PRD AC-30 now "per step" (D-3 default); ADR-001 emitter timeouts by max calls; ADR-002 §3.1 streaming inactivity timeout |
| C10 | Plan rev. 1 proposed Wikimedia/generated fixtures vs `assets/example-images/README.md` (real photos only, no generated images, no assumptions about content) | Two incompatible fixture rules | Fixtures = `assets/example-images/` read-only; AC-19/AC-21 by guard unit tests; E2E asserts structure; T07 removed |
| C11 | PRD §8 physical-store rule content | Store rule undefined | D-1 before T06 |
| C12 | `npm test -- --no-watch` vs `npx ng test --no-watch` | Two commands | ADR-000 TAC-01 aligned to `npx ng test --no-watch` |
| C13 | How `.env` reaches Maven and npm; `Read(.env)` denied; override needed for invalid-key QA | Unspecified mechanism | `app/scripts/with-env.sh` (T04), sets only unset variables; `.env` in the main checkout root (H3) |
| C14 | `*.db` ignored but not `data/uploads/` | Photos could be committed | T00 ignores `data/` |
| C15 | `rm`, `chmod` denied | Cleanup, `mvnw` exec bit | `git rm`; `sh mvnw` |
| C16 | `pom.xml` security hook | Slow edits | Orchestrator-only, batched (T02 incl. surefire `live` exclusion, T30) |
| C17 | TDD vs generated scaffolds | No prior failing test | Scaffolds verified by generated test + build |
| C18 | OpenCode without permission config | Headless runs hang | T00 read-only `opencode.json`; P5 |
| C19 | Capture plan covered only 3 happy paths; rev. 2 then allowed documentation-based "synthetic" stubs for 429/5xx/mid-stream errors (D-4) | Mocks based on documentation, forbidden by AGENTS.md | ADR-002 D6 capture list + derivation rule; non-capturable failures derived from real captures; D-4 removed |
| C32 | Frontend unit tests mocked our backend API with data written from the ADR-001 contract | Endpoint mocks not based on real calls (AGENTS.md) | T19 records real backend responses into `FE/src/testing/captures/`; T21–T23 depend on T19 and use only those (ADR-000 §10, ADR-004 D2, §9) |
| C20 | Capturing via SDK cannot keep raw SSE/headers | AGENTS.md requires verbatim captures | WireMock record/proxy mode (ADR-002 D6) |
| C21 | Spring Boot 4 = Jackson 3, openai-java = Jackson 2 | "One Jackson line" check would fail | Both lines expected; Jackson 2 ≥ 2.13.4 (ADR-002 §3.1, T02) |
| C22 | Guard fired only on ACCEPT | AC-18/20/21 justification not guaranteed for REJECT/NEEDS_REVIEW | ADR-002 §3.4: rule point ensured in every category |
| C23 | `changed` vs `categoryChanged`; no contradictions in chat; guard reverting a change | Ambiguous chat logic | ADR-002 §3.3 single name, `contradictions` added, normalization rule |
| C24 | Step signatures differed between ADR-001 §5 and ADR-002 §5 | T13/T16 interface mismatch | ADR-002 §5 single source; ADR-001 refers to it |
| C25 | Unlisted commands prompt during an unattended run | `/goal` stalls | H6 allowlist (human) |
| C26 | Ownership gaps: surefire config, error mappings, listeners, validator/context folders, FE lockfile, screenshots ignore | Workers would edit others' files | Rows T02, T12, T14, T15, T16, T20, T00 amended |
| C27 | Untested PRD behaviors: Firefox/Edge, physical-store rule, §11.2 rules, AC-31 on the real stack, blur validation, Enter/Shift+Enter, agent output language | Gaps | ADR-004 §9 rows, TAC-004-07, §8.2 items 6, 7, 10–12 |
| C28 | AC-28 E2E was conditional | Could pass without testing AC-28 | Physical-store scenario must produce a change (ADR-004 §9) |
| C29 | Source of the Polish `photo_unusable.message` | Unspecified | Fixed backend map (ADR-001 §4), owned by T15 |
| C30 | Attribution header `X-Title` vs `X-OpenRouter-Title` | Unverified | Confirmed in T05 (ADR-002 §3.1) |
| C31 | `assets/example-images/README.md` says an **employee** uploads photos; PRD (human decision) says **end customer** | Different user role | PRD stays authoritative (end customer); the README's usage rules for photos still apply. Human may adjust the README wording |

No missing architecture requires a new ADR; the review findings were resolved as amendments in ADR-000/001/002/004 and the PRD (same docs PR).

---

## 11. Unresolved decisions (answer at plan review)

| ID | Question | Proposed default |
|---|---|---|
| D-1 | Physical-store purchases in the return policy: goodwill return allowed? | No goodwill returns (rule `Z-6.1`); the agent sets REJECT, or NEEDS_REVIEW when the channel is unclear |
| D-3 | AC-30 timeout per step or per user action | Per step (already applied to PRD AC-30 and ADR-002 §3.1); reverse at review if a total budget is wanted |

---

## 12. Review gate, failure handling and fallback

**Review gate (now):** the human reviews this plan + PRD + ADRs in the docs PR and answers §11. Approval = merge of the docs PR (or explicit written approval). Only then: branch `feat/hardware-copilot-poc` in the main checkout, H1–H3/H6, T00, T01 (issues), briefs, workers.

**Failure / rollback:**
- Each row is one commit → revert a bad row with `git revert <sha>` (no history rewriting; `reset --hard` denied).
- T05 gate failure → stop, amend ADR-002 (e.g. raw OkHttp SSE for the reply step), get human OK, continue.
- OpenRouter outage or exhausted credit → continue unit/integration work on captures; mark T19/T35/T37 `Blocked (OpenRouter)`; never replace E2E with mocks.
- `data/` is disposable (reset by the human or a test helper).

**Smaller fallback (ordered cuts):**
1. Drop T30 (bundled JAR).
2. Drop T36 OpenCode audit — orchestrator maps ACs manually.
3. Reduce T35 to Chromium only and to: return flow, late return, reload, physical-store revision.
4. Minimum slice: form → assessment → streamed chat **without** assessment revision (AC-28 deferred, documented in the PR).
If subagents are unavailable, the orchestrator executes the matrix sequentially; if OpenCode free models are unavailable, T36 moves to a Haiku subagent.

**First bounded task after approval:** T00 — repo hygiene (`.gitignore`, `.env.example`, read-only `opencode.json`, `AGENTS.md` pointer to example images), orchestrator-owned, verified with `git check-ignore` and one read-only OpenCode run; in parallel the human completes H1–H3 and H6.
