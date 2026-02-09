// api/student/student.service.js
import { ObjectId } from 'bson';
import { getCollection } from '../../services/mongoDB.service.js';
import { validateStudent } from './student.validation.js';
import { relationshipValidationService } from '../../services/relationshipValidationService.js';
import { validateTeacherAssignmentsWithDB } from './student-assignments.validation.js';

export const studentService = {
  getStudents,
  getStudentById,
  addStudent,
  updateStudent,
  updateStudentTest,
  updateStudentStageLevel,
  removeStudent,
  checkTeacherHasAccessToStudent,
  associateStudentWithTeacher,
  removeStudentTeacherAssociation,
  setBagrutId,
  removeBagrutId,
  getStudentBagrut,
};

async function getStudents(filterBy = {}, page = 1, limit = 0, options = {}) {
  try {
    const { teacherId, isAdmin } = options;
    const collection = await getCollection('student');
    const criteria = _buildCriteria(filterBy);

    // IDOR prevention: non-admin teachers only see their own students
    if (teacherId && !isAdmin) {
      criteria.teacherIds = teacherId;
    }

    // If limit is 0 or not provided, return all students (backward compatibility)
    if (limit === 0) {
      const students = await collection.find(criteria).toArray();
      return students;
    }

    // Pagination enabled
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalCount = await collection.countDocuments(criteria);

    // Get paginated students
    const students = await collection
      .find(criteria)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    console.log(`📄 Pagination: Page ${page}/${totalPages}, Limit: ${limit}, Total: ${totalCount}, Returned: ${students.length}`);

    // Return paginated response with metadata
    return {
      data: students,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPreviousPage,
        resultsCount: students.length
      }
    };
  } catch (err) {
    console.error(`Error getting students: ${err.message}`);
    throw new Error(`Error getting students: ${err.message}`);
  }
}

async function getStudentById(studentId) {
  try {
    console.log(`🔍 Student service: Getting student by ID: ${studentId}`);
    
    // Validate ObjectId format
    if (!ObjectId.isValid(studentId)) {
      throw new Error(`Invalid student ID format: ${studentId}`);
    }
    
    const collection = await getCollection('student');
    const student = await collection.findOne({
      _id: ObjectId.createFromHexString(studentId),
    });

    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }
    
    console.log(`✅ Student service: Found student: ${student.personalInfo?.fullName || 'Unknown'}`);
    return student;
  } catch (err) {
    console.error(`❌ Student service error for ID ${studentId}:`, err.message);
    console.error('Stack trace:', err.stack);
    throw new Error(`Error getting student by id: ${err.message}`);
  }
}

async function addStudent(studentToAdd, teacherId = null, isAdmin = false) {
  try {
    // Validate with the standard (strict) schema
    const { error, value } = validateStudent(studentToAdd);
    if (error) throw error;

    // Ensure we have a primary instrument
    if (value.academicInfo.instrumentProgress) {
      const hasPrimary = value.academicInfo.instrumentProgress.some(
        (inst) => inst.isPrimary
      );
      if (!hasPrimary && value.academicInfo.instrumentProgress.length > 0) {
        value.academicInfo.instrumentProgress[0].isPrimary = true;
      }
    }

    if (
      !value.enrollments?.schoolYears ||
      value.enrollments.schoolYears.length === 0
    ) {
      const schoolYearService = (
        await import('../school-year/school-year.service.js')
      ).schoolYearService;
      const currentSchoolYear = await schoolYearService.getCurrentSchoolYear();

      if (!value.enrollments) {
        value.enrollments = {};
      }

      if (!value.enrollments.schoolYears) {
        value.enrollments.schoolYears = [];
      }

      value.enrollments.schoolYears.push({
        schoolYearId: currentSchoolYear._id.toString(),
        isActive: true,
      });
    }

    // Initialize relationship arrays if not present
    if (!value.teacherIds) value.teacherIds = [];
    if (!value.teacherAssignments) value.teacherAssignments = [];

    value.createdAt = new Date();
    value.updatedAt = new Date();

    const collection = await getCollection('student');
    const result = await collection.insertOne(value);

    if (teacherId && !isAdmin) {
      await associateStudentWithTeacher(
        result.insertedId.toString(),
        teacherId
      );
    }

    // 🔥 CRITICAL FIX: Sync teacher records if student created with teacherAssignments
    if (value.teacherAssignments && value.teacherAssignments.length > 0) {
      console.log(`🔥 SYNC FIX: New student created with ${value.teacherAssignments.length} teacher assignments - syncing teacher records`);
      try {
        await syncTeacherRecordsForStudentUpdate(
          result.insertedId.toString(), 
          value.personalInfo?.fullName, 
          value.teacherAssignments, 
          []
        );

        // 🔥 SYNC FIX: Also sync teacher IDs from teacherAssignments for new students
        const teacherIdsFromAssignments = value.teacherAssignments
          .filter(assignment => assignment.isActive)
          .map(assignment => assignment.teacherId)
          .filter(Boolean);
        
        if (teacherIdsFromAssignments.length > 0) {
          console.log(`🔥 SYNC FIX: New student has ${teacherIdsFromAssignments.length} teacher assignments - syncing to teacher.teaching.studentIds`);
          await syncTeacherStudentRelationships(result.insertedId.toString(), teacherIdsFromAssignments, []);
        }
      } catch (syncError) {
        console.error(`🔥 SYNC ERROR: Failed to sync teacher assignments for new student:`, syncError);
        // Continue with student creation even if sync fails
      }
    }

    return { _id: result.insertedId, ...value };
  } catch (err) {
    console.error(`Error adding student: ${err.message}`);
    throw new Error(`Error adding student: ${err.message}`);
  }
}

