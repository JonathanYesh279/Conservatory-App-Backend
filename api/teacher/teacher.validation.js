import Joi from 'joi';
import { ObjectId } from 'mongodb';

const VALID_RULES = ['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה'];
const VALID_DURATION = [30, 45, 60];
const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

// Schema for schedule slot
const scheduleSlotSchema = Joi.object({
  _id: Joi.any().default(() => new ObjectId()),
  studentId: Joi.string().allow(null).default(null),
  day: Joi.string().valid(...VALID_DAYS).required(),
  startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(), // HH:MM format
  endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // Calculated from startTime + duration
  duration: Joi.number().valid(...VALID_DURATION).required(),
  isAvailable: Joi.boolean().default(true),
  location: Joi.string().allow('', null).default(null),
  notes: Joi.string().allow('', null).default(null),
  recurring: Joi.object({
    isRecurring: Joi.boolean().default(true),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    excludeDates: Joi.array().items(Joi.date()).default([]),
  }).default({ isRecurring: true, excludeDates: [] }),
  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().default(() => new Date()),
});

// Original schema for creating new teachers
export const teacherSchema = Joi.object({
  personalInfo: Joi.object({
    fullName: Joi.string().required(),
    phone: Joi.string()
      .pattern(/^05\d{8}$/)
      .required(),
    email: Joi.string().email().required(),
    address: Joi.string().required(),
  }).required(),

  roles: Joi.array()
    .items(Joi.string().valid(...VALID_RULES))
    .required(),

  professionalInfo: Joi.object({
    instrument: Joi.string().when('..roles', {
      is: Joi.array().items().has('מורה תאוריה').length(1),
      then: Joi.string().allow('', null).optional(),
      otherwise: Joi.string().required()
    }),
    isActive: Joi.boolean().default(true),
  }).required(),

  teaching: Joi.object({
    studentIds: Joi.array().items(Joi.string()).default([]),
    schedule: Joi.array()
      .items(scheduleSlotSchema)
      .default([]),
  }).required(),

  conducting: Joi.object({
    orchestraIds: Joi.array().items(Joi.string()).default([]),
  }).default({}),

  ensemblesIds: Joi.array().items(Joi.string()).default([]),

  schoolYears: Joi.array()
    .items(
      Joi.object({
        schoolYearId: Joi.string().required(),
        isActive: Joi.boolean().default(true),
      })
    )
    .default([]),

  credentials: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }).required(),

  isActive: Joi.boolean().default(true),
}).custom((obj, helpers) => {
  if (obj.personalInfo.email !== obj.credentials.email) {
    return helpers.error('any.invalid', {
      message: 'Credentials email must match personal info email',
    });
  }
  return obj;
});

// Schedule slot schema for updates - allows partial updates
const scheduleSlotUpdateSchema = Joi.object({
  _id: Joi.any().optional(),
  studentId: Joi.string().allow(null).optional(),
  day: Joi.string().valid(...VALID_DAYS).optional(),
  startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:MM format
  endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
  duration: Joi.number().valid(...VALID_DURATION).optional(),
  isAvailable: Joi.boolean().optional(),
  location: Joi.string().allow('', null).optional(),
  notes: Joi.string().allow('', null).optional(),
  recurring: Joi.object({
    isRecurring: Joi.boolean().optional(),
    startDate: Joi.date().optional(),
    endDate: Joi.date().optional(),
    excludeDates: Joi.array().items(Joi.date()).optional(),
  }).optional(),
  updatedAt: Joi.date().default(() => new Date()),
});

// New schema for updating existing teachers
export const teacherUpdateSchema = Joi.object({
  personalInfo: Joi.object({
    fullName: Joi.string().optional(),
    phone: Joi.string()
      .pattern(/^05\d{8}$/)
      .optional(),
    email: Joi.string().email().optional(),
    address: Joi.string().optional(),
  }).optional(),

  roles: Joi.array()
    .items(Joi.string().valid(...VALID_RULES))
    .optional(),

  professionalInfo: Joi.object({
    instrument: Joi.string().when('..roles', {
      is: Joi.array().items().has('מורה תאוריה').length(1),
      then: Joi.string().allow('', null).optional(),
      otherwise: Joi.string().optional()
    }),
    isActive: Joi.boolean().optional(),
  }).optional(),

  teaching: Joi.object({
    studentIds: Joi.array().items(Joi.string()).optional(),
    schedule: Joi.array()
      .items(scheduleSlotUpdateSchema)
      .optional(),
  }).optional(),

  conducting: Joi.object({
    orchestraIds: Joi.array().items(Joi.string()).optional(),
  }).optional(),

  ensemblesIds: Joi.array().items(Joi.string()).optional(),

  schoolYears: Joi.array()
    .items(
      Joi.object({
        schoolYearId: Joi.string().required(),
        isActive: Joi.boolean().default(true),
      })
    )
    .optional(),

  // Make credentials optional for updates
  credentials: Joi.object({
    email: Joi.string().email().optional(),
    password: Joi.string().allow('', null).optional(),
  }).optional(),

  isActive: Joi.boolean().optional(),
}).custom((obj, helpers) => {
  // Only validate email match if both emails are present
  if (
    obj.personalInfo?.email &&
    obj.credentials?.email &&
    obj.personalInfo.email !== obj.credentials.email
  ) {
    return helpers.error('any.invalid', {
      message: 'Credentials email must match personal info email',
    });
  }
  return obj;
});

export function validateTeacher(teacher) {
  return teacherSchema.validate(teacher, { abortEarly: false });
}

export function validateTeacherUpdate(teacher) {
  return teacherUpdateSchema.validate(teacher, {
    abortEarly: false,
    allowUnknown: true, // Allow fields not in the schema
  });
}

export const TEACHER_CONSTANTS = {
  VALID_RULES,
};
