import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

export const attendanceAnalyticsService = {
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
 * @param {string} studentId - Student ID
 * @param {object} options - Analysis options
 * @returns {Promise<object>} - Comprehensive attendance statistics
 */
async function getStudentAttendanceStats(studentId, options = {}) {
  try {
    const {
      includePrivateLessons = true,
      includeTheory = true,
      includeRehearsal = true,
      includeOrchestra = true,
      startDate,
      endDate,
      compareWithPrevious = false
    } = options;

    const activityCollection = await getCollection('activity_attendance');
    const studentCollection = await getCollection('student');

    // Get student info
    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    // Build activity filter
    const activityTypes = [];
    if (includePrivateLessons) activityTypes.push('שיעור פרטי');
    if (includeTheory) activityTypes.push('תאוריה');
    if (includeRehearsal) activityTypes.push('חזרות');
    if (includeOrchestra) activityTypes.push('תזמורת');

    // Build time filter
    const timeFilter = { studentId };
    if (startDate || endDate) {
      timeFilter.date = {};
      if (startDate) timeFilter.date.$gte = new Date(startDate);
      if (endDate) timeFilter.date.$lte = new Date(endDate);
    }

    // Get attendance records
    const currentPeriodRecords = await activityCollection
      .find({
        ...timeFilter,
        activityType: { $in: activityTypes }
      })
      .sort({ date: -1 })
      .toArray();

    // Calculate current period statistics by activity type
    const statsByActivity = {};
    activityTypes.forEach(activityType => {
      const records = currentPeriodRecords.filter(r => r.activityType === activityType);
      const attended = records.filter(r => r.status === 'הגיע/ה').length;
      const total = records.length;
      
      statsByActivity[activityType] = {
        totalLessons: total,
        attended: attended,
        missed: records.filter(r => r.status === 'לא הגיע/ה').length,
        cancelled: records.filter(r => r.status === 'cancelled').length,
        attendanceRate: total > 0 ? (attended / total * 100).toFixed(2) : 0,
        recentTrend: calculateRecentTrend(records.slice(0, 10))
      };
    });

    // Overall statistics
    const totalLessons = currentPeriodRecords.length;
    const totalAttended = currentPeriodRecords.filter(r => r.status === 'הגיע/ה').length;
    const overallRate = totalLessons > 0 ? (totalAttended / totalLessons * 100).toFixed(2) : 0;

    const result = {
      studentId,
      studentName: student.personalInfo?.fullName,
      period: {
        startDate: startDate || 'Beginning',
        endDate: endDate || 'Now'
      },
      overall: {
        totalLessons,
        totalAttended,
        totalMissed: currentPeriodRecords.filter(r => r.status === 'לא הגיע/ה').length,
        totalCancelled: currentPeriodRecords.filter(r => r.status === 'cancelled').length,
        attendanceRate: parseFloat(overallRate)
      },
      byActivity: statsByActivity,
      recentActivity: currentPeriodRecords.slice(0, 15)
    };

    // Add comparison with previous period if requested
    if (compareWithPrevious && (startDate || endDate)) {
      const comparisonStats = await getComparisonPeriodStats(
        studentId, 
        activityTypes, 
        startDate, 
        endDate
      );
      result.comparison = comparisonStats;
    }

    return result;
  } catch (err) {
    console.error(`Error getting student attendance stats: ${err.message}`);
    throw new Error(`Error getting student attendance stats: ${err.message}`);
  }
}

/**
 * Get comprehensive attendance analytics for a teacher
 * @param {string} teacherId - Teacher ID
 * @param {object} options - Analysis options
 * @returns {Promise<object>} - Teacher attendance analytics
 */
async function getTeacherAttendanceAnalytics(teacherId, options = {}) {
  try {
    const {
      startDate,
      endDate,
      includeStudentBreakdown = true,
      includeTimeAnalysis = true
    } = options;

    const activityCollection = await getCollection('activity_attendance');
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    // Get teacher info
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Build time filter
    const filter = {
      teacherId,
      activityType: 'שיעור פרטי'
    };

    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Get attendance records
    const records = await activityCollection
      .find(filter)
      .sort({ date: -1 })
      .toArray();

    // Overall statistics
    const totalLessons = records.length;
    const attendedLessons = records.filter(r => r.status === 'הגיע/ה').length;
    const overallRate = totalLessons > 0 ? (attendedLessons / totalLessons * 100).toFixed(2) : 0;

    const analytics = {
      teacherId,
      teacherName: teacher.personalInfo?.fullName,
      instrument: teacher.professionalInfo?.instrument,
      period: {
        startDate: startDate || 'Beginning',
        endDate: endDate || 'Now'
      },
      overall: {
        totalLessons,
        attendedLessons,
        missedLessons: records.filter(r => r.status === 'לא הגיע/ה').length,
        cancelledLessons: records.filter(r => r.status === 'cancelled').length,
        attendanceRate: parseFloat(overallRate),
        activeStudents: [...new Set(records.map(r => r.studentId))].length
      }
    };

    // Student breakdown
    if (includeStudentBreakdown) {
      const studentIds = [...new Set(records.map(r => r.studentId))];
      const students = await studentCollection
        .find({ _id: { $in: studentIds.map(id => ObjectId.createFromHexString(id)) } })
        .project({ _id: 1, 'personalInfo.fullName': 1 })
        .toArray();

      const studentLookup = students.reduce((acc, student) => {
        acc[student._id.toString()] = student.personalInfo?.fullName || 'Unknown';
        return acc;
      }, {});

      analytics.studentBreakdown = studentIds.map(studentId => {
        const studentRecords = records.filter(r => r.studentId === studentId);
        const attended = studentRecords.filter(r => r.status === 'הגיע/ה').length;
        const total = studentRecords.length;

        return {
          studentId,
          studentName: studentLookup[studentId],
          totalLessons: total,
          attendedLessons: attended,
          missedLessons: studentRecords.filter(r => r.status === 'לא הגיע/ה').length,
          attendanceRate: total > 0 ? (attended / total * 100).toFixed(2) : 0,
          recentTrend: calculateRecentTrend(studentRecords.slice(0, 5))
        };
      }).sort((a, b) => parseFloat(b.attendanceRate) - parseFloat(a.attendanceRate));
    }

    // Time analysis
    if (includeTimeAnalysis) {
      analytics.timeAnalysis = {
        byWeekday: getAttendanceByWeekday(records),
        byMonth: getAttendanceByMonth(records),
        trends: calculateTrends(records)
      };
    }

    return analytics;
  } catch (err) {
    console.error(`Error getting teacher attendance analytics: ${err.message}`);
    throw new Error(`Error getting teacher attendance analytics: ${err.message}`);
  }
}

/**
 * Get overall attendance report across the system
 * @param {object} options - Report options
 * @returns {Promise<object>} - System-wide attendance report
 */
async function getOverallAttendanceReport(options = {}) {
  try {
    const {
      startDate,
      endDate,
      includeComparisons = true,
      groupBy = 'activity' // 'activity', 'teacher', 'month'
    } = options;

    const activityCollection = await getCollection('activity_attendance');

    // Build time filter
    const filter = {};
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Get all attendance records
    const records = await activityCollection
      .find(filter)
      .sort({ date: -1 })
      .toArray();

    // Overall system statistics
    const totalLessons = records.length;
    const attendedLessons = records.filter(r => r.status === 'הגיע/ה').length;
    const overallRate = totalLessons > 0 ? (attendedLessons / totalLessons * 100).toFixed(2) : 0;

    const report = {
      period: {
        startDate: startDate || 'Beginning',
        endDate: endDate || 'Now'
      },
      overall: {
        totalLessons,
        attendedLessons,
        missedLessons: records.filter(r => r.status === 'לא הגיע/ה').length,
        cancelledLessons: records.filter(r => r.status === 'cancelled').length,
        attendanceRate: parseFloat(overallRate),
        uniqueStudents: [...new Set(records.map(r => r.studentId))].length,
        uniqueTeachers: [...new Set(records.map(r => r.teacherId))].length
      }
    };

    // Group by specified criteria
    if (groupBy === 'activity') {
      report.byActivity = getStatsByGroup(records, 'activityType');
    } else if (groupBy === 'teacher') {
      report.byTeacher = getStatsByGroup(records, 'teacherId');
    } else if (groupBy === 'month') {
      report.byMonth = getAttendanceByMonth(records);
    }

    // Add comparisons if requested
    if (includeComparisons && (startDate || endDate)) {
      const comparisonData = await getSystemComparisonData(startDate, endDate);
      report.comparison = comparisonData;
    }

    return report;
  } catch (err) {
    console.error(`Error getting overall attendance report: ${err.message}`);
    throw new Error(`Error getting overall attendance report: ${err.message}`);
  }
}

/**
 * Get attendance trends analysis
 * @param {object} options - Analysis options
 * @returns {Promise<object>} - Attendance trends
 */
async function getAttendanceTrends(options = {}) {
  try {
    const {
      period = '3months', // '1month', '3months', '6months', '1year'
      activityType = 'שיעור פרטי',
      teacherId,
      studentId
    } = options;

    const activityCollection = await getCollection('activity_attendance');

    // Calculate date range based on period
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case '1month':
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case '3months':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case '1year':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
    }

    // Build filter
    const filter = {
      date: { $gte: startDate, $lte: endDate },
      activityType
    };

    if (teacherId) filter.teacherId = teacherId;
    if (studentId) filter.studentId = studentId;

    const records = await activityCollection
      .find(filter)
      .sort({ date: 1 })
      .toArray();

    // Calculate trends by week
    const weeklyTrends = calculateWeeklyTrends(records);
    const monthlyTrends = calculateMonthlyTrends(records);

    return {
      period,
      dateRange: { startDate, endDate },
      filters: { activityType, teacherId, studentId },
      totalRecords: records.length,
      weeklyTrends,
      monthlyTrends,
      overallTrend: calculateOverallTrend(records),
      insights: generateTrendInsights(weeklyTrends, monthlyTrends)
    };
  } catch (err) {
    console.error(`Error getting attendance trends: ${err.message}`);
    throw new Error(`Error getting attendance trends: ${err.message}`);
  }
}

