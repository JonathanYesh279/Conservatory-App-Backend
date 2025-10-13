/**
 * Date validation middleware for the conservatory app
 * Provides consistent date validation and normalization across all routes
 */

import { 
  isValidDate, 
  validateDateRange, 
  toUTC, 
  createAppDate,
  parseDate,
  isBefore,
  isAfter,
  now
} from '../utils/dateHelpers.js';

/**
 * Validate and normalize date fields in request body
 * @param {Array<string>} dateFields - Array of field names that contain dates
 * @param {Object} options - Validation options
 * @param {boolean} options.required - Whether date fields are required
 * @param {boolean} options.allowFuture - Whether future dates are allowed
 * @param {boolean} options.allowPast - Whether past dates are allowed
 * @param {number} options.maxFutureDays - Maximum days in the future allowed
 * @param {number} options.maxPastDays - Maximum days in the past allowed
 */
export const validateDates = (dateFields = [], options = {}) => {
  const {
    required = false,
    allowFuture = true,
    allowPast = true,
    maxFutureDays = null,
    maxPastDays = null
  } = options;

  return (req, res, next) => {
    const errors = [];
    const currentDate = now();

    for (const fieldName of dateFields) {
      const dateValue = req.body[fieldName];

      // Check if required field is missing
      if (required && (!dateValue || dateValue === '')) {
        errors.push(`${fieldName} is required`);
        continue;
      }

      // Skip validation if field is empty and not required
      if (!dateValue || dateValue === '') {
        continue;
      }

      // Validate date format
      if (!isValidDate(dateValue)) {
        errors.push(`${fieldName} must be a valid date`);
        continue;
      }

      const parsedDate = createAppDate(dateValue);

      // Check future date restrictions
      if (!allowFuture && isAfter(parsedDate, currentDate)) {
        errors.push(`${fieldName} cannot be in the future`);
        continue;
      }

      // Check past date restrictions
      if (!allowPast && isBefore(parsedDate, currentDate)) {
        errors.push(`${fieldName} cannot be in the past`);
        continue;
      }

      // Check maximum future days
      if (maxFutureDays && isAfter(parsedDate, currentDate)) {
        const futureLimit = currentDate.add(maxFutureDays, 'day');
        if (isAfter(parsedDate, futureLimit)) {
          errors.push(`${fieldName} cannot be more than ${maxFutureDays} days in the future`);
          continue;
        }
      }

      // Check maximum past days
      if (maxPastDays && isBefore(parsedDate, currentDate)) {
        const pastLimit = currentDate.subtract(maxPastDays, 'day');
        if (isBefore(parsedDate, pastLimit)) {
          errors.push(`${fieldName} cannot be more than ${maxPastDays} days in the past`);
          continue;
        }
      }

      // Normalize date to UTC for database storage
      req.body[fieldName] = toUTC(parsedDate);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Date validation failed',
        errors: errors
      });
    }

    next();
  };
};

/**
 * Validate date range in request body
 * @param {string} startDateField - Name of start date field
 * @param {string} endDateField - Name of end date field
 * @param {Object} options - Validation options
 */
export const validateDateRangeMiddleware = (startDateField, endDateField, options = {}) => {
  const { required = false, maxRangeDays = null } = options;

  return (req, res, next) => {
    const startDate = req.body[startDateField];
    const endDate = req.body[endDateField];
    const errors = [];

    // Check if required fields are missing
    if (required) {
      if (!startDate || startDate === '') {
        errors.push(`${startDateField} is required`);
      }
      if (!endDate || endDate === '') {
        errors.push(`${endDateField} is required`);
      }
    }

    // If either date is missing and not required, skip validation
    if ((!startDate || startDate === '') || (!endDate || endDate === '')) {
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Date validation failed',
          errors: errors
        });
      }
      return next();
    }

    // Validate individual dates
    if (!isValidDate(startDate)) {
      errors.push(`${startDateField} must be a valid date`);
    }
    if (!isValidDate(endDate)) {
      errors.push(`${endDateField} must be a valid date`);
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Date validation failed',
        errors: errors
      });
    }

    const parsedStartDate = createAppDate(startDate);
    const parsedEndDate = createAppDate(endDate);

    // Check date range validity
    const rangeValidation = validateDateRange(parsedStartDate, parsedEndDate);
    if (!rangeValidation.valid) {
      errors.push(rangeValidation.error);
    }

    // Check maximum range days
    if (maxRangeDays) {
      const daysDiff = parsedEndDate.diff(parsedStartDate, 'day');
      if (daysDiff > maxRangeDays) {
        errors.push(`Date range cannot exceed ${maxRangeDays} days`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Date range validation failed',
        errors: errors
      });
    }

    // Normalize dates to UTC
    req.body[startDateField] = toUTC(parsedStartDate);
    req.body[endDateField] = toUTC(parsedEndDate);

    next();
  };
};

