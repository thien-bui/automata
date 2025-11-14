import { DateTime } from 'luxon';
import type { FastifyInstance } from 'fastify';
import type { SchedulerEvent } from '@automata/types';

interface ScheduledTask {
  eventId: string;
  taskType: string;
  scheduleExpression: string;
  payload?: Record<string, unknown>;
  isRecurring: boolean;
  nextRunAt: Date;
  lastRunAt?: Date;
  createdAt: Date;
  timeoutId?: NodeJS.Timeout;
}

interface CronParts {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

export class SchedulerService {
  private fastify: FastifyInstance;
  private tasks: Map<string, ScheduledTask> = new Map();
  private readonly redisKeyPrefix = 'scheduler:task:';
  private readonly redisStatusKey = 'scheduler:status';
  private isExecuting = false;

  constructor(fastify: FastifyInstance) {
    this.fastify = fastify;
  }

  /**
   * Initialize the scheduler service
   * Load existing tasks from Redis and schedule them
   */
  async initialize(): Promise<void> {
    try {
      this.fastify.log.info('Initializing SchedulerService');
      
      // Load existing tasks from Redis
      try {
        const taskKeys = await this.fastify.redis.keys(`${this.redisKeyPrefix}*`);
        
        for (const key of taskKeys) {
          try {
            const taskData = await this.fastify.redis.get(key);
            if (taskData) {
              const task: ScheduledTask = JSON.parse(taskData);
              // Convert string dates back to Date objects
              task.nextRunAt = new Date(task.nextRunAt);
              task.createdAt = new Date(task.createdAt);
              if (task.lastRunAt) {
                task.lastRunAt = new Date(task.lastRunAt);
              }
              
              this.scheduleTask(task);
              this.fastify.log.info(`Loaded and scheduled task: ${task.eventId}`);
            }
          } catch (error) {
            this.fastify.log.warn({ err: error, key }, 'Failed to load task from Redis');
          }
        }
      } catch (error) {
        this.fastify.log.error({ err: error }, 'Failed to load tasks from Redis during initialization');
        // Continue initialization even if Redis fails
      }

      // Update scheduler status
      await this.updateStatus();

      this.fastify.log.info(`SchedulerService initialized with ${this.tasks.size} active tasks`);
    } catch (error) {
      this.fastify.log.error({ err: error }, 'Failed to initialize SchedulerService');
      // Don't throw to allow server to start even if scheduler fails
    }
  }

  /**
   * Schedule a new task
   */
  async schedule(
    taskType: string,
    scheduleExpression: string,
    payload?: Record<string, unknown>,
    isRecurring: boolean = true
  ): Promise<SchedulerEvent> {
    const eventId = this.generateEventId();
    const now = new Date();
    
    const nextRunAt = this.calculateNextRunTime(scheduleExpression, now);
    if (!nextRunAt) {
      throw new Error('Invalid schedule expression');
    }

    const task: ScheduledTask = {
      eventId,
      taskType,
      scheduleExpression,
      payload,
      isRecurring,
      nextRunAt,
      createdAt: now,
    };

    // Schedule the task
    this.scheduleTask(task);
    
    // Store in Redis
    await this.persistTask(task);

    // Update scheduler status
    await this.updateStatus();

    this.fastify.log.info({ eventId, taskType }, 'Task scheduled successfully');

    return this.toSchedulerEvent(task);
  }

  /**
   * Cancel a scheduled task
   */
  async cancel(eventId: string): Promise<boolean> {
    const task = this.tasks.get(eventId);
    if (!task) {
      return false;
    }

    // Clear the timeout
    if (task.timeoutId) {
      clearTimeout(task.timeoutId);
    }

    // Remove from memory
    this.tasks.delete(eventId);

    // Remove from Redis
    const redisKey = `${this.redisKeyPrefix}${eventId}`;
    await this.fastify.redis.del(redisKey);

    // Update scheduler status
    await this.updateStatus();

    this.fastify.log.info({ eventId }, 'Task cancelled successfully');

    return true;
  }

  /**
   * Get all scheduled tasks
   */
  getAllTasks(): SchedulerEvent[] {
    return Array.from(this.tasks.values()).map(task => this.toSchedulerEvent(task));
  }

