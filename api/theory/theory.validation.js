import Joi from 'joi';

export const VALID_DAYS_OF_WEEK = {
  0: 'ראשון', // Sunday
  1: 'שני', // Monday
  2: 'שלישי', // Tuesday
  3: 'רביעי', // Wednesday
  4: 'חמישי', // Thursday
  5: 'שישי', // Friday
  6: 'שבת', // Saturday
};

// Theory lesson categories based on the schedule image
export const VALID_THEORY_CATEGORIES = [
  'תלמידים חדשים ב-ד',
  'מתחילים',
  'מתחילים ב',
  'מתחילים ד',
  'מתקדמים ב',
  'מתקדמים א',
  'מתקדמים ג',
  'תלמידים חדשים בוגרים (ה - ט)',
  'תלמידים חדשים צעירים',
  'הכנה לרסיטל קלאסי יא',
  "הכנה לרסיטל רוק\\פופ\\ג'אז יא",
  "הכנה לרסיטל רוק\\פופ\\ג'אז יב",
  'מגמה',
  'תאוריה כלי',
];

// Valid locations for theory lessons
export const VALID_THEORY_LOCATIONS = [
  'אולם ערן',
  'סטודיו קאמרי 1',
  'סטודיו קאמרי 2',
  'אולפן הקלטות',
  'חדר חזרות 1',
  'חדר חזרות 2',
  'חדר מחשבים',
  'חדר 1',
  'חדר 2',
  'חדר חזרות',
  'חדר 5',
  'חדר 6',
  'חדר 7',
  'חדר 8',
  'חדר 9',
  'חדר 10',
  'חדר 11',
  'חדר 12',
  'חדר 13',
  'חדר 14',
  'חדר 15',
  'חדר 16',
  'חדר 17',
  'חדר 18',
  'חדר 19',
  'חדר 20',
  'חדר 21',
  'חדר 22',
  'חדר 23',
  'חדר 24',
  'חדר 25',
  'חדר 26',
  'חדר תאוריה א',
  'חדר תאוריה ב',
];

// Schema for individual theory lesson
export const theoryLessonSchema = Joi.object({
  category: Joi.string()
    .valid(...VALID_THEORY_CATEGORIES)
    .required()
    .messages({
      'any.only': `Category must be one of: ${VALID_THEORY_CATEGORIES.join(
        ', '
      )}`,
      'any.required': 'Theory lesson category is required',
    }),

  teacherId: Joi.string().required().messages({
    'any.required': 'Teacher ID is required for theory lesson',
  }),

  date: Joi.date().required().messages({
    'any.required': 'Date is required for theory lesson',
  }),

  dayOfWeek: Joi.number().integer().min(0).max(6).required().messages({
    'number.min': 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
    'number.max': 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
    'any.required': 'Day of week is required',
  }),

  startTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'Start time must be in HH:MM format (e.g., 14:30)',
      'any.required': 'Start time is required',
    }),

  endTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'string.pattern.base': 'End time must be in HH:MM format (e.g., 15:15)',
      'any.required': 'End time is required',
    }),

  location: Joi.string()
    .valid(...VALID_THEORY_LOCATIONS)
    .required()
    .messages({
      'any.only': `Location must be one of the valid classroom locations`,
      'any.required': 'Location is required',
    }),

  studentIds: Joi.array().items(
    Joi.string().custom((value, helpers) => {
      // Graceful ObjectId validation to prevent BSONError
      if (typeof value !== 'string') {
        return helpers.error('string.base', { value });
      }
      
      if (value.length !== 24) {
        return helpers.error('string.length', { value, limit: 24 });
      }
      
      if (!/^[0-9a-fA-F]{24}$/.test(value)) {
        return helpers.error('string.hex', { value });
      }
      
      return value;
    }).messages({
      'string.base': 'Student ID must be a string',
      'string.hex': 'Student ID must be a valid hexadecimal string',
      'string.length': 'Student ID must be exactly 24 characters long',
    })
  ).default([]).messages({
    'array.base': 'Student IDs must be an array',
  }),

  attendance: Joi.object({
    present: Joi.array().items(Joi.string()).default([]),
    absent: Joi.array().items(Joi.string()).default([]),
  }).default({ present: [], absent: [] }),

  notes: Joi.string().allow('', null).default('').messages({
    'string.base': 'Notes must be a string',
  }),

  syllabus: Joi.string().allow('', null).default('').messages({
    'string.base': 'Syllabus must be a string',
  }),

  homework: Joi.string().allow('', null).default('').messages({
    'string.base': 'Homework must be a string',
  }),

  schoolYearId: Joi.string().required().messages({
    'any.required': 'School year ID is required',
  }),

  isActive: Joi.boolean().default(true),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().default(() => new Date()),
}).custom((obj, helpers) => {
  // Custom validation to ensure end time is after start time
  const startTime = obj.startTime;
  const endTime = obj.endTime;

  if (startTime && endTime) {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      return helpers.error('any.invalid', {
        message: 'End time must be after start time',
      });
    }
  }

  return obj;
});

