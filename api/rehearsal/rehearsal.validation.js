import Joi from 'joi'

export const VALID_DAYS_OF_WEEK = {
  0: 'ראשון', // Sunday
  1: 'שני', // Monday
  2: 'שלישי', // Tuesday
  3: 'רביעי', // Wednesday
  4: 'חמישי', // Thursday
  5: 'שישי', // Friday
  6: 'שבת', // Saturday
}

export const VALID_REHEARSAL_TYPES = ['תזמורת', 'הרכב']

export const rehearsalSchema = Joi.object({
  groupId: Joi.string().required(),
  type: Joi.string().valid(...VALID_REHEARSAL_TYPES).required(),
  date: Joi.date().required(),
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  location: Joi.string().required(),
  attendance: Joi.object({
    present: Joi.array().items(Joi.string()).default([]),
    absent: Joi.array().items(Joi.string()).default([])
  }).default({ present: [], absent: [] }),
  notes: Joi.string().allow('').default(''),
  schoolYearId: Joi.string().required(),
  isActive: Joi.boolean().default(true)
})

export function validateRehearsal(rehearsal) {
  return rehearsalSchema.validate(rehearsal, { abortEarly: false })
}

export const bulkCreateSchema = Joi.object({
  orchestraId: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required(),
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
  location: Joi.string().required(),
  notes: Joi.string().allow('').default(''),
  excludeDates: Joi.array().items(Joi.date()).default([])
})

export function validateBulkCreate(data) {
  return bulkCreateSchema.validate(data, { abortEarly: false })
}

export const attendanceSchema = Joi.object({
  present: Joi.array().items(Joi.string()).default([]),
  absent: Joi.array().items(Joi.string()).default([]),
})

export function validateAttendance(attendance) {
  return attendanceSchema.validate(attendance, { abortEarly: false })
}