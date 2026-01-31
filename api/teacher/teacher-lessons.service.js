/**
 * Teacher Lessons Service
 * 
 * This service implements the new approach of using student teacherAssignments
 * as the single source of truth for lesson data, as outlined in the backend
 * synchronization guide.
 */

import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

export const teacherLessonsService = {
  getTeacherLessons,
  getTeacherWeeklySchedule,
  getTeacherDaySchedule,
  getTeacherLessonStats,
  validateTeacherLessonData,
  getTeacherStudentsWithLessons,
};

/**
 * Get all lessons for a teacher by querying student records
 * This implements the single source of truth approach
 * @param {string} teacherId - Teacher's ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of lesson objects
 */
async function getTeacherLessons(teacherId, options = {}) {
  try {
    console.log(`🔍 Getting lessons for teacher ${teacherId} using student records as source of truth`);

    // Validate teacher ID
    if (!ObjectId.isValid(teacherId)) {
      throw new Error(`Invalid teacher ID format: ${teacherId}`);
    }

    // Verify teacher exists
    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
      isActive: { $ne: false }
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Query students with active assignments to this teacher
    // Support both data locations: root-level teacherAssignments AND enrollments.teacherAssignments
    const studentCollection = await getCollection('student');

    // Build match stage to check BOTH paths where teacherAssignments might be stored
    const matchStage = {
      $or: [
        {
          'teacherAssignments.teacherId': teacherId,
          'teacherAssignments.isActive': { $ne: false }
        },
        {
          'enrollments.teacherAssignments.teacherId': teacherId,
          'enrollments.teacherAssignments.isActive': { $ne: false }
        }
      ],
      isActive: { $ne: false }
    };

    // Add optional filters
    if (options.studentId) {
      matchStage._id = ObjectId.createFromHexString(options.studentId);
    }

    // Build aggregation pipeline that handles both data locations
    const pipeline = [
      { $match: matchStage },
      // Create a unified teacherAssignments field from both possible locations
      {
        $addFields: {
          _unifiedAssignments: {
            $cond: {
              if: { $gt: [{ $size: { $ifNull: ['$teacherAssignments', []] } }, 0] },
              then: '$teacherAssignments',
              else: { $ifNull: ['$enrollments.teacherAssignments', []] }
            }
          }
        }
      },
      { $unwind: '$_unifiedAssignments' },
      {
        $match: {
          '_unifiedAssignments.teacherId': teacherId,
          '_unifiedAssignments.isActive': { $ne: false },
          ...(options.day ? { '_unifiedAssignments.day': options.day } : {})
        }
      },
      {
        $project: {
          lessonId: '$_unifiedAssignments._id',
          studentId: '$_id',
          studentName: '$personalInfo.fullName',
          studentPhone: '$personalInfo.phone',
          studentEmail: '$personalInfo.email',
          instrument: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$academicInfo.instrumentProgress',
                  as: 'inst',
                  cond: { $eq: ['$$inst.isPrimary', true] }
                }
              },
              0
            ]
          },
          // Lesson schedule information
          day: '$_unifiedAssignments.day',
          time: '$_unifiedAssignments.time',
          duration: '$_unifiedAssignments.duration',
          location: '$_unifiedAssignments.location',
          notes: '$_unifiedAssignments.notes',
          // Schedule metadata
          scheduleSlotId: '$_unifiedAssignments.scheduleSlotId',
          timeBlockId: '$_unifiedAssignments.timeBlockId',
          lessonId: '$_unifiedAssignments.lessonId',
          // Timing information
          startDate: '$_unifiedAssignments.startDate',
          endDate: '$_unifiedAssignments.endDate',
          isRecurring: '$_unifiedAssignments.isRecurring',
          // Enhanced schedule info if available
          scheduleInfo: '$_unifiedAssignments.scheduleInfo',
          // Metadata
          createdAt: '$_unifiedAssignments.createdAt',
          updatedAt: '$_unifiedAssignments.updatedAt'
        }
      },
      {
        $addFields: {
          instrumentName: '$instrument.instrumentName',
          currentStage: '$instrument.currentStage',
          // Calculate end time
          endTime: {
            $concat: [
              {
                $toString: {
                  $floor: {
                    $divide: [
                      {
                        $add: [
                          { $multiply: [{ $toInt: { $substr: ['$time', 0, 2] } }, 60] },
                          { $toInt: { $substr: ['$time', 3, 2] } },
                          '$duration'
                        ]
                      },
                      60
                    ]
                  }
                }
              },
              ':',
              {
                $let: {
                  vars: {
                    minutes: {
                      $mod: [
                        {
                          $add: [
                            { $multiply: [{ $toInt: { $substr: ['$time', 0, 2] } }, 60] },
                            { $toInt: { $substr: ['$time', 3, 2] } },
                            '$duration'
                          ]
                        },
                        60
                      ]
                    }
                  },
                  in: {
                    $cond: [
                      { $lt: ['$$minutes', 10] },
                      { $concat: ['0', { $toString: '$$minutes' }] },
                      { $toString: '$$minutes' }
                    ]
                  }
                }
              }
            ]
          }
        }
      }
    ];

    // Add sorting
    pipeline.push({
      $sort: {
        day: 1,
        time: 1,
        studentName: 1
      }
    });

    // Execute aggregation
    const lessons = await studentCollection.aggregate(pipeline).toArray();

    console.log(`✅ Found ${lessons.length} lessons for teacher ${teacherId}`);

    // Add day ordering for proper display
    const dayOrder = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    lessons.sort((a, b) => {
      const dayComparison = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
      if (dayComparison !== 0) return dayComparison;
      
      // Sort by time within the same day
      return a.time.localeCompare(b.time);
    });

    return lessons;

  } catch (error) {
    console.error(`❌ Error getting teacher lessons: ${error.message}`);
    throw new Error(`Error getting teacher lessons: ${error.message}`);
  }
}

