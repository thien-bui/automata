import type { FastifyInstance, FastifyPluginOptions, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { DateTime } from 'luxon';

import { buildProviderError, buildValidationError, buildInternalError } from '../utils/errors';
import type { 
  AppConfigResponse, 
  ConfigUpdateRequest,
  WeatherConfig,
  DiscordConfig,
  AutoModeConfig,
  UiPreferencesState
} from '@automata/types';
import { ConfigService } from '../services/configService';

const configQuerySchema = z.object({
  forceRefresh: z.coerce.boolean().optional(),
});

type ConfigQueryParams = z.infer<typeof configQuerySchema>;

const configUpdateSchema = z.object({
  weather: z.object({
    defaultLocation: z.string().optional(),
    defaultRefreshSeconds: z.number().min(60).max(3600).optional(),
    minRefreshSeconds: z.number().min(60).max(3600).optional(),
    maxRefreshSeconds: z.number().min(60).max(3600).optional(),
    displaySettings: z.object({
      showHourlyForecast: z.boolean(),
      hourlyForecastHours: z.number().min(1).max(168),
      hourlyForecastPastHours: z.number().min(0).max(24),
      hourlyForecastFutureHours: z.number().min(0).max(24),
      currentHourHighlight: z.boolean(),
      showHumidity: z.boolean(),
      showWindSpeed: z.boolean(),
      showPrecipitation: z.boolean(),
      temperatureUnit: z.enum(['celsius', 'fahrenheit', 'both']),
    }).optional(),
    uiSettings: z.object({
      compactMode: z.boolean(),
      showCacheInfo: z.boolean(),
      autoRefresh: z.boolean(),
    }).optional(),
  }).optional(),
  discord: z.object({
    defaultRefreshSeconds: z.number().min(60).max(3600).optional(),
    minRefreshSeconds: z.number().min(60).max(3600).optional(),
    maxRefreshSeconds: z.number().min(60).max(3600).optional(),
    displaySettings: z.object({
      showBots: z.boolean(),
      showOfflineMembers: z.boolean(),
      sortBy: z.enum(['status', 'username', 'displayName']),
      groupByStatus: z.boolean(),
      maxMembersToShow: z.number().min(1).max(1000),
      showAvatars: z.boolean(),
      compactMode: z.boolean(),
    }).optional(),
    uiSettings: z.object({
      compactMode: z.boolean(),
      showCacheInfo: z.boolean(),
      autoRefresh: z.boolean(),
    }).optional(),
  }).optional(),
  autoMode: z.object({
    enabled: z.boolean().optional(),
    timeWindows: z.array(z.object({
      name: z.string(),
      mode: z.enum(['Compact', 'Nav']),
      startTime: z.object({
        hour: z.number().min(0).max(23),
        minute: z.number().min(0).max(59),
      }),
      endTime: z.object({
        hour: z.number().min(0).max(23),
        minute: z.number().min(0).max(59),
      }),
      daysOfWeek: z.array(z.number().min(0).max(6)),
      description: z.string().optional(),
    })).optional(),
    defaultMode: z.enum(['Compact', 'Nav']).optional(),
    navModeRefreshSeconds: z.number().min(60).max(3600).optional(),
  }).optional(),
  ui: z.object({
    compactMode: z.boolean().optional(),
    widgetCompactModes: z.record(z.enum(['use-global', 'force-compact', 'force-full'])).optional(),
  }).optional(),
});

export async function registerConfig(
  app: FastifyInstance,
  _opts: FastifyPluginOptions,
): Promise<void> {
  // Initialize the config service
  const configService = new ConfigService();

  // GET /config - Get current application configuration
  app.get<{ Querystring: ConfigQueryParams }>('/config', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          forceRefresh: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            weather: {
              type: 'object',
              properties: {
                defaultLocation: { type: 'string' },
                defaultRefreshSeconds: { type: 'number' },
                minRefreshSeconds: { type: 'number' },
                maxRefreshSeconds: { type: 'number' },
                displaySettings: {
                  type: 'object',
                  properties: {
                    showHourlyForecast: { type: 'boolean' },
                    hourlyForecastHours: { type: 'number' },
                    hourlyForecastPastHours: { type: 'number' },
                    hourlyForecastFutureHours: { type: 'number' },
                    currentHourHighlight: { type: 'boolean' },
                    showHumidity: { type: 'boolean' },
                    showWindSpeed: { type: 'boolean' },
                    showPrecipitation: { type: 'boolean' },
                    temperatureUnit: { type: 'string', enum: ['celsius', 'fahrenheit', 'both'] },
                  },
                  required: ['showHourlyForecast', 'hourlyForecastHours', 'hourlyForecastPastHours', 'hourlyForecastFutureHours', 'currentHourHighlight', 'showHumidity', 'showWindSpeed', 'showPrecipitation', 'temperatureUnit'],
                },
                uiSettings: {
                  type: 'object',
                  properties: {
                    compactMode: { type: 'boolean' },
                    showCacheInfo: { type: 'boolean' },
                    autoRefresh: { type: 'boolean' },
                  },
                  required: ['compactMode', 'showCacheInfo', 'autoRefresh'],
                },
              },
              required: ['defaultLocation', 'defaultRefreshSeconds', 'minRefreshSeconds', 'maxRefreshSeconds', 'displaySettings', 'uiSettings'],
            },
            discord: {
              type: 'object',
              properties: {
                defaultRefreshSeconds: { type: 'number' },
                minRefreshSeconds: { type: 'number' },
                maxRefreshSeconds: { type: 'number' },
                displaySettings: {
                  type: 'object',
                  properties: {
                    showBots: { type: 'boolean' },
                    showOfflineMembers: { type: 'boolean' },
                    sortBy: { type: 'string', enum: ['status', 'username', 'displayName'] },
                    groupByStatus: { type: 'boolean' },
                    maxMembersToShow: { type: 'number' },
                    showAvatars: { type: 'boolean' },
                    compactMode: { type: 'boolean' },
                  },
                  required: ['showBots', 'showOfflineMembers', 'sortBy', 'groupByStatus', 'maxMembersToShow', 'showAvatars', 'compactMode'],
                },
                uiSettings: {
                  type: 'object',
                  properties: {
                    compactMode: { type: 'boolean' },
                    showCacheInfo: { type: 'boolean' },
                    autoRefresh: { type: 'boolean' },
                  },
                  required: ['compactMode', 'showCacheInfo', 'autoRefresh'],
                },
              },
              required: ['defaultRefreshSeconds', 'minRefreshSeconds', 'maxRefreshSeconds', 'displaySettings', 'uiSettings'],
            },
            autoMode: {
              type: 'object',
              properties: {
                enabled: { type: 'boolean' },
                timeWindows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      mode: { type: 'string', enum: ['Compact', 'Nav'] },
                      startTime: {
                        type: 'object',
                        properties: {
                          hour: { type: 'number' },
                          minute: { type: 'number' },
                        },
                        required: ['hour', 'minute'],
                      },
                      endTime: {
                        type: 'object',
                        properties: {
                          hour: { type: 'number' },
                          minute: { type: 'number' },
                        },
                        required: ['hour', 'minute'],
                      },
                      daysOfWeek: {
                        type: 'array',
                        items: { type: 'number' },
                      },
                      description: { type: 'string' },
                    },
                    required: ['name', 'mode', 'startTime', 'endTime', 'daysOfWeek'],
                  },
                },
                defaultMode: { type: 'string', enum: ['Compact', 'Nav'] },
                navModeRefreshSeconds: { type: 'number' },
              },
              required: ['enabled', 'timeWindows', 'defaultMode', 'navModeRefreshSeconds'],
            },
            ui: {
              type: 'object',
              properties: {
                compactMode: { type: 'boolean' },
                widgetCompactModes: {
                  type: 'object',
                  additionalProperties: {
                    type: 'string',
                    enum: ['use-global', 'force-compact', 'force-full'],
                  },
                },
              },
              required: ['compactMode', 'widgetCompactModes'],
            },
            lastUpdatedIso: { type: 'string' },
          },
          required: ['weather', 'discord', 'autoMode', 'ui', 'lastUpdatedIso'],
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['error', 'code', 'message'],
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Querystring: ConfigQueryParams }>,
    reply: FastifyReply,
  ) => {
    const validation = configQuerySchema.safeParse(request.query);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid query parameters', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const { forceRefresh = false } = validation.data;

    try {
      // Get current config from Redis or use defaults
      const configKey = 'app:config:current';
      let currentConfig = configService.getDefaultConfig();

      if (!forceRefresh) {
        try {
          const cachedConfig = await app.redis.get(configKey);
          if (cachedConfig) {
            const parsed = JSON.parse(cachedConfig) as {
              weather: WeatherConfig;
              discord: DiscordConfig;
              autoMode: AutoModeConfig;
              ui: UiPreferencesState;
            };
            // Basic validation of parsed config
            if (parsed && parsed.weather && parsed.discord && parsed.autoMode && parsed.ui) {
              currentConfig = parsed;
            }
          }
        } catch (error) {
          app.log.warn({ err: error }, 'Failed to read app config from Redis, using defaults');
        }
      }

      const lastUpdatedIso = configService.getCurrentTimestamp();

      const response: AppConfigResponse = {
        ...currentConfig,
        lastUpdatedIso,
      };

      // Cache the current config for future requests
      try {
        await app.redis.set(configKey, JSON.stringify(currentConfig), 'EX', 3600); // 1 hour cache
      } catch (error) {
        app.log.warn({ err: error }, 'Failed to persist app config to Redis');
      }

      app.log.info('Retrieved application configuration');
      
      return response;
    } catch (error) {
      app.log.error({ err: error }, 'Failed to retrieve application configuration');

      const { statusCode, payload } = buildProviderError(
        'Failed to fetch application configuration.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });

  // POST /config - Update application configuration
  app.post<{ Body: ConfigUpdateRequest }>('/config', {
    schema: {
      body: {
        type: 'object',
        properties: {
          weather: {
            type: 'object',
            properties: {
              defaultLocation: { type: 'string' },
              defaultRefreshSeconds: { type: 'number' },
              minRefreshSeconds: { type: 'number' },
              maxRefreshSeconds: { type: 'number' },
              displaySettings: {
                type: 'object',
                properties: {
                  showHourlyForecast: { type: 'boolean' },
                  hourlyForecastHours: { type: 'number' },
                  hourlyForecastPastHours: { type: 'number' },
                  hourlyForecastFutureHours: { type: 'number' },
                  currentHourHighlight: { type: 'boolean' },
                  showHumidity: { type: 'boolean' },
                  showWindSpeed: { type: 'boolean' },
                  showPrecipitation: { type: 'boolean' },
                  temperatureUnit: { type: 'string', enum: ['celsius', 'fahrenheit', 'both'] },
                },
              },
              uiSettings: {
                type: 'object',
                properties: {
                  compactMode: { type: 'boolean' },
                  showCacheInfo: { type: 'boolean' },
                  autoRefresh: { type: 'boolean' },
                },
              },
            },
          },
          discord: {
            type: 'object',
            properties: {
              defaultRefreshSeconds: { type: 'number' },
              minRefreshSeconds: { type: 'number' },
              maxRefreshSeconds: { type: 'number' },
              displaySettings: {
                type: 'object',
                properties: {
                  showBots: { type: 'boolean' },
                  showOfflineMembers: { type: 'boolean' },
                  sortBy: { type: 'string', enum: ['status', 'username', 'displayName'] },
                  groupByStatus: { type: 'boolean' },
                  maxMembersToShow: { type: 'number' },
                  showAvatars: { type: 'boolean' },
                  compactMode: { type: 'boolean' },
                },
              },
              uiSettings: {
                type: 'object',
                properties: {
                  compactMode: { type: 'boolean' },
                  showCacheInfo: { type: 'boolean' },
                  autoRefresh: { type: 'boolean' },
                },
              },
            },
          },
          autoMode: {
            type: 'object',
            properties: {
              enabled: { type: 'boolean' },
              timeWindows: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    mode: { type: 'string', enum: ['Compact', 'Nav'] },
                    startTime: {
                      type: 'object',
                      properties: {
                        hour: { type: 'number' },
                        minute: { type: 'number' },
                      },
                    },
                    endTime: {
                      type: 'object',
                      properties: {
                        hour: { type: 'number' },
                        minute: { type: 'number' },
                      },
                    },
                    daysOfWeek: {
                      type: 'array',
                      items: { type: 'number' },
                    },
                    description: { type: 'string' },
                  },
                },
              },
              defaultMode: { type: 'string', enum: ['Compact', 'Nav'] },
              navModeRefreshSeconds: { type: 'number' },
            },
          },
          ui: {
            type: 'object',
            properties: {
              compactMode: { type: 'boolean' },
              widgetCompactModes: {
                type: 'object',
                additionalProperties: {
                  type: 'string',
                  enum: ['use-global', 'force-compact', 'force-full'],
                },
              },
            },
          },
        },
        additionalProperties: false,
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            config: {
              type: 'object',
              properties: {
                weather: {
                  type: 'object',
                  properties: {
                    defaultLocation: { type: 'string' },
                    defaultRefreshSeconds: { type: 'number' },
                    minRefreshSeconds: { type: 'number' },
                    maxRefreshSeconds: { type: 'number' },
                    displaySettings: {
                      type: 'object',
                      properties: {
                        showHourlyForecast: { type: 'boolean' },
                        hourlyForecastHours: { type: 'number' },
                        hourlyForecastPastHours: { type: 'number' },
                        hourlyForecastFutureHours: { type: 'number' },
                        currentHourHighlight: { type: 'boolean' },
                        showHumidity: { type: 'boolean' },
                        showWindSpeed: { type: 'boolean' },
                        showPrecipitation: { type: 'boolean' },
                        temperatureUnit: { type: 'string', enum: ['celsius', 'fahrenheit', 'both'] },
                      },
                    },
                    uiSettings: {
                      type: 'object',
                      properties: {
                        compactMode: { type: 'boolean' },
                        showCacheInfo: { type: 'boolean' },
                        autoRefresh: { type: 'boolean' },
                      },
                    },
                  },
                },
                discord: {
                  type: 'object',
                  properties: {
                    defaultRefreshSeconds: { type: 'number' },
                    minRefreshSeconds: { type: 'number' },
                    maxRefreshSeconds: { type: 'number' },
                    displaySettings: {
                      type: 'object',
                      properties: {
                        showBots: { type: 'boolean' },
                        showOfflineMembers: { type: 'boolean' },
                        sortBy: { type: 'string', enum: ['status', 'username', 'displayName'] },
                        groupByStatus: { type: 'boolean' },
                        maxMembersToShow: { type: 'number' },
                        showAvatars: { type: 'boolean' },
                        compactMode: { type: 'boolean' },
                      },
                    },
                    uiSettings: {
                      type: 'object',
                      properties: {
                        compactMode: { type: 'boolean' },
                        showCacheInfo: { type: 'boolean' },
                        autoRefresh: { type: 'boolean' },
                      },
                    },
                  },
                },
                autoMode: {
                  type: 'object',
                  properties: {
                    enabled: { type: 'boolean' },
                    timeWindows: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          mode: { type: 'string', enum: ['Compact', 'Nav'] },
                          startTime: {
                            type: 'object',
                            properties: {
                              hour: { type: 'number' },
                              minute: { type: 'number' },
                            },
                          },
                          endTime: {
                            type: 'object',
                            properties: {
                              hour: { type: 'number' },
                              minute: { type: 'number' },
                            },
                          },
                          daysOfWeek: {
                            type: 'array',
                            items: { type: 'number' },
                          },
                          description: { type: 'string' },
                        },
                      },
                    },
                    defaultMode: { type: 'string', enum: ['Compact', 'Nav'] },
                    navModeRefreshSeconds: { type: 'number' },
                  },
                },
                ui: {
                  type: 'object',
                  properties: {
                    compactMode: { type: 'boolean' },
                    widgetCompactModes: {
                      type: 'object',
                      additionalProperties: {
                        type: 'string',
                        enum: ['use-global', 'force-compact', 'force-full'],
                      },
                    },
                  },
                },
              },
            },
            lastUpdatedIso: { type: 'string' },
          },
          required: ['success', 'message', 'config', 'lastUpdatedIso'],
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['error', 'code', 'message'],
        },
        500: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            code: { type: 'string' },
            message: { type: 'string' },
          },
          required: ['error', 'code', 'message'],
        },
      },
    },
  }, async (
    request: FastifyRequest<{ Body: ConfigUpdateRequest }>,
    reply: FastifyReply,
  ) => {
    const validation = configUpdateSchema.safeParse(request.body);
    if (!validation.success) {
      const { statusCode, payload } = buildValidationError('Invalid request body', {
        issues: validation.error.flatten(),
      });
      return reply.status(statusCode).send(payload);
    }

    const updates = validation.data;

    try {
      const configKey = 'app:config:current';
      
      // Get existing config
      let existingConfig = configService.getDefaultConfig();
      try {
        const cachedConfig = await app.redis.get(configKey);
        if (cachedConfig) {
          const parsed = JSON.parse(cachedConfig) as {
            weather: WeatherConfig;
            discord: DiscordConfig;
            autoMode: AutoModeConfig;
            ui: UiPreferencesState;
          };
          if (parsed && parsed.weather && parsed.discord && parsed.autoMode && parsed.ui) {
            existingConfig = parsed;
          }
        }
      } catch (error) {
        app.log.warn({ err: error }, 'Failed to read existing config from Redis, using defaults');
      }

      // Merge updates with existing config
      const updatedConfig = configService.mergeConfigs(existingConfig, updates);

      // Store the updated config
      try {
        await app.redis.set(configKey, JSON.stringify(updatedConfig), 'EX', 86400); // 24 hours cache
      } catch (error) {
        app.log.warn({ err: error }, 'Failed to persist config update to Redis');
      }

      const lastUpdatedIso = configService.getCurrentTimestamp();

      app.log.info('Updated application configuration');
      
      return {
        success: true,
        message: 'Configuration updated successfully',
        config: updatedConfig,
        lastUpdatedIso,
      };
    } catch (error) {
      app.log.error({ err: error }, 'Failed to update configuration');

      const { statusCode, payload } = buildProviderError(
        'Failed to update configuration.',
        error instanceof Error ? { message: error.message } : error,
      );
      return reply.status(statusCode).send(payload);
    }
  });
}

export default registerConfig;
