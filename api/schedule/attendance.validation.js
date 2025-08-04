import Joi from 'joi';

/**
 * Validation schema for marking lesson attendance
 */
export const validateMarkAttendance = (data) => {
  const schema = Joi.object({
    status: Joi.string()
      .valid('pending', 'הגיע/ה', 'לא הגיע/ה', 'cancelled')
      .required()
      .messages({
        'any.only': 'Status must be one of: pending, הגיע/ה, לא הגיע/ה, cancelled',
        'any.required': 'Attendance status is required'
      }),
    
    notes: Joi.string()
      .max(500)
      .optional()
      .allow('')
      .messages({
        'string.max': 'Notes cannot exceed 500 characters'
      }),
    
    lessonDate: Joi.date()
      .optional()
      .max('now')
      .messages({
        'date.max': 'Lesson date cannot be in the future'
      }),
    
    markedBy: Joi.string()
      .optional() // This will be set by the controller
  });

  return schema.validate(data);
};

/**
 * Validation schema for bulk attendance marking
 */
export const validateBulkAttendance = (data) => {
  const schema = Joi.object({
    attendanceRecords: Joi.array()
      .items(
        Joi.object({
          scheduleSlotId: Joi.string()
            .pattern(/^[0-9a-fA-F]{24}$/)
            .required()
            .messages({
              'string.pattern.base': 'Invalid schedule slot ID format',
              'any.required': 'Schedule slot ID is required'
            }),
          
          attendanceData: Joi.object({
            status: Joi.string()
              .valid('pending', 'הגיע/ה', 'לא הגיע/ה', 'cancelled')
              .required(),
            notes: Joi.string().max(500).optional().allow(''),
            lessonDate: Joi.date().optional().max('now')
          }).required()
        })
      )
      .min(1)
      .max(50)
      .required()
      .messages({
        'array.min': 'At least one attendance record is required',
        'array.max': 'Cannot process more than 50 attendance records at once',
        'any.required': 'Attendance records array is required'
      })
  });

  return schema.validate(data);
};

/**
 * Validation schema for attendance query filters
 */
export const validateAttendanceQuery = (data) => {
  const schema = Joi.object({
    teacherId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid teacher ID format'
      }),
    
    startDate: Joi.date()
      .optional()
      .messages({
        'date.base': 'Start date must be a valid date'
      }),
    
    endDate: Joi.date()
      .optional()
      .min(Joi.ref('startDate'))
      .messages({
        'date.base': 'End date must be a valid date',
        'date.min': 'End date must be after start date'
      }),
    
    limit: Joi.number()
      .integer()
      .min(1)
      .max(1000)
      .optional()
      .messages({
        'number.base': 'Limit must be a number',
        'number.integer': 'Limit must be an integer',
        'number.min': 'Limit must be at least 1',
        'number.max': 'Limit cannot exceed 1000'
      }),
    
    status: Joi.string()
      .valid('pending', 'הגיע/ה', 'לא הגיע/ה', 'cancelled')
      .optional()
      .messages({
        'any.only': 'Status must be one of: pending, הגיע/ה, לא הגיע/ה, cancelled'
      })
  });

  return schema.validate(data);
};

/**
 * Validation schema for bulk attendance data request
 */
export const validateBulkAttendanceRequest = (data) => {
  const schema = Joi.object({
    scheduleSlotIds: Joi.array()
      .items(
        Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .messages({
            'string.pattern.base': 'Invalid schedule slot ID format'
          })
      )
      .min(1)
      .max(100)
      .unique()
      .required()
      .messages({
        'array.min': 'At least one schedule slot ID is required',
        'array.max': 'Cannot request more than 100 schedule slots at once',
        'array.unique': 'Duplicate schedule slot IDs are not allowed',
        'any.required': 'Schedule slot IDs array is required'
      })
  });

  return schema.validate(data);
};

/**
 * Validation schema for attendance statistics query
 */
export const validateAttendanceStatsQuery = (data) => {
  const schema = Joi.object({
    teacherId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid teacher ID format'
      }),
    
    startDate: Joi.date()
      .optional()
      .messages({
        'date.base': 'Start date must be a valid date'
      }),
    
    endDate: Joi.date()
      .optional()
      .min(Joi.ref('startDate'))
      .messages({
        'date.base': 'End date must be a valid date',
        'date.min': 'End date must be after start date'
      }),
    
    includeDetails: Joi.boolean()
      .optional()
      .default(false)
      .messages({
        'boolean.base': 'includeDetails must be a boolean value'
      })
  });

  return schema.validate(data);
};

/**
 * Helper function to validate MongoDB ObjectId
 */
export const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Helper function to validate date range
 * @deprecated Use validateDateRange from dateHelpers instead
 */
export const validateDateRange = async (startDate, endDate) => {
  // Import here to avoid circular dependencies
  const { validateDateRange: centralValidation } = await import('../../utils/dateHelpers.js');
  return centralValidation(startDate, endDate);
};