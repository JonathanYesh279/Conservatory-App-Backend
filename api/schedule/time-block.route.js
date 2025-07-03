import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { timeBlockController } from './time-block.controller.js';

const router = express.Router();

// Route protection middleware
const teacherAuthMiddleware = requireAuth(['מורה', 'מנהל']);
const adminAuthMiddleware = requireAuth(['מנהל']);

// Time Block Management Routes

// POST create new time block for teacher
router.post(
  '/teacher/:teacherId/time-block',
  teacherAuthMiddleware,
  timeBlockController.createTimeBlock
);

// PUT update existing time block
router.put(
  '/teacher/:teacherId/time-block/:blockId',
  teacherAuthMiddleware,
  timeBlockController.updateTimeBlock
);

// DELETE time block
router.delete(
  '/teacher/:teacherId/time-block/:blockId',
  teacherAuthMiddleware,
  timeBlockController.deleteTimeBlock
);

// GET all time blocks for teacher
router.get(
  '/teacher/:teacherId/time-blocks',
  teacherAuthMiddleware,
  timeBlockController.getTeacherTimeBlocks
);

// GET teacher's complete schedule with time blocks
router.get(
  '/teacher/:teacherId/schedule-with-blocks',
  teacherAuthMiddleware,
  timeBlockController.getTeacherScheduleWithBlocks
);

// Lesson Slot Management Routes

// GET available lesson slots for specific duration
router.get(
  '/teacher/:teacherId/available-slots',
  teacherAuthMiddleware,
  timeBlockController.getAvailableSlots
);

// POST find optimal lesson slot for student preferences
router.post(
  '/teacher/:teacherId/find-optimal-slot',
  teacherAuthMiddleware,
  timeBlockController.findOptimalSlot
);

// POST assign lesson to time block
router.post(
  '/assign-lesson',
  teacherAuthMiddleware,
  timeBlockController.assignLessonToBlock
);

// DELETE remove lesson from time block
router.delete(
  '/lesson/:teacherId/:timeBlockId/:lessonId',
  teacherAuthMiddleware,
  timeBlockController.removeLessonFromBlock
);

// Advanced Scheduling Routes

// POST get lesson options across multiple teachers
router.post(
  '/lesson-options',
  teacherAuthMiddleware,
  timeBlockController.getLessonScheduleOptions
);

// Analytics and Statistics Routes

// GET block utilization statistics for teacher
router.get(
  '/teacher/:teacherId/utilization-stats',
  teacherAuthMiddleware,
  timeBlockController.getBlockUtilizationStats
);

export default router;