/**
 * Student Teacher Assignments Validation
 * 
 * Enhanced validation for student teacherAssignments to ensure data consistency
 * as outlined in the backend synchronization guide.
 */

import Joi from 'joi';
import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

// Valid days in Hebrew
const VALID_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// Valid lesson durations (in minutes)
const VALID_DURATIONS = [15, 30, 45, 60, 90, 120, 180];

/**
 * Teacher Assignment Schema
 * This schema validates individual teacher assignments within student records
 */
export const teacherAssignmentSchema = Joi.object({
  teacherId: Joi.string()
    .required()
    .custom((value, helpers) => {
      if (!ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.required': 'מזהה המורה הוא שדה חובה',
      'any.invalid': 'מזהה המורה אינו תקין'
    }),
    
  scheduleSlotId: Joi.string()
    .optional()
    .custom((value, helpers) => {
      if (value && !ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'מזהה השיבוץ אינו תקין'
    }),
    
  timeBlockId: Joi.string()
    .optional()
    .custom((value, helpers) => {
      if (value && !ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'מזהה בלוק הזמן אינו תקין'
    }),
    
  lessonId: Joi.string()
    .optional()
    .custom((value, helpers) => {
      if (value && !ObjectId.isValid(value)) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'מזהה השיעור אינו תקין'
    }),
    
  day: Joi.string()
    .valid(...VALID_DAYS)
    .required()
    .messages({
      'any.required': 'יום השבוע הוא שדה חובה',
      'any.only': `יום השבוע חייב להיות אחד מהערכים הבאים: ${VALID_DAYS.join(', ')}`
    }),
    
  time: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .required()
    .messages({
      'any.required': 'שעת השיעור היא שדה חובה',
      'string.pattern.base': 'שעת השיעור חייבת להיות בפורמט HH:MM (לדוגמא: 14:30)'
    }),
    
  duration: Joi.number()
    .valid(...VALID_DURATIONS)
    .required()
    .messages({
      'any.required': 'משך השיעור הוא שדה חובה',
      'any.only': `משך השיעור חייב להיות אחד מהערכים הבאים: ${VALID_DURATIONS.join(', ')} דקות`
    }),
    
  location: Joi.string()
    .optional()
    .allow('', null)
    .max(100)
    .messages({
      'string.max': 'מיקום השיעור יכול להכיל עד 100 תווים'
    }),
    
  notes: Joi.string()
    .optional()
    .allow('', null)
    .max(500)
    .messages({
      'string.max': 'הערות יכולות להכיל עד 500 תווים'
    }),
    
  scheduleInfo: Joi.object({
    day: Joi.string().valid(...VALID_DAYS),
    startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    duration: Joi.number().valid(...VALID_DURATIONS),
    location: Joi.string().allow('', null),
    notes: Joi.string().allow('', null)
  }).optional(),
  
  startDate: Joi.date()
    .optional()
    .default(() => new Date())
    .messages({
      'date.base': 'תאריך התחלה חייב להיות תאריך תקין'
    }),
    
  endDate: Joi.date()
    .optional()
    .allow(null)
    .greater(Joi.ref('startDate'))
    .messages({
      'date.base': 'תאריך סיום חייב להיות תאריך תקין',
      'date.greater': 'תאריך סיום חייב להיות מאוחר יותר מתאריך ההתחלה'
    }),
    
  isActive: Joi.boolean()
    .optional()
    .default(true),
    
  isRecurring: Joi.boolean()
    .optional()
    .default(true),
    
  createdAt: Joi.date()
    .optional()
    .default(() => new Date()),
    
  updatedAt: Joi.date()
    .optional()
    .default(() => new Date())
});

/**
 * Complete Teacher Assignments Array Schema
 */
export const teacherAssignmentsArraySchema = Joi.array()
  .items(teacherAssignmentSchema)
  .optional()
  .default([]);

/**
 * Validate a single teacher assignment
 * @param {Object} assignment - Teacher assignment object
 * @returns {Object} Joi validation result
 */
export function validateTeacherAssignment(assignment) {
  return teacherAssignmentSchema.validate(assignment, { 
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true 
  });
}

/**
 * Validate an array of teacher assignments
 * @param {Array} assignments - Array of teacher assignments
 * @returns {Object} Joi validation result
 */
export function validateTeacherAssignments(assignments) {
  return teacherAssignmentsArraySchema.validate(assignments, { 
    abortEarly: false,
    allowUnknown: false,
    stripUnknown: true 
  });
}

/**
 * Advanced validation with database consistency checks
 * @param {Array} assignments - Teacher assignments to validate
 * @param {string} studentId - Student ID for context
 * @returns {Promise<Object>} Comprehensive validation result
 */
export async function validateTeacherAssignmentsWithDB(assignments, studentId) {
  const validation = {
    isValid: true,
    errors: [],
    warnings: [],
    validatedAssignments: [],
    fixes: []
  };

  try {
    // First, run basic Joi validation
    const { error, value } = validateTeacherAssignments(assignments);
    
    if (error) {
      validation.isValid = false;
      validation.errors.push(...error.details.map(detail => ({
        type: 'VALIDATION_ERROR',
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      })));
      return validation;
    }

    validation.validatedAssignments = value || [];

    // Perform database consistency checks
    const teacherCollection = await getCollection('teacher');
    
    for (let i = 0; i < validation.validatedAssignments.length; i++) {
      const assignment = validation.validatedAssignments[i];
      
      try {
        // Check if teacher exists
        const teacher = await teacherCollection.findOne({
          _id: ObjectId.createFromHexString(assignment.teacherId),
          isActive: { $ne: false }
        });

        if (!teacher) {
          validation.isValid = false;
          validation.errors.push({
            type: 'TEACHER_NOT_FOUND',
            teacherId: assignment.teacherId,
            message: `המורה עם מזהה ${assignment.teacherId} לא נמצא במערכת`,
            assignmentIndex: i
          });
          continue;
        }

        // Validate timeBlockId if provided
        if (assignment.timeBlockId) {
          const timeBlock = teacher.teaching?.timeBlocks?.find(block => 
            block._id.toString() === assignment.timeBlockId && 
            block.day === assignment.day &&
            block.isActive !== false
          );

          if (!timeBlock) {
            validation.warnings.push({
              type: 'TIMEBLOCK_MISMATCH',
              teacherId: assignment.teacherId,
              timeBlockId: assignment.timeBlockId,
              message: `בלוק הזמן ${assignment.timeBlockId} לא נמצא או לא תואם ליום ${assignment.day}`,
              assignmentIndex: i,
              suggestedFix: 'Remove timeBlockId or verify correct teacher timeBlock'
            });
          } else {
            // Validate time is within timeBlock
            const assignmentStartMinutes = timeToMinutes(assignment.time);
            const blockStartMinutes = timeToMinutes(timeBlock.startTime);
            const blockEndMinutes = timeToMinutes(timeBlock.endTime);
            
            if (assignmentStartMinutes < blockStartMinutes || 
                assignmentStartMinutes + assignment.duration > blockEndMinutes) {
              validation.warnings.push({
                type: 'TIME_OUTSIDE_BLOCK',
                teacherId: assignment.teacherId,
                timeBlockId: assignment.timeBlockId,
                message: `זמן השיעור ${assignment.time} (משך: ${assignment.duration} דקות) חורג מבלוק הזמן ${timeBlock.startTime}-${timeBlock.endTime}`,
                assignmentIndex: i
              });
            }
          }
        }

        // Check for time conflicts with other assignments for this student
        const conflictingAssignments = validation.validatedAssignments.filter((otherAssignment, j) => {
          if (i === j || otherAssignment.teacherId === assignment.teacherId) return false;
          if (otherAssignment.day !== assignment.day) return false;
          if (!otherAssignment.isActive || !assignment.isActive) return false;
          
          const startTime1 = timeToMinutes(assignment.time);
          const endTime1 = startTime1 + assignment.duration;
          const startTime2 = timeToMinutes(otherAssignment.time);
          const endTime2 = startTime2 + otherAssignment.duration;
          
          return (startTime1 < endTime2) && (startTime2 < endTime1);
        });

        if (conflictingAssignments.length > 0) {
          validation.isValid = false;
          validation.errors.push({
            type: 'TIME_CONFLICT',
            assignmentIndex: i,
            conflictingAssignments: conflictingAssignments.map((conflict, j) => ({
              index: validation.validatedAssignments.indexOf(conflict),
              teacherId: conflict.teacherId,
              time: conflict.time,
              duration: conflict.duration
            })),
            message: `קונפליקט בזמן: השיעור ב${assignment.day} ${assignment.time} מתנגש עם שיעורים אחרים`
          });
        }

        // Ensure scheduleInfo consistency
        if (assignment.scheduleInfo) {
          const scheduleInfo = assignment.scheduleInfo;
          let scheduleInfoFixed = false;
          
          if (scheduleInfo.day !== assignment.day) {
            validation.validatedAssignments[i].scheduleInfo.day = assignment.day;
            scheduleInfoFixed = true;
          }
          
          if (scheduleInfo.startTime !== assignment.time) {
            validation.validatedAssignments[i].scheduleInfo.startTime = assignment.time;
            scheduleInfoFixed = true;
          }
          
          if (scheduleInfo.duration !== assignment.duration) {
            validation.validatedAssignments[i].scheduleInfo.duration = assignment.duration;
            scheduleInfoFixed = true;
          }
          
          const expectedEndTime = calculateEndTime(assignment.time, assignment.duration);
          if (scheduleInfo.endTime !== expectedEndTime) {
            validation.validatedAssignments[i].scheduleInfo.endTime = expectedEndTime;
            scheduleInfoFixed = true;
          }
          
          if (scheduleInfoFixed) {
            validation.fixes.push({
              type: 'SCHEDULE_INFO_SYNC',
              assignmentIndex: i,
              message: 'סונכרן מידע scheduleInfo עם הנתונים הראשיים'
            });
          }
        } else {
          // Add missing scheduleInfo
          validation.validatedAssignments[i].scheduleInfo = {
            day: assignment.day,
            startTime: assignment.time,
            endTime: calculateEndTime(assignment.time, assignment.duration),
            duration: assignment.duration,
            location: assignment.location || null,
            notes: assignment.notes || null
          };
          
          validation.fixes.push({
            type: 'SCHEDULE_INFO_ADDED',
            assignmentIndex: i,
            message: 'נוסף מידע scheduleInfo חסר'
          });
        }

        // Ensure proper timestamps
        if (!assignment.createdAt) {
          validation.validatedAssignments[i].createdAt = new Date();
          validation.fixes.push({
            type: 'CREATED_AT_ADDED',
            assignmentIndex: i,
            message: 'נוסף תאריך יצירה'
          });
        }
        
        validation.validatedAssignments[i].updatedAt = new Date();

      } catch (dbError) {
        validation.isValid = false;
        validation.errors.push({
          type: 'DATABASE_ERROR',
          teacherId: assignment.teacherId,
          message: `שגיאה בבדיקת מורה: ${dbError.message}`,
          assignmentIndex: i
        });
      }
    }

    // Check for duplicate assignments to the same teacher
    const teacherCounts = {};
    validation.validatedAssignments.forEach((assignment, index) => {
      if (assignment.isActive !== false) {
        if (!teacherCounts[assignment.teacherId]) {
          teacherCounts[assignment.teacherId] = [];
        }
        teacherCounts[assignment.teacherId].push(index);
      }
    });

    Object.entries(teacherCounts).forEach(([teacherId, indices]) => {
      if (indices.length > 1) {
        validation.warnings.push({
          type: 'DUPLICATE_TEACHER_ASSIGNMENTS',
          teacherId,
          assignmentIndices: indices,
          message: `ישנן ${indices.length} הקצאות פעילות לאותו מורה`
        });
      }
    });

  } catch (error) {
    validation.isValid = false;
    validation.errors.push({
      type: 'VALIDATION_SYSTEM_ERROR',
      message: `שגיאה במערכת האימות: ${error.message}`
    });
  }

  return validation;
}

/**
 * Helper function to convert time string to minutes
 * @param {string} timeString - Time in HH:MM format
 * @returns {number} Minutes since midnight
 */
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Helper function to calculate end time
 * @param {string} startTime - Start time in HH:MM format
 * @param {number} duration - Duration in minutes
 * @returns {string} End time in HH:MM format
 */
function calculateEndTime(startTime, duration) {
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + duration;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

/**
 * Middleware for validating teacherAssignments in student updates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object  
 * @param {Function} next - Express next function
 */
export async function validateTeacherAssignmentsMiddleware(req, res, next) {
  try {
    // Only validate if teacherAssignments are being updated
    if (!req.body.teacherAssignments) {
      return next();
    }

    const studentId = req.params.id || req.params.studentId;
    const assignments = req.body.teacherAssignments;

    console.log(`🔍 Validating teacherAssignments for student ${studentId}`);

    const validation = await validateTeacherAssignmentsWithDB(assignments, studentId);

    if (!validation.isValid) {
      console.error(`❌ TeacherAssignments validation failed:`, validation.errors);
      return res.status(400).json({
        success: false,
        error: 'נתוני השיבוץ למורים אינם תקינים',
        code: 'TEACHER_ASSIGNMENTS_VALIDATION_FAILED',
        details: {
          errors: validation.errors,
          warnings: validation.warnings
        }
      });
    }

    // Apply fixes and use validated assignments
    req.body.teacherAssignments = validation.validatedAssignments;

    if (validation.warnings.length > 0) {
      console.warn(`⚠️  TeacherAssignments validation warnings:`, validation.warnings);
      // Add warnings to response headers for frontend to handle (Base64 encoded)
      res.set('X-Validation-Warnings', Buffer.from(JSON.stringify(validation.warnings)).toString('base64'));
    }

    if (validation.fixes.length > 0) {
      console.log(`🔧 Applied ${validation.fixes.length} automatic fixes to teacherAssignments`);
      res.set('X-Validation-Fixes', Buffer.from(JSON.stringify(validation.fixes)).toString('base64'));
    }

    next();

  } catch (error) {
    console.error(`❌ TeacherAssignments validation middleware error:`, error);
    return res.status(500).json({
      success: false,
      error: 'שגיאה במערכת האימות',
      code: 'VALIDATION_SYSTEM_ERROR'
    });
  }
}

export const VALIDATION_CONSTANTS = {
  VALID_DAYS,
  VALID_DURATIONS
};