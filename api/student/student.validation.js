import Joi from 'joi'

const VALID_CLASSES = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'יא', 'יב', 'אחר']
const VALID_STAGES = [1, 2, 3, 4, 5, 6, 7, 8]
const VALID_INSTRUMENTS = ['חצוצרה', 'חליל צד', 'קלרינט', 'קרן יער', 'בריטון', 'טרומבון', 'סקסופון']

// Schema for creating a new student (all required fields)
export const studentSchema = Joi.object({
   personalInfo: Joi.object({
    fullName: Joi.string().required(),
    phone: Joi.string().pattern(/^05\d{8}$/).allow(null),
    age: Joi.number().min(0).max(99).allow(null),
    address: Joi.string().allow(null),
    parentName: Joi.string().allow(null),
    parentPhone: Joi.string().pattern(/^05\d{8}$/).allow(null),
    parentEmail: Joi.string().email().allow(null),
    studentEmail: Joi.string().email().allow(null),
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

  enrollments: Joi.object({
    orchestraIds: Joi.array().items(Joi.string()).default([]),
    ensembleIds: Joi.array().items(Joi.string()).default([]),

    schoolYears: Joi.array().items(
      Joi.object({
        schoolYearId: Joi.string().required(),
        isActive: Joi.boolean().default(true),
      })
    ).default([]),
  }).default({ orchestraIds: [], ensembleIds: [], schoolYears: [] }),

  isActive: Joi.boolean().default(true),
  createdAt: Joi.date().default(new Date()),
  updatedAt: Joi.date().default(new Date()),
})

// Schema for updating a student (partial updates allowed)
export const studentUpdateSchema = Joi.object({
   personalInfo: Joi.object({
    fullName: Joi.string(),
    phone: Joi.string().pattern(/^05\d{8}$/).allow(null),
    age: Joi.number().min(0).max(99).allow(null),
    address: Joi.string().allow(null),
    parentName: Joi.string().allow(null),
    parentPhone: Joi.string().pattern(/^05\d{8}$/).allow(null),
    parentEmail: Joi.string().email().allow(null),
    studentEmail: Joi.string().email().allow(null),
  }),

  academicInfo: Joi.object({
    instrument: Joi.string().valid(...VALID_INSTRUMENTS),
    currentStage: Joi.number()
      .valid(...VALID_STAGES)
      .messages({
        'any.only': 'Current stage must be a number between 1 and 8',
      }),
    class: Joi.string().valid(...VALID_CLASSES),
    tests: Joi.object({
      stageTest: Joi.object({
        status: Joi.string()
          .valid('לא נבחן', 'עבר/ה', 'לא עבר/ה'),
        lastTestDate: Joi.date().allow(null),
        nextTestDate: Joi.date().allow(null),
        notes: Joi.string().allow(''),
      }),
      technicalTest: Joi.object({
        status: Joi.string()
          .valid('לא נבחן', 'עבר/ה', 'לא עבר/ה'),
        lastTestDate: Joi.date().allow(null),
        nextTestDate: Joi.date().allow(null),
        notes: Joi.string().allow(''),
      }),
    }),
  }),

  enrollments: Joi.object({
    orchestraIds: Joi.array().items(Joi.string()),
    ensembleIds: Joi.array().items(Joi.string()),

    schoolYears: Joi.array().items(
      Joi.object({
        schoolYearId: Joi.string().required(),
        isActive: Joi.boolean().default(true),
      })
    ),
  }),

  isActive: Joi.boolean(),
  updatedAt: Joi.date().default(new Date()),
})

export function validateStudent(student, isUpdate = false) {
  const schema = isUpdate ? studentUpdateSchema : studentSchema
  return schema.validate(student, { abortEarly: false })
}

export const STUDENT_CONSTANTS = {
  VALID_CLASSES,
  VALID_STAGES,
  TEST_STATUSES: ['לא נבחן', 'עבר/ה', 'לא עבר/ה'],
}