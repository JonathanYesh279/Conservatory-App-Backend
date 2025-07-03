import Joi from 'joi';

const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const VALID_DURATION = [30, 45, 60];

// Note: createScheduleSlotSchema is now defined within validateCreateScheduleSlot function
// This allows for dynamic field name normalization (Hebrew to English)

// Validation schema for updating a schedule slot
export const updateScheduleSlotSchema = Joi.object({
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
  duration: Joi.number()
    .valid(...VALID_DURATION)
    .messages({
      'any.only': 'משך השיעור חייב להיות אחד מהערכים הבאים: ' + VALID_DURATION.join(', '),
    }),
  isAvailable: Joi.boolean(),
  location: Joi.string().allow(null, ''),
  notes: Joi.string().allow(null, ''),
  recurring: Joi.object({
    isRecurring: Joi.boolean(),
    startDate: Joi.date(),
    endDate: Joi.date(),
    excludeDates: Joi.array().items(Joi.date()),
  }),
}).min(1); // At least one field must be provided for update

// Validation schema for student assignment to a slot
export const assignStudentSchema = Joi.object({
  teacherId: Joi.string().required().messages({
    'any.required': 'מזהה המורה הוא שדה חובה',
  }),
  studentId: Joi.string().required().messages({
    'any.required': 'מזהה התלמיד הוא שדה חובה',
  }),
  scheduleSlotId: Joi.string().required().messages({
    'any.required': 'מזהה השיבוץ הוא שדה חובה',
  }),
  startDate: Joi.date().default(new Date()),
  notes: Joi.string().allow(null, ''),
});

// Validation schema for filtering available slots
export const availableSlotsFilterSchema = Joi.object({
  day: Joi.string().valid(...VALID_DAYS),
  minDuration: Joi.number().valid(...VALID_DURATION),
  startTimeAfter: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  startTimeBefore: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  location: Joi.string(),
  schoolYearId: Joi.string(),
});

// Helper function to normalize Hebrew field names to English
function normalizeScheduleSlotData(data) {
  const normalized = { ...data };
  
  // Map Hebrew field names to English
  const fieldMapping = {
    'יום': 'day',
    'שעה': 'startTime', 
    'משך השיעור': 'duration',
    'מיקום': 'location',
    'הערות': 'notes'
  };
  
  // Convert Hebrew fields to English
  Object.entries(fieldMapping).forEach(([hebrew, english]) => {
    if (normalized[hebrew] !== undefined) {
      normalized[english] = normalized[hebrew];
      delete normalized[hebrew];
    }
  });
  
  return normalized;
}

export function validateCreateScheduleSlot(data) {
  // Normalize field names before validation
  const normalizedData = normalizeScheduleSlotData(data);
  
  // Use simplified schema that only expects English field names
  const simpleSchema = Joi.object({
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
    duration: Joi.number()
      .valid(...VALID_DURATION)
      .required()
      .messages({
        'any.required': 'משך השיעור הוא שדה חובה',
        'any.only': 'משך השיעור חייב להיות אחד מהערכים הבאים: ' + VALID_DURATION.join(', '),
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
  });
  
  return simpleSchema.validate(normalizedData, { abortEarly: false });
}

export function validateUpdateScheduleSlot(data) {
  // Normalize field names before validation
  const normalizedData = normalizeScheduleSlotData(data);
  return updateScheduleSlotSchema.validate(normalizedData, { abortEarly: false });
}

export function validateAssignStudent(data) {
  return assignStudentSchema.validate(data, { abortEarly: false });
}

// Validation schema for teacher-student assignment
export const teacherStudentAssignmentSchema = Joi.object({
  studentId: Joi.string().required().messages({
    'any.required': 'מזהה התלמיד הוא שדה חובה',
  }),
});

export function validateAvailableSlotsFilter(data) {
  return availableSlotsFilterSchema.validate(data, { abortEarly: false });
}

export function validateTeacherStudentAssignment(data) {
  return teacherStudentAssignmentSchema.validate(data, { abortEarly: false });
}

export const SCHEDULE_CONSTANTS = {
  VALID_DAYS,
  VALID_DURATION,
};