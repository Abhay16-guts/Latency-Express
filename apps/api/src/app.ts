import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import crypto from 'crypto';
import { config } from './config/env.js';
import { pool } from './db/connection.js';
import { redis, checkRedisHealth } from './redis/client.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { trainsRoutes } from './modules/trains/trains.routes.js';
import { bookingsRoutes } from './modules/bookings/bookings.routes.js';
import { queueRoutes } from './modules/queue/queue.routes.js';
import { metricsRoutes, recordRollingMetric, httpRequestCounter, httpRequestDuration } from './modules/metrics/metrics.routes.js';
import { queueManager } from './concurrency/queue.js';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
      transport: config.NODE_ENV === 'development' ? { target: 'pino-pretty' } : undefined,
    },
    genReqId: () => `req-${crypto.randomUUID()}`,
  });

  // Security headers & CORS
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: true, // Allow frontend dev server and clients
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'x-request-id'],
    credentials: true,
  });

  // JWT Plugin
  await app.register(jwt, {
    secret: config.JWT_SECRET,
  });

  app.decorate('authenticate', async function (request: FastifyRequest, reply: FastifyReply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required or token expired.' },
      });
    }
  });

  // Metrics & Request Hooks
  app.addHook('onRequest', async (request) => {
    (request as any).startTime = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    const startTime = (request as any).startTime || Date.now();
    const durationMs = Date.now() - startTime;
    const route = request.routeOptions.url || request.url;
    
    httpRequestCounter.inc({ method: request.method, route, status_code: reply.statusCode.toString() });
    httpRequestDuration.observe({ method: request.method, route, status_code: reply.statusCode.toString() }, durationMs / 1000);
    recordRollingMetric(durationMs, reply.statusCode);
  });

  // Health Checks
  app.get('/health', async () => ({ status: 'ok', service: 'latency-express-api' }));
  app.get('/health/live', async () => ({ status: 'alive', uptime: process.uptime() }));
  app.get('/health/ready', async (request, reply) => {
    const redisOk = checkRedisHealth();
    let pgOk = false;
    try {
      await pool.query('SELECT 1');
      pgOk = true;
    } catch {
      pgOk = false;
    }

    const ready = redisOk && pgOk;
    const statusCode = ready ? 200 : 503;
    return reply.status(statusCode).send({
      status: ready ? 'ready' : 'degraded',
      postgres: pgOk ? 'connected' : 'disconnected',
      redis: redisOk ? 'connected' : 'disconnected',
    });
  });

  // Mount API modules
  await app.register(authRoutes, { prefix: '/api/v1/auth' });
  await app.register(trainsRoutes, { prefix: '/api/v1/trains' });
  await app.register(bookingsRoutes, { prefix: '/api/v1/bookings' });
  await app.register(queueRoutes, { prefix: '/api/v1/queue' });
  await app.register(metricsRoutes, { prefix: '/api/v1' });
  await app.register(metricsRoutes, { prefix: '' }); // enables standard /metrics

  // Global Centralized Error Handler
  app.setErrorHandler((error: any, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    return reply.status(statusCode).send({
      success: false,
      error: {
        code: error.code || 'INTERNAL_SERVER_ERROR',
        message: error.message || 'An unexpected internal error occurred.',
        requestId: request.id,
      },
    });
  });

  // Start background queue drain loop
  setInterval(async () => {
    try {
      const qLen = await queueManager.getQueueLength();
      if (qLen > 0) {
        await queueManager.processQueueBatch(10);
      }
    } catch (e) {
      // Quiet background log
    }
  }, 500);

  return app;
}