async function updateStudent(
  studentId,
  studentToUpdate,
  teacherId = null,
  isAdmin = false
) {
  // Get MongoDB client for session management
  const collection = await getCollection('student');
  const session = collection.client.startSession();
  
  try {
    // Start transaction for data consistency
    await session.startTransaction();
    
    // For updates, use the flexible validation schema
    const { error, value } = validateStudent(studentToUpdate, true);
    if (error) throw new Error(`Invalid student data: ${error.message}`);

    if (teacherId && !isAdmin) {
      const hasAccess = await checkTeacherHasAccessToStudent(
        teacherId,
        studentId
      );

      // If teacher doesn't have access, check if they're only adding themselves to teacherAssignments
      if (!hasAccess) {
        const isOnlyAddingSelfToAssignments = checkIfOnlyAddingSelfToAssignments(
          studentToUpdate,
          teacherId
        );

        if (!isOnlyAddingSelfToAssignments) {
          throw new Error('Not authorized to update student');
        }

        console.log(`✅ Authorization granted: Teacher ${teacherId} is adding themselves to student ${studentId}'s teacherAssignments`);
      }
    }

    // Get original student data before update to detect changes
    const originalStudent = await collection.findOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { session }
    );

    if (!originalStudent) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    // Set the updatedAt field
    value.updatedAt = new Date();

    // Ensure we have a primary instrument if updating instrumentProgress
    if (value.academicInfo?.instrumentProgress) {
      const hasPrimary = value.academicInfo.instrumentProgress.some(
        (inst) => inst.isPrimary
      );
      if (!hasPrimary && value.academicInfo.instrumentProgress.length > 0) {
        value.academicInfo.instrumentProgress[0].isPrimary = true;
      }
    }

    // 🔥 CRITICAL FIX: Detect teacherIds changes for bidirectional sync
    let teacherRelationshipSyncRequired = false;
    let teachersToAdd = [];
    let teachersToRemove = [];

    if (value.teacherIds !== undefined) {
      const originalTeacherIds = originalStudent.teacherIds || [];
      const newTeacherIds = value.teacherIds || [];
      
      teachersToAdd = newTeacherIds.filter(id => !originalTeacherIds.includes(id));
      teachersToRemove = originalTeacherIds.filter(id => !newTeacherIds.includes(id));
      
      if (teachersToAdd.length > 0 || teachersToRemove.length > 0) {
        teacherRelationshipSyncRequired = true;
        console.log(`🔥 SYNC FIX: TeacherIds changes detected for student ${studentId}`);
        console.log(`Teachers to add: ${teachersToAdd.length}, Teachers to remove: ${teachersToRemove.length}`);
      }
    }

    // 🔥 ENHANCED VALIDATION: Advanced teacherAssignments validation with DB consistency checks
    let teacherAssignmentsSyncRequired = false;
    let newAssignments = [];
    let removedAssignments = [];

    if (value.teacherAssignments) {
      console.log(`🔍 ENHANCED VALIDATION: Validating teacherAssignments for student ${studentId}`);
      
      // Perform comprehensive validation
      const assignmentValidation = await validateTeacherAssignmentsWithDB(value.teacherAssignments, studentId);
      
      if (!assignmentValidation.isValid) {
        const errorMessages = assignmentValidation.errors.map(error => error.message).join('; ');
        throw new Error(`TeacherAssignments validation failed: ${errorMessages}`);
      }
      
      // Use validated and fixed assignments
      value.teacherAssignments = assignmentValidation.validatedAssignments;
      
      if (assignmentValidation.warnings.length > 0) {
        console.warn(`⚠️  TeacherAssignments validation warnings for student ${studentId}:`, assignmentValidation.warnings);
      }
      
      if (assignmentValidation.fixes.length > 0) {
        console.log(`🔧 Applied ${assignmentValidation.fixes.length} automatic fixes to teacherAssignments for student ${studentId}`);
      }

      teacherAssignmentsSyncRequired = true;
      const originalAssignments = originalStudent.teacherAssignments || [];
      newAssignments = value.teacherAssignments || [];

      // Find removed assignments (in original but not in new)
      removedAssignments = originalAssignments.filter(originalAssignment => {
        return !newAssignments.some(newAssignment => 
          newAssignment.teacherId === originalAssignment.teacherId &&
          newAssignment.timeBlockId === originalAssignment.timeBlockId &&
          newAssignment.lessonId === originalAssignment.lessonId
        );
      });

      console.log(`🔥 SYNC FIX: TeacherAssignments update detected for student ${studentId}`);
      console.log(`Original assignments: ${originalAssignments.length}, New assignments: ${newAssignments.length}`);
      console.log(`Removed assignments: ${removedAssignments.length}`);
      console.log(`Validation fixes applied: ${assignmentValidation.fixes.length}`);
    }

    // Apply the update to student record
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(studentId) },
      { $set: value },
      { returnDocument: 'after', session }
    );

    if (!result) throw new Error(`Student with id ${studentId} not found`);

    // 🔥 CRITICAL FIX: Sync teacher relationships bidirectionally with transactions
    if (teacherRelationshipSyncRequired) {
      console.log(`🔥 SYNC FIX: Starting bidirectional teacherIds sync for student ${studentId}`);
      await syncTeacherStudentRelationships(studentId, teachersToAdd, teachersToRemove, session);
    }

    // 🔥 ENHANCED SYNC FIX: Robust bidirectional sync for teacherAssignments
    // This ensures teaching.studentIds is ALWAYS in sync with active assignments
    //
    // The sync handles these cases:
    // 1. New teacher assignment added (active) → Add student to teacher's studentIds
    // 2. Existing assignment becomes active → Add student to teacher's studentIds
    // 3. Existing assignment becomes inactive → Remove student from teacher's studentIds
    // 4. Assignment completely removed → Remove student from teacher's studentIds
    // 5. Safety fallback: If assignments updated but no changes detected, sync all active teachers
    //    (This fixes any pre-existing sync issues using idempotent $addToSet)
    if (teacherAssignmentsSyncRequired || (value.teacherAssignments && value.teacherAssignments.length > 0)) {
      const originalTeacherIdsFromAssignments = (originalStudent.teacherAssignments || [])
        .filter(assignment => assignment.isActive)
        .map(assignment => assignment.teacherId)
        .filter(Boolean);

      const newTeacherIdsFromAssignments = (value.teacherAssignments || [])
        .filter(assignment => assignment.isActive)
        .map(assignment => assignment.teacherId)
        .filter(Boolean);

      // Find teachers that need to be added (active in new but not in original, OR became active)
      const teachersToAddFromAssignments = [];
      const teachersToRemoveFromAssignments = [];

      // Check each new active assignment
      for (const assignment of (value.teacherAssignments || [])) {
        if (!assignment.teacherId) continue;

        const originalAssignment = (originalStudent.teacherAssignments || []).find(
          orig => orig.teacherId === assignment.teacherId
        );

        // Add teacher if:
        // 1. Assignment is now active AND (wasn't in original OR was inactive before)
        if (assignment.isActive) {
          if (!originalAssignment || !originalAssignment.isActive) {
            // Teacher should be added (assignment became active or is new)
            if (!teachersToAddFromAssignments.includes(assignment.teacherId)) {
              teachersToAddFromAssignments.push(assignment.teacherId);
            }
          }
        }

        // Remove teacher if:
        // 1. Assignment exists in original as active
        // 2. But is now inactive or removed
        if (originalAssignment && originalAssignment.isActive && !assignment.isActive) {
          if (!teachersToRemoveFromAssignments.includes(assignment.teacherId)) {
            teachersToRemoveFromAssignments.push(assignment.teacherId);
          }
        }
      }

      // Also check for teachers that were removed entirely from assignments
      for (const originalAssignment of (originalStudent.teacherAssignments || [])) {
        if (!originalAssignment.teacherId || !originalAssignment.isActive) continue;

        const stillExists = (value.teacherAssignments || []).some(
          newAssign => newAssign.teacherId === originalAssignment.teacherId
        );

        if (!stillExists && !teachersToRemoveFromAssignments.includes(originalAssignment.teacherId)) {
          teachersToRemoveFromAssignments.push(originalAssignment.teacherId);
        }
      }

      // ALWAYS sync if there are any changes detected
      // Even if the teacher ID didn't change, the isActive status might have
      if (teachersToAddFromAssignments.length > 0 || teachersToRemoveFromAssignments.length > 0) {
        console.log(`🔥 ENHANCED SYNC: TeacherAssignments sync - Adding ${teachersToAddFromAssignments.length} teachers, Removing ${teachersToRemoveFromAssignments.length} teachers`);
        console.log(`Teachers to add: [${teachersToAddFromAssignments.join(', ')}]`);
        console.log(`Teachers to remove: [${teachersToRemoveFromAssignments.join(', ')}]`);
        await syncTeacherStudentRelationships(studentId, teachersToAddFromAssignments, teachersToRemoveFromAssignments, session);
      } else if (teacherAssignmentsSyncRequired) {
        // Even if no changes detected in active status, ensure all currently active teachers have this student
        // This is a safety measure to fix any pre-existing sync issues
        const allActiveTeacherIds = (value.teacherAssignments || [])
          .filter(assignment => assignment.isActive && assignment.teacherId)
          .map(assignment => assignment.teacherId);

        if (allActiveTeacherIds.length > 0) {
          console.log(`🛡️ SAFETY SYNC: Ensuring ${allActiveTeacherIds.length} active teachers have student ${studentId} in their studentIds`);
          // Use addToSet which is idempotent - won't duplicate if already exists
          await syncTeacherStudentRelationships(studentId, allActiveTeacherIds, [], session);
        } else {
          console.log(`🔍 SYNC CHECK: No active teacher assignments for student ${studentId}`);
        }
      }
    }

    // 🔥 CRITICAL FIX: Sync teacher assignments (time-block system)
    if (teacherAssignmentsSyncRequired) {
      console.log(`🔥 SYNC FIX: Starting teacher assignments sync for student ${studentId}`);
      await syncTeacherRecordsForStudentUpdate(studentId, result.personalInfo?.fullName, newAssignments, removedAssignments, session);
    }

    // 🔥 VALIDATION: Validate relationship integrity after sync
    if (teacherRelationshipSyncRequired && value.teacherIds) {
      console.log(`🔍 VALIDATION: Checking relationship integrity for student ${studentId}`);
      try {
        const validationResult = await relationshipValidationService.validateStudentTeacherRelationships(
          studentId, 
          value.teacherIds
        );
        
        if (!validationResult.isValid) {
          console.warn(`⚠️  VALIDATION WARNING: Student ${studentId} has relationship issues:`, validationResult.errors);
        }
        
        if (validationResult.warnings.length > 0) {
          console.warn(`⚠️  VALIDATION WARNINGS for student ${studentId}:`, validationResult.warnings);
        }
      } catch (validationError) {
        console.error(`❌ VALIDATION ERROR: Failed to validate relationships for student ${studentId}:`, validationError.message);
        // Don't fail the transaction for validation errors
      }
    }

    // Commit the transaction
    await session.commitTransaction();
    
    return result;
  } catch (err) {
    console.error(`Error updating student: ${err.message}`);
    await session.abortTransaction();
    throw new Error(`Error updating student: ${err.message}`);
  } finally {
    await session.endSession();
  }
}

