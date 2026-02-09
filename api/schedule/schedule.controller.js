import { repairAllRelationships, validateScheduleIntegrity } from './repair-relationships.js';
import { teacherService } from '../teacher/teacher.service.js';
import { validateTeacherStudentAssignment } from './schedule.validation.js';
import { migrateToTimeBlocks as runMigration, createBackup, rollbackMigration, generateMigrationReport } from './migrate-to-time-blocks.js';

export const scheduleController = {
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
