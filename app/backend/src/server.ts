import { buildApp } from './app.ts';

const port = Number(process.env['SERVER_PORT'] ?? 8080);
const app = await buildApp();
await app.listen({ port, host: '127.0.0.1' });
console.log(`copilot-backend listening on http://127.0.0.1:${port}`);
