import { getCollection } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { sendErrorResponse } from '../utils/errorResponses.js';
import { isValidTimeFormat, isValidTimeRange } from '../utils/timeUtils.js';
import { isValidDate, validateDateRange as centralValidateDateRange } from '../utils/dateHelpers.js';

/**
 * Validate required fields for bulk theory lesson creation
 */
const validateBulkCreateFields = (req, res, next) => {
  const requiredFields = [
    'category',
    'teacherId', 
    'startDate',
    'endDate',
    'dayOfWeek',
    'startTime',
    'endTime',
    'location',
    'schoolYearId'
  ];

  const missingFields = requiredFields.filter(field => {
    const value = req.body[field];
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  });

  if (missingFields.length > 0) {
    return sendErrorResponse(res, 'MISSING_REQUIRED_FIELDS', missingFields);
  }

  next();
};

/**
 * Validate required fields for single theory lesson creation
 */
const validateSingleCreateFields = (req, res, next) => {
  const requiredFields = [
    'category',
    'teacherId',
    'date',
    'startTime',
    'endTime',
    'location',
    'schoolYearId'
  ];

  const missingFields = requiredFields.filter(field => {
    const value = req.body[field];
    return value === undefined || value === null || (typeof value === 'string' && value.trim() === '');
  });

  if (missingFields.length > 0) {
    return sendErrorResponse(res, 'MISSING_REQUIRED_FIELDS', missingFields);
  }

  next();
};

/**
 * Validate time format and range
 */
const validateTimeFormat = (req, res, next) => {
  const { startTime, endTime } = req.body;

  if (startTime && !isValidTimeFormat(startTime)) {
    return sendErrorResponse(res, 'INVALID_TIME_FORMAT');
  }

  if (endTime && !isValidTimeFormat(endTime)) {
    return sendErrorResponse(res, 'INVALID_TIME_FORMAT');
  }

  if (startTime && endTime && !isValidTimeRange(startTime, endTime)) {
    return sendErrorResponse(res, 'INVALID_TIME_RANGE');
  }

  next();
};

/**
 * Validate date range for bulk creation using centralized date validation
 */
const validateDateRange = (req, res, next) => {
  const { startDate, endDate } = req.body;

  if (startDate && endDate) {
    // Use centralized date validation
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: 'Invalid date format' }]);
    }

    const validation = centralValidateDateRange(startDate, endDate);
    if (!validation.valid) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: validation.error }]);
    }
  }

  next();
};

/**
 * Validate day of week
 */
const validateDayOfWeek = (req, res, next) => {
  const { dayOfWeek } = req.body;

  if (dayOfWeek !== undefined) {
    const day = parseInt(dayOfWeek);
    if (isNaN(day) || day < 0 || day > 6) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ 
        message: 'Day of week must be an integer between 0 (Sunday) and 6 (Saturday)' 
      }]);
    }
  }

  next();
};

/**
 * Validate MongoDB ObjectId format
 */
const validateObjectId = (paramName) => {
  return (req, res, next) => {
    const id = req.params[paramName] || req.body[paramName];
    
    if (id) {
      try {
        // Check basic format before calling ObjectId.isValid
        if (typeof id !== 'string' || id.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(id)) {
          return sendErrorResponse(res, 'VALIDATION_ERROR', [{ 
            message: `Invalid ${paramName} format - must be a 24-character hexadecimal string` 
          }]);
        }
        
        if (!ObjectId.isValid(id)) {
          return sendErrorResponse(res, 'VALIDATION_ERROR', [{ 
            message: `Invalid ${paramName} format` 
          }]);
        }
      } catch (error) {
        // Catch BSONError for malformed ObjectIds
        console.warn('ObjectId validation error for', paramName + ':', error.message, 'ID:', id);
        return sendErrorResponse(res, 'VALIDATION_ERROR', [{ 
          message: `Invalid ${paramName} format - ${error.message}` 
        }]);
      }
    }

    next();
  };
};

/**
 * Check if teacher exists and is active
 */
const validateTeacherExists = async (req, res, next) => {
  try {
    const teacherId = req.body.teacherId;
    if (!teacherId) return next();

    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne({ 
      _id: ObjectId.createFromHexString(teacherId) 
    });

    if (!teacher) {
      return sendErrorResponse(res, 'TEACHER_NOT_FOUND', teacherId);
    }

    if (!teacher.isActive) {
      return sendErrorResponse(res, 'TEACHER_INACTIVE', teacherId);
    }

    // Add teacher info to request for later use
    req.teacher = teacher;
    next();
  } catch (error) {
    console.error('Teacher validation error:', error);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', 'Error validating teacher');
  }
};

/**
 * Check if school year exists and is active
 */