/**
 * Validate lesson scheduling dates
 * Specific validation for theory lessons, rehearsals, and private lessons
 */
export const validateLessonDate = (req, res, next) => {
  const { date } = req.body;
  const errors = [];

  if (!date || date === '') {
    errors.push('Lesson date is required');
  } else if (!isValidDate(date)) {
    errors.push('Lesson date must be a valid date');
  } else {
    const lessonDate = createAppDate(date);
    const currentDate = now();

    // Lessons cannot be scheduled more than 1 year in the future
    const maxFutureDate = currentDate.add(1, 'year');
    if (isAfter(lessonDate, maxFutureDate)) {
      errors.push('Lessons cannot be scheduled more than 1 year in advance');
    }

    // Lessons cannot be scheduled more than 1 year in the past
    const maxPastDate = currentDate.subtract(1, 'year');
    if (isBefore(lessonDate, maxPastDate)) {
      errors.push('Cannot create lessons more than 1 year in the past');
    }

    // Normalize date to UTC for database storage
    req.body.date = toUTC(lessonDate);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Lesson date validation failed',
      errors: errors
    });
  }

  next();
};

/**
 * Validate bulk lesson creation dates
 */
export const validateBulkLessonDates = (req, res, next) => {
  const { startDate, endDate, excludeDates = [] } = req.body;
  const errors = [];

  // Validate start and end dates
  if (!startDate || startDate === '') {
    errors.push('Start date is required for bulk creation');
  } else if (!isValidDate(startDate)) {
    errors.push('Start date must be a valid date');
  }

  if (!endDate || endDate === '') {
    errors.push('End date is required for bulk creation');
  } else if (!isValidDate(endDate)) {
    errors.push('End date must be a valid date');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Bulk lesson date validation failed',
      errors: errors
    });
  }

  const parsedStartDate = createAppDate(startDate);
  const parsedEndDate = createAppDate(endDate);
  const currentDate = now();

  // Validate date range
  const rangeValidation = validateDateRange(parsedStartDate, parsedEndDate);
  if (!rangeValidation.valid) {
    errors.push(rangeValidation.error);
  }

  // Check maximum bulk creation range (1 year for full school year coverage)
  const daysDiff = parsedEndDate.diff(parsedStartDate, 'day');
  if (daysDiff > 365) {
    errors.push('Bulk creation range cannot exceed 1 year');
  }

  // Validate future date limit
  const maxFutureDate = currentDate.add(1, 'year');
  if (isAfter(parsedEndDate, maxFutureDate)) {
    errors.push('Bulk creation cannot extend more than 1 year in the future');
  }

  // Validate exclude dates
  const normalizedExcludeDates = [];
  for (let i = 0; i < excludeDates.length; i++) {
    const excludeDate = excludeDates[i];
    if (!isValidDate(excludeDate)) {
      errors.push(`Exclude date at index ${i} is not a valid date`);
    } else {
      normalizedExcludeDates.push(toUTC(createAppDate(excludeDate)));
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Bulk lesson date validation failed',
      errors: errors
    });
  }

  // Normalize dates to UTC
  req.body.startDate = toUTC(parsedStartDate);
  req.body.endDate = toUTC(parsedEndDate);
  req.body.excludeDates = normalizedExcludeDates;

  next();
};

/**
 * Validate attendance date
 */
export const validateAttendanceDate = (req, res, next) => {
  const { lessonDate } = req.body;
  
  if (!lessonDate) {
    return next(); // lessonDate is optional for attendance
  }

  const errors = [];

  if (!isValidDate(lessonDate)) {
    errors.push('Lesson date must be a valid date');
  } else {
    const parsedLessonDate = createAppDate(lessonDate);
    const currentDate = now();

    // Attendance cannot be marked for lessons more than 30 days in the future
    const maxFutureDate = currentDate.add(30, 'day');
    if (isAfter(parsedLessonDate, maxFutureDate)) {
      errors.push('Cannot mark attendance for lessons more than 30 days in the future');
    }

    // Attendance cannot be marked for lessons more than 1 year in the past
    const maxPastDate = currentDate.subtract(1, 'year');
    if (isBefore(parsedLessonDate, maxPastDate)) {
      errors.push('Cannot mark attendance for lessons more than 1 year in the past');
    }

    // Normalize date to UTC
    req.body.lessonDate = toUTC(parsedLessonDate);
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Attendance date validation failed',
      errors: errors
    });
  }

  next();
};