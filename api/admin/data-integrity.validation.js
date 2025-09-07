/**
 * Validation schemas for data integrity endpoints
 * Comprehensive validation for integrity checks, repairs, and reports
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

// Valid integrity check types
const INTEGRITY_CHECK_TYPES = [
  'MISSING_REFERENCES',
  'ORPHANED_RECORDS',
  'DUPLICATE_RECORDS',
  'INVALID_DATA_TYPES',
  'CONSTRAINT_VIOLATIONS',
  'INCONSISTENT_RELATIONSHIPS',
  'MISSING_REQUIRED_FIELDS',
  'INVALID_ENUMS',
  'DATE_CONSISTENCY',
  'BUSINESS_RULE_VIOLATIONS'
];

// Valid repair strategies
const REPAIR_STRATEGIES = [
  'AUTO_FIX',           // Automatically fix issues
  'REMOVE_ORPHANED',    // Remove orphaned records
  'CREATE_MISSING',     // Create missing references
  'UPDATE_INVALID',     // Update invalid values
  'MERGE_DUPLICATES',   // Merge duplicate records
  'SKIP_UNFIXABLE'      // Skip issues that can't be auto-fixed
];

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

/**
 * Schema for integrity validation request
 */
export const integrityValidationSchema = Joi.object({
  collections: Joi.array()
    .items(Joi.string().valid(...VALID_COLLECTIONS))
    .min(1)
    .default(VALID_COLLECTIONS)
    .description('אוספי נתונים לבדיקה'),
    
  checkTypes: Joi.array()
    .items(Joi.string().valid(...INTEGRITY_CHECK_TYPES))
    .min(1)
    .default(INTEGRITY_CHECK_TYPES)
    .description('סוגי בדיקות שלמות'),
    
  deepScan: Joi.boolean()
    .default(false)
    .description('סריקה עמוקה (איטית יותר אך יותר מקיפה)'),
    
  includeWarnings: Joi.boolean()
    .default(true)
    .description('כללת אזהרות בדוח'),
    
  batchSize: Joi.number()
    .integer()
    .min(10)
    .max(1000)
    .default(100)
    .description('גודל אצווה לעיבוד'),
    
  maxIssues: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .default(1000)
    .description('מספר מקסימלי של בעיות לדווח'),
    
  timeout: Joi.number()
    .integer()
    .min(30)
    .max(3600)
    .default(300)
    .description('זמן מקסימלי לביצוע (שניות)'),
    
  parallelChecks: Joi.boolean()
    .default(true)
    .description('ביצוע בדיקות במקביל')
}).messages({
  'array.min': 'יש לבחור לפחות פריט אחד',
  'number.min': 'ערך מינימלי: {#limit}',
  'number.max': 'ערך מקסימלי: {#limit}'
});

/**
 * Schema for integrity repair request
 */
