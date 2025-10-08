import { isDate } from 'util/types';

export function isValidTimeZone(timezone: unknown): timezone is string {
  if (typeof timezone !== 'string' || !timezone.trim()) {
    return false;
  }

  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

export function convertDateToUserTimezone(date: Date | string, timezone?: string): Date {
  if (!timezone || !isValidTimeZone(timezone)) {
    return new Date(date);
  }

  const referenceDate = typeof date === 'string' ? new Date(date) : date;
  if (!isDate(referenceDate)) {
    throw new Error('Invalid date supplied for conversion');
  }

  const zoned = referenceDate.toLocaleString('en-US', { timeZone: timezone });
  return new Date(zoned);
}