async function updateStudentTest(
  studentId,
  instrumentName,
  testType,
  status,
  teacherId = null,
  isAdmin = false
) {
  try {
    console.log(`Processing test update for student ${studentId}`, {
      instrumentName,
      testType,
      status,
      teacherId,
      isAdmin
    });

    // First, get the current student to find the instrument
    const student = await getStudentById(studentId);

    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    // Find the instrument index
    const instrumentIndex = student.academicInfo.instrumentProgress.findIndex(
      (i) => i.instrumentName === instrumentName
    );

    if (instrumentIndex === -1) {
      throw new Error(
        `Instrument ${instrumentName} not found for student ${studentId}`
      );
    }

    // Get previous status before any changes
    const previousStatus =
      student.academicInfo.instrumentProgress[instrumentIndex]?.tests?.[
        testType
      ]?.status || 'לא נבחן';

    console.log(`Previous test status: ${previousStatus}, New status: ${status}`);

    // Create update object with only the necessary changes
    const updateData = {
      academicInfo: {
        instrumentProgress: [...student.academicInfo.instrumentProgress],
      },
      updatedAt: new Date(),
    };

    // Ensure the tests object structure exists
    if (!updateData.academicInfo.instrumentProgress[instrumentIndex].tests) {
      updateData.academicInfo.instrumentProgress[instrumentIndex].tests = {};
    }

    if (
      !updateData.academicInfo.instrumentProgress[instrumentIndex].tests[
        testType
      ]
    ) {
      updateData.academicInfo.instrumentProgress[instrumentIndex].tests[
        testType
      ] = {};
    }

    // Update the test status
    updateData.academicInfo.instrumentProgress[instrumentIndex].tests[
      testType
    ].status = status;
    updateData.academicInfo.instrumentProgress[instrumentIndex].tests[
      testType
    ].lastTestDate = new Date();

    // Auto-increment stage if needed
    const passingStatuses = [
      'עבר/ה',
      'עבר/ה בהצטיינות',
      'עבר/ה בהצטיינות יתרה',
    ];
    const failingStatuses = ['לא נבחן', 'לא עבר/ה'];

    if (
      testType === 'stageTest' &&
      passingStatuses.includes(status) &&
      failingStatuses.includes(previousStatus) &&
      updateData.academicInfo.instrumentProgress[instrumentIndex].currentStage 
    ) {
      console.log(
        `Incrementing stage for student ${studentId}, instrument ${instrumentName}` +
        ` from ${updateData.academicInfo.instrumentProgress[instrumentIndex].currentStage}` +
        ` to ${updateData.academicInfo.instrumentProgress[instrumentIndex].currentStage + 1}`
      );
      
      updateData.academicInfo.instrumentProgress[instrumentIndex].currentStage =
        student.academicInfo.instrumentProgress[instrumentIndex].currentStage +
        1;
    }

    // Check authorization if needed
    if (teacherId && !isAdmin) {
      const hasAccess = await checkTeacherHasAccessToStudent(
        teacherId,
        studentId
      );
      if (!hasAccess) {
        throw new Error('Not authorized to update student test');
      }
    }

    // Apply the update
    const collection = await getCollection('student');
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(studentId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error(`Student with id ${studentId} not found after update attempt`);
    }

    console.log(`Successfully updated test for student ${studentId}`);
    return result;
  } catch (err) {
    console.error(`Error updating student test: ${err.message}`);
    throw new Error(`Error updating student test: ${err.message}`);
  }
}