/**
 * Compare attendance between different periods or groups
 * @param {object} comparisonOptions - Comparison options
 * @returns {Promise<object>} - Attendance comparison
 */
async function getAttendanceComparison(comparisonOptions = {}) {
  try {
    const {
      type = 'period', // 'period', 'students', 'teachers', 'activities'
      baseline,
      comparison,
      metric = 'attendanceRate'
    } = comparisonOptions;

    const activityCollection = await getCollection('activity_attendance');

    let baselineData, comparisonData;

    if (type === 'period') {
      baselineData = await activityCollection
        .find({
          date: {
            $gte: new Date(baseline.startDate),
            $lte: new Date(baseline.endDate)
          }
        })
        .toArray();

      comparisonData = await activityCollection
        .find({
          date: {
            $gte: new Date(comparison.startDate),
            $lte: new Date(comparison.endDate)
          }
        })
        .toArray();
    }

    const baselineStats = calculateStatsForRecords(baselineData);
    const comparisonStats = calculateStatsForRecords(comparisonData);

    return {
      type,
      baseline: {
        ...baseline,
        stats: baselineStats
      },
      comparison: {
        ...comparison,
        stats: comparisonStats
      },
      difference: {
        attendanceRate: comparisonStats.attendanceRate - baselineStats.attendanceRate,
        totalLessons: comparisonStats.totalLessons - baselineStats.totalLessons,
        attendedLessons: comparisonStats.attendedLessons - baselineStats.attendedLessons
      },
      percentageChange: {
        attendanceRate: baselineStats.attendanceRate > 0 ? 
          ((comparisonStats.attendanceRate - baselineStats.attendanceRate) / baselineStats.attendanceRate * 100).toFixed(2) : 0,
        totalLessons: baselineStats.totalLessons > 0 ? 
          ((comparisonStats.totalLessons - baselineStats.totalLessons) / baselineStats.totalLessons * 100).toFixed(2) : 0
      }
    };
  } catch (err) {
    console.error(`Error getting attendance comparison: ${err.message}`);
    throw new Error(`Error getting attendance comparison: ${err.message}`);
  }
}

