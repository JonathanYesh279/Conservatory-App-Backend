import { attendanceService } from './attendance.service.js';

export const attendanceController = {
  getStudentPrivateLessonStats,
  getStudentAttendanceHistory,
  getTeacherAttendanceOverview
};

/**
 * Get student's private lesson attendance statistics
 * @route GET /api/student/:studentId/private-lesson-attendance
 */
async function getStudentPrivateLessonStats(req, res) {
  try {
    const { studentId } = req.params;
    const { teacherId } = req.query;

    // Verify permission - teachers can only view stats for their own students
    if (!req.isAdmin) {
      if (!req.teacher.teaching.studentIds.includes(studentId)) {
        return res.status(403).json({
          error: 'You are not authorized to view this student\'s attendance'
        });
      }

      // If teacher specified, it must be the requesting teacher
      if (teacherId && teacherId !== req.teacher._id.toString()) {
        return res.status(403).json({
          error: 'You can only view attendance for your own lessons'
        });
      }
    }

    const stats = await attendanceService.getStudentPrivateLessonStats(
      studentId,
      teacherId || (!req.isAdmin ? req.teacher._id.toString() : null)
    );

    res.status(200).json(stats);
  } catch (err) {
    console.error(`Error in getStudentPrivateLessonStats: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get student's attendance history
 * @route GET /api/student/:studentId/attendance-history
 */
async function getStudentAttendanceHistory(req, res) {
  try {
    const { studentId } = req.params;
    const { teacherId, startDate, endDate, limit } = req.query;

    // Verify permission - teachers can only view their own students' history
    if (!req.isAdmin) {
      if (!req.teacher.teaching.studentIds.includes(studentId)) {
        return res.status(403).json({
          error: 'You are not authorized to view this student\'s attendance history'
        });
      }

      // Force teacher filter for non-admin users
      req.query.teacherId = req.teacher._id.toString();
    }

    const options = {
      teacherId: req.query.teacherId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit: limit ? parseInt(limit) : undefined
    };

    const history = await attendanceService.getStudentAttendanceHistory(studentId, options);

    res.status(200).json({
      studentId,
      options,
      history
    });
  } catch (err) {
    console.error(`Error in getStudentAttendanceHistory: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get teacher's attendance overview
 * @route GET /api/teacher/:teacherId/lesson-attendance-summary
 */
async function getTeacherAttendanceOverview(req, res) {
  try {
    const { teacherId } = req.params;
    const { startDate, endDate } = req.query;

    // Verify permission - teachers can only view their own overview
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to view this teacher\'s attendance overview'
      });
    }

    const dateRange = {};
    if (startDate) dateRange.startDate = startDate;
    if (endDate) dateRange.endDate = endDate;

    const overview = await attendanceService.getTeacherAttendanceOverview(teacherId, dateRange);

    res.status(200).json(overview);
  } catch (err) {
    console.error(`Error in getTeacherAttendanceOverview: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}