async function updateStudentStageLevel(studentId, newStageLevel, teacherId = null, isAdmin = false) {
  try {
    console.log(`🎵 Service: Updating stage level for student ${studentId} to ${newStageLevel}`);

    // Validate ObjectId format
    if (!ObjectId.isValid(studentId)) {
      throw new Error(`Invalid student ID format: ${studentId}`);
    }

    // Check authorization if needed
    if (teacherId && !isAdmin) {
      const hasAccess = await checkTeacherHasAccessToStudent(teacherId, studentId);
      if (!hasAccess) {
        throw new Error('Not authorized to update student stage level');
      }
    }

    // First, get the current student to find the primary instrument
    const student = await getStudentById(studentId);
    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    // Find the primary instrument or use the first one if no primary is set
    const primaryInstrument = student.academicInfo?.instrumentProgress?.find(inst => inst.isPrimary) 
      || student.academicInfo?.instrumentProgress?.[0];

    if (!primaryInstrument) {
      throw new Error(`No instrument progress found for student ${studentId}`);
    }

    // Update the stage level in the primary instrument
    const updatedInstrumentProgress = student.academicInfo.instrumentProgress.map(instrument => {
      if (instrument === primaryInstrument) {
        return {
          ...instrument,
          currentStage: newStageLevel,
          lastStageUpdate: new Date()
        };
      }
      return instrument;
    });

    // Update the student document
    const collection = await getCollection('student');
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(studentId) },
      {
        $set: {
          'academicInfo.instrumentProgress': updatedInstrumentProgress,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      throw new Error(`Student with id ${studentId} not found after update attempt`);
    }

    console.log(`✅ Successfully updated stage level for student ${studentId} to ${newStageLevel}`);
    return result;
  } catch (err) {
    console.error(`❌ Error updating student stage level: ${err.message}`);
    throw new Error(`Error updating student stage level: ${err.message}`);
  }
}

