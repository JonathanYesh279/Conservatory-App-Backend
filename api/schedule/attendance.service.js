import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { 
  toUTC, 
  createAppDate, 
  formatDate,
  isValidDate,
  now
} from '../../utils/dateHelpers.js';

export const attendanceService = {
  markLessonAttendance,
  getLessonAttendance,
  getStudentPrivateLessonStats,
  getTeacherAttendanceOverview,
  syncToActivityAttendance,
  createPrivateLessonAttendanceRecord,
  getStudentAttendanceHistory,
  getBulkAttendanceForTeacher
};

/**
 * Mark attendance for a specific lesson (schedule slot)
 * @param {string} scheduleSlotId - Schedule slot ID
 * @param {object} attendanceData - Attendance information
 * @returns {Promise<object>} - Updated attendance record
 */
async function markLessonAttendance(scheduleSlotId, attendanceData) {
  try {
    const teacherCollection = await getCollection('teacher');
    
    // Find the teacher with this schedule slot
    const teacher = await teacherCollection.findOne({
      'teaching.schedule._id': ObjectId.createFromHexString(scheduleSlotId)
    });

    if (!teacher) {
      throw new Error(`Schedule slot with id ${scheduleSlotId} not found`);
    }

    // Find the specific slot
    const scheduleSlot = teacher.teaching.schedule.find(
      slot => slot._id.toString() === scheduleSlotId
    );

    if (!scheduleSlot) {
      throw new Error(`Schedule slot with id ${scheduleSlotId} not found`);
    }

    if (!scheduleSlot.studentId) {
      throw new Error(`No student assigned to this schedule slot`);
    }

    // Validate lesson date if provided
    let lessonDate = attendanceData.lessonDate;
    if (lessonDate && !isValidDate(lessonDate)) {
      throw new Error('Invalid lesson date provided for attendance');
    }
    
    // Prepare attendance update with timezone-aware dates
    const currentTime = now();
    const attendanceUpdate = {
      status: attendanceData.status, // 'הגיע/ה' or 'לא הגיע/ה' or 'cancelled'
      markedAt: toUTC(currentTime),
      markedBy: attendanceData.markedBy,
      notes: attendanceData.notes || null,
      lessonCompleted: attendanceData.status === 'הגיע/ה' ? true : 
                      attendanceData.status === 'cancelled' ? false : null,
      lessonDate: lessonDate ? toUTC(createAppDate(lessonDate)) : toUTC(currentTime)
    };

    // Update the schedule slot with attendance data
    await teacherCollection.updateOne(
      { 
        _id: teacher._id,
        'teaching.schedule._id': ObjectId.createFromHexString(scheduleSlotId)
      },
      { 
        $set: { 
          'teaching.schedule.$.attendance': attendanceUpdate,
          'teaching.schedule.$.updatedAt': toUTC(now())
        }
      }
    );

    // Sync to central activity_attendance collection
    await syncToActivityAttendance(scheduleSlotId, teacher, scheduleSlot, attendanceUpdate);

    return {
      success: true,
      message: 'Attendance marked successfully',
      scheduleSlotId,
      attendance: attendanceUpdate
    };
  } catch (err) {
    console.error(`Error marking lesson attendance: ${err.message}`);
    throw new Error(`Error marking lesson attendance: ${err.message}`);
  }
}

/**
 * Get attendance data for a specific lesson
 * @param {string} scheduleSlotId - Schedule slot ID
 * @returns {Promise<object>} - Attendance data
 */
async function getLessonAttendance(scheduleSlotId) {
  try {
    const teacherCollection = await getCollection('teacher');
    
    const teacher = await teacherCollection.findOne({
      'teaching.schedule._id': ObjectId.createFromHexString(scheduleSlotId)
    });

    if (!teacher) {
      throw new Error(`Schedule slot with id ${scheduleSlotId} not found`);
    }

    const scheduleSlot = teacher.teaching.schedule.find(
      slot => slot._id.toString() === scheduleSlotId
    );

    if (!scheduleSlot) {
      throw new Error(`Schedule slot with id ${scheduleSlotId} not found`);
    }

    return {
      scheduleSlotId,
      studentId: scheduleSlot.studentId,
      teacherId: teacher._id.toString(),
      attendance: scheduleSlot.attendance || null,
      slotInfo: {
        day: scheduleSlot.day,
        startTime: scheduleSlot.startTime,
        endTime: scheduleSlot.endTime,
        duration: scheduleSlot.duration
      }
    };
  } catch (err) {
    console.error(`Error getting lesson attendance: ${err.message}`);
    throw new Error(`Error getting lesson attendance: ${err.message}`);
  }
}

/**
 * Get private lesson attendance statistics for a student
 * @param {string} studentId - Student ID
 * @param {string} teacherId - Optional teacher filter
 * @returns {Promise<object>} - Attendance statistics
 */
async function getStudentPrivateLessonStats(studentId, teacherId = null) {
  try {
    const activityCollection = await getCollection('activity_attendance');
    
    // Build query filter
    const filter = {
      studentId,
      activityType: 'שיעור פרטי'
    };
    
    if (teacherId) {
      filter.teacherId = teacherId;
    }

    // Get all private lesson attendance records
    const attendanceRecords = await activityCollection
      .find(filter)
      .sort({ date: -1 })
      .toArray();

    // Calculate statistics
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
      recentAttendance: attendanceRecords.slice(0, 10) // Last 10 records
    };
  } catch (err) {
    console.error(`Error getting student private lesson stats: ${err.message}`);
    throw new Error(`Error getting student private lesson stats: ${err.message}`);
  }
}