  /**
   * Get scheduler status
   */
  async getStatus(): Promise<{
    isHealthy: boolean;
    activeSchedules: number;
    nextScheduledEvents: Array<{
      eventId: string;
      scheduledAtIso: string;
      taskType: string;
    }>;
  }> {
    const now = new Date();
    const nextEvents = Array.from(this.tasks.values())
      .filter(task => task.nextRunAt > now)
      .sort((a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime())
      .slice(0, 10)
      .map(task => ({
        eventId: task.eventId,
        scheduledAtIso: task.nextRunAt.toISOString(),
        taskType: task.taskType,
      }));

    return {
      isHealthy: true,
      activeSchedules: this.tasks.size,
      nextScheduledEvents: nextEvents,
    };
  }

  /**
   * Shutdown the scheduler service
   */
  async shutdown(): Promise<void> {
    this.fastify.log.info('Shutting down SchedulerService');
    
    // Clear all timeouts
    for (const task of this.tasks.values()) {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
    }

    this.tasks.clear();
    this.fastify.log.info('SchedulerService shut down successfully');
  }

  /**
   * Schedule a task (internal method)
   */
  private scheduleTask(task: ScheduledTask): void {
    const now = new Date();
    const delay = task.nextRunAt.getTime() - now.getTime();

    if (delay <= 0) {
      this.fastify.log.warn({ eventId: task.eventId }, 'Task scheduled for past time, executing immediately');
      // Execute immediately but don't reschedule to avoid infinite loops
      this.executeTask(task, false);
      return;
    }

    const timeoutId = setTimeout(() => {
      this.executeTask(task);
    }, delay);

    task.timeoutId = timeoutId;
    this.tasks.set(task.eventId, task);
  }

  /**
   * Execute a task
   */
  private async executeTask(task: ScheduledTask, allowReschedule: boolean = true): Promise<void> {
    // Prevent re-entrancy and infinite loops
    if (this.isExecuting) {
      this.fastify.log.warn({ eventId: task.eventId }, 'Task execution already in progress, skipping');
      return;
    }

    this.isExecuting = true;
    const startTime = Date.now();
    
    try {
      this.fastify.log.info({ 
        eventId: task.eventId, 
        taskType: task.taskType,
        payload: task.payload 
      }, 'Executing scheduled task');

      // Execute the task based on task type
      await this.executeTaskByType(task);

      const duration = Date.now() - startTime;
      this.fastify.log.info({ 
        eventId: task.eventId, 
        duration 
      }, 'Task executed successfully');

      // Update last run time
      task.lastRunAt = new Date();

      // Schedule next run if recurring and allowed
      if (task.isRecurring && allowReschedule) {
        const now = new Date();
        const nextRunAt = this.calculateNextRunTime(task.scheduleExpression, now);
        if (nextRunAt && nextRunAt.getTime() > now.getTime() + 1000) {
          // Ensure next run is at least 1 second in the future to prevent tight loops
          task.nextRunAt = nextRunAt;
          this.scheduleTask(task);
          await this.persistTask(task);
        } else {
          this.fastify.log.warn({ eventId: task.eventId }, 'Could not calculate valid next run time for recurring task');
          await this.cancel(task.eventId);
        }
      } else if (!task.isRecurring) {
        // One-time task, remove it
        await this.cancel(task.eventId);
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      this.fastify.log.error({ 
        err: error, 
        eventId: task.eventId, 
        duration 
      }, 'Task execution failed');

      // For recurring tasks, schedule next run even if this one failed
      if (task.isRecurring && allowReschedule) {
        const now = new Date();
        const nextRunAt = this.calculateNextRunTime(task.scheduleExpression, now);
        if (nextRunAt && nextRunAt.getTime() > now.getTime() + 1000) {
          task.nextRunAt = nextRunAt;
          this.scheduleTask(task);
          await this.persistTask(task);
        } else {
          this.fastify.log.warn({ eventId: task.eventId }, 'Could not calculate next run time for recurring task after error');
          await this.cancel(task.eventId);
        }
      }
    } finally {
      this.isExecuting = false;
    }

    // Update scheduler status
    await this.updateStatus();
  }

  /**
   * Execute task based on type
   */
  private async executeTaskByType(task: ScheduledTask): Promise<void> {
    switch (task.taskType) {
      case 'route-polling':
        // Trigger route polling refresh
        this.fastify.log.info('Triggering route polling refresh');
        // This would integrate with existing route time service
        break;

      case 'weather-update':
        // Trigger weather data update
        this.fastify.log.info('Triggering weather data update');
        break;

      case 'reminder-check':
        // Check for overdue reminders
        this.fastify.log.info('Checking for overdue reminders');
        break;

      case 'cache-cleanup':
        // Clean up stale cache entries
        this.fastify.log.info('Cleaning up stale cache entries');
        break;

      default:
        this.fastify.log.warn({ taskType: task.taskType }, 'Unknown task type');
    }
  }

  /**
   * Calculate next run time from schedule expression
   */
  private calculateNextRunTime(scheduleExpression: string, from: Date): Date | null {
    try {
      // Handle simple interval format: "interval:seconds"
      if (scheduleExpression.startsWith('interval:')) {
        const seconds = parseInt(scheduleExpression.split(':')[1], 10);
        if (isNaN(seconds) || seconds <= 0) {
          return null;
        }
        return new Date(from.getTime() + seconds * 1000);
      }

      // Handle cron format: "cron:* * * * *"
      if (scheduleExpression.startsWith('cron:')) {
        const cronPart = scheduleExpression.substring(5);
        return this.parseCronExpression(cronPart, from);
      }

      return null;
    } catch (error) {
      this.fastify.log.error({ err: error, scheduleExpression }, 'Failed to parse schedule expression');
      return null;
    }
  }

  /**
   * Parse cron expression and calculate next run time
   */
  private parseCronExpression(cronExpression: string, from: Date): Date | null {
    try {
      const parts = cronExpression.trim().split(/\s+/);
      if (parts.length !== 5) {
        return null;
      }

      const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
      const cronParts: CronParts = { minute, hour, dayOfMonth, month, dayOfWeek };

      // For now, support simple cron patterns
      // This is a simplified implementation - in production, use a library like cron-parser
      let nextRun = DateTime.fromJSDate(from).toUTC();

      // Handle every minute: "* * * * *"
      if (minute === '*' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        nextRun = nextRun.plus({ minutes: 1 }).startOf('minute');
        return nextRun.toJSDate();
      }

      // Handle hourly: "0 * * * *"
      if (minute === '0' && hour === '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        nextRun = nextRun.plus({ hours: 1 }).startOf('hour');
        return nextRun.toJSDate();
      }

      // Handle daily at specific time: "0 9 * * *" (9:00 AM every day)
      if (minute === '0' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
        const targetHour = parseInt(hour, 10);
        nextRun = nextRun.set({ hour: targetHour, minute: 0, second: 0, millisecond: 0 });
        
        if (nextRun.toMillis() <= from.getTime()) {
          nextRun = nextRun.plus({ days: 1 });
        }
        
        return nextRun.toJSDate();
      }

      // Handle specific day of week: "0 9 * * 1" (9:00 AM every Monday)
      if (minute === '0' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
        const targetHour = parseInt(hour, 10);
        const targetDayOfWeek = parseInt(dayOfWeek, 10);
        
        nextRun = nextRun.set({ hour: targetHour, minute: 0, second: 0, millisecond: 0 });
        
        // Find next occurrence of target day
        let daysToAdd = (targetDayOfWeek - nextRun.weekday + 7) % 7;
        if (daysToAdd === 0 && nextRun.toMillis() <= from.getTime()) {
          daysToAdd = 7;
        }
        
        nextRun = nextRun.plus({ days: daysToAdd });
        return nextRun.toJSDate();
      }

      return null;
    } catch (error) {
      this.fastify.log.error({ err: error, cronExpression }, 'Failed to parse cron expression');
      return null;
    }
  }

  /**
   * Persist task to Redis
   */
  private async persistTask(task: ScheduledTask): Promise<void> {
    const redisKey = `${this.redisKeyPrefix}${task.eventId}`;
    const taskData = {
      ...task,
      // Don't persist timeoutId as it's not serializable
      timeoutId: undefined,
    };
    
    await this.fastify.redis.set(
      redisKey,
      JSON.stringify(taskData),
      'EX',
      86400 * 7 // 7 days TTL
    );
  }

  /**
   * Update scheduler status in Redis
   */
  private async updateStatus(): Promise<void> {
    const status = {
      activeSchedules: this.tasks.size,
      lastUpdatedIso: new Date().toISOString(),
    };
    
    await this.fastify.redis.set(
      this.redisStatusKey,
      JSON.stringify(status),
      'EX',
      300 // 5 minutes TTL
    );
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Convert ScheduledTask to SchedulerEvent
   */
  private toSchedulerEvent(task: ScheduledTask): SchedulerEvent {
    return {
      eventId: task.eventId,
      taskType: task.taskType,
      scheduleExpression: task.scheduleExpression,
      payload: task.payload,
      isRecurring: task.isRecurring,
      nextRunAtIso: task.nextRunAt.toISOString(),
      lastRunAtIso: task.lastRunAt?.toISOString(),
      createdAtIso: task.createdAt.toISOString(),
    };
  }
}