/**
 * Get teacher's weekly schedule organized by day
 * @param {string} teacherId - Teacher's ID
 * @param {Object} options - Query options
 * @returns {Promise<Object>} Weekly schedule organized by days
 */
async function getTeacherWeeklySchedule(teacherId, options = {}) {
  try {
    console.log(`📅 Getting weekly schedule for teacher ${teacherId}`);

    const lessons = await getTeacherLessons(teacherId, options);

    // Organize lessons by day
    const weeklySchedule = {
      'ראשון': [],
      'שני': [],
      'שלישי': [],
      'רביעי': [],
      'חמישי': [],
      'שישי': [],
      'שבת': []
    };

    // Group lessons by day
    lessons.forEach(lesson => {
      if (weeklySchedule[lesson.day]) {
        weeklySchedule[lesson.day].push(lesson);
      }
    });

    // Sort lessons within each day by time
    Object.keys(weeklySchedule).forEach(day => {
      weeklySchedule[day].sort((a, b) => a.time.localeCompare(b.time));
    });

    const totalLessons = lessons.length;
    console.log(`✅ Weekly schedule organized: ${totalLessons} total lessons across ${Object.keys(weeklySchedule).filter(day => weeklySchedule[day].length > 0).length} days`);

    return {
      teacherId,
      schedule: weeklySchedule,
      summary: {
        totalLessons,
        activeDays: Object.keys(weeklySchedule).filter(day => weeklySchedule[day].length > 0).length,
        lessonsPerDay: Object.keys(weeklySchedule).reduce((acc, day) => {
          acc[day] = weeklySchedule[day].length;
          return acc;
        }, {})
      }
    };

  } catch (error) {
    console.error(`❌ Error getting weekly schedule: ${error.message}`);
    throw new Error(`Error getting weekly schedule: ${error.message}`);
  }
}

