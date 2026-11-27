# Brief T03 — Frontend scaffold (Angular 22.3)

Plan: `docs/plans/hardware-copilot-implementation-plan.md` row T03. Worker: Claude Sonnet subagent.
Checkout: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/prd-hardware-copilot` (branch `feat/hardware-copilot-poc`). Run every command from there or below it.

## Goal
Generated Angular 22.3 workspace in `app/frontend` with Angular Material 22.3, ngx-markdown 22.1.1 (+ `marked` in its peer range), `@angular/material-date-fns-adapter@22.3.0` + `date-fns`, and `proxy.conf.json` (`/api` → `http://localhost:8080`, `secure: false`) wired into the `serve` target. Default `npx ng test --no-watch` and `npx ng build` green.

## Source: ADR-004 §6.1 (follow literally)
1. `npx @angular/cli@22.3.0 new --help` first; adapt flags only if help shows they changed.
2. `npx @angular/cli@22.3.0 new frontend --directory app/frontend --style=scss --routing --ssr=false --skip-git --defaults` (from the checkout root).
3. In `app/frontend`: `npx ng add @angular/material@22.3.0` (non-interactive: use `--defaults`/`--skip-confirmation` or the schematic options shown by help; theme "Custom"/any — T20 replaces the theme later; global typography on).
4. `npm install ngx-markdown@22.1.1 marked@<version satisfying ngx-markdown's peer range: check `npm view ngx-markdown@22.1.1 peerDependencies`> @angular/material-date-fns-adapter@22.3.0 date-fns`.
5. `proxy.conf.json` + `proxyConfig` in `angular.json` serve target.
6. Verify: `npx ng test --no-watch` and `npx ng build` (from `app/frontend`).

## Editable files
`app/frontend/**` only. Do not touch anything else (concurrent task T06 writes `app/backend/src/main/resources/{policies,prompts}/**`; orchestrator owns root files). Do NOT commit — the orchestrator commits. Do not run `git add`.

## Rules
- Package manager: npm. Shell: bash. `rm`, `curl`, `chmod`, `sudo` are denied — don't try alternatives.
- CLI syntax: tool `--help` first. Library APIs: Context7 is out of quota today; use `npm view` and CLI help; web search last (vendor docs).
- No feature code, no theme customization (T20 owns that).
- If `ng new` creates a nested `.git` or `.vscode`/AI config files, report them.

## Return
- Exact commands run and their final output lines (test counts, build result, warnings).
- The generated `test` script in `app/frontend/package.json` and installed versions (`npm ls @angular/core @angular/material ngx-markdown marked date-fns @angular/material-date-fns-adapter`).
- `git status --short` limited to `app/frontend`.
- Any contradiction with ADR-004 §6.1.