async function removeStudent(studentId, teacherId = null, isAdmin = false) {
  try {
    if (teacherId && !isAdmin) {
      const hasAccess = await checkTeacherHasAccessToStudent(
        teacherId,
        studentId
      );
      if (!hasAccess) {
        throw new Error('Not authorized to remove student');
      }

      return await removeStudentTeacherAssociation(studentId, teacherId);
    }

    const collection = await getCollection('student');
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(studentId) },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) throw new Error(`Student with id ${studentId} not found`);
    return result;
  } catch (err) {
    console.error(`Error removing student ${studentId}: ${err.message}`);
    throw err;
  }
}

async function checkTeacherHasAccessToStudent(teacherId, studentId) {
  try {
    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
      'teaching.studentIds': studentId,
      isActive: true,
    });

    return !!teacher;
  } catch (err) {
    console.error(`Error checking teacher access to student: ${err.message}`);
    throw new Error(`Error checking teacher access to student: ${err.message}`);
  }
}

/**
 * Check if the update only contains teacherAssignments where the teacher is adding/updating themselves
 * This allows teachers to assign themselves to students without prior authorization
 *
 * The logic is permissive: if ONLY teacherAssignments is being updated AND the teacher
 * is included in those assignments, we allow it. This handles both:
 * 1. Adding themselves to a new student
 * 2. Updating their existing assignment details (schedule, location, etc.)
 */
