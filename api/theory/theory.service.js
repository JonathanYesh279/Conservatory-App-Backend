import { getCollection } from '../../services/mongoDB.service.js';
import {
  validateTheoryLesson,
  validateTheoryLessonUpdate,
  validateTheoryBulkCreate,
  validateTheoryAttendance,
} from './theory.validation.js';
import { ObjectId } from 'mongodb';
import ConflictDetectionService from '../../services/conflictDetectionService.js';
import { 
  toUTC, 
  createAppDate, 
  getDayOfWeek,
  generateDatesForDayOfWeek,
  formatDate,
  getStartOfDay,
  getEndOfDay,
  isValidDate,
  now,
  isSameDay
} from '../../utils/dateHelpers.js';
import { 
  createLessonFilterQuery,
  createPaginationQuery,
  estimateQueryComplexity 
} from '../../utils/queryOptimization.js';
import queryCacheService from '../../services/queryCacheService.js';

export const theoryService = {
  getTheoryLessons,
  getTheoryLessonById,
  getTheoryLessonsByCategory,
  getTheoryLessonsByTeacher,
  addTheoryLesson,
  updateTheoryLesson,
  removeTheoryLesson,
  bulkCreateTheoryLessons,
  bulkDeleteTheoryLessonsByDate,
  bulkDeleteTheoryLessonsByCategory,
  bulkDeleteTheoryLessonsByTeacher,
  updateTheoryAttendance,
  getTheoryAttendance,
  addStudentToTheory,
  removeStudentFromTheory,
  getStudentTheoryAttendanceStats,
};

