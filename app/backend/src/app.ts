import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { systemClock, type Clock } from './config/clock.ts';
import type { AppConfig } from './config/config.ts';
import { registerErrorHandling } from './config/errors.ts';
import { registerCaseRoutes, type CaseRoutesDeps } from './cases/case-routes.ts';

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type AppOptions = {
  config: AppConfig;
  clock?: Clock;
  logger?: boolean;
  /** Upload size limit; defaults to 10 MB (PRD AC-08). Overridable only so tests can use small real photos. */
  maxPhotoBytes?: number;
  /** Bundled mode: absolute path of the built Angular app (dist/frontend/browser). Unset in dev. */
  frontendDir?: string;
  /** Case endpoints (ADR-001); omitted in tests that only need health/static. */
  cases?: CaseRoutesDeps;
};

/** Builds the Fastify application (no CORS: the SPA is same-origin via the dev proxy or bundled mode). */
export async function buildApp(options: AppOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? false });

  await app.register(multipart, {
    limits: { fileSize: options.maxPhotoBytes ?? MAX_PHOTO_BYTES, files: 1, fields: 10 },
    throwFileSizeLimit: true,
  });
  if (options.frontendDir) {
    await app.register(fastifyStatic, { root: options.frontendDir, index: ['index.html'] });
  }
  registerErrorHandling(app, { spaFallback: Boolean(options.frontendDir) });

  app.decorate('clock', options.clock ?? systemClock);
  app.get('/api/health', async () => ({ status: 'UP' }));

  if (options.cases) await registerCaseRoutes(app, options.cases);

  return app;
}
