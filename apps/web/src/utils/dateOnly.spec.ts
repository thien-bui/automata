import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  formatDateKey,
  getFriendlyDateLabel,
  getTodayDateKey,
  isValidDateKey,
  parseDateKey,
} from './dateOnly';

describe('dateOnly utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('validates YYYY-MM-DD date keys', () => {
    expect(isValidDateKey('2024-04-15')).toBe(true);
    expect(isValidDateKey('2024-13-01')).toBe(false);
    expect(isValidDateKey('2024-02-30')).toBe(false);
    expect(isValidDateKey('20240415')).toBe(false);
  });

  it('formats dates as YYYY-MM-DD keys anchored to local time', () => {
    const date = new Date(2024, 0, 5, 12, 30);
    expect(formatDateKey(date)).toBe('2024-01-05');
  });

  it('parses date keys into local start-of-day Date instances', () => {
    const parsed = parseDateKey('2024-06-20');
    expect(parsed.getFullYear()).toBe(2024);
    expect(parsed.getMonth()).toBe(5);
    expect(parsed.getDate()).toBe(20);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
  });

  it('adds days without mutating the original date', () => {
    const original = new Date(2024, 3, 1);
    const updated = addDays(original, 3);

    expect(updated.getDate()).toBe(4);
    expect(original.getDate()).toBe(1);
  });

  it('returns Today or Tomorrow labels for near-term dates', () => {
    const reference = new Date(2024, 3, 10, 9, 0); // April 10 (month is zero-indexed)
    vi.setSystemTime(reference);

    expect(getFriendlyDateLabel('2024-04-10', reference)).toBe('Today');
    expect(getFriendlyDateLabel('2024-04-11', reference)).toBe('Tomorrow');
  });

  it('derives today date keys from system time', () => {
    vi.setSystemTime(new Date(2024, 6, 4, 15, 0)); // July 4, 2024
    expect(getTodayDateKey()).toBe('2024-07-04');
  });
});
