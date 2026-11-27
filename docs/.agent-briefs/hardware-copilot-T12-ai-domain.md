# Brief T12 — AI domain (pure TypeScript, no network)

Plan row T12 + plan §0 (Rev. 3). Worker: Claude Sonnet subagent. Checkout: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/prd-hardware-copilot`, branch `feat/hardware-copilot-poc`. Backend = Node 24 + TypeScript (**read `docs/ADR/005-backend-runtime-node.md` first**, then `app/backend/AGENTS.md`).

## Goal
Deterministic AI-domain code from ADR-002 §3.3–§3.7, §4, §5 (signatures), D2, D3, translated to TypeScript:
- domain types + **Zod schemas** for `ImageAnalysis`, `AssessmentProposal`, `ChatEvaluation` exactly per ADR-002 §3.3 (these schemas will feed `zodResponseFormat` in T13 — keep them JSON-schema friendly: no transforms, all fields required, nullable via `.nullable()`),
- `promptRepository` (loads `app/backend/resources/prompts/*.md` and `resources/policies/*.pl.md`; selects by case type),
- `policyLimits` (parses `Z-2.1` 14 dni and `R-2.1` 2 lata from the policy text — fail at load if missing),
- `policyGuard` G1–G6 (ADR-002 §3.4) incl. "rule point ensured in every category" and "change normalized after guard",
- `outputValidator` (ADR-002 §3.3/D5: what counts as invalid output → one repair call later in T13),
- `firstMessageComposer` (ADR-002 §3.5, AC-23: exact Polish sections, order, mandatory notice — Polish texts from PRD §4.1/§4.6/§11.2),
- `contextBuilder` (ADR-002 §3.6: case context JSON + history for chat steps).
PRD AC-15…AC-23, AC-28. All ADR-002 §8 **unit** rows.

## Editable files (only)
`app/backend/src/ai/{domain,guard,prompt,validate,context,compose}/**`, `app/backend/test/ai/**` except `test/ai/steps/**`. Concurrent: T11 writes `src/imaging/**`; orchestrator writes `src/config/**`, `src/persistence/**`, `src/app.ts`, `package.json`. Do not commit or `git add`. Do not edit prompts/policies (report needed changes instead).

## Rules
- Today's date must be injectable (no hidden `new Date()` in guard logic) — G1/G3 tests pin dates (e.g. exactly 14 days keeps ACCEPT; 15 days → never ACCEPT).
- Never describe photo content in code or test data; `ImageAnalysis` test fixtures are field values per schema, not claims about the example photos.
- Node runs `.ts` natively: no enums/parameter properties/namespaces; `import type`; relative imports end in `.ts`. Prefer string-literal unions + `as const` arrays.
- TDD: red first (report the failure output), minimum code, refactor. Commands from `app/backend`: `npm test`, `npm run typecheck` (0 errors).
- Research: Context7 quota exhausted → read `node_modules/zod/**/*.d.ts`; vendor docs (zod.dev) last.

## Return
Files, red output, green counts per file, typecheck result, `git status --short`, every ADR-002/PRD contradiction or ambiguity you had to resolve (and how).
