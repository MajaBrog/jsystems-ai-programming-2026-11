# Brief T13 — OpenRouter AI steps (against real captures)

Plan row T13 + plan §0 (Rev. 3). Worker: Claude Sonnet subagent. Checkout: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/prd-hardware-copilot`, branch `feat/hardware-copilot-poc`.
**Read first:** `docs/ADR/005-backend-runtime-node.md` (incl. **§6 spike results**), `app/backend/AGENTS.md`, `docs/ADR/002-ai-llm-integration.md` §3.1–§3.7, §5, D1–D6, §8 integration rows, TAC-002-01/-05/-06.

## Existing code (do not modify unless listed)
- Contracts: `src/ai/steps/types.ts` (`AiSteps`, `LlmUnavailableError`, `LlmInvalidOutputError`). The `cases` layer relies on: every step accepts an `AbortSignal` and rejects when aborted; only these two error classes map to `LLM_UNAVAILABLE` / `LLM_INVALID_OUTPUT` (anything else → INTERNAL_ERROR); `chatReply.stream` calls `onToken` only with text that is part of its returned full text, and returns the complete reply; `analyse` receives an already compressed JPEG.
- Request builders + client: `src/ai/steps/requests.ts`, `src/ai/client/llm-client.ts` (already committed and tested; reuse, do not duplicate).
- Domain: `src/ai/validate/outputValidator.ts`, `src/ai/guard/policyGuard.ts` (`applyPolicyGuard`, `guardChatEvaluation`, `GuardInvalidOutputError`), `src/ai/prompt/promptRepository.ts` (`ruleIds`, `limits`).
- Test tooling: `test/support/replay-server.ts` (`startReplayServer`, `enqueue(capture, {delayMs, truncateAfterBytes, chunkDelayMs})`, `requests`), `test/support/capture-store.ts` (`loadCapture`), `test/support/test-config.ts`.
- **Real captures:** `test/captures/openrouter/*.{meta.json,body}` — vision-return-laptop-1, vision-complaint-phone-1, vision-return-phone-2-as-tv, decision-return, decision-complaint, chat-evaluate-neutral, chat-evaluate-physical-store, chat-reply-stream, error-401-invalid-key, error-unknown-model.

## Goal
`app/backend/src/ai/steps/` — `createAiSteps({ client, config, prompts, ruleIds/limits })` returning `AiSteps`:
- `imageAnalysis.analyse` / `decision.decide` / `chatEvaluate.evaluate`: send the built request (`client.chat.completions.create(req, { signal, timeout })`), parse `choices[0].message.content` as JSON, validate; on invalid output make **one repair call** (ADR-002 D5: same request + the invalid output + validator errors) and throw `LlmInvalidOutputError` if still invalid. `decide` applies `applyPolicyGuard` (today injected) and returns the guarded `Assessment` (`source: 'DECISION'`, `previousCategory: null`); `GuardInvalidOutputError` → treat as invalid output (repair once). `evaluate` applies `guardChatEvaluation`.
- `chatReply.stream`: `stream: true`; pass each `delta.content` to `onToken`; resolve with the concatenated text; inactivity timeout = `LLM_TIMEOUT_SECONDS` between chunks (and before the first) via `AbortController`; mid-stream error chunk / `finish_reason: "error"` / connection loss → `LlmUnavailableError`; external `signal` abort stops the upstream request.
- Map SDK errors (`APIError` subclasses, `APIConnectionError`, timeouts, aborts) → `LlmUnavailableError` (abort due to caller signal may rethrow anything — the caller is silent then).

## Tests — integration against the replay server only (`test/ai/steps/**`)
Each test names the capture it replays; **derived variants** follow ADR-002 D6 exactly and are documented in a comment in the test: (a) replay, (b) field-value change, (c) delay/truncation. Never write a response body from documentation. Required:
- happy path per step from the matching capture; request assertions on `replay.requests` (path `/api/v1/chat/completions` — TAC-002-01; vision body contains `data:image/jpeg;base64,` and the decoded JPEG long edge ≤ 1568 — TAC-001-04, use a real example photo compressed with `compressForModel`; correct policy per case type — AC-17).
- repair: first response = capture with a field value changed to invalid (e.g. `category` → `"MAYBE"`), second = original capture → success, exactly 2 requests; both invalid → `LlmInvalidOutputError`.
- guard applied on a real decision capture (e.g. purchase date beyond the limit → never ACCEPT).
- errors: real 401 capture → `LlmUnavailableError`; real 400 unknown-model capture → `LlmUnavailableError`; 429/5xx = the 401 capture with status + `code` value changed (D6); timeout = a capture replayed with `delayMs` > configured timeout (use `LLM_TIMEOUT_SECONDS=1`).
- streaming: tokens in order and full text equals concatenation; `chunkDelayMs` shows incremental delivery; truncation (`truncateAfterBytes` mid-stream) → `LlmUnavailableError`; last chunk `finish_reason` changed to `"error"` → `LlmUnavailableError`; inactivity (`chunkDelayMs` > timeout) → `LlmUnavailableError`; caller abort mid-stream stops the request.
- Keep-alive stall row: **dropped** (no keep-alive recorded, ADR-005 §6) — do not invent one.

## Editable files (only)
`app/backend/src/ai/steps/**` except `types.ts` and `requests.ts` (may add small exports to `requests.ts` only if needed for repair — report it), `app/backend/test/ai/steps/**` (keep the existing `requests.test.ts`, `llm-client.test.ts`). Do not commit or `git add`. No network: `npm test` must stay offline.

## Rules
TDD red first (report output). Node runs `.ts` natively (no enums/parameter properties; `import type`; `.ts` import suffixes). SDK API: read `node_modules/openai/**/*.d.ts` (Context7 out of quota). Commands from `app/backend`: `npm test`, `npm run typecheck` (0 errors).

## Return
Files, red output, green counts, typecheck, `git status --short`, list of tests with their source capture and derivation, contradictions found.
