import { scheduleService } from './schedule.service.js';
import { repairAllRelationships, validateScheduleIntegrity, repairTeacherStudentRelationship } from './repair-relationships.js';
import { teacherService } from '../teacher/teacher.service.js';
import { validateTeacherStudentAssignment } from './schedule.validation.js';
import { migrateToTimeBlocks as runMigration, createBackup, rollbackMigration, generateMigrationReport } from './migrate-to-time-blocks.js';
import { timeBlockController } from './time-block.controller.js';

export const scheduleController = {
  getTeacherWeeklySchedule,
  getAvailableSlots,
  createScheduleSlot,
  createTimeBlockProxy,
  assignStudentToSlot,
  removeStudentFromSlot,
  updateScheduleSlot,
  getStudentSchedule,
  repairRelationships,
  validateIntegrity,
  assignStudentToTeacher,
  removeStudentFromTeacher,
  migrateToTimeBlocks,
  createMigrationBackup,
  rollbackTimeBlockMigration,
  getMigrationReport,
};

/**
 * Get teacher's complete weekly schedule
 * @route GET /api/schedule/teacher/:teacherId/weekly
 */
async function getTeacherWeeklySchedule(req, res) {
  try {
    const { teacherId } = req.params;
    const includeStudentInfo = req.query.includeStudentInfo === 'true';
    
    // Verify permission if not admin (teachers can only view their own schedule)
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to view this teacher\'s schedule',
      });
    }

    const schedule = await scheduleService.getTeacherWeeklySchedule(teacherId, {
      includeStudentInfo,
    });

    res.status(200).json(schedule);
  } catch (err) {
    console.error(`Error in getTeacherWeeklySchedule: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get only available slots for assignment
 * @route GET /api/schedule/teacher/:teacherId/available
 */
async function getAvailableSlots(req, res) {
  try {
    const { teacherId } = req.params;
    const filters = {
      day: req.query.day,
      minDuration: req.query.minDuration ? parseInt(req.query.minDuration) : undefined,
      startTimeAfter: req.query.startTimeAfter,
      startTimeBefore: req.query.startTimeBefore,
      location: req.query.location,
    };

    // Remove undefined filters
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined) delete filters[key];
    });

    // Verify permission if not admin (teachers can only view their own available slots)
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to view this teacher\'s available slots',
      });
    }

    const availableSlots = await scheduleService.getAvailableSlots(teacherId, filters);

    res.status(200).json(availableSlots);
  } catch (err) {
    console.error(`Error in getAvailableSlots: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Create new schedule slot (DEPRECATED - use createTimeBlockProxy instead)
 * @route POST /api/schedule/teacher/:teacherId/slot-legacy
 */
async function createScheduleSlot(req, res) {
  try {
    const { teacherId } = req.params;
    const slotData = req.body;

    // Add school year context if available
    if (req.schoolYear && !slotData.schoolYearId) {
      slotData.schoolYearId = req.schoolYear._id.toString();
    }

    // Verify permission if not admin (teachers can only create slots for themselves)
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to create slots for this teacher',
      });
    }

    const newSlot = await scheduleService.createScheduleSlot(teacherId, slotData);

    res.status(201).json({
      ...newSlot,
      warning: 'DEPRECATED: This endpoint creates individual slots. Use time blocks for better efficiency: POST /api/schedule/time-blocks/teacher/:teacherId/time-block'
    });
  } catch (err) {
    console.error(`Error in createScheduleSlot: ${err.message}`);
    
    // Check for validation errors
    if (err.message.includes('Invalid schedule data')) {
      return res.status(400).json({ error: err.message });
    }
    
    // Check for conflict errors
    if (err.message.includes('conflicts with an existing slot')) {
      return res.status(409).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Assign student to specific slot
 * @route POST /api/schedule/assign
 */
async function assignStudentToSlot(req, res) {
  try {
    const assignmentData = req.body;

    // Verify permission if not admin
    // Teachers can only assign students to their own schedule
    if (!req.isAdmin && assignmentData.teacherId !== req.teacher._id.toString()) {
      return res.status(403).json({
        error: 'You are not authorized to assign students to this teacher\'s schedule',
      });
    }

    const result = await scheduleService.assignStudentToSlot(assignmentData);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in assignStudentToSlot: ${err.message}`);
    
    // Check for validation errors
    if (err.message.includes('Invalid assignment data')) {
      return res.status(400).json({ error: err.message });
    }
    
    // Check for conflict errors
    if (err.message.includes('already has another lesson')) {
      return res.status(409).json({ error: err.message });
    }
    
    // Check for not found errors
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Remove student from slot
 * @route DELETE /api/schedule/assign/:scheduleSlotId
 */
async function removeStudentFromSlot(req, res) {
  try {
    const { scheduleSlotId } = req.params;

    // First get the slot to check permissions
    const slot = await scheduleService.getScheduleSlotById(scheduleSlotId);

    // Verify permission if not admin
    // Teachers can only remove students from their own schedule
    if (!req.isAdmin && slot.teacherId !== req.teacher._id.toString()) {
      return res.status(403).json({
        error: 'You are not authorized to remove students from this schedule',
      });
    }

    const result = await scheduleService.removeStudentFromSlot(scheduleSlotId);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in removeStudentFromSlot: ${err.message}`);
    
    // Check for not found errors
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    // Check for other specific errors
    if (err.message.includes('No student assigned')) {
      return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Update slot details
 * @route PUT /api/schedule/slot/:scheduleSlotId
 */
async function updateScheduleSlot(req, res) {
  try {
    const { scheduleSlotId } = req.params;
    const updateData = req.body;

    // First get the slot to check permissions
    const slot = await scheduleService.getScheduleSlotById(scheduleSlotId);

    // Verify permission if not admin
    // Teachers can only update their own schedule
    if (!req.isAdmin && slot.teacherId !== req.teacher._id.toString()) {
      return res.status(403).json({
        error: 'You are not authorized to update this schedule slot',
      });
    }

    const result = await scheduleService.updateScheduleSlot(scheduleSlotId, updateData);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in updateScheduleSlot: ${err.message}`);
    
    // Check for validation errors
    if (err.message.includes('Invalid update data')) {
      return res.status(400).json({ error: err.message });
    }
    
    // Check for conflict errors
    if (err.message.includes('conflicts with an existing slot')) {
      return res.status(409).json({ error: err.message });
    }
    
    // Check for not found errors
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get student's complete schedule across teachers
 * @route GET /api/schedule/student/:studentId
 */
async function getStudentSchedule(req, res) {
  try {
    const { studentId } = req.params;

    // Verify permission if not admin
    // Teachers can only view schedules of their own students
    if (!req.isAdmin) {
      const hasAccess = req.teacher.teaching.studentIds.includes(studentId);
      if (!hasAccess) {
        return res.status(403).json({
          error: 'You are not authorized to view this student\'s schedule',
        });
      }
    }

    const schedule = await scheduleService.getStudentSchedule(studentId);

    res.status(200).json(schedule);
  } catch (err) {
    console.error(`Error in getStudentSchedule: ${err.message}`);
    
    // Check for not found errors
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Repair all relationships in the system
 * @route POST /api/schedule/repair
 */
async function repairRelationships(req, res) {
  try {
    // Only allow admin access
    if (!req.isAdmin) {
      return res.status(403).json({
        error: 'Administrator access required for relationship repair',
      });
    }

    const results = await repairAllRelationships();
    
    res.status(200).json({
      message: 'Relationship repair completed successfully',
      results
    });
  } catch (err) {
    console.error(`Error in repairRelationships: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Validate schedule integrity
 * @route GET /api/schedule/validate
 */
async function validateIntegrity(req, res) {
  try {
    // Only allow admin access
    if (!req.isAdmin) {
      return res.status(403).json({
        error: 'Administrator access required for integrity validation',
      });
    }

    const report = await validateScheduleIntegrity();
    
    res.status(200).json({
      message: 'Schedule integrity validation completed',
      report
    });
  } catch (err) {
    console.error(`Error in validateIntegrity: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Assign student to teacher (without schedule)
 * @route POST /api/schedule/teacher/:teacherId/assign-student
 */
async function assignStudentToTeacher(req, res) {
  try {
    const { teacherId } = req.params;
    
    // Validate request body
    const { error, value } = validateTeacherStudentAssignment(req.body);
    if (error) {
      return res.status(400).json({
        error: `Invalid assignment data: ${error.message}`,
      });
    }

    const { studentId } = value;

    // Verify permission if not admin
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to assign students to this teacher',
      });
    }

    const result = await teacherService.addStudentToTeacher(teacherId, studentId);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in assignStudentToTeacher: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Remove student from teacher
 * @route DELETE /api/schedule/teacher/:teacherId/students/:studentId
 */
async function removeStudentFromTeacher(req, res) {
  try {
    const { teacherId, studentId } = req.params;

    // Verify permission if not admin
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to remove students from this teacher',
      });
    }

    const result = await teacherService.removeStudentFromTeacher(teacherId, studentId);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in removeStudentFromTeacher: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Migrate from slot-based to time block system
 * @route POST /api/schedule/migrate-to-time-blocks
 */
async function migrateToTimeBlocks(req, res) {
  try {
    // Only allow admin access
    if (!req.isAdmin) {
      return res.status(403).json({
        error: 'Administrator access required for migration',
      });
    }

    const { dryRun = false } = req.body;

    const results = await runMigration({ dryRun });
    
    res.status(200).json({
      message: dryRun ? 'Migration analysis completed' : 'Migration completed successfully',
      results
    });
  } catch (err) {
    console.error(`Error in migrateToTimeBlocks: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Create backup before migration
 * @route POST /api/schedule/migration-backup
 */
async function createMigrationBackup(req, res) {
  try {
    // Only allow admin access
    if (!req.isAdmin) {
      return res.status(403).json({
        error: 'Administrator access required for backup creation',
      });
    }

    const backup = await createBackup();
    
    res.status(200).json({
      message: 'Backup created successfully',
      backup: {
        timestamp: backup.timestamp,
        teacherCount: backup.teachers.length,
        studentCount: backup.students.length,
        version: backup.version
      }
    });
  } catch (err) {
    console.error(`Error in createMigrationBackup: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Rollback time block migration
 * @route POST /api/schedule/rollback-migration
 */
async function rollbackTimeBlockMigration(req, res) {
  try {
    // Only allow admin access
    if (!req.isAdmin) {
      return res.status(403).json({
        error: 'Administrator access required for migration rollback',
      });
    }

    await rollbackMigration();
    
    res.status(200).json({
      message: 'Migration rollback completed successfully'
    });
  } catch (err) {
    console.error(`Error in rollbackTimeBlockMigration: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get migration report
 * @route GET /api/schedule/migration-report
 */
async function getMigrationReport(req, res) {
  try {
    // Only allow admin access
    if (!req.isAdmin) {
      return res.status(403).json({
        error: 'Administrator access required for migration report',
      });
    }

    const { teacherId } = req.query;
    const report = await generateMigrationReport(teacherId);
    
    res.status(200).json({
      message: 'Migration report generated successfully',
      report
    });
  } catch (err) {
    console.error(`Error in getMigrationReport: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Proxy function: Convert old slot creation to new time block creation
 * @route POST /api/schedule/teacher/:teacherId/slot
 */
async function createTimeBlockProxy(req, res) {
  try {
    console.log('🔄 Converting old slot creation to time block creation...');
    
    // Convert old slot data to time block format
    const slotData = req.body;
    
    // Normalize field names (Hebrew to English)
    const fieldMapping = {
      'יום': 'day',
      'שעה': 'startTime', 
      'משך השיעור': 'duration',
      'מיקום': 'location',
      'הערות': 'notes'
    };
    
    const normalizedData = { ...slotData };
    Object.entries(fieldMapping).forEach(([hebrew, english]) => {
      if (normalizedData[hebrew] !== undefined) {
        normalizedData[english] = normalizedData[hebrew];
        delete normalizedData[hebrew];
      }
    });
    
    // Calculate end time from start time and duration
    if (normalizedData.startTime && normalizedData.duration) {
      const startMinutes = timeToMinutes(normalizedData.startTime);
      const endMinutes = startMinutes + normalizedData.duration;
      normalizedData.endTime = minutesToTime(endMinutes);
    }
    
    // Remove duration field since time blocks use startTime/endTime
    delete normalizedData.duration;
    
    // Convert to time block request format
    const timeBlockData = {
      day: normalizedData.day,
      startTime: normalizedData.startTime,
      endTime: normalizedData.endTime,
      location: normalizedData.location,
      notes: normalizedData.notes || 'Converted from individual slot'
    };
    
    console.log('📋 Converting slot request:', slotData);
    console.log('🔄 To time block:', timeBlockData);
    
    // Call the time block creation controller
    req.body = timeBlockData;
    await timeBlockController.createTimeBlock(req, res);
    
  } catch (err) {
    console.error(`Error in createTimeBlockProxy: ${err.message}`);
    res.status(500).json({ 
      error: err.message,
      note: 'This endpoint now creates time blocks instead of individual slots'
    });
  }
}

// Helper functions for time conversion
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}