import { defineConfig } from 'vitest/config';

// Live tests against the real OpenRouter (capture spike, ADR-002 D6 / ADR-005).
// Run with: bash ../scripts/with-env.sh npm run test:live
export default defineConfig({
  test: {
    include: ['test/**/*.live.test.ts'],
    environment: 'node',
    testTimeout: 180_000,
    fileParallelism: false,
  },
});