/**
 * Get teacher's schedule for a specific day
 * @param {string} teacherId - Teacher's ID
 * @param {string} day - Day name in Hebrew
 * @returns {Promise<Array>} Lessons for the specified day
 */
async function getTeacherDaySchedule(teacherId, day) {
  try {
    console.log(`📅 Getting ${day} schedule for teacher ${teacherId}`);

    const lessons = await getTeacherLessons(teacherId, { day });
    
    console.log(`✅ Found ${lessons.length} lessons for ${day}`);
    
    return lessons;

  } catch (error) {
    console.error(`❌ Error getting day schedule: ${error.message}`);
    throw new Error(`Error getting day schedule: ${error.message}`);
  }
}

/**
 * Get lesson statistics for a teacher
 * @param {string} teacherId - Teacher's ID
 * @returns {Promise<Object>} Lesson statistics
 */
async function getTeacherLessonStats(teacherId) {
  try {
    console.log(`📊 Calculating lesson statistics for teacher ${teacherId}`);

    const lessons = await getTeacherLessons(teacherId);

    const stats = {
      totalLessons: lessons.length,
      uniqueStudents: new Set(lessons.map(lesson => lesson.studentId.toString())).size,
      totalHoursPerWeek: lessons.reduce((total, lesson) => total + (lesson.duration || 0), 0) / 60,
      lessonsByDay: {},
      lessonsByDuration: {},
      instruments: {},
      averageLessonDuration: 0
    };

    // Calculate statistics
    lessons.forEach(lesson => {
      // By day
      if (!stats.lessonsByDay[lesson.day]) {
        stats.lessonsByDay[lesson.day] = 0;
      }
      stats.lessonsByDay[lesson.day]++;

      // By duration
      const duration = lesson.duration || 0;
      if (!stats.lessonsByDuration[duration]) {
        stats.lessonsByDuration[duration] = 0;
      }
      stats.lessonsByDuration[duration]++;

      // By instrument
      const instrument = lesson.instrumentName || 'Unknown';
      if (!stats.instruments[instrument]) {
        stats.instruments[instrument] = 0;
      }
      stats.instruments[instrument]++;
    });

    // Calculate average lesson duration
    if (lessons.length > 0) {
      stats.averageLessonDuration = lessons.reduce((total, lesson) => total + (lesson.duration || 0), 0) / lessons.length;
    }

    console.log(`✅ Statistics calculated: ${stats.totalLessons} lessons, ${stats.uniqueStudents} students, ${stats.totalHoursPerWeek.toFixed(1)} hours/week`);

    return stats;

  } catch (error) {
    console.error(`❌ Error calculating lesson stats: ${error.message}`);
    throw new Error(`Error calculating lesson stats: ${error.message}`);
  }
}

/**
 * Validate teacher lesson data consistency
 * @param {string} teacherId - Teacher's ID
 * @returns {Promise<Object>} Validation report
 */
