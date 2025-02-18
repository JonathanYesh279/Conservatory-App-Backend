import Joi from 'joi'

const VALID_CLASSES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'אחר']
const VALID_STAGES = [1, 2, 3, 4, 5, 6, 7, 8]
const VALID_INSTRUMENTS = ['חצוצרה', 'חליל צד', 'קלרינט', 'קרן יער', 'בריטון', 'טרומבון', 'סקסופון']


export const studentSchema = Joi.object({
  personalInfo: Joi.object({
    fullName: Joi.string().required(),
    phone: Joi.string().pattern(/^05\d{8}$/),
    address: Joi.string().required(),
    parentName: Joi.string().required(),
    parentPhone: Joi.string().pattern(/^05\d{8}$/),
  }).required(),

  academicInfo: Joi.object({
    instrument: Joi.string()
      .valid(...VALID_INSTRUMENTS)
      .required(),
    currentStage: Joi.number()
      .valid(...VALID_STAGES)
      .required()
      .messages({
        'any.only': 'Current stage must be a number between 1 and 8',
      }),
    class: Joi.string()
      .valid(...VALID_CLASSES)
      .required(),
    tests: Joi.object({
      stageTest: Joi.object({
        status: Joi.string()
          .valid('לא נבחן', 'עבר/ה', 'לא עבר/ה')
          .default('לא נבחן'),
        lastTestDate: Joi.date().allow(null),
        nextTestDate: Joi.date().allow(null),
        notes: Joi.string().allow(''),
      }),
      technicalTest: Joi.object({
        status: Joi.string()
          .valid('לא נבחן', 'עבר/ה', 'לא עבר/ה')
          .default('לא נבחן'),
        lastTestDate: Joi.date().allow(null),
        nextTestDate: Joi.date().allow(null),
        notes: Joi.string().allow(''),
      }),
    }).default({}),
  }).required(),

  isActive: Joi.boolean().default(true),
});

export function validateStudent(student) {
  return studentSchema.validate(student, {  abortEarly: false })
}

export const STUDENT_CONSTANTS = {
  VALID_CLASSES,
  VALID_STAGES,
  TEST_STATUSES: ['לא נבחן', 'עבר/ה', 'לא עבר/ה'],
}