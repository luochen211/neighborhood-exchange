import Fastify, { type FastifyServerOptions } from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { access } from 'node:fs/promises';
import { ApiError, installErrorHandlers } from './plugins/errors.js';
import { authRoutes } from './auth/index.js';
import { itemsRoutes } from './modules/items/index.js';
import { commentsRoutes } from './modules/comments/index.js';
import { interestsRoutes } from './modules/interests/index.js';
import { tradesRoutes } from './modules/trades/index.js';
import { dashboardRoutes } from './modules/dashboard/index.js';
import { aiRoutes } from './modules/ai/index.js';

export interface AppOptions {
  logger?: FastifyServerOptions['logger'];
  serveWeb?: boolean;
  webRoot?: string;
}

/** No listener, database mutation or external API calls during construction. */
export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false, bodyLimit: 32 * 1024 });
  installErrorHandlers(app);
  await app.register(cookie);
  await app.register(async (api) => {
    // Process liveness only. Database-backed /health is owned by Issue #4.
    api.get('/status', async () => ({ data: { status: 'ok' } }));
    await api.register(authRoutes);
    await api.register(itemsRoutes);
    await api.register(commentsRoutes);
    await api.register(interestsRoutes);
    await api.register(tradesRoutes);
    await api.register(dashboardRoutes);
    await api.register(aiRoutes);
  }, { prefix: '/api/v1' });

  if (options.serveWeb) {
    const root = options.webRoot ?? fileURLToPath(new URL('../../web/dist/', import.meta.url));
    await access(join(root, 'index.html'));
    await app.register(fastifyStatic, { root, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      const isApi = pathname === '/api' || pathname.startsWith('/api/');
      const isPage = !pathname.split('/').at(-1)?.includes('.');
      if (!isApi && isPage && (request.method === 'GET' || request.method === 'HEAD') && request.headers.accept?.includes('text/html')) {
        return reply.type('text/html').sendFile('index.html', { maxAge: 0, cacheControl: false });
      }
      throw new ApiError(404, 'NOT_FOUND', '请求的内容不存在');
    });
  } else {
    app.setNotFoundHandler(() => { throw new ApiError(404, 'NOT_FOUND', '请求的内容不存在'); });
  }
  return app;
}
