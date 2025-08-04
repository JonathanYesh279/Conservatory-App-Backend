/**
 * Unit tests for date helper utilities
 */

import { describe, test, expect, beforeAll } from 'vitest';
import {
  createAppDate,
  toUTC,
  fromUTC,
  getStartOfDay,
  getEndOfDay,
  isValidDate,
  formatDate,
  formatDateTime,
  parseDate,
  isSameDay,
  now,
  today,
  addTime,
  subtractTime,
  isBefore,
  isAfter,
  diff,
  getDayOfWeek,
  generateDatesForDayOfWeek,
  validateDateRange,
  toISOString,
  toNativeDate,
  createDateWithTime,
  getAppTimezone
} from '../../utils/dateHelpers.js';

describe('Date Helpers', () => {
  beforeAll(() => {
    // Ensure timezone is set for tests
    process.env.APP_TIMEZONE = 'Asia/Jerusalem';
  });

  describe('Configuration', () => {
    test('should return correct app timezone', () => {
      expect(getAppTimezone()).toBe('Asia/Jerusalem');
    });
  });

  describe('Date Creation', () => {
    test('should create app date with timezone', () => {
      const date = createAppDate('2025-08-02');
      expect(date.format('YYYY-MM-DD')).toBe('2025-08-02');
      expect(date.isValid()).toBe(true);
      // Check that timezone offset is correct for Asia/Jerusalem (UTC+2/+3)
      expect(Math.abs(date.utcOffset())).toBeGreaterThanOrEqual(120);
    });

    test('should create current date when no input provided', () => {
      const date = createAppDate();
      expect(date.isValid()).toBe(true);
      expect(Math.abs(date.utcOffset())).toBeGreaterThanOrEqual(120);
    });

    test('should get current date in app timezone', () => {
      const currentDate = now();
      expect(currentDate.isValid()).toBe(true);
      expect(Math.abs(currentDate.utcOffset())).toBeGreaterThanOrEqual(120);
    });

    test('should get today at start of day', () => {
      const todayStart = today();
      expect(todayStart).toBeInstanceOf(Date);
    });
  });

  describe('UTC Conversion', () => {
    test('should convert to UTC for database storage', () => {
      const appDate = createAppDate('2025-08-02 14:30');
      const utcDate = toUTC(appDate);
      
      expect(utcDate).toBeInstanceOf(Date);
      expect(utcDate.getUTCFullYear()).toBe(2025);
      expect(utcDate.getUTCMonth()).toBe(7); // August is month 7 (0-indexed)
      expect(utcDate.getUTCDate()).toBe(2);
    });

    test('should convert from UTC to app timezone', () => {
      const utcDate = new Date('2025-08-02T12:30:00.000Z');
      const appDate = fromUTC(utcDate);
      
      expect(appDate.isValid()).toBe(true);
      expect(Math.abs(appDate.utcOffset())).toBeGreaterThanOrEqual(120);
    });
  });

  describe('Day Boundaries', () => {
    test('should get start of day in app timezone', () => {
      const startOfDay = getStartOfDay('2025-08-02');
      expect(startOfDay).toBeInstanceOf(Date);
    });

    test('should get end of day in app timezone', () => {
      const endOfDay = getEndOfDay('2025-08-02');
      expect(endOfDay).toBeInstanceOf(Date);
    });
  });

  describe('Date Validation', () => {
    test('should validate valid dates', () => {
      expect(isValidDate('2025-08-02')).toBe(true);
      expect(isValidDate('2025-08-02T14:30:00')).toBe(true);
      expect(isValidDate(new Date())).toBe(true);
    });

    test('should reject invalid dates', () => {
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('not-a-date')).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
      expect(isValidDate('')).toBe(false);
    });

    test('should validate date ranges', () => {
      const validRange = validateDateRange('2025-08-01', '2025-08-31');
      expect(validRange.valid).toBe(true);

      const invalidRange = validateDateRange('2025-08-31', '2025-08-01');
      expect(invalidRange.valid).toBe(false);
      expect(invalidRange.error).toBe('Start date must be before or equal to end date');

      const emptyRange = validateDateRange(null, null);
      expect(emptyRange.valid).toBe(true);
    });
  });

  describe('Date Formatting', () => {
    test('should format date correctly', () => {
      const formatted = formatDate('2025-08-02', 'DD/MM/YYYY');
      expect(formatted).toBe('02/08/2025');
    });

    test('should format datetime correctly', () => {
      const formatted = formatDateTime('2025-08-02T14:30:00', 'DD/MM/YYYY HH:mm');
      expect(formatted).toMatch(/02\/08\/2025 \d{2}:\d{2}/);
    });

    test('should use default formats', () => {
      const dateFormatted = formatDate('2025-08-02');
      expect(dateFormatted).toBe('2025-08-02');

      const dateTimeFormatted = formatDateTime('2025-08-02T14:30:00');
      expect(dateTimeFormatted).toMatch(/2025-08-02 \d{2}:\d{2}/);
    });
  });

  describe('Date Parsing', () => {
    test('should parse date strings', () => {
      const parsed = parseDate('2025-08-02');
      expect(parsed.format('YYYY-MM-DD')).toBe('2025-08-02');
      expect(parsed.isValid()).toBe(true);
      expect(Math.abs(parsed.utcOffset())).toBeGreaterThanOrEqual(120);
    });

    test('should parse with custom format', () => {
      const parsed = parseDate('02/08/2025', 'DD/MM/YYYY');
      expect(parsed.format('YYYY-MM-DD')).toBe('2025-08-02');
    });
  });

  describe('Date Comparison', () => {
    test('should check if same day', () => {
      expect(isSameDay('2025-08-02T10:00:00', '2025-08-02T18:00:00')).toBe(true);
      expect(isSameDay('2025-08-02', '2025-08-03')).toBe(false);
    });

    test('should check before/after', () => {
      expect(isBefore('2025-08-01', '2025-08-02')).toBe(true);
      expect(isAfter('2025-08-02', '2025-08-01')).toBe(true);
      expect(isBefore('2025-08-02', '2025-08-01')).toBe(false);
    });

    test('should calculate difference', () => {
      const diffDays = diff('2025-08-02', '2025-08-01', 'day');
      expect(diffDays).toBe(1);

      const diffHours = diff('2025-08-02T14:00:00', '2025-08-02T12:00:00', 'hour');
      expect(diffHours).toBe(2);
    });
  });

  describe('Date Arithmetic', () => {
    test('should add time correctly', () => {
      const original = createAppDate('2025-08-02');
      const added = addTime(original, 7, 'day');
      expect(added.format('YYYY-MM-DD')).toBe('2025-08-09');
    });

    test('should subtract time correctly', () => {
      const original = createAppDate('2025-08-02');
      const subtracted = subtractTime(original, 2, 'day');
      expect(subtracted.format('YYYY-MM-DD')).toBe('2025-07-31');
    });
  });

  describe('Day of Week', () => {
    test('should get correct day of week', () => {
      // 2025-08-02 is a Saturday
      const dayOfWeek = getDayOfWeek('2025-08-02');
      expect(dayOfWeek).toBe(6); // Saturday = 6
    });
  });

  describe('Date Generation', () => {
    test('should generate weekly recurring dates', () => {
      // Generate Mondays between Aug 4 and Aug 25, 2025
      const dates = generateDatesForDayOfWeek(
        '2025-08-04', // Monday
        '2025-08-25', // Monday
        1, // Monday
        []
      );

      expect(dates).toHaveLength(4); // 4 Mondays in range
      expect(dates[0]).toBeInstanceOf(Date);
    });

    test('should exclude specified dates', () => {
      const dates = generateDatesForDayOfWeek(
        '2025-08-04', // Monday
        '2025-08-25', // Monday
        1, // Monday
        ['2025-08-11'] // Exclude second Monday
      );

      expect(dates).toHaveLength(3); // 3 Mondays (one excluded)
    });

    test('should handle edge cases', () => {
      // Start date is after target day of week
      const dates = generateDatesForDayOfWeek(
        '2025-08-07', // Thursday
        '2025-08-25', // Monday
        1, // Monday
        []
      );

      expect(dates).toHaveLength(3); // Should find next Monday and continue
    });
  });

  describe('Utility Functions', () => {
    test('should convert to ISO string', () => {
      const isoString = toISOString('2025-08-02T14:30:00');
      expect(isoString).toMatch(/2025-08-02T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}/);
    });

    test('should convert to native Date', () => {
      const nativeDate = toNativeDate('2025-08-02');
      expect(nativeDate).toBeInstanceOf(Date);
    });

    test('should create date with specific time', () => {
      const dateWithTime = createDateWithTime('2025-08-02', '14:30');
      expect(dateWithTime).toBeInstanceOf(Date);
      
      // Convert back to check time
      const appDate = fromUTC(dateWithTime);
      expect(appDate.format('HH:mm')).toBe('14:30');
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined inputs gracefully', () => {
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
      expect(isValidDate('')).toBe(false);
      
      const currentDate = createAppDate(null);
      expect(currentDate.isValid()).toBe(true);
    });

    test('should handle timezone transitions', () => {
      // Test around DST transition (example)
      const beforeDST = createAppDate('2025-03-28'); // Before DST in Israel
      const afterDST = createAppDate('2025-03-30'); // After DST in Israel
      
      expect(beforeDST.isValid()).toBe(true);
      expect(afterDST.isValid()).toBe(true);
    });
  });
});