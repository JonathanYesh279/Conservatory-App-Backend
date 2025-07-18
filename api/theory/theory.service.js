import { getCollection } from '../../services/mongoDB.service.js';
import {
  validateTheoryLesson,
  validateTheoryBulkCreate,
  validateTheoryAttendance,
} from './theory.validation.js';
import { ObjectId } from 'mongodb';
import ConflictDetectionService from '../../services/conflictDetectionService.js';

export const theoryService = {
  getTheoryLessons,
  getTheoryLessonById,
  getTheoryLessonsByCategory,
  getTheoryLessonsByTeacher,
  addTheoryLesson,
  updateTheoryLesson,
  removeTheoryLesson,
  bulkCreateTheoryLessons,
  updateTheoryAttendance,
  getTheoryAttendance,
  addStudentToTheory,
  removeStudentFromTheory,
  getStudentTheoryAttendanceStats,
};

async function getTheoryLessons(filterBy = {}) {
  try {
    const collection = await getCollection('theory_lesson');
    const criteria = _buildCriteria(filterBy);

    const theoryLessons = await collection
      .find(criteria)
      .sort({ date: 1, startTime: 1 })
      .toArray();

    return theoryLessons;
  } catch (err) {
    console.error(`Error in theoryService.getTheoryLessons: ${err}`);
    throw new Error(`Error in theoryService.getTheoryLessons: ${err}`);
  }
}

async function getTheoryLessonById(theoryLessonId) {
  try {
    const collection = await getCollection('theory_lesson');
    const theoryLesson = await collection.findOne({
      _id: ObjectId.createFromHexString(theoryLessonId),
    });

    if (!theoryLesson) {
      throw new Error(`Theory lesson with id ${theoryLessonId} not found`);
    }
    return theoryLesson;
  } catch (err) {
    console.error(`Error in theoryService.getTheoryLessonById: ${err}`);
    throw new Error(`Error in theoryService.getTheoryLessonById: ${err}`);
  }
}

async function getTheoryLessonsByCategory(category, filterBy = {}) {
  try {
    filterBy.category = category;
    return await getTheoryLessons(filterBy);
  } catch (err) {
    console.error(`Error in theoryService.getTheoryLessonsByCategory: ${err}`);
    throw new Error(
      `Error in theoryService.getTheoryLessonsByCategory: ${err}`
    );
  }
}

async function getTheoryLessonsByTeacher(teacherId, filterBy = {}) {
  try {
    filterBy.teacherId = teacherId;
    return await getTheoryLessons(filterBy);
  } catch (err) {
    console.error(`Error in theoryService.getTheoryLessonsByTeacher: ${err}`);
    throw new Error(`Error in theoryService.getTheoryLessonsByTeacher: ${err}`);
  }
}

async function addTheoryLesson(theoryLessonToAdd) {
  try {
    const { error, value } = validateTheoryLesson(theoryLessonToAdd);
    if (error) {
      throw new Error(`Validation error: ${error.message}`);
    }

    // Ensure we have schoolYearId
    if (!value.schoolYearId) {
      const schoolYearService = (
        await import('../school-year/school-year.service.js')
      ).schoolYearService;
      const currentSchoolYear = await schoolYearService.getCurrentSchoolYear();
      value.schoolYearId = currentSchoolYear._id.toString();
    }

    // Calculate day of week if not provided
    if (value.dayOfWeek === undefined) {
      const lessonDate = new Date(value.date);
      value.dayOfWeek = lessonDate.getDay();
    }

    // Set timestamps
    value.createdAt = new Date();
    value.updatedAt = new Date();

    // CRITICAL: Final conflict check right before insertion to prevent race conditions
    const conflictValidation = await ConflictDetectionService.validateSingleLesson(value);
    if (conflictValidation.hasConflicts && !theoryLessonToAdd.forceCreate) {
      const conflicts = [...conflictValidation.roomConflicts, ...conflictValidation.teacherConflicts];
      throw new Error(`Conflicts detected: ${conflicts.map(c => c.description).join('; ')}`);
    }

    const collection = await getCollection('theory_lesson');
    
    // Try to insert with error handling for duplicate key errors
    try {
      const result = await collection.insertOne(value);
      
      // Update teacher record to include this theory lesson
      try {
        const teacherCollection = await getCollection('teacher');
        await teacherCollection.updateOne(
          { _id: ObjectId.createFromHexString(value.teacherId) },
          {
            $push: { 'teaching.theoryLessonIds': result.insertedId.toString() },
          }
        );
      } catch (teacherUpdateErr) {
        // Log warning but don't fail the entire operation
        console.warn(
          `Failed to update teacher record: ${teacherUpdateErr.message}`
        );
      }

      return { _id: result.insertedId, ...value };
    } catch (insertError) {
      // Handle duplicate key errors (race condition caught at DB level)
      if (insertError.code === 11000) {
        throw new Error(`Duplicate lesson detected: A lesson already exists for this room and time slot`);
      }
      throw insertError;
    }
  } catch (err) {
    console.error(`Error in theoryService.addTheoryLesson: ${err}`);
    throw new Error(`Error in theoryService.addTheoryLesson: ${err}`);
  }
}

