import { isValidDate, createAppDate } from '../utils/dateHelpers.js';

/**
 * Validate past activities query parameters
 */
export function validatePastActivitiesQuery(req, res, next) {
  try {
    const { type, teacherId, startDate, endDate, limit, page } = req.query;
    const errors = [];

    // Validate activity type
    if (type && !['all', 'rehearsals', 'theory', 'private-lessons'].includes(type)) {
      errors.push('Invalid activity type. Supported types: all, rehearsals, theory, private-lessons');
    }

    // Validate teacherId for private lessons
    if (type === 'private-lessons' && !teacherId) {
      errors.push('teacherId is required when filtering private lessons');
    }

    // Validate teacherId format if provided
    if (teacherId && !isValidObjectId(teacherId)) {
      errors.push('Invalid teacherId format');
    }

    // Validate date formats
    if (startDate && !isValidDateString(startDate)) {
      errors.push('Invalid startDate format. Use YYYY-MM-DD');
    }

    if (endDate && !isValidDateString(endDate)) {
      errors.push('Invalid endDate format. Use YYYY-MM-DD');
    }

    // Validate date range
    if (startDate && endDate) {
      const start = createAppDate(startDate);
      const end = createAppDate(endDate);
      if (start > end) {
        errors.push('startDate must be before or equal to endDate');
      }
    }

    // Validate pagination parameters
    if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 1000)) {
      errors.push('limit must be a positive integer between 1 and 1000');
    }

    if (page && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
      errors.push('page must be a positive integer starting from 1');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    next();
  } catch (err) {
    console.error(`Past activities validation error: ${err.message}`);
    return res.status(500).json({
      error: 'Internal server error during validation'
    });
  }
}

/**
 * Validate past activities by type route parameters
 */
export function validatePastActivitiesByType(req, res, next) {
  try {
    const { type } = req.params;
    const { teacherId, studentId, orchestraId } = req.query;
    const errors = [];

    // Validate activity type parameter
    if (!['rehearsals', 'theory', 'private-lessons'].includes(type)) {
      errors.push('Invalid activity type. Supported types: rehearsals, theory, private-lessons');
    }

    // Validate required parameters for specific types
    if (type === 'private-lessons' && !teacherId) {
      errors.push('teacherId is required when filtering private lessons');
    }

    // Validate ObjectId formats
    if (teacherId && !isValidObjectId(teacherId)) {
      errors.push('Invalid teacherId format');
    }

    if (studentId && !isValidObjectId(studentId)) {
      errors.push('Invalid studentId format');
    }

    if (orchestraId && !isValidObjectId(orchestraId)) {
      errors.push('Invalid orchestraId format');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    // Continue with general query validation
    validatePastActivitiesQuery(req, res, next);
  } catch (err) {
    console.error(`Past activities by type validation error: ${err.message}`);
    return res.status(500).json({
      error: 'Internal server error during validation'
    });
  }
}

/**
 * Helper function to validate ObjectId format
 */
function isValidObjectId(id) {
  if (typeof id !== 'string') return false;
  return /^[0-9a-fA-F]{24}$/.test(id);
}

/**
 * Helper function to validate date string format (YYYY-MM-DD)
 */
function isValidDateString(dateString) {
  if (typeof dateString !== 'string') return false;
  
  // Check format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) return false;

  // Check if it's a valid date
  const date = new Date(dateString + 'T00:00:00.000Z');
  return date instanceof Date && !isNaN(date.getTime());
}