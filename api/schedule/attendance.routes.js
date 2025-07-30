import express from 'express';
import { attendanceController } from './attendance.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = express.Router();

// All attendance routes require authentication
router.use(authenticateToken);

/**
 * Mark attendance for a specific lesson
 * PUT /api/lessons/:lessonId/attendance
 */
router.put('/lessons/:lessonId/attendance', attendanceController.markLessonAttendance);

/**
 * Get attendance for a specific lesson  
 * GET /api/lessons/:lessonId/attendance
 */
router.get('/lessons/:lessonId/attendance', attendanceController.getLessonAttendance);

/**
 * Get student's private lesson attendance stats
 * GET /api/students/:studentId/private-lesson-attendance
 * Query params: teacherId (optional)
 */
router.get('/students/:studentId/private-lesson-attendance', attendanceController.getStudentPrivateLessonStats);

/**
 * Get student's attendance history
 * GET /api/students/:studentId/attendance-history
 * Query params: teacherId, startDate, endDate, limit
 */
router.get('/students/:studentId/attendance-history', attendanceController.getStudentAttendanceHistory);

/**
 * Get teacher's attendance overview
 * GET /api/teachers/:teacherId/lesson-attendance-summary
 * Query params: startDate, endDate
 */
router.get('/teachers/:teacherId/lesson-attendance-summary', attendanceController.getTeacherAttendanceOverview);

/**
 * Bulk attendance operations (for teacher dashboard)
 * POST /api/teachers/:teacherId/bulk-attendance
 */
router.post('/teachers/:teacherId/bulk-attendance', attendanceController.getBulkAttendanceForTeacher);

/**
 * Mark multiple lessons attendance at once
 * POST /api/teachers/:teacherId/bulk-mark-attendance
 */
router.post('/teachers/:teacherId/bulk-mark-attendance', attendanceController.bulkMarkAttendance);

export default router;