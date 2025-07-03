import Joi from 'joi';

const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const VALID_DURATION = [30, 45, 60];

// Validation schema for creating a new time block
export const createTimeBlockSchema = Joi.object({
  day: Joi.string()
    .valid(...VALID_DAYS)
    .required()
    .messages({
      'any.required': 'יום הוא שדה חובה',
      'any.only': 'יום חייב להיות אחד מהימים הבאים: ' + VALID_DAYS.join(', '),
    }),
  startTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'any.required': 'שעת התחלה היא שדה חובה',
      'string.pattern.base': 'שעת התחלה חייבת להיות בפורמט HH:MM',
    }),
  endTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'any.required': 'שעת סיום היא שדה חובה',
      'string.pattern.base': 'שעת סיום חייבת להיות בפורמט HH:MM',
    }),
  location: Joi.string().allow(null, ''),
  notes: Joi.string().allow(null, ''),
  recurring: Joi.object({
    isRecurring: Joi.boolean().default(true),
    startDate: Joi.date(),
    endDate: Joi.date(),
    excludeDates: Joi.array().items(Joi.date()),
  }),
  schoolYearId: Joi.string(),
}).custom((value, helpers) => {
  // Validate that endTime is after startTime
  const startMinutes = timeToMinutes(value.startTime);
  const endMinutes = timeToMinutes(value.endTime);
  
  if (endMinutes <= startMinutes) {
    return helpers.error('custom.timeOrder');
  }
  
  // Validate minimum block duration (30 minutes)
  const duration = endMinutes - startMinutes;
  if (duration < 30) {
    return helpers.error('custom.minDuration');
  }
  
  // Validate maximum block duration (8 hours)
  if (duration > 480) {
    return helpers.error('custom.maxDuration');
  }
  
  return value;
}, 'Time block validation').messages({
  'custom.timeOrder': 'שעת הסיום חייבת להיות אחרי שעת ההתחלה',
  'custom.minDuration': 'משך הבלוק חייב להיות לפחות 30 דקות',
  'custom.maxDuration': 'משך הבלוק לא יכול להיות יותר מ-8 שעות',
});

// Validation schema for updating a time block
export const updateTimeBlockSchema = Joi.object({
  day: Joi.string()
    .valid(...VALID_DAYS)
    .messages({
      'any.only': 'יום חייב להיות אחד מהימים הבאים: ' + VALID_DAYS.join(', '),
    }),
  startTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .messages({
      'string.pattern.base': 'שעת התחלה חייבת להיות בפורמט HH:MM',
    }),
  endTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .messages({
      'string.pattern.base': 'שעת סיום חייבת להיות בפורמט HH:MM',
    }),
  isActive: Joi.boolean(),
  location: Joi.string().allow(null, ''),
  notes: Joi.string().allow(null, ''),
  recurring: Joi.object({
    isRecurring: Joi.boolean(),
    startDate: Joi.date(),
    endDate: Joi.date(),
    excludeDates: Joi.array().items(Joi.date()),
  }),
}).min(1).custom((value, helpers) => {
  // If both startTime and endTime are provided, validate them
  if (value.startTime && value.endTime) {
    const startMinutes = timeToMinutes(value.startTime);
    const endMinutes = timeToMinutes(value.endTime);
    
    if (endMinutes <= startMinutes) {
      return helpers.error('custom.timeOrder');
    }
    
    const duration = endMinutes - startMinutes;
    if (duration < 30) {
      return helpers.error('custom.minDuration');
    }
    
    if (duration > 480) {
      return helpers.error('custom.maxDuration');
    }
  }
  
  return value;
}, 'Time block update validation').messages({
  'custom.timeOrder': 'שעת הסיום חייבת להיות אחרי שעת ההתחלה',
  'custom.minDuration': 'משך הבלוק חייב להיות לפחות 30 דקות',
  'custom.maxDuration': 'משך הבלוק לא יכול להיות יותר מ-8 שעות',
});

