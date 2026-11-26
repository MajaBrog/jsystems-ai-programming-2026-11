---
name: write-implementation-plan
description: Use when the user wants an implementation plan for an application or feature from an approved PRD and ADRs — a reviewable plan with one dependency matrix, worker/model assignment (subagents, OpenCode headless), briefs, verification, Definition of Done and a review gate before any execution. Not for writing the PRD/ADR themselves and not for executing the plan.
---

# Write an implementation plan (PRD + ADR → reviewable plan)

Produce **one** plan document that lets a capable orchestrator implement the whole scope autonomously (e.g. with `/goal`), and **stop for human review**. Planning never authorizes execution, new agents, issue creation, push, publication or merge.

Default scope: **the whole application defined by the PRD and ADRs**, split into internal phases with checkpoints. Plan only a part when the user asks for it.

---

## Step 1 — Locate the real sources
1. Find the PRD, ADRs, design guidance and every instruction level that applies:
   organization/admin instructions (system context) → user level (`~/.claude/CLAUDE.md`, `~/.claude/rules/*`, `~/.codex/AGENTS.md`, `~/.config/opencode/AGENTS.md`) → project root (`AGENTS.md`, `CLAUDE.md`) → module/folder `AGENTS.md`. Note which levels exist and **which worker reads which** (user-level Claude rules do not reach OpenCode or Codex workers).
2. Ask for paths only if a source is missing or ambiguous. Teaching or example folders (e.g. `course-materials/`) are not requirements.

