import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import Redis from 'ioredis';

export interface RedisPluginOptions {
  url?: string;
}

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

const redisPluginImpl: FastifyPluginAsync<RedisPluginOptions> = async (
  fastify: FastifyInstance,
  opts: RedisPluginOptions = {},
) => {
  const url = opts.url ?? process.env.REDIS_URL ?? 'redis://127.0.0.1:6379';
  const client = new Redis(url, {
    maxRetriesPerRequest: 2,
    retryStrategy: (attempt: number) => Math.min(attempt * 100, 1000),
    reconnectOnError: () => true,
  });

  client.on('error', (error: Error) => {
    fastify.log.error({ err: error }, 'Redis connection error');
  });

  fastify.decorate('redis', client);

  fastify.addHook('onClose', async () => {
    await client.quit();
  });
};

export const redisPlugin = fp(redisPluginImpl);

export default redisPlugin;
