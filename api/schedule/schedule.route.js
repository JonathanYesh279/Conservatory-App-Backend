import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { scheduleController } from './schedule.controller.js';
import timeBlockRoutes from './time-block.route.js';

const router = express.Router();

// Route protection middleware
const teacherAuthMiddleware = requireAuth(['מורה', 'מנהל']);
const adminAuthMiddleware = requireAuth(['מנהל']);

// POST repair all relationships (admin only)
router.post(
  '/repair',
  adminAuthMiddleware,
  scheduleController.repairRelationships
);

// GET validate schedule integrity (admin only)
router.get(
  '/validate',
  adminAuthMiddleware,
  scheduleController.validateIntegrity
);

// POST assign student to teacher (without schedule)
router.post(
  '/teacher/:teacherId/assign-student',
  teacherAuthMiddleware,
  scheduleController.assignStudentToTeacher
);

// DELETE remove student from teacher
router.delete(
  '/teacher/:teacherId/students/:studentId',
  teacherAuthMiddleware,
  scheduleController.removeStudentFromTeacher
);

// Migration routes (admin only)
router.post(
  '/migrate-to-time-blocks',
  adminAuthMiddleware,
  scheduleController.migrateToTimeBlocks
);

router.post(
  '/migration-backup',
  adminAuthMiddleware,
  scheduleController.createMigrationBackup
);

router.post(
  '/rollback-migration',
  adminAuthMiddleware,
  scheduleController.rollbackTimeBlockMigration
);

router.get(
  '/migration-report',
  adminAuthMiddleware,
  scheduleController.getMigrationReport
);

// Mount time block routes
router.use('/time-blocks', timeBlockRoutes);

export default router;
