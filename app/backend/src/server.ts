import { buildApp } from './app.ts';
import { ConfigError, loadConfig } from './config/config.ts';
import { runStartupChecks } from './config/startup-checks.ts';

try {
  const config = loadConfig(process.env);
  await runStartupChecks({ dataDir: config.dataDir });
  const app = await buildApp({ config, logger: true });
  await app.listen({ port: config.serverPort, host: '127.0.0.1' });
  console.log(`copilot-backend listening on http://127.0.0.1:${config.serverPort}`);
} catch (error) {
  const message = error instanceof ConfigError || error instanceof Error ? error.message : String(error);
  console.error(`copilot-backend failed to start: ${message}`);
  process.exit(1);
}