async function updateTheoryLesson(theoryLessonId, theoryLessonToUpdate) {
  try {
    const { error, value } = validateTheoryLesson(theoryLessonToUpdate);
    if (error) {
      throw new Error(`Validation error: ${error.message}`);
    }

    value.updatedAt = new Date();

    // Get existing lesson to check for teacher changes
    const existingLesson = await getTheoryLessonById(theoryLessonId);

    // If teacher changed, update both old and new teacher records
    if (existingLesson.teacherId !== value.teacherId) {
      const teacherCollection = await getCollection('teacher');

      // Remove from old teacher
      await teacherCollection.updateOne(
        { _id: ObjectId.createFromHexString(existingLesson.teacherId) },
        {
          $pull: { 'teaching.theoryLessonIds': theoryLessonId },
        }
      );

      // Add to new teacher
      await teacherCollection.updateOne(
        { _id: ObjectId.createFromHexString(value.teacherId) },
        {
          $push: { 'teaching.theoryLessonIds': theoryLessonId },
        }
      );
    }

    const collection = await getCollection('theory_lesson');
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(theoryLessonId) },
      { $set: value },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error(`Theory lesson with id ${theoryLessonId} not found`);
    }
    return result;
  } catch (err) {
    console.error(`Error in theoryService.updateTheoryLesson: ${err}`);
    throw new Error(`Error in theoryService.updateTheoryLesson: ${err}`);
  }
}

async function removeTheoryLesson(theoryLessonId) {
  try {
    const theoryLesson = await getTheoryLessonById(theoryLessonId);

    // Remove from teacher record
    try {
      const teacherCollection = await getCollection('teacher');
      await teacherCollection.updateOne(
        { _id: ObjectId.createFromHexString(theoryLesson.teacherId) },
        {
          $pull: { 'teaching.theoryLessonIds': theoryLessonId },
        }
      );
    } catch (teacherUpdateErr) {
      console.warn(
        `Failed to update teacher record: ${teacherUpdateErr.message}`
      );
    }

    // Remove from student records
    try {
      const studentCollection = await getCollection('student');
      await studentCollection.updateMany(
        { 'enrollments.theoryLessonIds': theoryLessonId },
        {
          $pull: { 'enrollments.theoryLessonIds': theoryLessonId },
          $set: { updatedAt: new Date() }
        }
      );
    } catch (studentUpdateErr) {
      console.warn(
        `Failed to update student records: ${studentUpdateErr.message}`
      );
    }

    // Delete associated attendance records
    try {
      const activityCollection = await getCollection('activity_attendance');
      await activityCollection.deleteMany({
        sessionId: theoryLessonId,
        activityType: 'תאוריה',
      });
    } catch (attendanceErr) {
      console.warn(
        `Failed to delete attendance records: ${attendanceErr.message}`
      );
    }

    // Hard delete - actually remove the document
    const collection = await getCollection('theory_lesson');
    const result = await collection.findOneAndDelete(
      { _id: ObjectId.createFromHexString(theoryLessonId) }
    );

    if (!result) {
      throw new Error(`Theory lesson with id ${theoryLessonId} not found`);
    }
    return result;
  } catch (err) {
    console.error(`Error in theoryService.removeTheoryLesson: ${err}`);
    throw new Error(`Error in theoryService.removeTheoryLesson: ${err}`);
  }
}

