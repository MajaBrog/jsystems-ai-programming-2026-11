import { resolve } from 'node:path';
import { createLlmClient } from './ai/client/llm-client.ts';
import { loadPromptRepository } from './ai/prompt/promptRepository.ts';
import { createAiSteps } from './ai/steps/index.ts';
import { buildApp } from './app.ts';
import { createCaseLocks } from './cases/case-locks.ts';
import { systemClock } from './config/clock.ts';
import { loadConfig } from './config/config.ts';
import { runStartupChecks } from './config/startup-checks.ts';
import { createPhotoStore } from './imaging/photo-store.ts';
import { openDatabase } from './persistence/database.ts';

try {
  const config = loadConfig(process.env);
  await runStartupChecks({ dataDir: config.dataDir });
  const prompts = loadPromptRepository();
  const frontendDir = process.env['FRONTEND_DIR']?.trim();
  const app = await buildApp({
    config,
    logger: true,
    clock: systemClock,
    ...(frontendDir ? { frontendDir: resolve(frontendDir) } : {}),
    cases: {
      db: openDatabase(config.dataDir),
      photoStore: createPhotoStore(config.dataDir),
      steps: createAiSteps({ client: createLlmClient(config), config, prompts }),
      clock: systemClock,
      locks: createCaseLocks(),
      models: { vision: config.llmVisionModel, decision: config.llmModel },
    },
  });
  await app.listen({ port: config.serverPort, host: '127.0.0.1' });
  console.log(`copilot-backend listening on http://127.0.0.1:${config.serverPort}`);
} catch (error) {
  // Messages never contain the API key (ConfigError names variables only).
  console.error(`copilot-backend failed to start: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
