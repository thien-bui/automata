/**
 * Tests for midnight scheduler utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getMsUntilMidnight,
  getMsUntilTime,
  scheduleMidnightTask,
  scheduleDailyTask,
} from '../midnightScheduler';

describe('midnightScheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getMsUntilMidnight', () => {
    it('should return positive milliseconds until next midnight', () => {
      // Set current time to 2023-01-01 10:30:00
      const mockDate = new Date(2023, 0, 1, 10, 30, 0);
      vi.setSystemTime(mockDate);

      const msUntilMidnight = getMsUntilMidnight();
      
      // Should be 13.5 hours until midnight (10:30 to 00:00 next day)
      // 13.5 hours = 13 * 60 * 60 * 1000 + 30 * 60 * 1000 = 48,600,000ms
      expect(msUntilMidnight).toBe(13.5 * 60 * 60 * 1000);
    });

    it('should handle time close to midnight correctly', () => {
      // Set current time to 2023-01-01 23:59:59
      const mockDate = new Date(2023, 0, 1, 23, 59, 59);
      vi.setSystemTime(mockDate);

      const msUntilMidnight = getMsUntilMidnight();
      
      // Should be 1 second until midnight
      expect(msUntilMidnight).toBe(1000);
    });

    it('should handle time exactly at midnight correctly', () => {
      // Set current time to 2023-01-01 00:00:00
      const mockDate = new Date(2023, 0, 1, 0, 0, 0);
      vi.setSystemTime(mockDate);

      const msUntilMidnight = getMsUntilMidnight();
      
      // Should be 24 hours until next midnight
      expect(msUntilMidnight).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('getMsUntilTime', () => {
    it('should return milliseconds until specified time later today', () => {
      // Set current time to 2023-01-01 10:30:00
      const mockDate = new Date(2023, 0, 1, 10, 30, 0);
      vi.setSystemTime(mockDate);

      const msUntilTime = getMsUntilTime(14, 30, 0); // 2:30 PM
      
      // Should be 4 hours until 2:30 PM
      expect(msUntilTime).toBe(4 * 60 * 60 * 1000);
    });

    it('should return milliseconds until specified time tomorrow if time has passed', () => {
      // Set current time to 2023-01-01 16:30:00
      const mockDate = new Date(2023, 0, 1, 16, 30, 0);
      vi.setSystemTime(mockDate);

      const msUntilTime = getMsUntilTime(14, 30, 0); // 2:30 PM
      
      // Should be 22 hours until 2:30 PM tomorrow
      expect(msUntilTime).toBe(22 * 60 * 60 * 1000);
    });

    it('should handle exact time match', () => {
      // Set current time to 2023-01-01 14:30:00
      const mockDate = new Date(2023, 0, 1, 14, 30, 0);
      vi.setSystemTime(mockDate);

      const msUntilTime = getMsUntilTime(14, 30, 0); // 2:30 PM
      
      // Should be 24 hours until same time tomorrow
      expect(msUntilTime).toBe(24 * 60 * 60 * 1000);
    });

    it('should use default values when parameters are not provided', () => {
      // Set current time to 2023-01-01 10:30:00
      const mockDate = new Date(2023, 0, 1, 10, 30, 0);
      vi.setSystemTime(mockDate);

      const msUntilTime = getMsUntilTime(); // Should default to 00:00:00
      
      // Should be 13.5 hours until midnight
      expect(msUntilTime).toBe(13.5 * 60 * 60 * 1000);
    });
  });

  describe('scheduleMidnightTask', () => {
    it('should schedule callback to run at midnight', () => {
      const callback = vi.fn();
      
      // Set current time to 2023-01-01 10:30:00
      const mockDate = new Date(2023, 0, 1, 10, 30, 0);
      vi.setSystemTime(mockDate);

      const cleanup = scheduleMidnightTask(callback);
      
      // Callback should not be called immediately
      expect(callback).not.toHaveBeenCalled();
      
      // Fast-forward time to midnight
      vi.advanceTimersByTime(13.5 * 60 * 60 * 1000);
      
      // Callback should now be called once
      expect(callback).toHaveBeenCalledTimes(1);
      
      // Cleanup should stop further calls
      cleanup();
      
      // Fast-forward another day
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      
      // Callback should still only be called once
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should schedule callback to run every day at midnight', () => {
      const callback = vi.fn();
      
      // Set current time to 2023-01-01 10:30:00
      const mockDate = new Date(2023, 0, 1, 10, 30, 0);
      vi.setSystemTime(mockDate);

      scheduleMidnightTask(callback);
      
      // Fast-forward to first midnight
      vi.advanceTimersByTime(13.5 * 60 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
      
      // Fast-forward another day
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(2);
      
      // Fast-forward another day
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(3);
    });
  });

  describe('scheduleDailyTask', () => {
    it('should schedule callback to run at specified time', () => {
      const callback = vi.fn();
      
      // Set current time to 2023-01-01 10:30:00
      const mockDate = new Date(2023, 0, 1, 10, 30, 0);
      vi.setSystemTime(mockDate);

      const cleanup = scheduleDailyTask(callback, 14, 30, 0); // 2:30 PM
      
      // Callback should not be called immediately
      expect(callback).not.toHaveBeenCalled();
      
      // Fast-forward time to 2:30 PM
      vi.advanceTimersByTime(4 * 60 * 60 * 1000);
      
      // Callback should now be called once
      expect(callback).toHaveBeenCalledTimes(1);
      
      // Cleanup should stop further calls
      cleanup();
      
      // Fast-forward another day
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      
      // Callback should still only be called once
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should schedule callback to run every day at specified time', () => {
      const callback = vi.fn();
      
      // Set current time to 2023-01-01 10:30:00
      const mockDate = new Date(2023, 0, 1, 10, 30, 0);
      vi.setSystemTime(mockDate);

      scheduleDailyTask(callback, 14, 30, 0); // 2:30 PM
      
      // Fast-forward to first 2:30 PM
      vi.advanceTimersByTime(4 * 60 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(1);
      
      // Fast-forward another day
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(2);
      
      // Fast-forward another day
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('should handle time that has already passed today', () => {
      const callback = vi.fn();
      
      // Set current time to 2023-01-01 16:30:00
      const mockDate = new Date(2023, 0, 1, 16, 30, 0);
      vi.setSystemTime(mockDate);

      scheduleDailyTask(callback, 14, 30, 0); // 2:30 PM
      
      // Fast-forward to next day's 2:30 PM (22 hours from now)
      vi.advanceTimersByTime(22 * 60 * 60 * 1000);
      
      // Callback should now be called once
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });
});
