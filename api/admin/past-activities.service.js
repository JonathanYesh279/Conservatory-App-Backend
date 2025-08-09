import { rehearsalService } from '../rehearsal/rehearsal.service.js';
import { theoryService } from '../theory/theory.service.js';
import { attendanceService } from '../schedule/attendance.service.js';
import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { 
  getStartOfDay,
  getEndOfDay,
  formatDate,
  now,
  createAppDate
} from '../../utils/dateHelpers.js';

export const pastActivitiesService = {
  getPastActivities,
  getPastActivitiesByType
};

/**
 * Get all past activities with filtering and pagination
 */
async function getPastActivities(filterBy) {
  try {
    const { type, teacherId, startDate, endDate, limit, page } = filterBy;
    
    // Set default end date to yesterday if not provided
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const defaultEndDate = formatDate(yesterday);
    
    const dateFilter = {
      startDate,
      endDate: endDate || defaultEndDate
    };

    let activities = [];
    let summary = {
      totalCount: 0,
      rehearsalsCount: 0,
      theoryCount: 0,
      privateLessonsCount: 0,
      dateRange: {
        from: startDate || 'beginning',
        to: endDate || defaultEndDate
      }
    };

    // Fetch data based on type filter
    switch (type) {
      case 'all':
        const [rehearsals, theoryLessons, privateLessons] = await Promise.all([
          _getPastRehearsals(dateFilter),
          _getPastTheoryLessons(dateFilter),
          teacherId ? _getPastPrivateLessons({ ...dateFilter, teacherId }) : []
        ]);
        
        activities = [
          ...rehearsals.map(item => ({ ...item, activityType: 'rehearsal' })),
          ...theoryLessons.map(item => ({ ...item, activityType: 'theory' })),
          ...privateLessons.map(item => ({ ...item, activityType: 'private-lesson' }))
        ];
        
        summary.rehearsalsCount = rehearsals.length;
        summary.theoryCount = theoryLessons.length;
        summary.privateLessonsCount = privateLessons.length;
        break;
        
      case 'rehearsals':
        const rehearsalData = await _getPastRehearsals(dateFilter);
        activities = rehearsalData.map(item => ({ ...item, activityType: 'rehearsal' }));
        summary.rehearsalsCount = activities.length;
        break;
        
      case 'theory':
        const theoryData = await _getPastTheoryLessons(dateFilter);
        activities = theoryData.map(item => ({ ...item, activityType: 'theory' }));
        summary.theoryCount = activities.length;
        break;
        
      case 'private-lessons':
        if (!teacherId) {
          throw new Error('teacherId is required for private lessons filtering');
        }
        const privateLessonData = await _getPastPrivateLessons({ ...dateFilter, teacherId });
        activities = privateLessonData.map(item => ({ ...item, activityType: 'private-lesson' }));
        summary.privateLessonsCount = activities.length;
        break;
        
      default:
        throw new Error(`Unsupported activity type: ${type}`);
    }

    // Sort activities by date (most recent first)
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Apply pagination
    const totalCount = activities.length;
    const totalPages = Math.ceil(totalCount / limit);
    const offset = (page - 1) * limit;
    const paginatedActivities = activities.slice(offset, offset + limit);

    summary.totalCount = totalCount;

    return {
      activities: paginatedActivities,
      currentPage: page,
      totalPages,
      totalCount,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
      summary
    };
  } catch (err) {
    console.error(`Failed to get past activities: ${err.message}`);
    throw new Error(`Failed to get past activities: ${err.message}`);
  }
}

/**
 * Get past activities by specific type with enhanced filtering
 */
async function getPastActivitiesByType(filterBy) {
  try {
    const { type } = filterBy;
    
    // Reuse the main function with specific type
    return await getPastActivities(filterBy);
  } catch (err) {
    console.error(`Failed to get past activities by type: ${err.message}`);
    throw new Error(`Failed to get past activities by type: ${err.message}`);
  }
}

/**
 * Get past rehearsals with date filtering
 */