## Step 2 — Inspect the environment before planning (record evidence)
Run and record each check; a plan built on unverified tools fails at task one.
- Git: current branch, worktree or main checkout, clean/dirty, remotes, **is the intended base branch pushed or ahead of its remote**, default branch.
- Code: existing app code, build descriptors, wrappers, tests, entry points. Run the existing build/test once and record **baseline failures**. Never replace an existing scaffold.
- Existing test data and assets: search the repository (outside teaching folders) for fixture folders, sample files and their READMEs (e.g. `assets/**`, `fixtures/**`, `testdata/**`) and **follow their usage rules** before proposing new fixtures. Check real file types (`file <path>`), not extensions.
- Toolchain: versions of every runtime/build tool the ADRs need (`java`, `mvn`, `node`, `npm`, `pnpm`, `python`, `docker`…). Missing tools become **human prerequisites**.
- Permissions: harness settings (e.g. `.claude/settings.json` allow/deny/ask, hooks). List denied commands the ADRs rely on (`curl`, `sudo`, `rm`, `chmod`, `git push`, reading `.env`) and plan the human step or the allowed alternative (e.g. Node `fetch` probe instead of `curl`, `git rm` instead of `rm`, `git revert` instead of `reset --hard`). Also list commands the run needs that are **not allowed** (they prompt): for an unattended run, propose a narrow allowlist as a human prerequisite — the agent never edits permission settings itself.
- Secrets: which `.env` file the run uses (worktrees do not share ignored files), how it reaches every process (build tool, dev server, tests) without the agent reading it, and how a test can override one variable (e.g. an invalid key for error QA).
- Execution checkout: plan execution in the checkout the repository policy prefers (usually the main checkout, visible in the user's editor); use a worktree only for parallel same-file edits.
- `.gitignore` vs planned paths: brief folder, log folder, runtime data, uploads, build outputs.
- Tracking: `gh auth status`, `gh repo view --json hasIssuesEnabled,viewerPermission`.
- Agents actually available: the subagent tool and its model overrides; `opencode --version`, `opencode models` (free models change), connected providers, OpenCode permission config; MCP servers (Context7, browser tools); browser/QA CLI required by AGENTS.md.

## Step 3 — Ask only consequential questions
Batch ≤ 4 per round; offer a recommended option first. Typical gaps:
- Scope: whole application (default) or phases delivered separately.
- Briefs committed vs private (resolve any `.gitignore` conflict).
- GitHub Issues: enable/create after approval, or plan Status column only.
- Push/PR policy and **PR base branch** (stacked branches!), per phase vs one PR at the end.
- Which worker providers/models may be used (paid vs free OpenCode models).
- Domain decisions the PRD leaves open that block a task (record unanswered ones as "Unresolved decisions" with a proposed default — never invent them silently).
Missing **architecture** goes into a proposed ADR amendment, not into a plan assumption.

## Step 4 — Write the plan
Save as `docs/plans/<plan-name>-implementation-plan.md`, marked **DRAFT — awaiting human review**. Link PRD criteria, ADR sections and design guidance by ID/anchor; do not copy them. Required sections:
1. **Header**: scope, sources of truth (links), orchestrator model, date.
2. **Current state**: what exists, verified commands with results, baseline failures, environment gaps.
3. **Decisions taken** (from Step 3) and **human prerequisites** (install, credentials, generator commands the agent may not run, fixture approvals) with what each unblocks.
4. **Workers and models**: table of worker → model → use for → not for, with *why*; escalation rule; ad hoc subagents by default (custom role files only for a recurring role with reusable tool restrictions); fallback to sequential single-agent execution if the harness lacks subagents.
5. **OpenCode headless note** (when used): command, model flag, how the brief is passed, permissions, log location — see template below.
6. **Research rules for every worker**: Context7 (`resolve-library-id` → `query-docs`, matched to the lockfile version) and the tool's `--help` before any web search; web search last, vendor docs first; broad research delegated to subagents or CLI agents. Spell this out in briefs for non-Claude workers.
7. **Phases** (internal checkpoints) with exit checks and the commit boundary (one row = one focused commit by the orchestrator).
8. **One authoritative dependency matrix**:

   | Task | Observable outcome | PRD/ADR links | Prerequisites | Owner/model | Editable files | Verification and handoff | Status |
   |---|---|---|---|---|---|---|---|

   Every row: bounded deliverable, exact editable files (disjoint from concurrent rows), Red→Green evidence, reproduction commands, commit message, Status. Include rows for: repo hygiene, issue creation (after approval), scaffolds, **real-call capture spike**, each component, integration checkpoints with the real external services, bundling/packaging if in scope, E2E on the real stack, traceability audit, Manual QA, independent review, final PR, cleanup.
9. **Parallel waves**, **critical path**, **shared-file hotspots** (build descriptors, lockfiles, app config, routes, migrations/schema, shared contracts, root ignore/env files — one owner each), and a **Mermaid dependency graph** of the tasks.
10. **Verification**: per-task protocol; Manual QA checklist on the real app mapped to PRD criteria; mocks policy (below); AC/TAC traceability requirement.
11. **Definition of Done** for the whole plan (build, tests with counts, startup recorded separately, E2E twice on the real stack, Manual QA with screenshots and brand comparison, traceability complete, reviews resolved, PR opened, human merge, cleanup).
12. **Contradictions and ambiguities** table (where, issue, resolution/action) — see Step 5.
13. **Unresolved decisions** with proposed defaults, **review gate**, **brief protocol**, **failure/rollback**, **smaller fallback** (ordered cuts), **first bounded task**.

## Step 5 — Cross-check before saving
Compare plan × PRD × ADRs × all AGENTS.md levels × environment. Prefer an **independent subagent review** given only the file paths (not your conclusions), then merge its findings. Look for at least:
- The same user-facing string in two languages or two wordings (pick the authoritative one, propose a PRD fix).
- Limits that can be read two ways (per call vs per user action, inclusive vs exclusive boundaries).
- Commands, env var names, paths, event names, enum values or versions that differ between documents.
- Requirements with no task/test; tasks with no requirement; overlapping editable files in one wave.
- Required commands that the harness denies or tools that are not installed.
- Ignore rules hiding planned files; runtime data that could be committed.
- Stubs that would have to be invented because no real capture is planned; capture methods that lose raw bytes/headers (an SDK returns parsed objects — record through a recording proxy instead).
- Field names, event names and method signatures defined in more than one ADR (make one ADR the single source and reference it).
- Version-line conflicts after major framework upgrades (e.g. two major lines of a serialization library on the classpath) that would make a planned check fail.
- Deterministic guards that enforce a category but not the required explanation; post-guard normalization (a "change" reverted by the guard is no change).
- Timeout budgets that ignore retries/repair calls or cut healthy streams (use inactivity timeouts for streams).
- Ownership gaps: build config needed by a worker's tests, shared error handlers, callback interfaces, lockfiles, ignore entries for new output folders.
- Conditional tests that can pass without exercising the requirement ("if X happens, assert Y") — make the scenario force X or fail.
- Every command and path in the plan: run it or check the file exists; mark anything unverified.
- Test inputs that break the rules of existing fixture READMEs (generated/blank images, renamed files, tests that assume what a model will see — assert structure and deterministic outcomes instead).
- Whether the documents state the problem, users, **scale** (PoC/internal/enterprise, expected volume), **company/sector specifics** (regulation, personal data) and include diagrams (UML/flow/sequence/ER in Mermaid). Propose additions where missing.

## Step 6 — Testing rules (non-negotiable)
- **E2E and manual tests use the real application**: every endpoint, LLM/decision-model call and decision path runs for real — no mocks, no request interception, no fake servers.
- **Unit tests** mock all dependencies. **Integration tests** mock only external endpoints/APIs, and every mock is **derived from a real recorded call** (status, headers without secrets, body or stream, date, target, request summary). Plan a capture task before any mock: include happy paths **and** real negative cases that can be provoked safely (invalid input, invalid credentials, unusable input, unknown model). Variants may only change field values or timing of a real capture and must say so in the stub header. If a case cannot be captured safely, record it as a known gap instead of inventing a shape.
- TDD: failing behavioral test first, minimum code, refactor while green; generated scaffolds are verified by their own tests/build.
- A green build is not proof of startup or of the user flow.

## Step 7 — Save, commit, stop
1. Save the draft; check links and IDs (every PRD criterion referenced, every task ID in the graph exists).
2. Commit locally only if the repository policy allows (`Docs: …`, named paths). If the user wants the plan in a PR, check the base branch is pushed; if push is denied, hand the user the exact commands and a ready PR body — never work around a denial.
3. Tell the user the **absolute path and branch** of the plan (worktrees are invisible in an editor opened on the main checkout).
4. Finish with: plan link, unresolved decisions, human prerequisites, first bounded task, review gate. Then stop.

---

## After approval (include these rules in the plan)
- Enable/create GitHub Issues if agreed: one issue per row; use `T<nn> (#<issue>)` in the plan and in the agent task list. Status lives in the plan's Status column.
- Just before dispatch, write a self-contained brief `docs/.agent-briefs/<plan-name>-<task-id>-<slug>.md`: goal, pasted excerpts of the linked PRD/ADR sections, current contracts, predecessor outputs, exact editable files, concurrent tasks and their folders, ordered Red→Green steps, test inputs and expected results, commands, research rules, what to return (diff, outputs, contradictions). Workers cannot change scope or accept their own work.
- Only the orchestrator switches branches, stages and commits; workers return diffs. Commit briefs and the plan during the work; keep worker logs out of Git (e.g. `.agent-logs/`).
- One checkout by default with disjoint files; a worktree only when agents must edit the same files in parallel (follow the repository's approval policy, remove it afterwards).
- After the Definition of Done (merge or deploy): delete the plan and briefs (`git rm`), remove temporary worktrees. Git history keeps them.

## OpenCode headless template
```bash
opencode run -m <provider/model> -f docs/.agent-briefs/<plan-name>-<brief>.md \
  "Do the task described in the attached brief." </dev/null 2>&1 | tee .agent-logs/<plan-name>-<brief>.log
```
- Model: verify the id in `opencode models` right before dispatch (free `opencode/*` models work after install; `openrouter/*` needs `/connect`).
- Permissions: a headless run cannot answer prompts — grant exactly what the task needs in the project `opencode.json` (read-only tasks: deny edit and bash). Avoid `--auto` outside a trusted sandbox.
- `--format json` for machine-readable output; `-c` / `-s <id>` to continue a session.
- OpenCode does not read Claude user-level rules: put the research rules and constraints in the brief.