export const integrityRepairSchema = Joi.object({
  targetCollections: Joi.array()
    .items(Joi.string().valid(...VALID_COLLECTIONS))
    .min(1)
    .required()
    .description('אוספי נתונים לתיקון'),
    
  repairStrategies: Joi.array()
    .items(Joi.string().valid(...REPAIR_STRATEGIES))
    .min(1)
    .default(['AUTO_FIX', 'SKIP_UNFIXABLE'])
    .description('אסטרטגיות תיקון'),
    
  autoFix: Joi.boolean()
    .default(false)
    .description('תיקון אוטומטי (מבלי לחכות לאישור)'),
    
  maxRepairs: Joi.number()
    .integer()
    .min(1)
    .max(10000)
    .default(100)
    .description('מספר מקסימלי של תיקונים'),
    
  dryRun: Joi.boolean()
    .default(true)
    .description('הרצה לדוגמה'),
    
  createBackup: Joi.boolean()
    .default(true)
    .description('יצירת גיבוי לפני תיקון'),
    
  repairPriority: Joi.string()
    .valid('HIGH', 'MEDIUM', 'LOW', 'CRITICAL_ONLY')
    .default('MEDIUM')
    .description('עדיפות תיקונים'),
    
  excludeIssueTypes: Joi.array()
    .items(Joi.string().valid(...INTEGRITY_CHECK_TYPES))
    .default([])
    .description('סוגי בעיות להחרגה מהתיקון'),
    
  confirmationRequired: Joi.boolean()
    .default(true)
    .description('דרישת אישור לפני תיקון'),
    
  notifyOnCompletion: Joi.boolean()
    .default(true)
    .description('התראה בסיום'),
    
  adminPassword: Joi.string()
    .when('autoFix', {
      is: true,
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .description('סיסמת מנהל לתיקון אוטומטי'),
    
  reason: Joi.string()
    .max(500)
    .description('סיבת התיקון')
}).messages({
  'any.required': 'שדה {#label} הוא חובה',
  'string.max': 'שדה {#label} לא יכול להכיל יותר מ-{#limit} תווים'
});

/**
 * Schema for integrity report generation
 */
export const integrityReportSchema = Joi.object({
  reportType: Joi.string()
    .valid('SUMMARY', 'DETAILED', 'CRITICAL_ONLY', 'TRENDS')
    .default('SUMMARY')
    .description('סוג הדוח'),
    
  format: Joi.string()
    .valid('JSON', 'HTML', 'CSV', 'PDF')
    .default('JSON')
    .description('פורמט הדוח'),
    
  includeCharts: Joi.boolean()
    .default(false)
    .description('כללת גרפים בדוח'),
    
  timeRange: Joi.object({
    start: Joi.date().iso().required(),
    end: Joi.date().iso().min(Joi.ref('start')).required()
  })
  .default(() => ({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    end: new Date()
  }))
  .description('טווח זמן לדוח'),
    
  groupBy: Joi.string()
    .valid('COLLECTION', 'ISSUE_TYPE', 'SEVERITY', 'DATE')
    .default('ISSUE_TYPE')
    .description('קיבוץ תוצאות לפי'),
    
  includeResolved: Joi.boolean()
    .default(false)
    .description('כללת בעיות פתורות'),
    
  minSeverity: Joi.string()
    .valid('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
    .default('LOW')
    .description('רמת חומרה מינימלית'),
    
  emailReport: Joi.boolean()
    .default(false)
    .description('שליחת הדוח במייל'),
    
  emailAddresses: Joi.array()
    .items(Joi.string().email())
    .when('emailReport', {
      is: true,
      then: Joi.min(1).required(),
      otherwise: Joi.optional()
    })
    .description('כתובות מייל לשליחת הדוח')
}).messages({
  'date.min': 'תאריך הסיום חייב להיות אחרי תאריך ההתחלה',
  'string.email': 'כתובת מייל לא תקינה',
  'array.min': 'יש לציין לפחות כתובת מייל אחת'
});

/**
 * Schema for orphaned students query
 */
export const orphanedStudentsQuerySchema = Joi.object({
  includeInactive: Joi.boolean()
    .default(false)
    .description('כללת תלמידים לא פעילים'),
    
  orphanType: Joi.string()
    .valid('ALL', 'NO_LESSONS', 'NO_ATTENDANCE', 'NO_ORCHESTRA', 'NO_TEACHER')
    .default('ALL')
    .description('סוג היתמות'),
    
  minDaysSinceActivity: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(30)
    .description('מספר ימים מינימלי ללא פעילות'),
    
  includeMetrics: Joi.boolean()
    .default(true)
    .description('כללת מטריקות במענה'),
    
  sortBy: Joi.string()
    .valid('lastActivity', 'name', 'createdAt', 'orphanScore')
    .default('lastActivity')
    .description('מיון לפי'),
    
  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .description('כיוון המיון'),
    
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
    
  exportFormat: Joi.string()
    .valid('JSON', 'CSV', 'XLSX')
    .description('פורמט ייצוא')
}).messages({
  'number.min': 'ערך מינימלי: {#limit}',
  'number.max': 'ערך מקסימלי: {#limit}'
});

/**
 * Validation middleware factory for data integrity endpoints
 */
export function validateDataIntegrity(schema) {
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
        code: 'DATA_INTEGRITY_VALIDATION_FAILED',
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
export function validateIntegrityQueryParams(schema) {
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
        code: 'INTEGRITY_QUERY_VALIDATION_FAILED',
        details: errorDetails
      });
    }
    
    req.validatedQuery = value;
    next();
  };
}

/**
 * Advanced validation for complex repair scenarios
 */
export function validateRepairContext(req, res, next) {
  const { validatedData } = req;
  
  // Business rule: Auto-fix requires admin password
  if (validatedData.autoFix && !validatedData.adminPassword) {
    return res.status(400).json({
      success: false,
      error: 'MISSING_ADMIN_PASSWORD',
      message: 'תיקון אוטומטי דורש סיסמת מנהל',
      code: 'REPAIR_AUTHORIZATION_REQUIRED'
    });
  }
  
  // Business rule: High-risk operations require confirmation
  const highRiskStrategies = ['REMOVE_ORPHANED', 'MERGE_DUPLICATES'];
  const hasHighRisk = validatedData.repairStrategies?.some(strategy => 
    highRiskStrategies.includes(strategy)
  );
  
  if (hasHighRisk && !validatedData.confirmationRequired && !validatedData.adminPassword) {
    return res.status(400).json({
      success: false,
      error: 'HIGH_RISK_OPERATION',
      message: 'פעולות מסוכנות דורשות אישור או סיסמת מנהל',
      code: 'HIGH_RISK_REPAIR_UNAUTHORIZED'
    });
  }
  
  next();
}