// Schema for bulk creation of theory lessons
export const theoryBulkCreateSchema = Joi.object({
  category: Joi.string()
    .valid(...VALID_THEORY_CATEGORIES)
    .required(),

  teacherId: Joi.string().required(),

  startDate: Joi.date().required().messages({
    'any.required': 'Start date is required for bulk creation',
  }),

  endDate: Joi.date().min(Joi.ref('startDate')).required().messages({
    'date.min': 'End date must be after start date',
    'any.required': 'End date is required for bulk creation',
  }),

  dayOfWeek: Joi.number().integer().min(0).max(6).required(),

  startTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required(),

  endTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required(),

  location: Joi.string()
    .valid(...VALID_THEORY_LOCATIONS)
    .required(),

  studentIds: Joi.array().items(
    Joi.string().custom((value, helpers) => {
      // Graceful ObjectId validation to prevent BSONError
      if (typeof value !== 'string') {
        return helpers.error('string.base', { value });
      }
      
      if (value.length !== 24) {
        return helpers.error('string.length', { value, limit: 24 });
      }
      
      if (!/^[0-9a-fA-F]{24}$/.test(value)) {
        return helpers.error('string.hex', { value });
      }
      
      return value;
    }).messages({
      'string.base': 'Student ID must be a string',
      'string.hex': 'Student ID must be a valid hexadecimal string',
      'string.length': 'Student ID must be exactly 24 characters long',
    })
  ).default([]),

  notes: Joi.string().allow('', null).default(''),

  syllabus: Joi.string().allow('', null).default(''),

  excludeDates: Joi.array().items(Joi.date()).default([]).messages({
    'array.base': 'Exclude dates must be an array of dates',
  }),

  schoolYearId: Joi.string().required().messages({
    'any.required': 'School year ID is required for bulk creation',
  }),
}).custom((obj, helpers) => {
  // Custom validation for time consistency
  const startTime = obj.startTime;
  const endTime = obj.endTime;

  if (startTime && endTime) {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      return helpers.error('any.invalid', {
        message: 'End time must be after start time',
      });
    }
  }

  return obj;
});

