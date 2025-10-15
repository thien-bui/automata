/**
 * Reminder API route plugin
 * Provides endpoints for managing and retrieving reminders
 */

import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ReminderRepository } from '../../adapters/reminderRepository';
import { ReminderScheduler } from '../../services/reminderScheduler';
import { getReminderExpireWindowMinutes } from '../../config/reminder';
import { buildValidationError, buildInternalError } from '../../utils/errors';

const reminderQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD'),
});

const completeReminderSchema = z.object({
  reminderId: z.string().min(1, 'Reminder ID is required'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Expected YYYY-MM-DD').optional(),
});

const reminderRoutes: FastifyPluginAsync<{
  reminderRepository: ReminderRepository;
  reminderScheduler: ReminderScheduler;
}> = async (fastify, { reminderRepository, reminderScheduler }) => {
  // GET /reminder - Get reminders for a specific date
  fastify.get('/', {
    schema: {
      querystring: reminderQuerySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            reminders: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  description: { type: 'string' },
                  scheduledAt: { type: 'string' },
                  isRecurring: { type: 'boolean' },
                  isCompleted: { type: 'boolean' },
                  createdAt: { type: 'string' },
                },
                required: ['id', 'title', 'scheduledAt', 'isRecurring', 'isCompleted', 'createdAt'],
              },
            },
            expiresAfterMinutes: { type: 'number' },
          },
          required: ['reminders', 'expiresAfterMinutes'],
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
  }, async (request, reply) => {
    try {
      const { date } = request.query as { date: string };
      
      // Validate date format and convert to Date object
      const dateParts = date.split('-').map(Number);
      const queryDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
      
      if (isNaN(queryDate.getTime())) {
        const error = buildValidationError('The provided date is not valid');
        return reply.status(error.statusCode).send(error.payload);
      }

      // Ensure reminders are seeded for the requested date
      await reminderRepository.seedRecurringReminders(queryDate);

      // Get reminders for the date
      const reminderResponse = await reminderRepository.getRemindersForDate(queryDate);

      // Update expiresAfterMinutes from config
      reminderResponse.expiresAfterMinutes = getReminderExpireWindowMinutes();

      fastify.log.info(`Retrieved ${reminderResponse.reminders.length} reminders for date: ${date}`);
      
      return reminderResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`Error fetching reminders: ${errorMessage}`);
      
      const errorResponse = buildInternalError(error as Error);
      return reply.status(errorResponse.statusCode).send(errorResponse.payload);
    }
  });

  // POST /reminder/complete - Mark a reminder as completed
  fastify.post('/complete', {
    schema: {
      body: completeReminderSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
          required: ['success', 'message'],
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
        404: {
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
  }, async (request, reply) => {
    try {
      const { reminderId, date } = request.body as { reminderId: string; date?: string };
      
      let targetDate: Date;
      if (date) {
        const dateParts = date.split('-').map(Number);
        targetDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
        
        if (isNaN(targetDate.getTime())) {
          const error = buildValidationError('The provided date is not valid');
          return reply.status(error.statusCode).send(error.payload);
        }
      } else {
        targetDate = new Date();
      }

      await reminderRepository.markReminderCompleted(reminderId, targetDate);

      fastify.log.info(`Marked reminder ${reminderId} as completed for date: ${date || 'today'}`);
      
      return {
        success: true,
        message: 'Reminder marked as completed',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`Error marking reminder as completed: ${errorMessage}`);
      
      if (error instanceof Error && error.message === 'Reminder not found') {
        const errorResponse = buildValidationError('The specified reminder does not exist');
        return reply.status(404).send(errorResponse.payload);
      }

      if (error instanceof Error && error.message === 'No reminders found for this date') {
        const errorResponse = buildValidationError('No reminders exist for the specified date');
        return reply.status(404).send(errorResponse.payload);
      }
      
      const errorResponse = buildInternalError(error as Error);
      return reply.status(errorResponse.statusCode).send(errorResponse.payload);
    }
  });

  // GET /reminder/status - Get scheduler status
  fastify.get('/status', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            initialized: { type: 'boolean' },
            todaySeeded: { type: 'boolean' },
            tomorrowSeeded: { type: 'boolean' },
            templateCount: { type: 'number' },
          },
          required: ['initialized', 'todaySeeded', 'tomorrowSeeded', 'templateCount'],
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
  }, async (request, reply) => {
    try {
      const status = await reminderScheduler.getStatus();
      fastify.log.info('Retrieved reminder scheduler status');
      return status;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      fastify.log.error(`Error getting scheduler status: ${errorMessage}`);
      
      const errorResponse = buildInternalError(error as Error);
      return reply.status(errorResponse.statusCode).send(errorResponse.payload);
    }
  });
};

export default reminderRoutes;
