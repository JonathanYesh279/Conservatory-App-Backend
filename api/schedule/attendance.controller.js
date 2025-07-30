import { attendanceService } from './attendance.service.js';
import { scheduleService } from './schedule.service.js';
import { 
  validateMarkAttendance, 
  validateBulkAttendance, 
  validateAttendanceQuery,
  validateBulkAttendanceRequest,
  validateAttendanceStatsQuery
} from './attendance.validation.js';

export const attendanceController = {
  markLessonAttendance,
  getLessonAttendance,
  getStudentPrivateLessonStats,
  getStudentAttendanceHistory,
  getTeacherAttendanceOverview,
  getBulkAttendanceForTeacher,
  bulkMarkAttendance
};

/**
 * Mark attendance for a specific lesson
 * @route PUT /api/lessons/:lessonId/attendance
 */
async function markLessonAttendance(req, res) {
  try {
    const { lessonId } = req.params;
    const attendanceData = req.body;

    // Validate attendance data
    const { error, value } = validateMarkAttendance(attendanceData);
    if (error) {
      return res.status(400).json({
        error: `Invalid attendance data: ${error.message}`
      });
    }

    // Add user info for audit trail
    value.markedBy = req.isAdmin ? 
      `admin:${req.user._id}` : 
      `teacher:${req.teacher._id}`;

    // Verify permission - teachers can only mark attendance for their own lessons
    if (!req.isAdmin) {
      const lesson = await scheduleService.getScheduleSlotById(lessonId);
      if (lesson.teacherId !== req.teacher._id.toString()) {
        return res.status(403).json({
          error: 'You are not authorized to mark attendance for this lesson'
        });
      }
    }

    const result = await attendanceService.markLessonAttendance(lessonId, value);

    res.status(200).json(result);
  } catch (err) {
    console.error(`Error in markLessonAttendance: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    if (err.message.includes('No student assigned')) {
      return res.status(400).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get attendance for a specific lesson
 * @route GET /api/lessons/:lessonId/attendance
 */
async function getLessonAttendance(req, res) {
  try {
    const { lessonId } = req.params;

    // Verify permission - teachers can only view attendance for their own lessons
    if (!req.isAdmin) {
      const lesson = await scheduleService.getScheduleSlotById(lessonId);
      if (lesson.teacherId !== req.teacher._id.toString()) {
        return res.status(403).json({
          error: 'You are not authorized to view attendance for this lesson'
        });
      }
    }

    const attendance = await attendanceService.getLessonAttendance(lessonId);

    res.status(200).json(attendance);
  } catch (err) {
    console.error(`Error in getLessonAttendance: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get student's private lesson attendance statistics
 * @route GET /api/students/:studentId/private-lesson-attendance
 */
async function getStudentPrivateLessonStats(req, res) {
  try {
    const { studentId } = req.params;
    const { teacherId } = req.query;

    // Verify permission - teachers can only view stats for their own students
    if (!req.isAdmin) {
      // Check if teacher has access to this student
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
 * @route GET /api/students/:studentId/attendance-history
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
 * @route GET /api/teachers/:teacherId/lesson-attendance-summary
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

/**
 * Get bulk attendance data for teacher dashboard
 * @route POST /api/teachers/:teacherId/bulk-attendance
 */
async function getBulkAttendanceForTeacher(req, res) {
  try {
    const { teacherId } = req.params;
    
    // Validate bulk attendance request
    const { error, value } = validateBulkAttendanceRequest(req.body);
    if (error) {
      return res.status(400).json({
        error: `Invalid bulk attendance request: ${error.message}`
      });
    }

    const { scheduleSlotIds } = value;

    // Verify permission - teachers can only get their own bulk data
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to access this teacher\'s attendance data'
      });
    }

    const bulkData = await attendanceService.getBulkAttendanceForTeacher(teacherId, scheduleSlotIds);

    res.status(200).json({
      teacherId,
      attendanceData: bulkData
    });
  } catch (err) {
    console.error(`Error in getBulkAttendanceForTeacher: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Mark attendance for multiple lessons at once
 * @route POST /api/teachers/:teacherId/bulk-mark-attendance
 */
async function bulkMarkAttendance(req, res) {
  try {
    const { teacherId } = req.params;
    
    // Validate bulk attendance data
    const { error, value } = validateBulkAttendance(req.body);
    if (error) {
      return res.status(400).json({
        error: `Invalid bulk attendance data: ${error.message}`
      });
    }

    const { attendanceRecords } = value;

    // Verify permission - teachers can only mark their own lessons
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to mark attendance for this teacher'
      });
    }

    const results = [];
    const errors = [];

    // Process each attendance record
    for (const record of attendanceRecords) {
      try {
        const attendanceData = {
          ...record.attendanceData,
          markedBy: req.isAdmin ? 
            `admin:${req.user._id}` : 
            `teacher:${req.teacher._id}`
        };

        // Verify teacher owns this lesson if not admin
        if (!req.isAdmin) {
          const lesson = await scheduleService.getScheduleSlotById(record.scheduleSlotId);
          if (lesson.teacherId !== teacherId) {
            errors.push({
              scheduleSlotId: record.scheduleSlotId,
              error: 'Unauthorized lesson access'
            });
            continue;
          }
        }

        const result = await attendanceService.markLessonAttendance(
          record.scheduleSlotId, 
          attendanceData
        );
        
        results.push({
          scheduleSlotId: record.scheduleSlotId,
          success: true,
          result
        });
      } catch (error) {
        errors.push({
          scheduleSlotId: record.scheduleSlotId,
          error: error.message
        });
      }
    }

    res.status(200).json({
      message: 'Bulk attendance marking completed',
      successful: results.length,
      failed: errors.length,
      results,
      errors
    });
  } catch (err) {
    console.error(`Error in bulkMarkAttendance: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}