/**
 * Get teacher's attendance overview for their private lessons
 * @param {string} teacherId - Teacher ID
 * @param {object} dateRange - Optional date range filter
 * @returns {Promise<object>} - Teacher attendance overview
 */
async function getTeacherAttendanceOverview(teacherId, dateRange = {}) {
  try {
    const activityCollection = await getCollection('activity_attendance');
    const studentCollection = await getCollection('student');
    
    // Build query filter
    const filter = {
      teacherId,
      activityType: 'שיעור פרטי'
    };
    
    if (dateRange.startDate || dateRange.endDate) {
      filter.date = {};
      if (dateRange.startDate) filter.date.$gte = new Date(dateRange.startDate);
      if (dateRange.endDate) filter.date.$lte = new Date(dateRange.endDate);
    }

    // Get attendance records
    const attendanceRecords = await activityCollection
      .find(filter)
      .sort({ date: -1 })
      .toArray();

    // Get unique student IDs
    const studentIds = [...new Set(attendanceRecords.map(r => r.studentId))];
    
    // Get student information
    const students = await studentCollection
      .find({ _id: { $in: studentIds.map(id => ObjectId.createFromHexString(id)) } })
      .project({ _id: 1, 'personalInfo.fullName': 1 })
      .toArray();

    const studentLookup = students.reduce((acc, student) => {
      acc[student._id.toString()] = student.personalInfo?.fullName || 'Unknown';
      return acc;
    }, {});

    // Calculate per-student statistics
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

    // Overall statistics
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
 * Sync lesson attendance to central activity_attendance collection
 * @param {string} scheduleSlotId - Schedule slot ID
 * @param {object} teacher - Teacher document
 * @param {object} scheduleSlot - Schedule slot data
 * @param {object} attendanceData - Attendance information
 * @returns {Promise<object>} - Created attendance record
 */
async function syncToActivityAttendance(scheduleSlotId, teacher, scheduleSlot, attendanceData) {
  try {
    const activityCollection = await getCollection('activity_attendance');
    
    // Create activity attendance record
    const activityRecord = {
      _id: new ObjectId(),
      studentId: scheduleSlot.studentId,
      teacherId: teacher._id.toString(),
      activityType: 'שיעור פרטי',
      groupId: teacher._id.toString(), // Use teacher ID as group for private lessons
      sessionId: scheduleSlotId,
      date: attendanceData.lessonDate ? toUTC(createAppDate(attendanceData.lessonDate)) : toUTC(now()),
      status: attendanceData.status,
      notes: attendanceData.notes || null,
      markedBy: attendanceData.markedBy,
      markedAt: attendanceData.markedAt,
      metadata: {
        day: scheduleSlot.day,
        startTime: scheduleSlot.startTime,
        endTime: scheduleSlot.endTime,
        duration: scheduleSlot.duration,
        location: scheduleSlot.location,
        instrument: teacher.professionalInfo?.instrument
      },
      createdAt: toUTC(now()),
      updatedAt: toUTC(now())
    };

    // Check if record already exists (prevent duplicates)
    const existingRecord = await activityCollection.findOne({
      sessionId: scheduleSlotId,
      studentId: scheduleSlot.studentId,
      date: activityRecord.date
    });

    if (existingRecord) {
      // Update existing record
      await activityCollection.updateOne(
        { _id: existingRecord._id },
        { 
          $set: {
            status: attendanceData.status,
            notes: attendanceData.notes,
            markedBy: attendanceData.markedBy,
            markedAt: attendanceData.markedAt,
            updatedAt: toUTC(now())
          }
        }
      );
      return existingRecord;
    } else {
      // Create new record
      await activityCollection.insertOne(activityRecord);
      return activityRecord;
    }
  } catch (err) {
    console.error(`Error syncing to activity attendance: ${err.message}`);
    throw new Error(`Error syncing to activity attendance: ${err.message}`);
  }
}

/**
 * Create a private lesson attendance record directly
 * @param {object} lessonData - Lesson information
 * @param {object} attendanceData - Attendance information
 * @returns {Promise<object>} - Created attendance record
 */
async function createPrivateLessonAttendanceRecord(lessonData, attendanceData) {
  try {
    return await syncToActivityAttendance(
      lessonData.scheduleSlotId,
      lessonData.teacher,
      lessonData.scheduleSlot,
      attendanceData
    );
  } catch (err) {
    console.error(`Error creating private lesson attendance record: ${err.message}`);
    throw new Error(`Error creating private lesson attendance record: ${err.message}`);
  }
}

/**
 * Get student's attendance history for private lessons
 * @param {string} studentId - Student ID
 * @param {object} options - Query options
 * @returns {Promise<Array>} - Attendance history
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

/**
 * Get bulk attendance data for teacher dashboard
 * @param {string} teacherId - Teacher ID
 * @param {Array} scheduleSlotIds - Array of schedule slot IDs
 * @returns {Promise<object>} - Bulk attendance data
 */
async function getBulkAttendanceForTeacher(teacherId, scheduleSlotIds) {
  try {
    const teacherCollection = await getCollection('teacher');
    
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    const attendanceData = {};
    
    teacher.teaching.schedule.forEach(slot => {
      if (scheduleSlotIds.includes(slot._id.toString())) {
        attendanceData[slot._id.toString()] = {
          scheduleSlotId: slot._id.toString(),
          studentId: slot.studentId,
          attendance: slot.attendance || null,
          slotInfo: {
            day: slot.day,
            startTime: slot.startTime,
            endTime: slot.endTime
          }
        };
      }
    });

    return attendanceData;
  } catch (err) {
    console.error(`Error getting bulk attendance: ${err.message}`);
    throw new Error(`Error getting bulk attendance: ${err.message}`);
  }
}