async function _getPastRehearsals(dateFilter) {
  try {
    const { startDate, endDate } = dateFilter;
    
    const filterBy = {
      toDate: endDate // Only get rehearsals before the end date (past)
    };
    
    if (startDate) {
      filterBy.fromDate = startDate;
    }

    const rehearsals = await rehearsalService.getRehearsals(filterBy);
    
    // Filter to only include past dates (before today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return rehearsals
      .filter(rehearsal => new Date(rehearsal.date) < today)
      .map(rehearsal => ({
        _id: rehearsal._id,
        title: rehearsal.title || 'חזרה',
        date: rehearsal.date,
        time: rehearsal.time,
        location: rehearsal.location,
        orchestraId: rehearsal.orchestraId,
        orchestraName: rehearsal.orchestraName,
        conductorId: rehearsal.conductorId,
        conductorName: rehearsal.conductorName,
        attendance: rehearsal.attendance || [],
        notes: rehearsal.notes,
        repertoire: rehearsal.repertoire
      }));
  } catch (err) {
    console.error(`Failed to get past rehearsals: ${err.message}`);
    throw new Error(`Failed to get past rehearsals: ${err.message}`);
  }
}

/**
 * Get past theory lessons with date filtering
 */
async function _getPastTheoryLessons(dateFilter) {
  try {
    const { startDate, endDate } = dateFilter;
    
    const filterBy = {
      toDate: endDate // Only get theory lessons before the end date (past)
    };
    
    if (startDate) {
      filterBy.fromDate = startDate;
    }

    const theoryLessons = await theoryService.getTheoryLessons(filterBy);
    
    // Filter to only include past dates (before today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return theoryLessons
      .filter(lesson => new Date(lesson.date) < today)
      .map(lesson => ({
        _id: lesson._id,
        title: lesson.title || `תאוריה - ${lesson.category}`,
        date: lesson.date,
        time: lesson.time,
        category: lesson.category,
        location: lesson.location,
        teacherId: lesson.teacherId,
        teacherName: lesson.teacherName,
        students: lesson.students || [],
        attendance: lesson.attendance || [],
        notes: lesson.notes,
        materials: lesson.materials
      }));
  } catch (err) {
    console.error(`Failed to get past theory lessons: ${err.message}`);
    throw new Error(`Failed to get past theory lessons: ${err.message}`);
  }
}

/**
 * Get past private lessons for a specific teacher
 */
async function _getPastPrivateLessons(filterBy) {
  try {
    const { teacherId, startDate, endDate } = filterBy;
    
    if (!teacherId) {
      throw new Error('teacherId is required for private lessons');
    }

    const teacherCollection = await getCollection('teacher');
    
    // Build date filter criteria
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    const dateQuery = {
      'teaching.schedule.date': { $lt: today } // Only past dates
    };
    
    if (startDate) {
      dateQuery['teaching.schedule.date'].$gte = getStartOfDay(startDate);
    }
    
    if (endDate) {
      dateQuery['teaching.schedule.date'].$lt = getEndOfDay(endDate);
    }

    // Find teacher with past scheduled lessons
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
      ...dateQuery
    });

    if (!teacher) {
      return [];
    }

    // Filter schedule to only past lessons with students
    const pastLessons = teacher.teaching.schedule
      .filter(slot => {
        const lessonDate = new Date(slot.date);
        lessonDate.setHours(23, 59, 59, 999);
        return lessonDate < today && slot.studentId; // Only past lessons with assigned students
      })
      .map(slot => ({
        _id: slot._id,
        title: `שיעור פרטי - ${slot.instrument}`,
        date: slot.date,
        time: `${slot.startTime} - ${slot.endTime}`,
        teacherId: teacher._id,
        teacherName: `${teacher.personalInfo.firstName} ${teacher.personalInfo.lastName}`,
        studentId: slot.studentId,
        studentName: slot.studentName,
        instrument: slot.instrument,
        location: slot.location || 'לא צוין',
        attendance: slot.attendance || [],
        notes: slot.notes,
        lessonType: 'private'
      }));

    return pastLessons;
  } catch (err) {
    console.error(`Failed to get past private lessons: ${err.message}`);
    throw new Error(`Failed to get past private lessons: ${err.message}`);
  }
}