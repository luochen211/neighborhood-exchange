import type { FastifyPluginAsync } from 'fastify';

// Issue #4 owns session routes and services; paths are relative to /api/v1.
export const authRoutes: FastifyPluginAsync = async () => {};