function checkIfOnlyAddingSelfToAssignments(studentUpdate, teacherId) {
  // Get the keys being updated (excluding system fields)
  const updateKeys = Object.keys(studentUpdate).filter(
    key => !['updatedAt', 'createdAt', '_id'].includes(key)
  );

  // Check if ONLY teacherAssignments is being updated
  if (updateKeys.length !== 1 || updateKeys[0] !== 'teacherAssignments') {
    return false;
  }

  // Check if teacherAssignments is an array
  const assignments = studentUpdate.teacherAssignments;
  if (!Array.isArray(assignments)) {
    return false;
  }

  // Allow empty array (teacher removing themselves)
  if (assignments.length === 0) {
    return true;
  }

  // Verify that the teacher is in at least one of the assignments
  // This allows the teacher to update their own assignment even if other teachers are also assigned
  const hasTeacherInAssignments = assignments.some(
    assignment => assignment.teacherId === teacherId
  );

  return hasTeacherInAssignments;
}

async function associateStudentWithTeacher(studentId, teacherId) {
  try {
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    
    // Always update the teacher's studentIds array for backward compatibility
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { $addToSet: { 'teaching.studentIds': studentId } }
    );
    
    // Update the student's teacherIds array for backward compatibility
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { $addToSet: { teacherIds: teacherId } }
    );
    
    return {
      success: true,
      studentId,
      teacherId,
    };
  } catch (err) {
    console.error(`Error associating student with teacher: ${err.message}`);
    throw new Error(`Error associating student with teacher: ${err.message}`);
  }
}

async function removeStudentTeacherAssociation(studentId, teacherId) {
  try {
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    
    // For backward compatibility, remove student from teacher's studentIds array
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { $pull: { 'teaching.studentIds': studentId } }
    );

    // Deactivate lessons in timeBlocks for this student
    await teacherCollection.updateMany(
      {
        _id: ObjectId.createFromHexString(teacherId),
        'teaching.timeBlocks.assignedLessons.studentId': studentId
      },
      {
        $set: {
          'teaching.timeBlocks.$[block].assignedLessons.$[lesson].isActive': false,
          'teaching.timeBlocks.$[block].assignedLessons.$[lesson].endDate': new Date(),
          'teaching.timeBlocks.$[block].assignedLessons.$[lesson].updatedAt': new Date()
        }
      },
      {
        arrayFilters: [
          { 'block.assignedLessons.studentId': studentId },
          { 'lesson.studentId': studentId }
        ]
      }
    );

    // Mark all teacher assignments for this student as inactive
    await studentCollection.updateMany(
      { 
        _id: ObjectId.createFromHexString(studentId),
        'teacherAssignments.teacherId': teacherId,
        'teacherAssignments.isActive': true
      },
      { 
        $set: { 
          'teacherAssignments.$[elem].isActive': false,
          'teacherAssignments.$[elem].endDate': new Date(),
          'teacherAssignments.$[elem].updatedAt': new Date()
        }
      },
      {
        arrayFilters: [{ 'elem.teacherId': teacherId, 'elem.isActive': true }]
      }
    );
    
    // For backward compatibility, remove teacher from student's teacherIds array
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { $pull: { teacherIds: teacherId } }
    );

    return {
      message: 'Student removed from teacher successfully',
      studentId,
      teacherId,
    };
  } catch (err) {
    console.error(`Error removing student from teacher: ${err.message}`);
    throw new Error(`Error removing student from teacher: ${err.message}`);
  }
}

/**
 * 🔥 CRITICAL FIX: Sync teacher-student relationships bidirectionally (teacherIds array)
 * This function ensures the teacher's studentIds array is updated when student's teacherIds changes
 */
async function syncTeacherStudentRelationships(studentId, teachersToAdd, teachersToRemove, session) {
  try {
    const teacherCollection = await getCollection('teacher');

    console.log(`🔥 SYNC FIX: Syncing teacher relationships - Adding ${teachersToAdd.length}, Removing ${teachersToRemove.length}`);

    // Add student to new teachers' studentIds arrays
    if (teachersToAdd.length > 0) {
      const teacherObjectIds = teachersToAdd.map(id => ObjectId.createFromHexString(id));
      await teacherCollection.updateMany(
        { _id: { $in: teacherObjectIds } },
        { 
          $addToSet: { 'teaching.studentIds': studentId },
          $set: { updatedAt: new Date() }
        },
        { session }
      );
      console.log(`🔥 SYNC FIX: Added student ${studentId} to ${teachersToAdd.length} teachers' studentIds`);
    }

    // Remove student from old teachers' studentIds arrays
    if (teachersToRemove.length > 0) {
      const teacherObjectIds = teachersToRemove.map(id => ObjectId.createFromHexString(id));
      await teacherCollection.updateMany(
        { _id: { $in: teacherObjectIds } },
        { 
          $pull: { 'teaching.studentIds': studentId },
          $set: { updatedAt: new Date() }
        },
        { session }
      );
      console.log(`🔥 SYNC FIX: Removed student ${studentId} from ${teachersToRemove.length} teachers' studentIds`);
    }

    console.log(`🔥 SYNC FIX: Teacher-student relationship sync completed for student ${studentId}`);

  } catch (err) {
    console.error(`🔥 SYNC FIX: Error in syncTeacherStudentRelationships:`, err.message);
    throw err; // Re-throw to trigger transaction rollback
  }
}

