import { createHash } from 'node:crypto';

import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';

import { fetchDiscordGuildStatus, DiscordGuildStatus } from '../adapters/discord';
import { cacheConfig } from '../config/cache';
import { buildProviderError, buildValidationError } from '../utils/errors';

const discordCacheConfig = cacheConfig.discord;

const querySchema = z.object({
  forceRefresh: z.coerce.boolean().optional(),
});

interface CachedDiscordRecord {
  payload: Omit<DiscordGuildStatus, 'cache'>;
  cachedAtIso: string;
}

type DiscordQueryParams = z.infer<typeof querySchema>;

export interface DiscordResponse extends DiscordGuildStatus {
  cache: {
    hit: boolean;
    ageSeconds: number;
    staleWhileRevalidate: boolean;
  };
}

function buildCacheKey(): string {
  const hasher = createHash('sha256');
  hasher.update('discord:guild-status');
  return `discord:${hasher.digest('hex')}`;
}

function toResponse(
  record: CachedDiscordRecord,
  ageSeconds: number,
  hit: boolean,
  staleWhileRevalidate: boolean,
): DiscordResponse {
  return {
    ...record.payload,
    cache: {
      hit,
      ageSeconds,
      staleWhileRevalidate,
    },
  };
}

function coerceCachedRecord(
  raw: string | null,
  logFn: (msg: string, meta?: unknown) => void,
): CachedDiscordRecord | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as CachedDiscordRecord;
    if (parsed?.payload && parsed.cachedAtIso) {
      return parsed;
    }
  } catch (error) {
    logFn('Failed to parse cached discord entry', { error });
  }

  return null;
}

export async function registerDiscord(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  app.get<{ Querystring: DiscordQueryParams }>('/discord-status', async (
    request: FastifyRequest<{ Querystring: DiscordQueryParams }>,
    reply: FastifyReply,
  ) => {
    const validation = querySchema.safeParse(request.query);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid query parameters', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const { forceRefresh = false } = validation.data;
    const freshnessSeconds = discordCacheConfig.baseTtlSeconds;
    const maxAcceptableAgeSeconds = freshnessSeconds + discordCacheConfig.staleGraceSeconds;
    const cacheKey = buildCacheKey();

    const cachedRecord = coerceCachedRecord(await app.redis.get(cacheKey), (msg, meta) => {
      app.log.warn(meta, msg);
    });

    const now = Date.now();
    let cachedAgeSeconds = 0;

    if (cachedRecord) {
      cachedAgeSeconds = Math.max(
        0,
        Math.floor((now - new Date(cachedRecord.cachedAtIso).getTime()) / 1000),
      );

      if (!forceRefresh && cachedAgeSeconds <= freshnessSeconds) {
        return toResponse(cachedRecord, cachedAgeSeconds, true, false);
      }
    }

    try {
      const providerResult = await fetchDiscordGuildStatus();
      const lastUpdatedIso = new Date(now).toISOString();

      const payload: Omit<DiscordGuildStatus, 'cache'> = {
        guildId: providerResult.guildId,
        guildName: providerResult.guildName,
        totalMembers: providerResult.totalMembers,
        onlineMembers: providerResult.onlineMembers,
        members: providerResult.members,
        lastUpdatedIso,
      };

      const response: DiscordResponse = {
        ...payload,
        cache: {
          hit: false,
          ageSeconds: 0,
          staleWhileRevalidate: false,
        },
      };

      const cacheValue: CachedDiscordRecord = {
        payload,
        cachedAtIso: lastUpdatedIso,
      };

      await app.redis.set(
        cacheKey,
        JSON.stringify(cacheValue),
        'EX',
        discordCacheConfig.redisExpireSeconds,
      );

      return response;
    } catch (error) {
      app.log.error({ err: error }, 'Failed to retrieve discord data from provider');

      if (cachedRecord && cachedAgeSeconds <= maxAcceptableAgeSeconds) {
        return toResponse(cachedRecord, cachedAgeSeconds, true, true);
      }

      const { statusCode, payload } = buildProviderError(
        'Failed to fetch discord guild status from provider.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });
}

export default registerDiscord;
