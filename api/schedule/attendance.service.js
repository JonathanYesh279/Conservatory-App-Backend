import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

export const attendanceService = {
  getStudentPrivateLessonStats,
  getTeacherAttendanceOverview,
  getStudentAttendanceHistory
};

/**
 * Get private lesson attendance statistics for a student
 * Reads from activity_attendance collection
 */
async function getStudentPrivateLessonStats(studentId, teacherId = null) {
  try {
    const activityCollection = await getCollection('activity_attendance');

    const filter = {
      studentId,
      activityType: 'שיעור פרטי'
    };

    if (teacherId) {
      filter.teacherId = teacherId;
    }

    const attendanceRecords = await activityCollection
      .find(filter)
      .sort({ date: -1 })
      .toArray();

    const totalLessons = attendanceRecords.length;
    const attendedLessons = attendanceRecords.filter(r => r.status === 'הגיע/ה').length;
    const missedLessons = attendanceRecords.filter(r => r.status === 'לא הגיע/ה').length;
    const cancelledLessons = attendanceRecords.filter(r => r.status === 'cancelled').length;

    const attendanceRate = totalLessons > 0 ? (attendedLessons / totalLessons * 100).toFixed(2) : 0;

    return {
      studentId,
      teacherId,
      totalLessons,
      attendedLessons,
      missedLessons,
      cancelledLessons,
      attendanceRate: parseFloat(attendanceRate),
      recentAttendance: attendanceRecords.slice(0, 10)
    };
  } catch (err) {
    console.error(`Error getting student private lesson stats: ${err.message}`);
    throw new Error(`Error getting student private lesson stats: ${err.message}`);
  }
}

/**
 * Get teacher's attendance overview for their private lessons
 * Reads from activity_attendance collection
 */
async function getTeacherAttendanceOverview(teacherId, dateRange = {}) {
  try {
    const activityCollection = await getCollection('activity_attendance');
    const studentCollection = await getCollection('student');

    const filter = {
      teacherId,
      activityType: 'שיעור פרטי'
    };

    if (dateRange.startDate || dateRange.endDate) {
      filter.date = {};
      if (dateRange.startDate) filter.date.$gte = new Date(dateRange.startDate);
      if (dateRange.endDate) filter.date.$lte = new Date(dateRange.endDate);
    }

    const attendanceRecords = await activityCollection
      .find(filter)
      .sort({ date: -1 })
      .toArray();

    const studentIds = [...new Set(attendanceRecords.map(r => r.studentId))];

    const students = await studentCollection
      .find({ _id: { $in: studentIds.map(id => ObjectId.createFromHexString(id)) } })
      .project({ _id: 1, 'personalInfo.fullName': 1 })
      .toArray();

    const studentLookup = students.reduce((acc, student) => {
      acc[student._id.toString()] = student.personalInfo?.fullName || 'Unknown';
      return acc;
    }, {});

    const studentStats = {};
    studentIds.forEach(studentId => {
      const studentRecords = attendanceRecords.filter(r => r.studentId === studentId);
      const attended = studentRecords.filter(r => r.status === 'הגיע/ה').length;
      const total = studentRecords.length;

      studentStats[studentId] = {
        studentName: studentLookup[studentId],
        totalLessons: total,
        attendedLessons: attended,
        missedLessons: studentRecords.filter(r => r.status === 'לא הגיע/ה').length,
        attendanceRate: total > 0 ? (attended / total * 100).toFixed(2) : 0
      };
    });

    const totalLessons = attendanceRecords.length;
    const attendedLessons = attendanceRecords.filter(r => r.status === 'הגיע/ה').length;
    const overallAttendanceRate = totalLessons > 0 ? (attendedLessons / totalLessons * 100).toFixed(2) : 0;

    return {
      teacherId,
      dateRange,
      overallStats: {
        totalLessons,
        attendedLessons,
        missedLessons: attendanceRecords.filter(r => r.status === 'לא הגיע/ה').length,
        cancelledLessons: attendanceRecords.filter(r => r.status === 'cancelled').length,
        attendanceRate: parseFloat(overallAttendanceRate)
      },
      studentStats,
      recentActivity: attendanceRecords.slice(0, 20)
    };
  } catch (err) {
    console.error(`Error getting teacher attendance overview: ${err.message}`);
    throw new Error(`Error getting teacher attendance overview: ${err.message}`);
  }
}

/**
 * Get student's attendance history for private lessons
 * Reads from activity_attendance collection
 */
async function getStudentAttendanceHistory(studentId, options = {}) {
  try {
    const activityCollection = await getCollection('activity_attendance');

    const filter = {
      studentId,
      activityType: 'שיעור פרטי'
    };

    if (options.teacherId) {
      filter.teacherId = options.teacherId;
    }

    if (options.startDate || options.endDate) {
      filter.date = {};
      if (options.startDate) filter.date.$gte = new Date(options.startDate);
      if (options.endDate) filter.date.$lte = new Date(options.endDate);
    }

    const records = await activityCollection
      .find(filter)
      .sort({ date: -1 })
      .limit(options.limit || 50)
      .toArray();

    return records;
  } catch (err) {
    console.error(`Error getting student attendance history: ${err.message}`);
    throw new Error(`Error getting student attendance history: ${err.message}`);
  }
}
