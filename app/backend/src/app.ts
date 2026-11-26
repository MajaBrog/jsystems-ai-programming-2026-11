import Fastify, { type FastifyInstance } from 'fastify';

/** Builds the Fastify application. Routes are registered here; config and wiring grow in T14. */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  app.get('/api/health', async () => ({ status: 'UP' }));

  return app;
}