async function bulkCreateTheoryLessons(bulkData) {
  try {
    console.log(
      'Bulk creating theory lessons with data:',
      JSON.stringify(bulkData, null, 2)
    );

    const { error, value } = validateTheoryBulkCreate(bulkData);
    if (error) {
      console.error(`Bulk validation error:`, error.details);
      throw error;
    }

    const {
      category,
      teacherId,
      startDate,
      endDate,
      dayOfWeek,
      startTime,
      endTime,
      location,
      studentIds = [],
      notes = '',
      syllabus = '',
      excludeDates = [],
      schoolYearId,
    } = value;

    // Verify school year ID
    if (!schoolYearId) {
      console.error('Missing schoolYearId in bulk theory lesson data');
      throw new Error('School year ID is required for bulk creation');
    }

    // Generate dates for theory lessons
    const dates = _generateDatesForDayOfWeek(
      new Date(startDate),
      new Date(endDate),
      dayOfWeek,
      (excludeDates || []).map((day) => new Date(day))
    );

    console.log(`Generated ${dates.length} dates for theory lessons`);

    // Create theory lesson documents
    const theoryLessons = dates.map((date) => ({
      category,
      teacherId,
      date,
      dayOfWeek,
      startTime,
      endTime,
      location,
      studentIds: [...studentIds],
      attendance: { present: [], absent: [] },
      notes: notes || '',
      syllabus: syllabus || '',
      homework: '',
      schoolYearId: schoolYearId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    if (theoryLessons.length === 0) {
      console.log('No theory lesson dates generated, returning empty result');
      return { insertedCount: 0, theoryLessonIds: [] };
    }

    // Get theory lesson collection
    const theoryLessonCollection = await getCollection('theory_lesson');
    if (!theoryLessonCollection) {
      throw new Error('Theory lesson collection is undefined');
    }

    const result = { insertedCount: 0, theoryLessonIds: [] };

    // CRITICAL: Final conflict validation right before insertion
    console.log('Performing final conflict validation before insertion...');
    const finalConflictCheck = await ConflictDetectionService.validateBulkLessons({
      startDate,
      endDate,
      dayOfWeek,
      startTime,
      endTime,
      location,
      teacherId,
      excludeDates
    });

    if (finalConflictCheck.hasConflicts && !bulkData.forceCreate) {
      const conflicts = [...finalConflictCheck.roomConflicts, ...finalConflictCheck.teacherConflicts];
      throw new Error(`Final validation failed - conflicts detected: ${conflicts.map(c => c.description).join('; ')}`);
    }

    // Insert theory lessons atomically with conflict protection
    const batchSize = 50; // Smaller batches for better error handling
    for (let i = 0; i < theoryLessons.length; i += batchSize) {
      try {
        const batch = theoryLessons.slice(i, i + batchSize);
        console.log(
          `Inserting batch ${i / batchSize + 1} with ${
            batch.length
          } theory lessons`
        );

        // Use insertMany with ordered:false to continue on conflicts
        const batchResult = await theoryLessonCollection.insertMany(batch, {
          ordered: false, // Continue inserting even if some fail due to conflicts
          writeConcern: { w: 'majority' } // Ensure write is acknowledged by majority of replica set
        });
        
        console.log(`Batch inserted successfully: ${batchResult.insertedCount} lessons`);

        result.insertedCount += batchResult.insertedCount;
        const batchIds = Object.values(batchResult.insertedIds).map((id) =>
          id.toString()
        );
        result.theoryLessonIds = [...result.theoryLessonIds, ...batchIds];
      } catch (batchErr) {
        console.error(`Error inserting batch: ${batchErr}`);
        
        // Handle duplicate key errors specifically
        if (batchErr.code === 11000 || batchErr.writeErrors?.some(e => e.code === 11000)) {
          console.warn('Some lessons were skipped due to conflicts (duplicate key errors)');
          // Extract successfully inserted IDs even when some fail
          if (batchErr.result && batchErr.result.insertedIds) {
            const successfulIds = Object.values(batchErr.result.insertedIds).map(id => id.toString());
            result.theoryLessonIds = [...result.theoryLessonIds, ...successfulIds];
            result.insertedCount += successfulIds.length;
          }
          continue; // Continue with next batch
        }
        
        throw new Error(
          `Failed to insert theory lesson batch: ${batchErr.message}`
        );
      }
    }

    // Update teacher record with new theory lesson IDs
    if (result.theoryLessonIds.length > 0) {
      try {
        const teacherCollection = await getCollection('teacher');
        if (teacherCollection) {
          console.log(
            `Updating teacher ${teacherId} with ${result.theoryLessonIds.length} new theory lesson IDs`
          );

          await teacherCollection.updateOne(
            { _id: ObjectId.createFromHexString(teacherId) },
            {
              $push: {
                'teaching.theoryLessonIds': { $each: result.theoryLessonIds },
              },
            }
          );
        }
      } catch (updateErr) {
        // Log the error but don't fail the entire operation
        console.error(
          `Failed to update teacher with theory lesson IDs: ${updateErr}`
        );
      }

      // Update student records with theory lesson IDs if students were assigned
      if (studentIds && studentIds.length > 0) {
        try {
          const studentCollection = await getCollection('student');
          
          // Update each student with all theory lesson IDs
          for (const studentId of studentIds) {
            await studentCollection.updateOne(
              { _id: ObjectId.createFromHexString(studentId) },
              {
                $addToSet: { 
                  'enrollments.theoryLessonIds': { $each: result.theoryLessonIds } 
                },
                $set: { updatedAt: new Date() }
              }
            );
          }
          
          console.log(
            `Updated ${studentIds.length} students with ${result.theoryLessonIds.length} theory lesson IDs`
          );
        } catch (studentUpdateErr) {
          // Log the error but don't fail the entire operation
          console.error(
            `Failed to update students with theory lesson IDs: ${studentUpdateErr}`
          );
        }
      }
    }

    console.log(`Successfully created ${result.insertedCount} theory lessons`);
    return result;
  } catch (err) {
    console.error(`Failed to bulk create theory lessons: ${err}`);
    throw new Error(`Failed to bulk create theory lessons: ${err}`);
  }
}

async function updateTheoryAttendance(theoryLessonId, attendanceData) {
  try {
    const { error, value } = validateTheoryAttendance(attendanceData);
    if (error) throw error;

    const { present, absent } = value;

    // Get the theory lesson to verify it exists
    const theoryLesson = await getTheoryLessonById(theoryLessonId);

    const collection = await getCollection('theory_lesson');
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(theoryLessonId) },
      {
        $set: {
          attendance: {
            present,
            absent,
          },
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error(`Theory lesson with id ${theoryLessonId} not found`);
    }

    // Create activity attendance records
    try {
      const activityCollection = await getCollection('activity_attendance');
      if (activityCollection) {
        // Delete existing attendance records for this lesson
        await activityCollection.deleteMany({
          sessionId: theoryLessonId,
          activityType: 'תאוריה',
        });

        // Create new attendance records
        const presentPromises = present.map((studentId) =>
          activityCollection.insertOne({
            studentId,
            activityType: 'תאוריה',
            groupId: theoryLesson.category,
            sessionId: theoryLessonId,
            date: theoryLesson.date,
            status: 'הגיע/ה',
            notes: '',
            createdAt: new Date(),
          })
        );

        const absentPromises = absent.map((studentId) =>
          activityCollection.insertOne({
            studentId,
            activityType: 'תאוריה',
            groupId: theoryLesson.category,
            sessionId: theoryLessonId,
            date: theoryLesson.date,
            status: 'לא הגיע/ה',
            notes: '',
            createdAt: new Date(),
          })
        );

        await Promise.all([...presentPromises, ...absentPromises]);
      }
    } catch (activityErr) {
      // Log but don't fail if activity records couldn't be created
      console.warn(`Could not create activity records: ${activityErr.message}`);
    }

    return result;
  } catch (err) {
    console.error(`Error in theoryService.updateTheoryAttendance: ${err}`);
    throw new Error(`Error in theoryService.updateTheoryAttendance: ${err}`);
  }
}

async function getTheoryAttendance(theoryLessonId) {
  try {
    const theoryLesson = await getTheoryLessonById(theoryLessonId);
    return theoryLesson.attendance || { present: [], absent: [] };
  } catch (err) {
    console.error(`Error in theoryService.getTheoryAttendance: ${err}`);
    throw new Error(`Error in theoryService.getTheoryAttendance: ${err}`);
  }
}

async function addStudentToTheory(theoryLessonId, studentId) {
  try {
    // Update the theory lesson to add the student
    const theoryCollection = await getCollection('theory_lesson');
    const result = await theoryCollection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(theoryLessonId) },
      {
        $addToSet: { studentIds: studentId },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error(`Theory lesson with id ${theoryLessonId} not found`);
    }

    // Also update the student to add the theory lesson ID
    try {
      const studentCollection = await getCollection('student');
      await studentCollection.updateOne(
        { _id: ObjectId.createFromHexString(studentId) },
        {
          $addToSet: { 'enrollments.theoryLessonIds': theoryLessonId },
          $set: { updatedAt: new Date() }
        }
      );
    } catch (studentUpdateErr) {
      // Log warning but don't fail the entire operation
      console.warn(`Failed to update student record with theory lesson: ${studentUpdateErr.message}`);
    }

    return result;
  } catch (err) {
    console.error(`Error in theoryService.addStudentToTheory: ${err}`);
    throw new Error(`Error in theoryService.addStudentToTheory: ${err}`);
  }
}

async function removeStudentFromTheory(theoryLessonId, studentId) {
  try {
    // Update the theory lesson to remove the student
    const theoryCollection = await getCollection('theory_lesson');
    const result = await theoryCollection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(theoryLessonId) },
      {
        $pull: { studentIds: studentId },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error(`Theory lesson with id ${theoryLessonId} not found`);
    }

    // Also update the student to remove the theory lesson ID
    try {
      const studentCollection = await getCollection('student');
      await studentCollection.updateOne(
        { _id: ObjectId.createFromHexString(studentId) },
        {
          $pull: { 'enrollments.theoryLessonIds': theoryLessonId },
          $set: { updatedAt: new Date() }
        }
      );
    } catch (studentUpdateErr) {
      // Log warning but don't fail the entire operation
      console.warn(`Failed to update student record when removing theory lesson: ${studentUpdateErr.message}`);
    }

    return result;
  } catch (err) {
    console.error(`Error in theoryService.removeStudentFromTheory: ${err}`);
    throw new Error(`Error in theoryService.removeStudentFromTheory: ${err}`);
  }
}

async function getStudentTheoryAttendanceStats(studentId, category = null) {
  try {
    const activityCollection = await getCollection('activity_attendance');

    const matchCriteria = {
      studentId,
      activityType: 'תאוריה',
    };

    if (category) {
      matchCriteria.groupId = category;
    }

    const attendanceRecords = await activityCollection
      .find(matchCriteria)
      .toArray();

    const totalLessons = attendanceRecords.length;
    const attended = attendanceRecords.filter(
      (record) => record.status === 'הגיע/ה'
    ).length;
    const attendanceRate = totalLessons ? (attended / totalLessons) * 100 : 0;

    const recentHistory = attendanceRecords
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10)
      .map((record) => ({
        date: record.date,
        status: record.status,
        category: record.groupId,
        sessionId: record.sessionId,
        notes: record.notes,
      }));

    const result = {
      totalLessons,
      attended,
      attendanceRate,
      recentHistory,
    };

    if (totalLessons === 0) {
      result.message =
        'No attendance records found for this student in theory lessons';
    }

    return result;
  } catch (err) {
    console.error(
      `Error in theoryService.getStudentTheoryAttendanceStats: ${err}`
    );
    throw new Error(
      `Error in theoryService.getStudentTheoryAttendanceStats: ${err}`
    );
  }
}

