/**
 * Centralized date utilities for the conservatory app
 * Provides timezone-aware date handling and consistent date operations
 */

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter.js';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

// Extend dayjs with required plugins
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(customParseFormat);

// Application timezone configuration
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Jerusalem';

/**
 * Get the application's default timezone
 * @returns {string} Application timezone
 */
export const getAppTimezone = () => APP_TIMEZONE;

/**
 * Create a timezone-aware date from input
 * @param {string|Date|dayjs} input - Date input
 * @param {string} timezone - Target timezone (defaults to app timezone)
 * @returns {dayjs.Dayjs} Timezone-aware dayjs object
 */
export const createAppDate = (input = null, timezone = APP_TIMEZONE) => {
  if (input === null || input === undefined) {
    return dayjs().tz(timezone);
  }
  return dayjs.tz(input, timezone);
};

/**
 * Convert any date to UTC for database storage
 * @param {string|Date|dayjs} input - Date input
 * @returns {Date} UTC Date object for MongoDB storage
 */
export const toUTC = (input) => {
  return dayjs(input).utc().toDate();
};

/**
 * Convert UTC date from database to app timezone
 * @param {Date} utcDate - UTC date from database
 * @param {string} timezone - Target timezone (defaults to app timezone)
 * @returns {dayjs.Dayjs} Timezone-aware dayjs object
 */
export const fromUTC = (utcDate, timezone = APP_TIMEZONE) => {
  return dayjs(utcDate).tz(timezone);
};

/**
 * Get start of day in app timezone
 * @param {string|Date|dayjs} input - Date input
 * @returns {Date} Start of day as UTC Date for database queries
 */
export const getStartOfDay = (input) => {
  return createAppDate(input).startOf('day').utc().toDate();
};

/**
 * Get end of day in app timezone
 * @param {string|Date|dayjs} input - Date input
 * @returns {Date} End of day as UTC Date for database queries
 */
export const getEndOfDay = (input) => {
  return createAppDate(input).endOf('day').utc().toDate();
};

/**
 * Check if a date is valid
 * @param {any} input - Date input to validate
 * @returns {boolean} True if valid date
 */
export const isValidDate = (input) => {
  if (input === null || input === undefined || input === '') {
    return false;
  }
  return dayjs(input).isValid();
};

/**
 * Format date for display in app timezone
 * @param {string|Date|dayjs} input - Date input
 * @param {string} format - Format string (default: YYYY-MM-DD)
 * @param {string} timezone - Target timezone (defaults to app timezone)
 * @returns {string} Formatted date string
 */
export const formatDate = (input, format = 'YYYY-MM-DD', timezone = APP_TIMEZONE) => {
  return dayjs(input).tz(timezone).format(format);
};

/**
 * Format datetime for display in app timezone
 * @param {string|Date|dayjs} input - Date input
 * @param {string} format - Format string (default: YYYY-MM-DD HH:mm)
 * @param {string} timezone - Target timezone (defaults to app timezone)
 * @returns {string} Formatted datetime string
 */
export const formatDateTime = (input, format = 'YYYY-MM-DD HH:mm', timezone = APP_TIMEZONE) => {
  return dayjs(input).tz(timezone).format(format);
};

/**
 * Parse date string in app timezone
 * @param {string} dateString - Date string to parse
 * @param {string} format - Expected format (optional)
 * @param {string} timezone - Source timezone (defaults to app timezone)
 * @returns {dayjs.Dayjs} Parsed dayjs object
 */
export const parseDate = (dateString, format = null, timezone = APP_TIMEZONE) => {
  if (format) {
    return dayjs.tz(dateString, format, timezone);
  }
  return dayjs.tz(dateString, timezone);
};

/**
 * Check if two dates are the same day in app timezone
 * @param {string|Date|dayjs} date1 - First date
 * @param {string|Date|dayjs} date2 - Second date
 * @param {string} timezone - Timezone for comparison (defaults to app timezone)
 * @returns {boolean} True if same day
 */
export const isSameDay = (date1, date2, timezone = APP_TIMEZONE) => {
  const d1 = dayjs(date1).tz(timezone);
  const d2 = dayjs(date2).tz(timezone);
  return d1.format('YYYY-MM-DD') === d2.format('YYYY-MM-DD');
};

/**
 * Get current date in app timezone
 * @returns {dayjs.Dayjs} Current date in app timezone
 */
export const now = () => {
  return dayjs().tz(APP_TIMEZONE);
};

/**
 * Get today's date at start of day for database queries
 * @returns {Date} Today's start of day as UTC Date
 */
export const today = () => {
  return getStartOfDay(now());
};

/**
 * Add time to a date
 * @param {string|Date|dayjs} input - Base date
 * @param {number} amount - Amount to add
 * @param {string} unit - Unit to add (day, hour, minute, etc.)
 * @returns {dayjs.Dayjs} New date with time added
 */
export const addTime = (input, amount, unit) => {
  return createAppDate(input).add(amount, unit);
};

/**
 * Subtract time from a date
 * @param {string|Date|dayjs} input - Base date
 * @param {number} amount - Amount to subtract
 * @param {string} unit - Unit to subtract (day, hour, minute, etc.)
 * @returns {dayjs.Dayjs} New date with time subtracted
 */