// Schema for updating theory lessons (partial updates allowed)
export const theoryLessonUpdateSchema = Joi.object({
  category: Joi.string()
    .valid(...VALID_THEORY_CATEGORIES)
    .optional()
    .messages({
      'any.only': `Category must be one of: ${VALID_THEORY_CATEGORIES.join(
        ', '
      )}`,
    }),

  teacherId: Joi.string().optional(),

  date: Joi.date().optional(),

  dayOfWeek: Joi.number().integer().min(0).max(6).optional().messages({
    'number.min': 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
    'number.max': 'Day of week must be between 0 (Sunday) and 6 (Saturday)',
  }),

  startTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .messages({
      'string.pattern.base': 'Start time must be in HH:MM format (e.g., 14:30)',
    }),

  endTime: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .optional()
    .messages({
      'string.pattern.base': 'End time must be in HH:MM format (e.g., 15:15)',
    }),

  location: Joi.string()
    .valid(...VALID_THEORY_LOCATIONS)
    .optional()
    .messages({
      'any.only': `Location must be one of the valid classroom locations`,
    }),

  studentIds: Joi.array().items(
    Joi.string().custom((value, helpers) => {
      // Graceful ObjectId validation to prevent BSONError
      if (typeof value !== 'string') {
        return helpers.error('string.base', { value });
      }
      
      if (value.length !== 24) {
        return helpers.error('string.length', { value, limit: 24 });
      }
      
      if (!/^[0-9a-fA-F]{24}$/.test(value)) {
        return helpers.error('string.hex', { value });
      }
      
      return value;
    }).messages({
      'string.base': 'Student ID must be a string',
      'string.hex': 'Student ID must be a valid hexadecimal string',
      'string.length': 'Student ID must be exactly 24 characters long',
    })
  ).optional().messages({
    'array.base': 'Student IDs must be an array',
  }),

  attendance: Joi.object({
    present: Joi.array().items(Joi.string()).default([]),
    absent: Joi.array().items(Joi.string()).default([]),
  }).optional(),

  notes: Joi.string().allow('', null).optional().messages({
    'string.base': 'Notes must be a string',
  }),

  syllabus: Joi.string().allow('', null).optional().messages({
    'string.base': 'Syllabus must be a string',
  }),

  homework: Joi.string().allow('', null).optional().messages({
    'string.base': 'Homework must be a string',
  }),

  schoolYearId: Joi.string().optional(),

  isActive: Joi.boolean().optional(),

  updatedAt: Joi.date().default(() => new Date()),
}).custom((obj, helpers) => {
  // Custom validation to ensure end time is after start time (only if both provided)
  const startTime = obj.startTime;
  const endTime = obj.endTime;

  if (startTime && endTime) {
    const [startHour, startMin] = startTime.split(':').map(Number);
    const [endHour, endMin] = endTime.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    if (endMinutes <= startMinutes) {
      return helpers.error('any.invalid', {
        message: 'End time must be after start time',
      });
    }
  }

  return obj;
});

// Schema for attendance updates
export const theoryAttendanceSchema = Joi.object({
  present: Joi.array().items(Joi.string()).default([]).messages({
    'array.base': 'Present students must be an array of student IDs',
  }),

  absent: Joi.array().items(Joi.string()).default([]).messages({
    'array.base': 'Absent students must be an array of student IDs',
  }),
});

// Validation functions
export function validateTheoryLesson(theoryLesson) {
  return theoryLessonSchema.validate(theoryLesson, {
    abortEarly: false,
    stripUnknown: false,
  });
}

export function validateTheoryBulkCreate(bulkData) {
  return theoryBulkCreateSchema.validate(bulkData, {
    abortEarly: false,
    stripUnknown: false,
  });
}

export function validateTheoryLessonUpdate(theoryLessonUpdate) {
  return theoryLessonUpdateSchema.validate(theoryLessonUpdate, {
    abortEarly: false,
    stripUnknown: false,
  });
}

export function validateTheoryAttendance(attendance) {
  return theoryAttendanceSchema.validate(attendance, {
    abortEarly: false,
    stripUnknown: false,
  });
}

// Bulk delete validation schemas
const theoryBulkDeleteByDateSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required(),
});

const theoryBulkDeleteByCategorySchema = Joi.object({
  category: Joi.string().valid(...VALID_THEORY_CATEGORIES).required(),
});

const theoryBulkDeleteByTeacherSchema = Joi.object({
  teacherId: Joi.string().hex().length(24).required(),
});

// Bulk delete validation functions
export function validateTheoryBulkDeleteByDate(deleteData) {
  return theoryBulkDeleteByDateSchema.validate(deleteData, {
    abortEarly: false,
    stripUnknown: false,
  });
}

export function validateTheoryBulkDeleteByCategory(deleteData) {
  return theoryBulkDeleteByCategorySchema.validate(deleteData, {
    abortEarly: false,
    stripUnknown: false,
  });
}

export function validateTheoryBulkDeleteByTeacher(deleteData) {
  return theoryBulkDeleteByTeacherSchema.validate(deleteData, {
    abortEarly: false,
    stripUnknown: false,
  });
}

// Export constants for use in other files
export const THEORY_CONSTANTS = {
  VALID_DAYS_OF_WEEK,
  VALID_THEORY_CATEGORIES,
  VALID_THEORY_LOCATIONS,
};
