import { defineConfig } from 'vitest/config';

// Unit + integration tests. Never touches the network: live OpenRouter tests
// (*.live.test.ts) run only through vitest.live.config.ts (ADR-005 TAC-005-01).
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/**/*.live.test.ts', 'node_modules/**'],
    environment: 'node',
  },
});
