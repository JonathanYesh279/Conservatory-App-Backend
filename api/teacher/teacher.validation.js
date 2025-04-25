import Joi from 'joi';

const VALID_RULES = ['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה'];
const VALID_DURATION = [30, 45, 60];

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
    instrument: Joi.string().required(),
    isActive: Joi.boolean().default(true),
  }).required(),

  teaching: Joi.object({
    studentIds: Joi.array().items(Joi.string()).default([]),
    schedule: Joi.array()
      .items(
        Joi.object({
          studentId: Joi.string().required(),
          day: Joi.string().required(),
          time: Joi.string().required(),
          duration: Joi.number()
            .valid(...VALID_DURATION)
            .required(),
        })
      )
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
    instrument: Joi.string().optional(),
    isActive: Joi.boolean().optional(),
  }).optional(),

  teaching: Joi.object({
    studentIds: Joi.array().items(Joi.string()).optional(),
    schedule: Joi.array()
      .items(
        Joi.object({
          studentId: Joi.string().required(),
          day: Joi.string().required(),
          time: Joi.string().required(),
          duration: Joi.number()
            .valid(...VALID_DURATION)
            .required(),
        })
      )
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