export const subtractTime = (input, amount, unit) => {
  return createAppDate(input).subtract(amount, unit);
};

/**
 * Check if date is before another date
 * @param {string|Date|dayjs} date1 - Date to check
 * @param {string|Date|dayjs} date2 - Date to compare against
 * @returns {boolean} True if date1 is before date2
 */
export const isBefore = (date1, date2) => {
  return dayjs(date1).isBefore(dayjs(date2));
};

/**
 * Check if date is after another date
 * @param {string|Date|dayjs} date1 - Date to check
 * @param {string|Date|dayjs} date2 - Date to compare against
 * @returns {boolean} True if date1 is after date2
 */
export const isAfter = (date1, date2) => {
  return dayjs(date1).isAfter(dayjs(date2));
};

/**
 * Get difference between two dates
 * @param {string|Date|dayjs} date1 - First date
 * @param {string|Date|dayjs} date2 - Second date
 * @param {string} unit - Unit for difference (default: 'millisecond')
 * @returns {number} Difference between dates
 */
export const diff = (date1, date2, unit = 'millisecond') => {
  return dayjs(date1).diff(dayjs(date2), unit);
};

/**
 * Get day of week (0 = Sunday, 6 = Saturday) in app timezone
 * @param {string|Date|dayjs} input - Date input
 * @param {string} timezone - Timezone (defaults to app timezone)
 * @returns {number} Day of week
 */
export const getDayOfWeek = (input, timezone = APP_TIMEZONE) => {
  return dayjs(input).tz(timezone).day();
};

/**
 * Generate dates for a specific day of week within a date range
 * @param {string|Date|dayjs} startDate - Range start date
 * @param {string|Date|dayjs} endDate - Range end date
 * @param {number} dayOfWeek - Day of week (0 = Sunday, 6 = Saturday)
 * @param {Array<string|Date|dayjs>} excludeDates - Dates to exclude
 * @returns {Array<Date>} Array of UTC dates for database storage
 */
export const generateDatesForDayOfWeek = (startDate, endDate, dayOfWeek, excludeDates = []) => {
  const dates = [];
  const start = createAppDate(startDate);
  const end = createAppDate(endDate);

  // Find first occurrence of the specified day of week
  let current = start.clone();
  const daysToAdd = (dayOfWeek - current.day() + 7) % 7;
  current = current.add(daysToAdd, 'day');

  // Convert exclude dates to comparable format
  const excludeSet = new Set(
    excludeDates.map(date => createAppDate(date).format('YYYY-MM-DD'))
  );

  // Generate weekly recurring dates
  while (current.isSameOrBefore(end, 'day')) {
    const dateString = current.format('YYYY-MM-DD');

    if (!excludeSet.has(dateString)) {
      // CRITICAL FIX: Set time to noon (12:00) before converting to UTC
      // This prevents the date from shifting to the previous day when
      // midnight in Israel time (UTC+2/+3) converts to the previous day in UTC.
      // Example: Oct 26 00:00 Israel = Oct 25 22:00 UTC (wrong day!)
      //          Oct 26 12:00 Israel = Oct 26 10:00 UTC (correct day!)
      const noonDate = current.hour(12).minute(0).second(0).millisecond(0);
      dates.push(toUTC(noonDate));
    }

    current = current.add(7, 'day');
  }

  return dates;
};

/**
 * Validate date range
 * @param {string|Date|dayjs} startDate - Start date
 * @param {string|Date|dayjs} endDate - End date
 * @returns {Object} Validation result with valid flag and error message
 */
export const validateDateRange = (startDate, endDate) => {
  if (!startDate && !endDate) {
    return { valid: true };
  }
  
  if (!isValidDate(startDate) || !isValidDate(endDate)) {
    return { 
      valid: false, 
      error: 'Invalid date format' 
    };
  }
  
  if (isAfter(startDate, endDate)) {
    return { 
      valid: false, 
      error: 'Start date must be before or equal to end date' 
    };
  }
  
  return { valid: true };
};

/**
 * Convert date to ISO string in app timezone
 * @param {string|Date|dayjs} input - Date input
 * @param {string} timezone - Timezone (defaults to app timezone)
 * @returns {string} ISO string in specified timezone
 */
export const toISOString = (input, timezone = APP_TIMEZONE) => {
  return dayjs(input).tz(timezone).format();
};

/**
 * Legacy compatibility: Convert to native Date object
 * @param {string|Date|dayjs} input - Date input
 * @returns {Date} Native JavaScript Date object
 */
export const toNativeDate = (input) => {
  return dayjs(input).toDate();
};

/**
 * Create date with specific time in app timezone
 * @param {string|Date|dayjs} date - Base date
 * @param {string} time - Time in HH:MM format
 * @param {string} timezone - Timezone (defaults to app timezone)
 * @returns {Date} UTC Date for database storage
 */
export const createDateWithTime = (date, time, timezone = APP_TIMEZONE) => {
  const [hours, minutes] = time.split(':').map(Number);
  return createAppDate(date, timezone)
    .hour(hours)
    .minute(minutes)
    .second(0)
    .millisecond(0)
    .utc()
    .toDate();
};