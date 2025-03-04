import Joi from 'joi'

export const schoolYearSchema = Joi.object({
  name: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  isCurrent: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
  createdAt: Joi.date().default(Date.now),
  updatedAt: Joi.date().default(Date.now)
})

export function validateSchoolYear(schoolYear) {
  return schoolYearSchema.validate(schoolYear, { abortEarly: false })
}