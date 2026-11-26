# app/ — Hardware Service Decision Copilot

Two independent builds talking only over HTTP (`/api`, contract in `docs/ADR/001-backend-api.md`):
`backend/` (Spring Boot 4.2, Java 21, Maven wrapper) and `frontend/` (Angular 22.3, npm). Scoped rules live in their own `AGENTS.md`.

## Commands (run from `app/`)
- `npm run dev` — backend (`:8080`) and frontend (`:4200`, proxies `/api`) together; data in `<repo>/data/` (gitignored).
- `npm run dev:frontend` / `npm run dev:backend` — one side only.
- `bash scripts/with-env.sh <cmd>` — run with the checkout-root `.env` (falls back to the main worktree's `.env`); already-set variables win. `bash scripts/with-env.sh env-check` lists which variables are set, never values. Never read `.env` directly.

## Rules
- Tests and Manual QA photos: only `assets/example-images/` (see its README). Never tell the model what a photo shows.
- Mocks of an endpoint (OpenRouter or our API) are derived from real recorded responses only (`backend/src/test/resources/openrouter-captures/`, `frontend/src/testing/captures/`).
- E2E (`e2e/`) runs on the real stack with the real model: no `page.route`, no interception.
