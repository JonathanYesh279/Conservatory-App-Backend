import Joi from 'joi'

const VALID_TYPES = ['תזמורת נשיפה מתחילים', 'תזמורת נשיפה עתודה', 'תזמורת נשיפה צעירה', 'תזמורת נשיפה יצוגית', 'תזמורת סימפונית']

export const orchestraSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().valid(...VALID_TYPES).required(),
  conductorId: Joi.string().required(),
  scheduleInfo: Joi.object({
    rehearsalDay: Joi.string().required(),
    rehearsalTime: Joi.string().required(),
    location: Joi.string().required()
  }).required(),
  memberIds: Joi.array().items(Joi.string()).default([]),
  rehearsalIds: Joi.array().items(Joi.string()).default([]),
  isActive: Joi.boolean().default(true)
})

export function validateOrchestra(orchestra) {
  return orchestraSchema.validate(orchestra, { abortEarly: false })
}

export const ORCHESTRA_CONSTANTS = {
  VALID_TYPES
}
