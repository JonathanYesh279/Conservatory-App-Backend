/**
 * Validation schemas for cascade deletion endpoints
 * Supports Hebrew error messages and comprehensive validation
 */

import Joi from 'joi';

// Valid MongoDB collection names in the conservatory system
const VALID_COLLECTIONS = [
  'students',
  'teachers', 
  'theoryLessons',
  'rehearsals',
  'orchestras',
  'privateAttendance',
  'privateLessons',
  'bagrutPresentations',
  'schoolYears'
];

// MongoDB ObjectId validation pattern
const objectIdPattern = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for cascade deletion preview request
 */
export const cascadeDeletionPreviewSchema = Joi.object({
  preserveAcademic: Joi.boolean()
    .default(false)
    .description('שמירת מידע אקדמי (ציונים, נוכחות)'),
  
  hardDelete: Joi.boolean()
    .default(false)
    .description('מחיקה מוחלטת (לא ניתן לשחזור)'),
    
  createBackup: Joi.boolean()
    .default(true)
    .description('יצירת גיבוי לפני מחיקה'),
    
  dryRun: Joi.boolean()
    .default(true)
    .description('הרצה לדוגמה ללא ביצוע מחיקה בפועל'),
    
  includeAnalytics: Joi.boolean()
    .default(false)
    .description('כללת נתוני אנליטיקה במחיקה')
}).messages({
  'any.required': 'שדה {#label} הוא חובה',
  'boolean.base': 'שדה {#label} חייב להיות true או false'
});

/**
 * Schema for cascade deletion execution
 */
export const cascadeDeletionExecuteSchema = Joi.object({
  preserveAcademic: Joi.boolean()
    .default(false)
    .description('שמירת מידע אקדמי'),
    
  hardDelete: Joi.boolean()
    .default(false)
    .description('מחיקה מוחלטת'),
    
  createBackup: Joi.boolean()
    .default(true)
    .description('יצירת גיבוי'),
    
  confirmationCode: Joi.string()
    .required()
    .min(6)
    .max(10)
    .description('קוד אישור למחיקה'),
    
  reason: Joi.string()
    .max(500)
    .description('סיבת המחיקה'),
    
  adminPassword: Joi.string()
    .when('hardDelete', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .description('סיסמת מנהל למחיקה קשה')
}).messages({
  'any.required': 'שדה {#label} הוא חובה',
  'string.min': 'שדה {#label} חייב להכיל לפחות {#limit} תווים',
  'string.max': 'שדה {#label} לא יכול להכיל יותר מ-{#limit} תווים'
});

/**
 * Schema for orphaned references cleanup
 */
export const orphanedCleanupSchema = Joi.object({
  collections: Joi.array()
    .items(Joi.string().valid(...VALID_COLLECTIONS))
    .min(1)
    .default(VALID_COLLECTIONS)
    .description('רשימת אוספי הנתונים לניקוי'),
    
  dryRun: Joi.boolean()
    .default(true)
    .description('הרצה לדוגמה'),
    
  batchSize: Joi.number()
    .integer()
    .min(10)
    .max(1000)
    .default(100)
    .description('גודל אצווה לעיבוד'),
    
  maxOrphansToProcess: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .default(1000)
    .description('מספר מקסימלי של רפרנסים יתומים לעיבוד'),
    
  includeBackup: Joi.boolean()
    .default(true)
    .description('כללת גיבוי במהלך הניקוי'),
    
  autoConfirm: Joi.boolean()
    .default(false)
    .description('אישור אוטומטי לניקוי')
}).messages({
  'array.min': 'יש לבחור לפחות אוסף נתונים אחד',
  'number.min': 'ערך מינימלי: {#limit}',
  'number.max': 'ערך מקסימלי: {#limit}'
});

/**
 * Schema for rollback deletion request
 */
export const rollbackDeletionSchema = Joi.object({
  snapshotId: Joi.string()
    .pattern(objectIdPattern)
    .required()
    .description('מזהה תמונת המצב'),
    
  confirmRollback: Joi.boolean()
    .valid(true)
    .required()
    .description('אישור ביצוע שחזור'),
    
  preserveNewData: Joi.boolean()
    .default(false)
    .description('שמירת נתונים חדשים שנוצרו אחרי המחיקה'),
    
  rollbackReason: Joi.string()
    .max(500)
    .description('סיבת השחזור'),
    
  adminPassword: Joi.string()
    .required()
    .description('סיסמת מנהל לשחזור')
}).messages({
  'string.pattern.base': 'מזהה תמונת המצב אינו תקין',
  'any.only': 'יש לאשר את ביצוע השחזור',
  'any.required': 'שדה {#label} הוא חובה'
});

/**
 * Schema for audit log query parameters
 */
export const auditLogQuerySchema = Joi.object({
  startDate: Joi.date()
    .iso()
    .description('תאריך התחלה'),
    
  endDate: Joi.date()
    .iso()
    .min(Joi.ref('startDate'))
    .description('תאריך סיום'),
    
  action: Joi.string()
    .valid('CASCADE_DELETE', 'ROLLBACK', 'CLEANUP', 'REPAIR')
    .description('סוג הפעולה'),
    
  adminId: Joi.string()
    .pattern(objectIdPattern)
    .description('מזהה מנהל'),
    
  entityType: Joi.string()
    .valid('student', 'teacher', 'orchestra', 'lesson')
    .description('סוג הישות'),
    
  status: Joi.string()
    .valid('SUCCESS', 'FAILED', 'PARTIAL')
    .description('סטטוס הפעולה'),
    
  limit: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(100)
    .description('מספר תוצאות מקסימלי'),
    
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .description('מספר עמוד'),
    
  sortBy: Joi.string()
    .valid('timestamp', 'action', 'status', 'adminId')
    .default('timestamp')
    .description('מיון לפי'),
    
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .description('כיוון המיון')
}).messages({
  'date.min': 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה',
  'date.iso': 'פורמט תאריך לא תקין (נדרש ISO 8601)'
});

/**
 * Validation middleware factory for cascade deletion endpoints
 */
export function validateCascadeDeletion(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'שגיאה בוולידציה של הבקשה',
        code: 'CASCADE_DELETION_VALIDATION_FAILED',
        details: errorDetails
      });
    }
    
    req.validatedData = value;
    next();
  };
}

/**
 * Validation middleware for query parameters
 */
export function validateQueryParams(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });
    
    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));
      
      return res.status(400).json({
        success: false,
        error: 'QUERY_VALIDATION_ERROR',
        message: 'שגיאה בוולידציה של פרמטרי השאילתה',
        code: 'QUERY_PARAMS_VALIDATION_FAILED',
        details: errorDetails
      });
    }
    
    req.validatedQuery = value;
    next();
  };
}

/**
 * Validation middleware for path parameters
 */
export function validatePathParams(req, res, next) {
  const { studentId, snapshotId } = req.params;
  
  if (studentId && !objectIdPattern.test(studentId)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_STUDENT_ID',
      message: 'מזהה התלמיד אינו תקין',
      code: 'INVALID_PATH_PARAMETER'
    });
  }
  
  if (snapshotId && !objectIdPattern.test(snapshotId)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_SNAPSHOT_ID',
      message: 'מזהה תמונת המצב אינו תקין',
      code: 'INVALID_PATH_PARAMETER'
    });
  }
  
  next();
}