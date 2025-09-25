import Joi from 'joi';

const VALID_CLASSES = [
  'א',
  'ב',
  'ג',
  'ד',
  'ה',
  'ו',
  'ז',
  'ח',
  'ט',
  'י',
  'יא',
  'יב',
  'אחר',
];
const VALID_STAGES = [1, 2, 3, 4, 5, 6, 7, 8];
const VALID_INSTRUMENTS = [
  'חלילית',
  'חליל צד',
  'אבוב',
  'בסון',
  'סקסופון',
  'קלרינט',
  'חצוצרה',
  'קרן יער',
  'טרומבון',
  'טובה/בריטון',
  'שירה',
  'כינור',
  'ויולה',
  "צ'לו",
  'קונטרבס',
  'פסנתר',
  'גיטרה',
  'גיטרה בס',
  'תופים',
];

const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const VALID_DURATIONS = [30, 45, 60];
// Update the test statuses to include the new options
const TEST_STATUSES = [
  'לא נבחן',
  'עבר/ה',
  'לא עבר/ה',
  'עבר/ה בהצטיינות',
  'עבר/ה בהצטיינות יתרה',
];

// Schema for instrument-specific progress tracking
const instrumentProgressSchema = Joi.object({
  instrumentName: Joi.string()
    .valid(...VALID_INSTRUMENTS)
    .required(),
  isPrimary: Joi.boolean().default(false),
  currentStage: Joi.number()
    .valid(...VALID_STAGES)
    .required()
    .messages({
      'any.only': 'Current stage must be a number between 1 and 8',
    }),
  tests: Joi.object({
    stageTest: Joi.object({
      status: Joi.string()
        .valid(...TEST_STATUSES)
        .default('לא נבחן'),
      lastTestDate: Joi.date().allow(null, ''),
      nextTestDate: Joi.date().allow(null, ''),
      notes: Joi.string().allow(null, ''),
    }),
    technicalTest: Joi.object({
      status: Joi.string()
        .valid(...TEST_STATUSES)
        .default('לא נבחן'),
      lastTestDate: Joi.date().allow(null, ''),
      nextTestDate: Joi.date().allow(null, ''),
      notes: Joi.string().allow(null, ''),
    }),
  }).default({}),
});

// Schema for teacher assignment (frontend format)
const teacherAssignmentSchema = Joi.object({
  teacherId: Joi.string().required().messages({
    'any.required': 'מזהה המורה הוא שדה חובה',
  }),
  scheduleSlotId: Joi.string().optional().allow(null, '').messages({
    'any.required': 'מזהה השיבוץ הוא שדה חובה',
  }),
  day: Joi.string()
    .valid(...VALID_DAYS)
    .required()
    .messages({
      'any.required': 'יום הוא שדה חובה',
      'any.only': 'יום חייב להיות אחד מהימים הבאים: ' + VALID_DAYS.join(', '),
    }),
  time: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'any.required': 'שעה היא שדה חובה',
      'string.pattern.base': 'שעה חייבת להיות בפורמט HH:MM',
    }),
  duration: Joi.number()
    .valid(...VALID_DURATIONS)
    .required()
    .messages({
      'any.required': 'משך השיעור הוא שדה חובה',
      'any.only': 'משך השיעור חייב להיות אחד מהערכים הבאים: ' + VALID_DURATIONS.join(', '),
    }),
  location: Joi.string().allow('', null).default(null),
  // Optional fields for extended functionality
  startDate: Joi.date().default(() => new Date()),
  endDate: Joi.date().allow(null).default(null),
  isActive: Joi.boolean().default(true),
  notes: Joi.string().allow('', null).default(null),
  isRecurring: Joi.boolean().default(false),
  scheduleInfo: Joi.object().unknown(true).allow(null).default(null),
  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().default(() => new Date()),
});