// Helper function to generate dates for a specific day of the week
function _generateDatesForDayOfWeek(
  startDate,
  endDate,
  dayOfWeek,
  excludeDates = []
) {
  const dates = [];
  const currentDate = new Date(startDate);

  // Calculate first occurrence of the specified day of week
  currentDate.setDate(
    currentDate.getDate() + ((dayOfWeek - currentDate.getDay() + 7) % 7)
  );

  // If the first occurrence is before the start date, move to next week
  if (currentDate < startDate) {
    currentDate.setDate(currentDate.getDate() + 7);
  }

  // Generate all dates until end date
  while (currentDate <= endDate) {
    const shouldExclude = excludeDates.some(
      (excludeDate) => excludeDate.toDateString() === currentDate.toDateString()
    );

    if (!shouldExclude) {
      dates.push(new Date(currentDate));
    }

    currentDate.setDate(currentDate.getDate() + 7);
  }

  return dates;
}

// Helper function to build query criteria
function _buildCriteria(filterBy) {
  const criteria = {};

  if (filterBy.category) {
    criteria.category = filterBy.category;
  }

  if (filterBy.teacherId) {
    criteria.teacherId = filterBy.teacherId;
  }

  if (filterBy.studentId) {
    criteria.studentIds = filterBy.studentId;
  }

  if (filterBy.fromDate) {
    criteria.date = criteria.date || {};
    criteria.date.$gte = new Date(filterBy.fromDate);
  }

  if (filterBy.toDate) {
    criteria.date = criteria.date || {};
    criteria.date.$lte = new Date(filterBy.toDate);
  }

  if (filterBy.dayOfWeek !== undefined) {
    criteria.dayOfWeek = parseInt(filterBy.dayOfWeek);
  }

  if (filterBy.location) {
    criteria.location = filterBy.location;
  }

  if (filterBy.schoolYearId) {
    criteria.schoolYearId = filterBy.schoolYearId;
  }

  // isActive filtering removed - all records are now active (hard delete implementation)

  return criteria;
}
