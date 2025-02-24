import Joi from 'joi'

const VALID_RULES = ['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מדריך תאוריה']
const VALID_DURATION = [30, 45, 60] 

export const teacherSchema = Joi.object({
  personalInfo: Joi.object({
    fullName: Joi.string().required(),
    phone: Joi.string().pattern(/^05\d{8}$/),
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

  credentials: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }).required(),

  isActive: Joi.boolean().default(true),
}).custom((obj, helpers) => {
  if (obj.personalInfo.email !== obj.credentials.email) {
    return helpers.error('any.invalid', {
      message: 'Credentials email must match personal info email',
    })
  }
  return obj
})

export function validateTeacher(teacher) {
  return teacherSchema.validate(teacher, { abortEarly: false })
}

export const TEACHER_CONSTANTS = {
  VALID_RULES
}