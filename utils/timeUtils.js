/**
 * Time utilities for theory lesson scheduling
 * Works alongside dateHelpers.js for complete date/time handling
 */

import { createAppDate, createDateWithTime } from './dateHelpers.js';

/**
 * Convert time string to minutes from midnight
 * @param {string} timeString - Time in HH:MM format
 * @returns {number} Minutes from midnight
 */
const timeToMinutes = (timeString) => {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * Check if two time ranges overlap
 * @param {string} start1 - Start time of first range (HH:MM)
 * @param {string} end1 - End time of first range (HH:MM)
 * @param {string} start2 - Start time of second range (HH:MM)
 * @param {string} end2 - End time of second range (HH:MM)
 * @returns {boolean} True if ranges overlap
 */
const doTimesOverlap = (start1, end1, start2, end2) => {
  const start1Minutes = timeToMinutes(start1);
  const end1Minutes = timeToMinutes(end1);
  const start2Minutes = timeToMinutes(start2);
  const end2Minutes = timeToMinutes(end2);
  
  // Check for overlap: range1 starts before range2 ends AND range1 ends after range2 starts
  return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
};

/**
 * Validate time format (HH:MM)
 * @param {string} time - Time string to validate
 * @returns {boolean} True if valid format
 */
const isValidTimeFormat = (time) => {
  const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
  return timePattern.test(time);
};

/**
 * Check if start time is before end time
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {boolean} True if start is before end
 */
const isValidTimeRange = (startTime, endTime) => {
  return timeToMinutes(startTime) < timeToMinutes(endTime);
};

/**
 * Format time for display
 * @param {string} time - Time in HH:MM format
 * @returns {string} Formatted time
 */
const formatTime = (time) => {
  const [hours, minutes] = time.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
};

/**
 * Get time range description
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {string} Time range description
 */
const getTimeRangeDescription = (startTime, endTime) => {
  return `${formatTime(startTime)}-${formatTime(endTime)}`;
};

/**
 * Create a timezone-aware datetime by combining a date and time
 * @param {string|Date|dayjs} date - Date part
 * @param {string} time - Time in HH:MM format
 * @returns {Date} UTC Date for database storage
 */
const combineDateTime = (date, time) => {
  if (!isValidTimeFormat(time)) {
    throw new Error('Invalid time format. Expected HH:MM');
  }
  return createDateWithTime(date, time);
};

/**
 * Check if a time falls within a time range
 * @param {string} time - Time to check (HH:MM)
 * @param {string} rangeStart - Range start time (HH:MM)
 * @param {string} rangeEnd - Range end time (HH:MM)
 * @returns {boolean} True if time is within range
 */
const isTimeInRange = (time, rangeStart, rangeEnd) => {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(rangeStart);
  const endMinutes = timeToMinutes(rangeEnd);
  
  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
};

/**
 * Calculate duration between two times in minutes
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @returns {number} Duration in minutes
 */
const getTimeDuration = (startTime, endTime) => {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
};

/**
 * Add minutes to a time string
 * @param {string} time - Base time (HH:MM)
 * @param {number} minutes - Minutes to add
 * @returns {string} New time (HH:MM)
 */
const addMinutesToTime = (time, minutes) => {
  const totalMinutes = timeToMinutes(time) + minutes;
  const hours = Math.floor(totalMinutes / 60) % 24;
  const mins = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

/**
 * Validate that lesson times are during business hours
 * @param {string} startTime - Start time (HH:MM)
 * @param {string} endTime - End time (HH:MM)
 * @param {Object} businessHours - Business hours config
 * @returns {boolean} True if within business hours
 */
const isWithinBusinessHours = (startTime, endTime, businessHours = { start: '08:00', end: '22:00' }) => {
  return isTimeInRange(startTime, businessHours.start, businessHours.end) &&
         isTimeInRange(endTime, businessHours.start, businessHours.end);
};

export {
  timeToMinutes,
  doTimesOverlap,
  isValidTimeFormat,
  isValidTimeRange,
  formatTime,
  getTimeRangeDescription,
  combineDateTime,
  isTimeInRange,
  getTimeDuration,
  addMinutesToTime,
  isWithinBusinessHours
};