/**
 * Generate attendance insights and recommendations
 * @param {string} entityId - Student or Teacher ID
 * @param {string} entityType - 'student' or 'teacher'
 * @param {object} options - Analysis options
 * @returns {Promise<object>} - Insights and recommendations
 */
async function generateAttendanceInsights(entityId, entityType, options = {}) {
  try {
    const insights = {
      entityId,
      entityType,
      generatedAt: new Date(),
      insights: [],
      recommendations: [],
      alerts: []
    };

    let stats;
    if (entityType === 'student') {
      stats = await getStudentAttendanceStats(entityId, { ...options, compareWithPrevious: true });
    } else if (entityType === 'teacher') {
      stats = await getTeacherAttendanceAnalytics(entityId, options);
    }

    // Generate insights based on statistics
    if (stats.overall.attendanceRate < 70) {
      insights.alerts.push({
        type: 'low_attendance',
        severity: 'high',
        message: `Attendance rate is below 70% (${stats.overall.attendanceRate}%)`,
        suggestion: 'Consider reaching out to discuss attendance challenges'
      });
    }

    if (entityType === 'student' && stats.comparison) {
      const rateDiff = stats.overall.attendanceRate - stats.comparison.overall.attendanceRate;
      if (rateDiff < -10) {
        insights.alerts.push({
          type: 'declining_attendance',
          severity: 'medium',
          message: `Attendance has declined by ${Math.abs(rateDiff).toFixed(1)}% compared to previous period`,
          suggestion: 'Monitor closely and consider intervention'
        });
      } else if (rateDiff > 10) {
        insights.insights.push({
          type: 'improving_attendance',
          message: `Attendance has improved by ${rateDiff.toFixed(1)}% compared to previous period`,
          suggestion: 'Continue current strategies'
        });
      }
    }

    // Add activity-specific insights for students
    if (entityType === 'student' && stats.byActivity) {
      Object.entries(stats.byActivity).forEach(([activity, activityStats]) => {
        if (activityStats.attendanceRate < 60) {
          insights.recommendations.push({
            type: 'activity_focus',
            message: `${activity} attendance is particularly low (${activityStats.attendanceRate}%)`,
            suggestion: `Focus improvement efforts on ${activity} classes`
          });
        }
      });
    }

    return insights;
  } catch (err) {
    console.error(`Error generating attendance insights: ${err.message}`);
    throw new Error(`Error generating attendance insights: ${err.message}`);
  }
}

