import express from 'express';
import { attendanceController } from './attendance.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = express.Router();

// All attendance routes require authentication
router.use(authenticateToken);

/**
 * Get student's private lesson attendance stats
 * GET /api/attendance/students/:studentId/private-lesson-attendance
 */
router.get('/students/:studentId/private-lesson-attendance', attendanceController.getStudentPrivateLessonStats);

/**
 * Get student's attendance history
 * GET /api/attendance/students/:studentId/attendance-history
 */
router.get('/students/:studentId/attendance-history', attendanceController.getStudentAttendanceHistory);

/**
 * Get teacher's attendance overview
 * GET /api/attendance/teachers/:teacherId/lesson-attendance-summary
 */
router.get('/teachers/:teacherId/lesson-attendance-summary', attendanceController.getTeacherAttendanceOverview);

export default router;
