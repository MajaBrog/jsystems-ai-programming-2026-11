# Brief T11 — Imaging (validate, compress, store photos)

Plan row T11 + plan §0 (Rev. 3). Worker: Claude Sonnet subagent. Checkout: `/home/labuser/jsystems-ai-programming-2026-11/.claude/worktrees/prd-hardware-copilot`, branch `feat/hardware-copilot-poc`. Backend = Node 24 + TypeScript + Fastify (**read `docs/ADR/005-backend-runtime-node.md` first**, then `app/backend/AGENTS.md`).

## Goal
Modules `imageValidator`, `imageCompressor`, `photoStore` in `app/backend/src/imaging/` per ADR-001 §3 (ImageValidator / ImageCompressor / PhotoStore rows), D2, D3, TAC-001-04 and ADR-003 §5 (storage layout), translated to `sharp` per ADR-005 §2. PRD AC-07 (accepted types JPEG/PNG/WEBP by **content**, not extension), AC-08 (≤ 10 MB), AC-11 (compressed before the model: JPEG, long edge ≤ 1568 px, quality 80 (ADR-001 D2 says 0.8), EXIF rotate, alpha flattened on white).

## Editable files (only)
`app/backend/src/imaging/**`, `app/backend/test/imaging/**`. Concurrent: T12 writes `app/backend/src/ai/**` + `test/ai/**`; orchestrator writes `src/config/**`, `src/persistence/**`, `src/app.ts`, `package.json`. Do not touch those. Do not commit or `git add`.

## Inputs (read-only)
Only real photos from `assets/example-images/` (read its README — rules: never rename/modify, no generated images). `laptop-1.png` is JPEG content (3024×3135) → must be accepted as JPEG and come out with long edge 1568; `laptop-2.webp` decoded; small JPEGs (387×516) not enlarged. Non-image rejection tests use non-image bytes (e.g. a UTF-8 text buffer, a minimal `%PDF-1.4` buffer) — never generated pictures. Unsupported real image types: none in assets; do not fabricate one — test the "unsupported" path with non-image bytes and note that GIF/HEIC are not covered by real fixtures.

## API (suggested; keep pure functions where possible)
- `validateImage(buf: Buffer): Promise<{ ok: true; format: 'jpeg'|'png'|'webp' } | { ok: false; reason: 'UNSUPPORTED_TYPE'|'FILE_TOO_LARGE'|'EMPTY' }>` — size limit from a parameter (default 10 MB).
- `compressForModel(buf): Promise<{ jpeg: Buffer; width; height }>`.
- `createPhotoStore(dataDir)` → `{ save(caseId, jpeg): Promise<string /*relative path*/>; read(relativePath): Promise<Buffer>; }` — path layout per ADR-003 §5; reject path traversal (relative path must stay under `uploads/`).
Adjust names if ADR-001/003 dictate otherwise and report.

## TDD
Red first (`npm test` from `app/backend` → failure for the expected reason, report it), then minimum code, then refactor. Use a temp dir (`fs.mkdtemp(os.tmpdir())`) for store tests. Commands: `npm test`, `npm run typecheck` (0 errors). Node runs `.ts` natively: no enums/parameter properties; relative imports end in `.ts`.

## Research rules
CLI: `--help`. Library API: Context7 quota exhausted today → read `node_modules/sharp/lib/index.d.ts`; vendor docs (sharp.pixelplumbing.com) last.

## Return
Files, red output, green counts, typecheck result, `git status --short`, contradictions found.
