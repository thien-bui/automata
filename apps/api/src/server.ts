import { randomUUID } from 'node:crypto';

import Fastify, { FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

import { redisPlugin } from './plugins/redis';
import { registerRouteTime } from './routes/routeTime';
import { buildRateLimitError } from './utils/errors';

export interface BuildServerOptions {
  redisUrl?: string;
}

const isProduction = process.env.NODE_ENV === 'production';

export function buildServer(options: BuildServerOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: isProduction
      ? {
          level: process.env.LOG_LEVEL ?? 'info',
        }
      : {
          level: process.env.LOG_LEVEL ?? 'debug',
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l o',
              singleLine: true,
            },
          },
        },
    genReqId: (request) => {
      const existing = request.headers['x-request-id'];
      return typeof existing === 'string' && existing.length > 0 ? existing : randomUUID();
    },
  });

  app.register(rateLimit, {
    max: 10,
    timeWindow: '1 minute',
    ban: 0,
    continueExceeding: true,
    keyGenerator: (request) => request.headers['x-forwarded-for']?.toString() ?? request.ip,
    errorResponseBuilder: (_request, context) => {
      const { statusCode, payload } = buildRateLimitError(Math.ceil(context.ttl / 1000));
      return {
        statusCode,
        error: 'Too Many Requests',
        message: payload.message,
        code: payload.code,
        retryAfterSeconds: payload.retryAfterSeconds,
      };
    },
  });

  app.register(redisPlugin, { url: options.redisUrl });

  app.get('/health', async () => ({
    status: 'ok',
    uptimeSeconds: process.uptime(),
    timestamp: new Date().toISOString(),
  }));

  app.register(registerRouteTime, { prefix: '/api' });

  return app;
}

export async function start() {
  const app = buildServer();
  const port = Number(process.env.API_PORT ?? 4000);
  const host = process.env.API_HOST ?? '0.0.0.0';

  try {
    await app.listen({ port, host });
  } catch (error) {
    app.log.error({ err: error }, 'Failed to start Fastify server');
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