/**
 * Export attendance report in specified format
 * @param {object} reportOptions - Report options
 * @returns {Promise<object>} - Export data
 */
async function exportAttendanceReport(reportOptions = {}) {
  try {
    const {
      format = 'json', // 'json', 'csv', 'summary'
      scope = 'overall', // 'overall', 'teacher', 'student'
      entityId,
      startDate,
      endDate,
      includeDetails = true
    } = reportOptions;

    let reportData;

    switch (scope) {
      case 'student':
        reportData = await getStudentAttendanceStats(entityId, {
          startDate,
          endDate,
          includePrivateLessons: true,
          includeTheory: true,
          includeRehearsal: true,
          includeOrchestra: true
        });
        break;
      case 'teacher':
        reportData = await getTeacherAttendanceAnalytics(entityId, {
          startDate,
          endDate,
          includeStudentBreakdown: includeDetails,
          includeTimeAnalysis: includeDetails
        });
        break;
      case 'overall':
      default:
        reportData = await getOverallAttendanceReport({
          startDate,
          endDate,
          includeComparisons: includeDetails
        });
        break;
    }

    const exportData = {
      generatedAt: new Date(),
      format,
      scope,
      reportOptions,
      data: reportData
    };

    // Format data based on requested format
    if (format === 'csv') {
      exportData.csvData = convertToCSV(reportData, scope);
    } else if (format === 'summary') {
      exportData.summary = generateSummary(reportData, scope);
    }

    return exportData;
  } catch (err) {
    console.error(`Error exporting attendance report: ${err.message}`);
    throw new Error(`Error exporting attendance report: ${err.message}`);
  }
}

