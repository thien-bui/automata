export type DateKey = `${number}${number}${number}${number}-${number}${number}-${number}${number}`;

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ONE_DAY_MS = 86_400_000;

/**
 * Determine if a value is a valid YYYY-MM-DD date key.
 */
export function isValidDateKey(value: string): value is DateKey {
  if (!DATE_KEY_REGEX.test(value)) {
    return false;
  }

  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);

  const candidate = new Date(year, month, day);
  return (
    candidate.getFullYear() === year &&
    candidate.getMonth() === month &&
    candidate.getDate() === day
  );
}

/**
 * Format a Date instance as a YYYY-MM-DD key anchored to local time.
 */
export function formatDateKey(date: Date): DateKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const candidate = `${year}-${month}-${day}`;

  if (!isValidDateKey(candidate)) {
    throw new Error(`Invalid formatted date key: ${candidate}`);
  }

  return candidate;
}

/**
 * Convert a date key into a Date set to the local start of the day.
 */
export function parseDateKey(dateKey: DateKey): Date {
  if (!isValidDateKey(dateKey)) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  const [yearStr, monthStr, dayStr] = dateKey.split('-');
  return new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
}

/**
 * Return today's date key in local time.
 */
export function getTodayDateKey(): DateKey {
  return formatDateKey(new Date());
}

/**
 * Add the provided number of days to a date without mutating the original.
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Produce a friendly label for a date key relative to a reference date.
 */
export function getFriendlyDateLabel(dateKey: DateKey, reference: Date = new Date()): string {
  const target = parseDateKey(dateKey);
  const referenceStart = new Date(reference.getFullYear(), reference.getMonth(), reference.getDate());

  const diffDays = Math.round((target.getTime() - referenceStart.getTime()) / ONE_DAY_MS);

  if (diffDays === 0) {
    return 'Today';
  }

  if (diffDays === 1) {
    return 'Tomorrow';
  }

  return target.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