async function getTheoryLessons(filterBy = {}, paginationOptions = {}) {
  try {
    console.log('🔍 Theory Service: Getting theory lessons with filters:', JSON.stringify(filterBy, null, 2));
    console.log('📄 Theory Service: Pagination options:', JSON.stringify(paginationOptions, null, 2));

    // Temporarily disable cache for debugging
    // const cacheKey = 'theory_lessons';
    // const cachedResult = queryCacheService.get(cacheKey, filterBy);
    // if (cachedResult) {
    //   console.log('📦 Theory Service: Returning cached result, count:', cachedResult.length);
    //   return cachedResult;
    // }

    const collection = await getCollection('theory_lesson');
    const criteria = createLessonFilterQuery(filterBy);

    console.log('🔎 Theory Service: Built query criteria:', JSON.stringify(criteria, null, 2));

    // Count total matching documents
    const totalCount = await collection.countDocuments(criteria);
    console.log('📈 Theory Service: Total matching documents:', totalCount);

    // Estimate query complexity for monitoring
    const complexity = estimateQueryComplexity(criteria);

    // Extract pagination parameters with defaults
    const page = parseInt(paginationOptions.page) || 1;
    const limit = parseInt(paginationOptions.limit) || 20;
    const sortField = paginationOptions.sortField || 'date';
    const sortOrder = paginationOptions.sortOrder || 1; // 1 for ascending

    // Create pagination query
    const { pagination, sort } = createPaginationQuery({
      page,
      limit,
      sortField,
      sortOrder
    });

    // Build sort object with secondary sort on startTime
    const sortObj = { ...sort, startTime: 1 };

    // Execute query with pagination
    const theoryLessons = await collection
      .find(criteria)
      .sort(sortObj)
      .skip(pagination.skip)
      .limit(pagination.limit)
      .toArray();

    console.log('✅ Theory Service: Query executed, found lessons:', theoryLessons.length);
    if (theoryLessons.length > 0) {
      console.log('📄 Theory Service: First lesson sample:', {
        _id: theoryLessons[0]._id,
        category: theoryLessons[0].category,
        teacherId: theoryLessons[0].teacherId,
        date: theoryLessons[0].date,
        schoolYearId: theoryLessons[0].schoolYearId
      });
    }

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Temporarily disable cache for debugging
    // const ttl = _calculateCacheTTL(filterBy, complexity);
    // queryCacheService.set(cacheKey, filterBy, theoryLessons, { ttl });

    return {
      data: theoryLessons,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage
      }
    };
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

async function getTheoryLessonsByCategory(category, filterBy = {}, paginationOptions = {}) {
  try {
    filterBy.category = category;
    return await getTheoryLessons(filterBy, paginationOptions);
  } catch (err) {
    console.error(`Error in theoryService.getTheoryLessonsByCategory: ${err}`);
    throw new Error(
      `Error in theoryService.getTheoryLessonsByCategory: ${err}`
    );
  }
}

async function getTheoryLessonsByTeacher(teacherId, filterBy = {}, paginationOptions = {}) {
  try {
    filterBy.teacherId = teacherId;
    return await getTheoryLessons(filterBy, paginationOptions);
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

    // Convert date to UTC for storage and calculate day of week
    if (!isValidDate(value.date)) {
      throw new Error('Invalid lesson date provided');
    }
    
    const lessonDate = createAppDate(value.date);
    value.date = toUTC(lessonDate);
    
    // Calculate day of week if not provided (using timezone-aware calculation)
    if (value.dayOfWeek === undefined) {
      value.dayOfWeek = getDayOfWeek(lessonDate);
    }

    // Set timestamps using timezone-aware current time
    const currentTime = now();
    value.createdAt = toUTC(currentTime);
    value.updatedAt = toUTC(currentTime);

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

      // Invalidate relevant cache entries
      queryCacheService.invalidateByDate(lessonDate.format('YYYY-MM-DD'));
      queryCacheService.invalidate('theory_lessons', { teacherId: value.teacherId });

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
    console.log(`🔄 Theory Service: Updating lesson ${theoryLessonId} with data:`, JSON.stringify(theoryLessonToUpdate, null, 2));
    
    const { error, value } = validateTheoryLessonUpdate(theoryLessonToUpdate);
    if (error) {
      console.error(`❌ Validation error in theory update:`, error.details);
      throw new Error(`Validation error: ${error.message}`);
    }

    console.log(`✅ Validation passed. Validated data:`, JSON.stringify(value, null, 2));

    // Handle date conversion for updates
    if (value.date && !isValidDate(value.date)) {
      throw new Error('Invalid lesson date provided for update');
    }
    
    if (value.date) {
      const lessonDate = createAppDate(value.date);
      value.date = toUTC(lessonDate);
      
      // Recalculate day of week if date changed
      value.dayOfWeek = getDayOfWeek(lessonDate);
    }
    
    value.updatedAt = toUTC(now());

    // Get existing lesson to check for teacher changes
    const existingLesson = await getTheoryLessonById(theoryLessonId);

    // If teacher changed, update both old and new teacher records
    if (value.teacherId && existingLesson.teacherId !== value.teacherId) {
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
    
    // Validate theoryLessonId format before using it
    if (!ObjectId.isValid(theoryLessonId)) {
      throw new Error(`Invalid theory lesson ID format: ${theoryLessonId}`);
    }

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
          $set: { updatedAt: toUTC(now()) }
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

    // Validate input dates
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      throw new Error('Invalid start or end date provided for bulk creation');
    }
    
    // Generate dates for theory lessons using timezone-aware helper
    console.log(`📅 Bulk creation: Generating dates for dayOfWeek=${dayOfWeek} (0=Sun, 6=Sat) from ${startDate} to ${endDate}`);
    const utcDates = generateDatesForDayOfWeek(startDate, endDate, dayOfWeek, excludeDates || []);

    console.log(`Generated ${utcDates.length} dates for theory lessons`);

    // CRITICAL: Verify generated dates match the requested day of week
    if (utcDates.length > 0) {
      const firstDate = createAppDate(utcDates[0]);
      const firstDateDay = firstDate.day();
      if (firstDateDay !== dayOfWeek) {
        console.error(`❌ CRITICAL DATE MISMATCH: Requested dayOfWeek=${dayOfWeek} but first generated date ${firstDate.format('YYYY-MM-DD')} has dayOfWeek=${firstDateDay}`);
        console.error(`   Input startDate: ${startDate}, Input endDate: ${endDate}`);
        throw new Error(`Date generation mismatch: requested day ${dayOfWeek} but generated dates for day ${firstDateDay}`);
      }
      console.log(`✅ Date verification passed: First date ${firstDate.format('YYYY-MM-DD')} is dayOfWeek=${firstDateDay}`);
    }

    // Create theory lesson documents with proper timezone handling
    const currentTime = now();
    const theoryLessons = utcDates.map((utcDate) => ({
      category,
      teacherId,
      date: utcDate, // Already in UTC from generateDatesForDayOfWeek
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
      createdAt: toUTC(currentTime),
      updatedAt: toUTC(currentTime),
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
                $set: { updatedAt: toUTC(now()) }
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
          updatedAt: toUTC(now()),
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
            createdAt: toUTC(now()),
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
            createdAt: toUTC(now()),
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
        $set: { updatedAt: toUTC(now()) },
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
          $set: { updatedAt: toUTC(now()) }
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
        $set: { updatedAt: toUTC(now()) },
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
          $set: { updatedAt: toUTC(now()) }
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
      .sort((a, b) => createAppDate(b.date).valueOf() - createAppDate(a.date).valueOf())
      .slice(0, 10)
      .map((record) => ({
        date: formatDate(record.date, 'DD/MM/YYYY'),
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
// @deprecated Use generateDatesForDayOfWeek from dateHelpers instead
function _generateDatesForDayOfWeek(
  startDate,
  endDate,
  dayOfWeek,
  excludeDates = []
) {
  // Use the new timezone-aware date generation
  return generateDatesForDayOfWeek(startDate, endDate, dayOfWeek, excludeDates);
}

async function bulkDeleteTheoryLessonsByDate(startDate, endDate, userId, isAdmin = false) {
  try {
    // Input validation
    if (!startDate || !endDate) {
      throw new Error('Start date and end date are required');
    }

    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      throw new Error('Invalid start or end date provided');
    }

    const start = getStartOfDay(startDate);
    const end = getEndOfDay(endDate);

    if (end <= start) {
      throw new Error('End date must be after start date');
    }

    // Get collections
    const theoryCollection = await getCollection('theory_lesson');
    const activityCollection = await getCollection('activity_attendance');

    if (!theoryCollection) {
      throw new Error('Database error: Failed to access theory lesson collection');
    }

    // Build query criteria
    const criteria = {
      date: {
        $gte: start,
        $lte: end
      }
    };

    // Get all theory lessons in date range to collect IDs for cleanup
    const theoryLessons = await theoryCollection.find(criteria).toArray();
    const lessonIds = theoryLessons.map(lesson => lesson._id.toString());

    let deletedCount = 0;

    // Use transaction for data consistency
    const client = theoryCollection.client || theoryCollection.s?.client;
    if (client) {
      const session = client.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Delete all theory lessons in date range
          const deleteResult = await theoryCollection.deleteMany(criteria, { session });
          deletedCount = deleteResult.deletedCount;

          // Clean up attendance records if collection exists
          if (activityCollection && lessonIds.length > 0) {
            await activityCollection.deleteMany(
              { 
                sessionId: { $in: lessonIds },
                activityType: 'תאוריה'
              },
              { session }
            );
          }
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Fallback without transaction if session not available
      const deleteResult = await theoryCollection.deleteMany(criteria);
      deletedCount = deleteResult.deletedCount;

      // Clean up attendance records
      if (activityCollection && lessonIds.length > 0) {
        try {
          await activityCollection.deleteMany({
            sessionId: { $in: lessonIds },
            activityType: 'תאוריה'
          });
        } catch (attendanceErr) {
          console.warn(`Failed to delete attendance records: ${attendanceErr.message}`);
        }
      }
    }

    // Clear cache
    queryCacheService.invalidate('theory_lessons');

    // Logging
    console.log(`User ${userId} deleted ${deletedCount} theory lessons between ${formatDate(start)} and ${formatDate(end)}`);

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} theory lessons between ${formatDate(start)} and ${formatDate(end)}`
    };
  } catch (err) {
    console.error(`Failed to bulk delete theory lessons by date: ${err}`);
    throw new Error(`Failed to bulk delete theory lessons by date: ${err.message}`);
  }
}

async function bulkDeleteTheoryLessonsByCategory(category, userId, isAdmin = false) {
  try {
    // Input validation
    if (!category) {
      throw new Error('Category is required');
    }

    // Get collections
    const theoryCollection = await getCollection('theory_lesson');
    const activityCollection = await getCollection('activity_attendance');

    if (!theoryCollection) {
      throw new Error('Database error: Failed to access theory lesson collection');
    }

    // Build query criteria
    const criteria = { category };

    // Get all theory lessons for this category to collect IDs for cleanup
    const theoryLessons = await theoryCollection.find(criteria).toArray();
    const lessonIds = theoryLessons.map(lesson => lesson._id.toString());

    let deletedCount = 0;

    // Use transaction for data consistency
    const client = theoryCollection.client || theoryCollection.s?.client;
    if (client) {
      const session = client.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Delete all theory lessons for this category
          const deleteResult = await theoryCollection.deleteMany(criteria, { session });
          deletedCount = deleteResult.deletedCount;

          // Clean up attendance records if collection exists
          if (activityCollection && lessonIds.length > 0) {
            await activityCollection.deleteMany(
              { 
                sessionId: { $in: lessonIds },
                activityType: 'תאוריה'
              },
              { session }
            );
          }
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Fallback without transaction if session not available
      const deleteResult = await theoryCollection.deleteMany(criteria);
      deletedCount = deleteResult.deletedCount;

      // Clean up attendance records
      if (activityCollection && lessonIds.length > 0) {
        try {
          await activityCollection.deleteMany({
            sessionId: { $in: lessonIds },
            activityType: 'תאוריה'
          });
        } catch (attendanceErr) {
          console.warn(`Failed to delete attendance records: ${attendanceErr.message}`);
        }
      }
    }

    // Clear cache
    queryCacheService.invalidate('theory_lessons');

    // Logging
    console.log(`User ${userId} deleted ${deletedCount} theory lessons for category: ${category}`);

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} theory lessons for category: ${category}`
    };
  } catch (err) {
    console.error(`Failed to bulk delete theory lessons by category: ${err}`);
    throw new Error(`Failed to bulk delete theory lessons by category: ${err.message}`);
  }
}

async function bulkDeleteTheoryLessonsByTeacher(teacherId, userId, isAdmin = false) {
  try {
    // Input validation
    if (!teacherId || !ObjectId.isValid(teacherId)) {
      throw new Error('Valid teacher ID is required');
    }

    // Authorization check - teachers can only delete their own lessons unless admin
    if (!isAdmin && teacherId !== userId.toString()) {
      throw new Error('Not authorized to delete lessons for this teacher');
    }

    // Get collections
    const theoryCollection = await getCollection('theory_lesson');
    const activityCollection = await getCollection('activity_attendance');

    if (!theoryCollection) {
      throw new Error('Database error: Failed to access theory lesson collection');
    }

    // Build query criteria
    const criteria = { teacherId };

    // Get all theory lessons for this teacher to collect IDs for cleanup
    const theoryLessons = await theoryCollection.find(criteria).toArray();
    const lessonIds = theoryLessons.map(lesson => lesson._id.toString());

    let deletedCount = 0;

    // Use transaction for data consistency
    const client = theoryCollection.client || theoryCollection.s?.client;
    if (client) {
      const session = client.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Delete all theory lessons for this teacher
          const deleteResult = await theoryCollection.deleteMany(criteria, { session });
          deletedCount = deleteResult.deletedCount;

          // Clean up attendance records if collection exists
          if (activityCollection && lessonIds.length > 0) {
            await activityCollection.deleteMany(
              { 
                sessionId: { $in: lessonIds },
                activityType: 'תאוריה'
              },
              { session }
            );
          }
        });
      } finally {
        await session.endSession();
      }
    } else {
      // Fallback without transaction if session not available
      const deleteResult = await theoryCollection.deleteMany(criteria);
      deletedCount = deleteResult.deletedCount;

      // Clean up attendance records
      if (activityCollection && lessonIds.length > 0) {
        try {
          await activityCollection.deleteMany({
            sessionId: { $in: lessonIds },
            activityType: 'תאוריה'
          });
        } catch (attendanceErr) {
          console.warn(`Failed to delete attendance records: ${attendanceErr.message}`);
        }
      }
    }

    // Clear cache
    queryCacheService.invalidate('theory_lessons');

    // Logging
    console.log(`User ${userId} deleted ${deletedCount} theory lessons for teacher: ${teacherId}`);

    return {
      deletedCount,
      message: `Successfully deleted ${deletedCount} theory lessons for teacher`
    };
  } catch (err) {
    console.error(`Failed to bulk delete theory lessons by teacher: ${err}`);
    throw new Error(`Failed to bulk delete theory lessons by teacher: ${err.message}`);
  }
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
    if (!isValidDate(filterBy.fromDate)) {
      throw new Error('Invalid fromDate provided in filter');
    }
    criteria.date = criteria.date || {};
    criteria.date.$gte = getStartOfDay(filterBy.fromDate);
  }

  if (filterBy.toDate) {
    if (!isValidDate(filterBy.toDate)) {
      throw new Error('Invalid toDate provided in filter');
    }
    criteria.date = criteria.date || {};
    criteria.date.$lte = getEndOfDay(filterBy.toDate);
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

// Helper function to calculate cache TTL based on query characteristics
function _calculateCacheTTL(filterBy, complexity = 1) {
  let baseTTL = 5 * 60 * 1000; // 5 minutes base TTL
  
  // Longer TTL for historical data
  if (filterBy.toDate && createAppDate(filterBy.toDate).isBefore(now().subtract(1, 'day'))) {
    baseTTL *= 4; // 20 minutes for historical data
  }
  
  // Longer TTL for complex queries
  if (complexity > 5) {
    baseTTL *= 2;
  }
  
  // Shorter TTL for current day queries
  if (filterBy.fromDate && isSameDay(createAppDate(filterBy.fromDate), now())) {
    baseTTL = Math.min(baseTTL, 2 * 60 * 1000); // Max 2 minutes for current day
  }
  
  // Maximum TTL cap
  return Math.min(baseTTL, 60 * 60 * 1000); // 1 hour max
}