// Schema for creating a new student (all required fields)
export const studentSchema = Joi.object({
  personalInfo: Joi.object({
    fullName: Joi.string().required(),
    phone: Joi.string()
      .pattern(/^05\d{8}$/)
      .allow(null, ''),
    age: Joi.number().min(0).max(99).allow(null),
    address: Joi.string().allow(null, ''),
    parentName: Joi.string().allow(null, ''),
    parentPhone: Joi.string()
      .pattern(/^05\d{8}$/)
      .allow(null, ''),
    parentEmail: Joi.string().email().allow(null, ''),
    studentEmail: Joi.string().email().allow(null, ''),
  }).required(),

  academicInfo: Joi.object({
    instrumentProgress: Joi.array()
      .items(instrumentProgressSchema)
      .min(1)
      .required(),
    class: Joi.string()
      .valid(...VALID_CLASSES)
      .required(),
    tests: Joi.object({
      bagrutId: Joi.string().allow(null).default(null),
    }).default({ bagrutId: null }),
  }).required(),

  enrollments: Joi.object({
    orchestraIds: Joi.array().items(Joi.string()).default([]),
    ensembleIds: Joi.array().items(Joi.string()).default([]),
    theoryLessonIds: Joi.array().items(Joi.string()).default([]),

    schoolYears: Joi.array()
      .items(
        Joi.object({
          schoolYearId: Joi.string().required(),
          isActive: Joi.boolean().default(true),
        })
      )
      .default([]),
  }).default({ orchestraIds: [], ensembleIds: [], theoryLessonIds: [], schoolYears: [] }),

  // Legacy field, maintained for backward compatibility
  teacherIds: Joi.array().items(Joi.string()).default([]),
  
  // New field for comprehensive teacher assignments with schedule slots
  teacherAssignments: Joi.array().items(teacherAssignmentSchema).default([]),

  isActive: Joi.boolean().default(true),
  createdAt: Joi.date().default(new Date()),
  updatedAt: Joi.date().default(new Date()),
});

// Schema for teacher assignment updates
const teacherAssignmentUpdateSchema = Joi.object({
  teacherId: Joi.string().optional(),
  scheduleSlotId: Joi.string().optional(),
  day: Joi.string()
    .valid(...VALID_DAYS)
    .optional()
    .messages({
      'any.only': 'יום חייב להיות אחד מהימים הבאים: ' + VALID_DAYS.join(', '),
    }),
  time: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .messages({
      'string.pattern.base': 'שעה חייבת להיות בפורמט HH:MM',
    }),
  duration: Joi.number()
    .valid(...VALID_DURATIONS)
    .optional()
    .messages({
      'any.only': 'משך השיעור חייב להיות אחד מהערכים הבאים: ' + VALID_DURATIONS.join(', '),
    }),
  // Optional fields for extended functionality
  startDate: Joi.date().optional(),
  endDate: Joi.date().allow(null).optional(),
  isActive: Joi.boolean().optional(),
  notes: Joi.string().allow('', null).optional(),
  isRecurring: Joi.boolean().optional(),
  scheduleInfo: Joi.object().unknown(true).allow(null).optional(),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().default(() => new Date()),
});

// Schema for updating a student (partial updates allowed)
export const studentUpdateSchema = Joi.object({
  personalInfo: Joi.object({
    fullName: Joi.string(),
    phone: Joi.string()
      .pattern(/^05\d{8}$/)
      .allow(null, ''),
    age: Joi.number().min(0).max(99).allow(null),
    address: Joi.string().allow(null, ''),
    parentName: Joi.string().allow(null, ''),
    parentPhone: Joi.string()
      .pattern(/^05\d{8}$/)
      .allow(null, ''),
    parentEmail: Joi.string().email().allow(null, ''),
    studentEmail: Joi.string().email().allow(null, ''),
  }),

  academicInfo: Joi.object({
    instrumentProgress: Joi.array().items(instrumentProgressSchema),
    class: Joi.string().valid(...VALID_CLASSES),
    tests: Joi.object({
      bagrutId: Joi.string().allow(null),
    }),
  }),

  enrollments: Joi.object({
    orchestraIds: Joi.array().items(Joi.string()),
    ensembleIds: Joi.array().items(Joi.string()),
    theoryLessonIds: Joi.array().items(Joi.string()),

    schoolYears: Joi.array().items(
      Joi.object({
        schoolYearId: Joi.string().required(),
        isActive: Joi.boolean().default(true),
      })
    ),
  }),
  
  // Legacy field, maintained for backward compatibility
  teacherIds: Joi.array().items(Joi.string()),
  
  // New field for comprehensive teacher assignments with schedule slots
  teacherAssignments: Joi.array().items(teacherAssignmentUpdateSchema),

  isActive: Joi.boolean(),
  updatedAt: Joi.date().default(new Date()),
});

export function validateStudent(student, isUpdate = false, isAdmin = false) {
  let schema = isUpdate ? studentUpdateSchema : studentSchema;
  
  // If it's an admin or update operation, make the class field optional
  if (isAdmin || isUpdate) {
    schema = schema.fork(['academicInfo.class'], (classSchema) => classSchema.optional());
  }
  
  return schema.validate(student, { abortEarly: false });
}

export const STUDENT_CONSTANTS = {
  VALID_CLASSES,
  VALID_STAGES,
  VALID_INSTRUMENTS,
  VALID_DAYS,
  VALID_DURATIONS,
  TEST_STATUSES,
};
