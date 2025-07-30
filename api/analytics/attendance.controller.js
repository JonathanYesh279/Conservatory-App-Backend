import { attendanceAnalyticsService } from './attendance.service.js';

export const attendanceAnalyticsController = {
  getStudentAttendanceStats,
  getTeacherAttendanceAnalytics,
  getOverallAttendanceReport,
  getAttendanceTrends,
  getAttendanceComparison,
  generateAttendanceInsights,
  exportAttendanceReport
};

/**
 * Get comprehensive attendance statistics for a student
 * @route GET /api/analytics/students/:studentId/attendance
 */
async function getStudentAttendanceStats(req, res) {
  try {
    const { studentId } = req.params;
    const {
      includePrivateLessons = 'true',
      includeTheory = 'true',
      includeRehearsal = 'true',
      includeOrchestra = 'true',
      startDate,
      endDate,
      compareWithPrevious = 'false'
    } = req.query;

    // Verify permission - teachers can only view their own students
    if (!req.isAdmin) {
      if (!req.teacher.teaching.studentIds.includes(studentId)) {
        return res.status(403).json({
          error: 'You are not authorized to view this student\'s attendance analytics'
        });
      }
    }

    const options = {
      includePrivateLessons: includePrivateLessons === 'true',
      includeTheory: includeTheory === 'true',
      includeRehearsal: includeRehearsal === 'true',
      includeOrchestra: includeOrchestra === 'true',
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      compareWithPrevious: compareWithPrevious === 'true'
    };

    const stats = await attendanceAnalyticsService.getStudentAttendanceStats(studentId, options);

    res.status(200).json(stats);
  } catch (err) {
    console.error(`Error in getStudentAttendanceStats: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get comprehensive attendance analytics for a teacher
 * @route GET /api/analytics/teachers/:teacherId/attendance
 */
async function getTeacherAttendanceAnalytics(req, res) {
  try {
    const { teacherId } = req.params;
    const {
      startDate,
      endDate,
      includeStudentBreakdown = 'true',
      includeTimeAnalysis = 'true'
    } = req.query;

    // Verify permission - teachers can only view their own analytics
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        error: 'You are not authorized to view this teacher\'s attendance analytics'
      });
    }

    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeStudentBreakdown: includeStudentBreakdown === 'true',
      includeTimeAnalysis: includeTimeAnalysis === 'true'
    };

    const analytics = await attendanceAnalyticsService.getTeacherAttendanceAnalytics(teacherId, options);

    res.status(200).json(analytics);
  } catch (err) {
    console.error(`Error in getTeacherAttendanceAnalytics: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get overall attendance report across the system
 * @route GET /api/analytics/attendance/overall
 */
async function getOverallAttendanceReport(req, res) {
  try {
    // Only admin can access overall reports
    if (!req.isAdmin) {
      return res.status(403).json({
        error: 'Administrator access required for overall attendance reports'
      });
    }

    const {
      startDate,
      endDate,
      includeComparisons = 'true',
      groupBy = 'activity'
    } = req.query;

    const options = {
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      includeComparisons: includeComparisons === 'true',
      groupBy
    };

    const report = await attendanceAnalyticsService.getOverallAttendanceReport(options);

    res.status(200).json(report);
  } catch (err) {
    console.error(`Error in getOverallAttendanceReport: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Get attendance trends analysis
 * @route GET /api/analytics/attendance/trends
 */
async function getAttendanceTrends(req, res) {
  try {
    const {
      period = '3months',
      activityType = 'שיעור פרטי',
      teacherId,
      studentId
    } = req.query;

    // Verify permissions
    if (!req.isAdmin) {
      // Teachers can only view trends for their own data or their students
      if (teacherId && teacherId !== req.teacher._id.toString()) {
        return res.status(403).json({
          error: 'You can only view trends for your own lessons'
        });
      }
      
      if (studentId && !req.teacher.teaching.studentIds.includes(studentId)) {
        return res.status(403).json({
          error: 'You can only view trends for your own students'
        });
      }
      
      // If no specific filter, default to current teacher
      if (!teacherId && !studentId) {
        req.query.teacherId = req.teacher._id.toString();
      }
    }

    const options = {
      period,
      activityType,
      teacherId: req.query.teacherId,
      studentId
    };

    const trends = await attendanceAnalyticsService.getAttendanceTrends(options);

    res.status(200).json(trends);
  } catch (err) {
    console.error(`Error in getAttendanceTrends: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Compare attendance between different periods or groups
 * @route POST /api/analytics/attendance/compare
 */
async function getAttendanceComparison(req, res) {
  try {
    // Only admin can access comparison features for now
    if (!req.isAdmin) {
      return res.status(403).json({
        error: 'Administrator access required for attendance comparisons'
      });
    }

    const comparisonOptions = req.body;

    // Validate comparison options
    if (!comparisonOptions.type || !comparisonOptions.baseline || !comparisonOptions.comparison) {
      return res.status(400).json({
        error: 'Missing required comparison parameters: type, baseline, comparison'
      });
    }

    const comparison = await attendanceAnalyticsService.getAttendanceComparison(comparisonOptions);

    res.status(200).json(comparison);
  } catch (err) {
    console.error(`Error in getAttendanceComparison: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}

/**
 * Generate attendance insights and recommendations
 * @route GET /api/analytics/:entityType/:entityId/insights
 */
async function generateAttendanceInsights(req, res) {
  try {
    const { entityType, entityId } = req.params;
    const options = req.query;

    // Validate entity type
    if (!['student', 'teacher'].includes(entityType)) {
      return res.status(400).json({
        error: 'Entity type must be either "student" or "teacher"'
      });
    }

    // Verify permissions
    if (!req.isAdmin) {
      if (entityType === 'teacher' && entityId !== req.teacher._id.toString()) {
        return res.status(403).json({
          error: 'You can only view insights for your own profile'
        });
      }
      
      if (entityType === 'student' && !req.teacher.teaching.studentIds.includes(entityId)) {
        return res.status(403).json({
          error: 'You can only view insights for your own students'
        });
      }
    }

    const insights = await attendanceAnalyticsService.generateAttendanceInsights(
      entityId, 
      entityType, 
      options
    );

    res.status(200).json(insights);
  } catch (err) {
    console.error(`Error in generateAttendanceInsights: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }
    
    res.status(500).json({ error: err.message });
  }
}

/**
 * Export attendance report in specified format
 * @route POST /api/analytics/attendance/export
 */
async function exportAttendanceReport(req, res) {
  try {
    const reportOptions = req.body;

    // Verify permissions based on scope
    if (!req.isAdmin) {
      if (reportOptions.scope === 'overall') {
        return res.status(403).json({
          error: 'Administrator access required for overall reports'
        });
      }
      
      if (reportOptions.scope === 'teacher' && reportOptions.entityId !== req.teacher._id.toString()) {
        return res.status(403).json({
          error: 'You can only export reports for your own data'
        });
      }
      
      if (reportOptions.scope === 'student' && !req.teacher.teaching.studentIds.includes(reportOptions.entityId)) {
        return res.status(403).json({
          error: 'You can only export reports for your own students'
        });
      }
    }

    const exportData = await attendanceAnalyticsService.exportAttendanceReport(reportOptions);

    // Set appropriate headers for file download if needed
    if (reportOptions.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=attendance-report.csv');
    }

    res.status(200).json(exportData);
  } catch (err) {
    console.error(`Error in exportAttendanceReport: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
}