// Validation schema for lesson assignment to time block
export const lessonAssignmentSchema = Joi.object({
  teacherId: Joi.string().required().messages({
    'any.required': 'מזהה המורה הוא שדה חובה',
  }),
  studentId: Joi.string().required().messages({
    'any.required': 'מזהה התלמיד הוא שדה חובה',
  }),
  timeBlockId: Joi.string().required().messages({
    'any.required': 'מזהה הבלוק הוא שדה חובה',
  }),
  startTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'any.required': 'שעת התחלת השיעור היא שדה חובה',
      'string.pattern.base': 'שעת התחלה חייבת להיות בפורמט HH:MM',
    }),
  duration: Joi.number()
    .valid(...VALID_DURATION)
    .required()
    .messages({
      'any.required': 'משך השיעור הוא שדה חובה',
      'any.only': 'משך השיעור חייב להיות אחד מהערכים הבאים: ' + VALID_DURATION.join(', '),
    }),
  startDate: Joi.date().default(new Date()),
  notes: Joi.string().allow(null, ''),
});

// Validation schema for available slots query
export const availableSlotsQuerySchema = Joi.object({
  duration: Joi.number()
    .valid(...VALID_DURATION)
    .required()
    .messages({
      'any.required': 'משך השיעור הוא שדה חובה',
      'any.only': 'משך השיעור חייב להיות אחד מהערכים הבאים: ' + VALID_DURATION.join(', '),
    }),
  preferredDays: Joi.array()
    .items(Joi.string().valid(...VALID_DAYS))
    .messages({
      'array.includes': 'ימים מועדפים חייבים להיות מהרשימה: ' + VALID_DAYS.join(', '),
    }),
  preferredStartTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .messages({
      'string.pattern.base': 'שעת התחלה מועדפת חייבת להיות בפורמט HH:MM',
    }),
  maxEndTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .messages({
      'string.pattern.base': 'שעת סיום מקסימלית חייבת להיות בפורמט HH:MM',
    }),
  minStartTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .messages({
      'string.pattern.base': 'שעת התחלה מינימלית חייבת להיות בפורמט HH:MM',
    }),
});

// Validation schema for optimal slot finder
export const optimalSlotSchema = Joi.object({
  duration: Joi.number()
    .valid(...VALID_DURATION)
    .required()
    .messages({
      'any.required': 'משך השיעור הוא שדה חובה',
      'any.only': 'משך השיעור חייב להיות אחד מהערכים הבאים: ' + VALID_DURATION.join(', '),
    }),
  preferences: Joi.object({
    preferredDays: Joi.array().items(Joi.string().valid(...VALID_DAYS)),
    preferredStartTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    maxEndTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    minStartTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    priorityScore: Joi.number().min(1).max(10).default(5),
  }).default({}),
});

// Validation schema for time block filters
export const timeBlockFiltersSchema = Joi.object({
  day: Joi.string().valid(...VALID_DAYS),
  activeOnly: Joi.boolean().default(true),
  includeAvailableSlots: Joi.boolean().default(false),
  includeUtilization: Joi.boolean().default(false),
});

// Validation schema for schedule statistics query
export const scheduleStatsQuerySchema = Joi.object({
  includeStudentInfo: Joi.boolean().default(false),
  dateRange: Joi.object({
    startDate: Joi.date(),
    endDate: Joi.date(),
  }),
  groupBy: Joi.string().valid('day', 'week', 'month').default('week'),
});

// Validation functions
export function validateCreateTimeBlock(data) {
  return createTimeBlockSchema.validate(data, { abortEarly: false });
}

export function validateUpdateTimeBlock(data) {
  return updateTimeBlockSchema.validate(data, { abortEarly: false });
}

export function validateLessonAssignment(data) {
  return lessonAssignmentSchema.validate(data, { abortEarly: false });
}

export function validateAvailableSlotsQuery(data) {
  return availableSlotsQuerySchema.validate(data, { abortEarly: false });
}

export function validateOptimalSlot(data) {
  return optimalSlotSchema.validate(data, { abortEarly: false });
}

export function validateTimeBlockFilters(data) {
  return timeBlockFiltersSchema.validate(data, { abortEarly: false });
}

export function validateScheduleStatsQuery(data) {
  return scheduleStatsQuerySchema.validate(data, { abortEarly: false });
}

// Helper function for time validation
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

// Constants export
export const TIME_BLOCK_CONSTANTS = {
  VALID_DAYS,
  VALID_DURATION,
  MIN_BLOCK_DURATION: 30,
  MAX_BLOCK_DURATION: 480,
  SLOT_INTERVAL: 15, // Minutes between possible lesson start times
  DEFAULT_LESSON_DURATIONS: VALID_DURATION,
};