/**
 * 🔥 CRITICAL FIX: Sync teacher records when student assignments are modified (time-block system)
 * This function ensures bidirectional consistency between student and teacher records
 */
async function syncTeacherRecordsForStudentUpdate(studentId, studentName, newAssignments, removedAssignments, session = null) {
  try {
    const teacherCollection = await getCollection('teacher');

    console.log(`🔥 SYNC FIX: Processing ${newAssignments.length} new assignments and ${removedAssignments.length} removed assignments`);

    // Process new/active assignments - add to teacher time blocks
    for (const assignment of newAssignments) {
      if (!assignment.isActive) continue;

      const { teacherId, timeBlockId, lessonId } = assignment;
      
      if (!teacherId || !timeBlockId) {
        console.warn(`🔥 SYNC FIX: Skipping invalid assignment - missing teacherId or timeBlockId`, assignment);
        continue;
      }

      try {
        // Find teacher and time block
        const teacher = await teacherCollection.findOne(
          {
            _id: ObjectId.createFromHexString(teacherId),
            'teaching.timeBlocks._id': ObjectId.createFromHexString(timeBlockId)
          },
          { session }
        );

        if (!teacher) {
          console.warn(`🔥 SYNC FIX: Teacher ${teacherId} or timeBlock ${timeBlockId} not found`);
          continue;
        }

        const timeBlock = teacher.teaching.timeBlocks.find(tb => tb._id.toString() === timeBlockId);
        if (!timeBlock) {
          console.warn(`🔥 SYNC FIX: TimeBlock ${timeBlockId} not found in teacher ${teacherId}`);
          continue;
        }

        // Check if lesson already exists in teacher's time block
        const existingLesson = timeBlock.assignedLessons?.find(lesson => 
          lesson.studentId === studentId && 
          lesson._id.toString() === (lessonId || 'new')
        );

        if (existingLesson) {
          console.log(`🔥 SYNC FIX: Lesson already exists in teacher time block - skipping`);
          continue;
        }

        // Create lesson assignment for teacher time block
        const lessonAssignment = {
          _id: lessonId ? ObjectId.createFromHexString(lessonId) : new ObjectId(),
          studentId: studentId,
          studentName: studentName || 'Unknown Student',
          lessonStartTime: assignment.scheduleInfo?.startTime || '00:00',
          lessonEndTime: assignment.scheduleInfo?.endTime || '00:45',
          duration: assignment.scheduleInfo?.duration || 45,
          notes: assignment.notes || '',
          attended: undefined,
          isActive: true,
          isRecurring: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        // Add lesson to teacher's time block
        const updateOptions = session ? { session } : {};
        await teacherCollection.updateOne(
          { 
            _id: ObjectId.createFromHexString(teacherId),
            'teaching.timeBlocks._id': ObjectId.createFromHexString(timeBlockId)
          },
          { 
            $push: { 'teaching.timeBlocks.$.assignedLessons': lessonAssignment },
            $addToSet: { 'teaching.studentIds': studentId },
            $set: { 
              'teaching.timeBlocks.$.updatedAt': new Date(),
              updatedAt: new Date()
            }
          },
          updateOptions
        );

        console.log(`🔥 SYNC FIX: Added lesson to teacher ${teacherId} timeBlock ${timeBlockId} for student ${studentId}`);

      } catch (err) {
        console.error(`🔥 SYNC FIX: Error processing assignment for teacher ${teacherId}:`, err.message);
        if (session) throw err; // Re-throw to trigger transaction rollback
      }
    }

    // Process removed assignments - remove from teacher time blocks
    for (const assignment of removedAssignments) {
      const { teacherId, timeBlockId, lessonId } = assignment;
      
      if (!teacherId || !timeBlockId) continue;

      try {
        // Mark lesson as inactive in teacher's time block
        const updateOptions = session ? { session } : {};
        await teacherCollection.updateOne(
          { 
            _id: ObjectId.createFromHexString(teacherId),
            'teaching.timeBlocks._id': ObjectId.createFromHexString(timeBlockId),
            'teaching.timeBlocks.assignedLessons._id': ObjectId.createFromHexString(lessonId)
          },
          { 
            $set: { 
              'teaching.timeBlocks.$[block].assignedLessons.$[lesson].isActive': false,
              'teaching.timeBlocks.$[block].assignedLessons.$[lesson].endDate': new Date(),
              'teaching.timeBlocks.$[block].assignedLessons.$[lesson].updatedAt': new Date(),
              'teaching.timeBlocks.$[block].updatedAt': new Date()
            }
          },
          {
            arrayFilters: [
              { 'block._id': ObjectId.createFromHexString(timeBlockId) },
              { 'lesson._id': ObjectId.createFromHexString(lessonId) }
            ],
            ...updateOptions
          }
        );

        console.log(`🔥 SYNC FIX: Marked lesson ${lessonId} as inactive in teacher ${teacherId} timeBlock ${timeBlockId}`);

      } catch (err) {
        console.error(`🔥 SYNC FIX: Error removing assignment for teacher ${teacherId}:`, err.message);
        if (session) throw err; // Re-throw to trigger transaction rollback
      }
    }

    console.log(`🔥 SYNC FIX: Teacher record sync completed for student ${studentId}`);

  } catch (err) {
    console.error(`🔥 SYNC FIX: Error in syncTeacherRecordsForStudentUpdate:`, err.message);
    if (session) {
      throw err; // Re-throw to trigger transaction rollback
    }
    // Don't throw if no session - we don't want to break the student update if teacher sync fails
  }
}

function _buildCriteria(filterBy) {
  const criteria = {};
  console.log('🔍 studentService._buildCriteria called with filterBy:', JSON.stringify(filterBy))

  // Handle batch fetching by IDs - highest priority
  if (filterBy.ids) {
    console.log('🎯 Found student ids parameter:', filterBy.ids)
    const idsArray = Array.isArray(filterBy.ids) ? filterBy.ids : filterBy.ids.split(',')
    console.log('🎯 Parsed student IDs array:', idsArray)
    criteria._id = { 
      $in: idsArray.map(id => ObjectId.createFromHexString(id.trim())) 
    }
    console.log('🎯 Built student criteria with IDs:', JSON.stringify(criteria))
    // When fetching by specific IDs, return all (active and inactive)
    return criteria
  }

  // Update to support instrument filtering against the new structure
  if (filterBy.instrument) {
    criteria['academicInfo.instrumentProgress.instrumentName'] =
      filterBy.instrument;
  }

  if (filterBy.class) {
    criteria['academicInfo.class'] = filterBy.class;
  }

  if (filterBy.stage) {
    const stageNum = parseInt(filterBy.stage);
    criteria['academicInfo.instrumentProgress.currentStage'] = stageNum;
  }

  if (filterBy.name) {
    criteria['personalInfo.fullName'] = {
      $regex: filterBy.name,
      $options: 'i',
    };
  }

  // Update test filtering to check new structure
  if (filterBy.technicalTest) {
    criteria['academicInfo.instrumentProgress.tests.technicalTest.status'] =
      filterBy.technicalTest;
  }

  if (filterBy.stageTest) {
    criteria['academicInfo.instrumentProgress.tests.stageTest.status'] =
      filterBy.stageTest;
  }

  // Unchanged criteria
  if (filterBy.teacherId) {
    criteria['enrollments.teachers'] = {
      $elemMatch: {
        teacherId: filterBy.teacherId,
        isActive: true,
      },
    };
  }

  if (filterBy.orchestraId) {
    criteria['enrollments.orchestras'] = {
      $elemMatch: {
        orchestraId: filterBy.orchestraId,
      },
    };
  }

  if (filterBy.schoolYearId) {
    criteria['enrollments.schoolYears'] = {
      $elemMatch: {
        schoolYearId: filterBy.schoolYearId,
        isActive: true,
      },
    };
  }

  if (filterBy.showInactive) {
    if (filterBy.isActive !== undefined) {
      criteria.isActive = filterBy.isActive;
    }
  } else {
    criteria.isActive = true;
  }

  return criteria;
}

// Bagrut connection management functions

async function setBagrutId(studentId, bagrutId) {
  try {
    const collection = await getCollection('student');
    const result = await collection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { 
        $set: { 
          'academicInfo.tests.bagrutId': bagrutId,
          updatedAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    return result.modifiedCount > 0;
  } catch (err) {
    console.error(`Error setting bagrut ID for student ${studentId}: ${err.message}`);
    throw new Error(`Error setting bagrut ID: ${err.message}`);
  }
}

async function removeBagrutId(studentId) {
  try {
    const collection = await getCollection('student');
    const result = await collection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { 
        $unset: { 
          'academicInfo.tests.bagrutId': ""
        },
        $set: {
          updatedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    return result.modifiedCount > 0;
  } catch (err) {
    console.error(`Error removing bagrut ID for student ${studentId}: ${err.message}`);
    throw new Error(`Error removing bagrut ID: ${err.message}`);
  }
}

async function getStudentBagrut(studentId) {
  try {
    const student = await getStudentById(studentId);
    
    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    const bagrutId = student.academicInfo?.tests?.bagrutId;
    
    if (!bagrutId) {
      return null; // Student has no bagrut
    }

    // Import bagrutService to avoid circular dependency
    const { bagrutService } = await import('../bagrut/bagrut.service.js');
    return await bagrutService.getBagrutById(bagrutId);
  } catch (err) {
    console.error(`Error getting student bagrut: ${err.message}`);
    throw new Error(`Error getting student bagrut: ${err.message}`);
  }
}