async function validateTeacherLessonData(teacherId) {
  try {
    console.log(`🔍 Validating lesson data consistency for teacher ${teacherId}`);

    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');

    const validation = {
      teacherId,
      isValid: true,
      issues: [],
      summary: {
        lessonsFound: 0,
        studentsWithAssignments: 0,
        dataInconsistencies: 0,
        missingReferences: 0
      }
    };

    // Get teacher record
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    if (!teacher) {
      validation.isValid = false;
      validation.issues.push({
        type: 'TEACHER_NOT_FOUND',
        message: `Teacher ${teacherId} not found`
      });
      return validation;
    }

    // Get lessons from student records
    const lessons = await getTeacherLessons(teacherId);
    validation.summary.lessonsFound = lessons.length;

    // Check if teacher has students in studentIds that match the lessons
    const teacherStudentIds = teacher.teaching?.studentIds || [];
    const lessonStudentIds = [...new Set(lessons.map(lesson => lesson.studentId.toString()))];
    validation.summary.studentsWithAssignments = lessonStudentIds.length;

    // Check for missing bidirectional references
    lessonStudentIds.forEach(studentId => {
      if (!teacherStudentIds.includes(studentId)) {
        validation.isValid = false;
        validation.issues.push({
          type: 'MISSING_BIDIRECTIONAL_REFERENCE',
          message: `Student ${studentId} has lessons with teacher but teacher doesn't have student in studentIds`,
          studentId,
          teacherId
        });
        validation.summary.missingReferences++;
      }
    });

    // Check for orphaned teacher references
    teacherStudentIds.forEach(studentId => {
      if (!lessonStudentIds.includes(studentId)) {
        validation.issues.push({
          type: 'ORPHANED_TEACHER_REFERENCE',
          message: `Teacher has student ${studentId} in studentIds but no active lessons found`,
          studentId,
          teacherId
        });
        validation.summary.dataInconsistencies++;
      }
    });

    // Validate lesson data completeness
    lessons.forEach(lesson => {
      if (!lesson.day || !lesson.time || !lesson.duration) {
        validation.isValid = false;
        validation.issues.push({
          type: 'INCOMPLETE_LESSON_DATA',
          message: `Lesson missing required fields: day=${!!lesson.day}, time=${!!lesson.time}, duration=${!!lesson.duration}`,
          lessonId: lesson.lessonId,
          studentId: lesson.studentId
        });
        validation.summary.dataInconsistencies++;
      }
    });

    console.log(`✅ Validation completed: ${validation.isValid ? 'PASSED' : 'FAILED'} with ${validation.issues.length} issues`);

    return validation;

  } catch (error) {
    console.error(`❌ Error validating lesson data: ${error.message}`);
    return {
      teacherId,
      isValid: false,
      issues: [{
        type: 'VALIDATION_ERROR',
        message: error.message
      }],
      summary: {
        lessonsFound: 0,
        studentsWithAssignments: 0,
        dataInconsistencies: 1,
        missingReferences: 0
      }
    };
  }
}

/**
 * Get all students with their lesson details for a teacher
 * @param {string} teacherId - Teacher's ID
 * @returns {Promise<Array>} Students with lesson information
 */
async function getTeacherStudentsWithLessons(teacherId) {
  try {
    console.log(`👥 Getting students with lessons for teacher ${teacherId}`);

    // Get all lessons
    const lessons = await getTeacherLessons(teacherId);

    // Group lessons by student
    const studentsMap = new Map();
    
    lessons.forEach(lesson => {
      const studentId = lesson.studentId.toString();
      
      if (!studentsMap.has(studentId)) {
        studentsMap.set(studentId, {
          studentId,
          studentName: lesson.studentName,
          studentPhone: lesson.studentPhone,
          studentEmail: lesson.studentEmail,
          instrumentName: lesson.instrumentName,
          currentStage: lesson.currentStage,
          lessons: []
        });
      }
      
      studentsMap.get(studentId).lessons.push({
        lessonId: lesson.lessonId,
        day: lesson.day,
        time: lesson.time,
        duration: lesson.duration,
        endTime: lesson.endTime,
        location: lesson.location,
        notes: lesson.notes,
        scheduleSlotId: lesson.scheduleSlotId,
        timeBlockId: lesson.timeBlockId
      });
    });

    // Convert to array and sort
    const students = Array.from(studentsMap.values());
    
    // Sort students by name
    students.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
    
    // Sort lessons within each student by day and time
    const dayOrder = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    students.forEach(student => {
      student.lessons.sort((a, b) => {
        const dayComparison = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
        if (dayComparison !== 0) return dayComparison;
        return a.time.localeCompare(b.time);
      });
    });

    console.log(`✅ Found ${students.length} students with ${lessons.length} total lessons`);

    return students;

  } catch (error) {
    console.error(`❌ Error getting students with lessons: ${error.message}`);
    throw new Error(`Error getting students with lessons: ${error.message}`);
  }
}