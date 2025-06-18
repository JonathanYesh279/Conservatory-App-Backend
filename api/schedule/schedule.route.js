import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { scheduleController } from './schedule.controller.js';

const router = express.Router();

// Route protection middleware
const teacherAuthMiddleware = requireAuth(['מורה', 'מנהל']);
const adminAuthMiddleware = requireAuth(['מנהל']);

// GET teacher's complete weekly schedule
router.get(
  '/teacher/:teacherId/weekly',
  teacherAuthMiddleware,
  scheduleController.getTeacherWeeklySchedule
);

// GET only available slots for assignment
router.get(
  '/teacher/:teacherId/available',
  teacherAuthMiddleware,
  scheduleController.getAvailableSlots
);

// POST create new schedule slot
router.post(
  '/teacher/:teacherId/slot',
  teacherAuthMiddleware,
  scheduleController.createScheduleSlot
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
  scheduleController.getStudentSchedule
);

export default router;