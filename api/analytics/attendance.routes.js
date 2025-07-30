import express from 'express';
import { attendanceAnalyticsController } from './attendance.controller.js';
import { authenticateToken } from '../../middleware/auth.middleware.js';

const router = express.Router();

// All analytics routes require authentication
router.use(authenticateToken);

/**
 * Student attendance analytics
 * GET /api/analytics/students/:studentId/attendance
 * Query params: includePrivateLessons, includeTheory, includeRehearsal, includeOrchestra, startDate, endDate, compareWithPrevious
 */
router.get('/students/:studentId/attendance', attendanceAnalyticsController.getStudentAttendanceStats);

/**
 * Teacher attendance analytics
 * GET /api/analytics/teachers/:teacherId/attendance
 * Query params: startDate, endDate, includeStudentBreakdown, includeTimeAnalysis
 */
router.get('/teachers/:teacherId/attendance', attendanceAnalyticsController.getTeacherAttendanceAnalytics);

/**
 * Overall system attendance report
 * GET /api/analytics/attendance/overall
 * Query params: startDate, endDate, includeComparisons, groupBy
 */
router.get('/attendance/overall', attendanceAnalyticsController.getOverallAttendanceReport);

/**
 * Attendance trends analysis
 * GET /api/analytics/attendance/trends
 * Query params: period, activityType, teacherId, studentId
 */
router.get('/attendance/trends', attendanceAnalyticsController.getAttendanceTrends);

/**
 * Attendance comparison
 * POST /api/analytics/attendance/compare
 * Body: { type, baseline, comparison, metric }
 */
router.post('/attendance/compare', attendanceAnalyticsController.getAttendanceComparison);

/**
 * Generate insights for student or teacher
 * GET /api/analytics/:entityType/:entityId/insights
 * Path params: entityType (student|teacher), entityId
 * Query params: various options
 */
router.get('/:entityType/:entityId/insights', attendanceAnalyticsController.generateAttendanceInsights);

/**
 * Export attendance report
 * POST /api/analytics/attendance/export
 * Body: { format, scope, entityId, startDate, endDate, includeDetails }
 */
router.post('/attendance/export', attendanceAnalyticsController.exportAttendanceReport);

export default router;