const validateSchoolYear = async (req, res, next) => {
  try {
    const schoolYearId = req.body.schoolYearId;
    if (!schoolYearId) return next();

    const schoolYearCollection = await getCollection('school_year');
    const schoolYear = await schoolYearCollection.findOne({ 
      _id: ObjectId.createFromHexString(schoolYearId) 
    });

    if (!schoolYear) {
      return sendErrorResponse(res, 'SCHOOL_YEAR_NOT_FOUND', schoolYearId);
    }

    if (!schoolYear.isActive) {
      return sendErrorResponse(res, 'SCHOOL_YEAR_INACTIVE', schoolYearId);
    }

    // Add school year info to request for later use
    req.schoolYear = schoolYear;
    next();
  } catch (error) {
    console.error('School year validation error:', error);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', 'Error validating school year');
  }
};

/**
 * Validate location against allowed values
 */
const validateLocation = async (req, res, next) => {
  const { location } = req.body;
  
  if (!location) return next();

  try {
    // Import the valid locations from validation
    const { VALID_THEORY_LOCATIONS } = await import('../api/theory/theory.validation.js');
    
    if (!VALID_THEORY_LOCATIONS.includes(location)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ 
        message: `Location must be one of: ${VALID_THEORY_LOCATIONS.join(', ')}` 
      }]);
    }

    next();
  } catch (error) {
    console.error('Error validating location:', error);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', 'Error validating location');
  }
};

/**
 * Validate category against allowed values
 */
const validateCategory = async (req, res, next) => {
  const { category } = req.body;
  
  if (!category) return next();

  try {
    // Import the valid categories from validation
    const { VALID_THEORY_CATEGORIES } = await import('../api/theory/theory.validation.js');
    
    if (!VALID_THEORY_CATEGORIES.includes(category)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ 
        message: `Category must be one of: ${VALID_THEORY_CATEGORIES.join(', ')}` 
      }]);
    }

    next();
  } catch (error) {
    console.error('Error validating category:', error);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', 'Error validating category');
  }
};

/**
 * Validate exclude dates format
 */
const validateExcludeDates = (req, res, next) => {
  const { excludeDates } = req.body;

  if (!excludeDates) return next();

  if (!Array.isArray(excludeDates)) {
    return sendErrorResponse(res, 'VALIDATION_ERROR', [{ 
      message: 'Exclude dates must be an array' 
    }]);
  }

  // Check if all dates are valid using centralized validation
  const invalidDates = excludeDates.filter(date => !isValidDate(date));

  if (invalidDates.length > 0) {
    return sendErrorResponse(res, 'VALIDATION_ERROR', [{ 
      message: 'All exclude dates must be valid dates' 
    }]);
  }

  next();
};

/**
 * Validate student IDs format
 */
const validateStudentIds = (req, res, next) => {
  const { studentIds } = req.body;

  if (!studentIds) return next();

  if (!Array.isArray(studentIds)) {
    return sendErrorResponse(res, 'VALIDATION_ERROR', [{ 
      message: 'Student IDs must be an array' 
    }]);
  }

  // Check if all IDs are valid ObjectIds - safely handle BSONError
  const invalidIds = studentIds.filter(id => {
    try {
      // Also check if it's a string and has correct length before validation
      if (typeof id !== 'string' || id.length !== 24) {
        return true;
      }
      return !ObjectId.isValid(id);
    } catch (error) {
      // Catch BSONError for malformed hex strings
      console.warn('ObjectId validation error:', error.message, 'for ID:', id);
      return true; // Mark as invalid if validation throws
    }
  });

  if (invalidIds.length > 0) {
    return sendErrorResponse(res, 'VALIDATION_ERROR', [{ 
      message: `Invalid student IDs found: ${invalidIds.slice(0, 3).join(', ')}${invalidIds.length > 3 ? '...' : ''}. All student IDs must be valid 24-character MongoDB ObjectIds` 
    }]);
  }

  next();
};

/**
 * Composite validation middleware for bulk creation
 */
const validateBulkCreate = [
  validateBulkCreateFields,
  validateTimeFormat,
  validateDateRange,
  validateDayOfWeek,
  validateObjectId('teacherId'),
  validateObjectId('schoolYearId'),
  validateLocation,
  validateCategory,
  validateExcludeDates,
  validateStudentIds,
  validateTeacherExists,
  validateSchoolYear
];

/**
 * Composite validation middleware for single creation
 */
const validateSingleCreate = [
  validateSingleCreateFields,
  validateTimeFormat,
  validateObjectId('teacherId'),
  validateObjectId('schoolYearId'),
  validateLocation,
  validateCategory,
  validateStudentIds,
  validateTeacherExists,
  validateSchoolYear
];

/**
 * Composite validation middleware for updates
 */
const validateUpdate = [
  validateObjectId('id'),
  validateTimeFormat,
  validateObjectId('teacherId'),
  validateObjectId('schoolYearId'),
  validateLocation,
  validateCategory,
  validateStudentIds,
  // Don't validate teacher/school year existence for updates as they might not be changing
];

export {
  validateBulkCreate,
  validateSingleCreate,
  validateUpdate,
  validateBulkCreateFields,
  validateSingleCreateFields,
  validateTimeFormat,
  validateDateRange,
  validateDayOfWeek,
  validateObjectId,
  validateTeacherExists,
  validateSchoolYear,
  validateLocation,
  validateCategory,
  validateExcludeDates,
  validateStudentIds
};