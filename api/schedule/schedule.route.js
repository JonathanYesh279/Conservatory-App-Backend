import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { scheduleController } from './schedule.controller.js';
import timeBlockRoutes from './time-block.route.js';
import { 
  formatScheduleResponse, 
  formatAttendanceResponse 
} from '../../middleware/responseFormatterMiddleware.js';

const router = express.Router();

// Route protection middleware
const teacherAuthMiddleware = requireAuth(['מורה', 'מנהל']);
const adminAuthMiddleware = requireAuth(['מנהל']);

// GET teacher's complete weekly schedule
router.get(
  '/teacher/:teacherId/weekly',
  teacherAuthMiddleware,
  formatScheduleResponse(),
  scheduleController.getTeacherWeeklySchedule
);

// GET only available slots for assignment
router.get(
  '/teacher/:teacherId/available',
  teacherAuthMiddleware,
  formatScheduleResponse(),
  scheduleController.getAvailableSlots
);

// POST create new time block (replaces old slot system)
router.post(
  '/teacher/:teacherId/slot',
  teacherAuthMiddleware,
  scheduleController.createTimeBlockProxy
);

// POST assign student to specific slot
router.post(
  '/assign',
  teacherAuthMiddleware,
  scheduleController.assignStudentToSlot
);

// DELETE remove student from slot
router.delete(
  '/assign/:scheduleSlotId',
  teacherAuthMiddleware,
  scheduleController.removeStudentFromSlot
);

// PUT update slot details
router.put(
  '/slot/:scheduleSlotId',
  teacherAuthMiddleware,
  scheduleController.updateScheduleSlot
);

// GET student's complete schedule across teachers
router.get(
  '/student/:studentId',
  teacherAuthMiddleware,
  formatScheduleResponse(),
  scheduleController.getStudentSchedule
);

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