// Helper functions
function calculateRecentTrend(records) {
  if (records.length < 3) return 'insufficient_data';
  
  const recent = records.slice(0, 3);
  const older = records.slice(3, 6);
  
  const recentRate = recent.filter(r => r.status === 'הגיע/ה').length / recent.length;
  const olderRate = older.length > 0 ? older.filter(r => r.status === 'הגיע/ה').length / older.length : recentRate;
  
  if (recentRate > olderRate + 0.1) return 'improving';
  if (recentRate < olderRate - 0.1) return 'declining';
  return 'stable';
}

function getAttendanceByWeekday(records) {
  const weekdays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  const weekdayStats = {};
  
  weekdays.forEach(day => {
    const dayRecords = records.filter(r => {
      const weekday = new Date(r.date).getDay();
      const hebrewDay = weekdays[weekday];
      return hebrewDay === day;
    });
    
    const attended = dayRecords.filter(r => r.status === 'הגיע/ה').length;
    weekdayStats[day] = {
      total: dayRecords.length,
      attended,
      rate: dayRecords.length > 0 ? (attended / dayRecords.length * 100).toFixed(2) : 0
    };
  });
  
  return weekdayStats;
}

function getAttendanceByMonth(records) {
  const monthlyStats = {};
  
  records.forEach(record => {
    const monthKey = new Date(record.date).toISOString().substring(0, 7); // YYYY-MM
    
    if (!monthlyStats[monthKey]) {
      monthlyStats[monthKey] = {
        total: 0,
        attended: 0,
        missed: 0,
        cancelled: 0
      };
    }
    
    monthlyStats[monthKey].total++;
    if (record.status === 'הגיע/ה') monthlyStats[monthKey].attended++;
    else if (record.status === 'לא הגיע/ה') monthlyStats[monthKey].missed++;
    else if (record.status === 'cancelled') monthlyStats[monthKey].cancelled++;
  });
  
  // Calculate rates
  Object.keys(monthlyStats).forEach(month => {
    const stats = monthlyStats[month];
    stats.attendanceRate = stats.total > 0 ? (stats.attended / stats.total * 100).toFixed(2) : 0;
  });
  
  return monthlyStats;
}

function getStatsByGroup(records, groupField) {
  const groupStats = {};
  
  records.forEach(record => {
    const groupValue = record[groupField];
    
    if (!groupStats[groupValue]) {
      groupStats[groupValue] = {
        total: 0,
        attended: 0,
        missed: 0,
        cancelled: 0
      };
    }
    
    groupStats[groupValue].total++;
    if (record.status === 'הגיע/ה') groupStats[groupValue].attended++;
    else if (record.status === 'לא הגיע/ה') groupStats[groupValue].missed++;
    else if (record.status === 'cancelled') groupStats[groupValue].cancelled++;
  });
  
  // Calculate rates
  Object.keys(groupStats).forEach(group => {
    const stats = groupStats[group];
    stats.attendanceRate = stats.total > 0 ? (stats.attended / stats.total * 100).toFixed(2) : 0;
  });
  
  return groupStats;
}

function calculateStatsForRecords(records) {
  const total = records.length;
  const attended = records.filter(r => r.status === 'הגיע/ה').length;
  
  return {
    totalLessons: total,
    attendedLessons: attended,
    missedLessons: records.filter(r => r.status === 'לא הגיע/ה').length,
    cancelledLessons: records.filter(r => r.status === 'cancelled').length,
    attendanceRate: total > 0 ? (attended / total * 100).toFixed(2) : 0
  };
}

