import Joi from 'joi';

const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const VALID_DURATION = [30, 45, 60];

// Validation schema for creating a new schedule slot
export const createScheduleSlotSchema = Joi.object({
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

export function validateCreateScheduleSlot(data) {
  return createScheduleSlotSchema.validate(data, { abortEarly: false });
}

export function validateUpdateScheduleSlot(data) {
  return updateScheduleSlotSchema.validate(data, { abortEarly: false });
}

export function validateAssignStudent(data) {
  return assignStudentSchema.validate(data, { abortEarly: false });
}

export function validateAvailableSlotsFilter(data) {
  return availableSlotsFilterSchema.validate(data, { abortEarly: false });
}

export const SCHEDULE_CONSTANTS = {
  VALID_DAYS,
  VALID_DURATION,
};