function calculateWeeklyTrends(records) {
  // Group records by week and calculate trends
  const weeklyData = {};
  
  records.forEach(record => {
    const date = new Date(record.date);
    const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
    const weekKey = weekStart.toISOString().substring(0, 10);
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { total: 0, attended: 0 };
    }
    
    weeklyData[weekKey].total++;
    if (record.status === 'הגיע/ה') weeklyData[weekKey].attended++;
  });
  
  return Object.entries(weeklyData).map(([week, data]) => ({
    week,
    total: data.total,
    attended: data.attended,
    rate: data.total > 0 ? (data.attended / data.total * 100).toFixed(2) : 0
  })).sort((a, b) => a.week.localeCompare(b.week));
}

function calculateMonthlyTrends(records) {
  return getAttendanceByMonth(records);
}

function calculateOverallTrend(records) {
  const weeklyTrends = calculateWeeklyTrends(records);
  if (weeklyTrends.length < 3) return 'insufficient_data';
  
  const recentWeeks = weeklyTrends.slice(-3);
  const earlierWeeks = weeklyTrends.slice(0, 3);
  
  const recentAvg = recentWeeks.reduce((sum, week) => sum + parseFloat(week.rate), 0) / recentWeeks.length;
  const earlierAvg = earlierWeeks.reduce((sum, week) => sum + parseFloat(week.rate), 0) / earlierWeeks.length;
  
  if (recentAvg > earlierAvg + 5) return 'improving';
  if (recentAvg < earlierAvg - 5) return 'declining';
  return 'stable';
}

function generateTrendInsights(weeklyTrends, monthlyTrends) {
  const insights = [];
  
  // Analyze weekly trends
  if (weeklyTrends.length >= 4) {
    const lastFourWeeks = weeklyTrends.slice(-4);
    const avgRate = lastFourWeeks.reduce((sum, week) => sum + parseFloat(week.rate), 0) / 4;
    
    if (avgRate > 90) {
      insights.push({
        type: 'excellent_attendance',
        message: 'Excellent attendance maintained over the last 4 weeks',
        data: { averageRate: avgRate.toFixed(2) }
      });
    } else if (avgRate < 70) {
      insights.push({
        type: 'concerning_trend',
        message: 'Attendance has been concerning over the last 4 weeks',
        data: { averageRate: avgRate.toFixed(2) }
      });
    }
  }
  
  return insights;
}

async function getComparisonPeriodStats(studentId, activityTypes, startDate, endDate) {
  // Calculate previous period of same duration
  const start = new Date(startDate);
  const end = new Date(endDate);
  const duration = end - start;
  
  const prevEnd = new Date(start);
  const prevStart = new Date(start - duration);
  
  const activityCollection = await getCollection('activity_attendance');
  
  const prevRecords = await activityCollection
    .find({
      studentId,
      activityType: { $in: activityTypes },
      date: { $gte: prevStart, $lte: prevEnd }
    })
    .toArray();
  
  const total = prevRecords.length;
  const attended = prevRecords.filter(r => r.status === 'הגיע/ה').length;
  
  return {
    period: { startDate: prevStart, endDate: prevEnd },
    overall: {
      totalLessons: total,
      attendedLessons: attended,
      attendanceRate: total > 0 ? (attended / total * 100).toFixed(2) : 0
    }
  };
}

async function getSystemComparisonData(startDate, endDate) {
  // Similar logic for system-wide comparison
  const start = new Date(startDate);
  const end = new Date(endDate);
  const duration = end - start;
  
  const prevEnd = new Date(start);
  const prevStart = new Date(start - duration);
  
  const activityCollection = await getCollection('activity_attendance');
  
  const prevRecords = await activityCollection
    .find({
      date: { $gte: prevStart, $lte: prevEnd }
    })
    .toArray();
  
  return calculateStatsForRecords(prevRecords);
}

function convertToCSV(data, scope) {
  // Convert data to CSV format based on scope
  // Implementation would depend on specific requirements
  return "CSV conversion not implemented yet";
}

function generateSummary(data, scope) {
  // Generate executive summary
  return {
    summary: "Summary generation not fully implemented",
    keyMetrics: data.overall || {},
    recommendations: []
  };
}