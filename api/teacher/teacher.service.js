import { getCollection, withTransaction } from '../../services/mongoDB.service.js';
import {
  validateTeacher,
  validateTeacherUpdate,
} from './teacher.validation.js';
import { ObjectId } from 'mongodb';
import { authService } from '../auth/auth.service.js';
import { DuplicateDetectionService } from '../../services/duplicateDetectionService.js';
import { emailService } from '../../services/emailService.js';
import { invitationConfig } from '../../services/invitationConfig.js';
import crypto from 'crypto';

export const teacherService = {
  getTeachers,
  getTeacherById,
  getTeacherIds,
  addTeacher,
  updateTeacher,
  removeTeacher,
  getTeacherByRole,
  updateTeacherSchedule,
  addStudentToTeacher,
  removeStudentFromTeacher,
  initializeTeachingStructure,
  createTimeBlock,
  updateTimeBlock,
  deleteTimeBlock,
  getTimeBlocks,
};

async function getTeachers(filterBy = {}, page = 1, limit = 0) {
  try {
    const collection = await getCollection('teacher');
    const criteria = _buildCriteria(filterBy);

    // If limit is 0 or not provided, return all teachers (backward compatibility)
    if (limit === 0) {
      const teachers = await collection.find(criteria).toArray();
      return teachers;
    }

    // Pagination enabled
    const skip = (page - 1) * limit;

    // Get total count for pagination metadata
    const totalCount = await collection.countDocuments(criteria);

    // Get paginated teachers
    const teachers = await collection
      .find(criteria)
      .skip(skip)
      .limit(limit)
      .toArray();

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    console.log(`📄 Pagination: Page ${page}/${totalPages}, Limit: ${limit}, Total: ${totalCount}, Returned: ${teachers.length}`);

    // Return paginated response with metadata
    return {
      data: teachers,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPreviousPage,
        resultsCount: teachers.length
      }
    };
  } catch (err) {
    console.error(`Error getting teachers: ${err.message}`);
    throw new Error(`Error getting teachers: ${err.message}`);
  }
}

async function getTeacherById(teacherId) {
  try {
    console.log(`Getting teacher by ID: ${teacherId}`);
    
    // Validate ObjectId format
    if (!teacherId || !ObjectId.isValid(teacherId)) {
      console.error(`Invalid teacher ID format: ${teacherId}`);
      throw new Error(`Invalid teacher ID format: ${teacherId}`);
    }

    const collection = await getCollection('teacher');
    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
    });

    console.log(`Teacher found: ${teacher ? 'Yes' : 'No'}`);
    if (!teacher) {
      console.error(`Teacher with id ${teacherId} not found in database`);
      throw new Error(`Teacher with id ${teacherId} not found`);
    }
    
    return teacher;
  } catch (err) {
    console.error(`Error getting teacher by id: ${err.message}`);
    if (err.message.includes('Invalid teacher ID format')) {
      throw err; // Re-throw validation errors as-is
    }
    throw new Error(`Error getting teacher by id: ${err.message}`);
  }
}

async function getTeacherIds() {
  try {
    const collection = await getCollection('teacher');
    const teachers = await collection.find(
      { isActive: true },
      { 
        projection: { 
          _id: 1, 
          'personalInfo.fullName': 1, 
          'credentials.email': 1, 
          roles: 1,
          isActive: 1,
          createdAt: 1
        } 
      }
    ).toArray();
    
    return teachers.map(teacher => ({
      _id: teacher._id.toString(),
      fullName: teacher.personalInfo?.fullName || 'Unknown',
      email: teacher.credentials?.email || 'No email',
      roles: teacher.roles || [],
      isActive: teacher.isActive,
      createdAt: teacher.createdAt
    }));
  } catch (err) {
    console.error(`Error getting teacher IDs: ${err.message}`);
    throw new Error(`Error getting teacher IDs: ${err.message}`);
  }
}

async function addTeacher(teacherToAdd, adminId) {
  try {
    console.log('🔍 Raw teacher data received:', JSON.stringify(teacherToAdd, null, 2));
    
    // When admin creates a teacher, ensure required fields are present with defaults
    const teacherData = {
      ...teacherToAdd,
      // Ensure teaching structure exists and handle timeBlocks conversion
      teaching: (() => {
        let teaching = teacherToAdd.teaching || {
          studentIds: [],
          timeBlocks: []
        };

        // Ensure timeBlocks array exists
        if (!teaching.timeBlocks) {
          teaching.timeBlocks = [];
        }

        return teaching;
      })(),
      // Ensure credentials exist - will be populated with invitation data
      credentials: teacherToAdd.credentials || {
        email: teacherToAdd.personalInfo?.email || '',
        password: null // Will be set via invitation system
      },
      // Default other fields if missing
      conducting: teacherToAdd.conducting || { orchestraIds: [] },
      ensemblesIds: teacherToAdd.ensemblesIds || [],
      schoolYears: teacherToAdd.schoolYears || []
    };

    const { error, value } = validateTeacher(teacherData);
    if (error) throw new Error(`Invalid teacher data: ${error.message}`);

    // Comprehensive duplicate detection
    const duplicateResult = await DuplicateDetectionService.detectTeacherDuplicates(value);
    
    if (duplicateResult.hasDuplicates) {
      // Check if creation should be blocked based on severity
      if (DuplicateDetectionService.shouldBlockCreation(duplicateResult)) {
        const criticalDuplicates = duplicateResult.duplicates.filter(d => 
          d.severity === 'CRITICAL' || 
          (d.severity === 'HIGH' && ['EMAIL_DUPLICATE', 'PHONE_DUPLICATE', 'FULL_PROFILE_DUPLICATE'].includes(d.type))
        );
        
        const error = new Error('Duplicate teacher detected');
        error.code = 'DUPLICATE_TEACHER_DETECTED';
        error.duplicateInfo = {
          blocked: true,
          reason: duplicateResult.recommendation,
          duplicates: criticalDuplicates,
          totalDuplicatesFound: duplicateResult.duplicateCount
        };
        throw error;
      } else {
        // Non-blocking duplicates - log warning but allow creation
        console.warn('Potential duplicates detected but allowing creation:', duplicateResult);
      }
    }

    const collection = await getCollection('teacher');

    // Handle invitation based on current mode
    if (invitationConfig.isEmailMode()) {
      // Legacy EMAIL mode - generate invitation token
      const invitationToken = crypto.randomBytes(32).toString('hex');
      const invitationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Remove password and set invitation data
      delete value.credentials.password;
      
      value.credentials.invitationToken = invitationToken;
      value.credentials.invitationExpiry = invitationExpiry;
      value.credentials.isInvitationAccepted = false;
      value.credentials.invitedAt = new Date();
      value.credentials.invitedBy = adminId;
      value.credentials.invitationMode = 'EMAIL';
    } else {
      // DEFAULT_PASSWORD mode - set default password directly
      const defaultPassword = invitationConfig.getDefaultPassword();
      const hashedPassword = await authService.encryptPassword(defaultPassword);
      
      value.credentials.password = hashedPassword;
      value.credentials.isInvitationAccepted = true; // Consider as accepted
      value.credentials.requiresPasswordChange = true; // Force password change
      value.credentials.passwordSetAt = new Date();
      value.credentials.invitedAt = new Date();
      value.credentials.invitedBy = adminId;
      value.credentials.invitationMode = 'DEFAULT_PASSWORD';
    }

    // Initialize teaching structure if not present
    if (!value.teaching) {
      value.teaching = {
        studentIds: [],
        timeBlocks: []
      };
    } else {
      if (!value.teaching.studentIds) value.teaching.studentIds = [];
      if (!value.teaching.timeBlocks) value.teaching.timeBlocks = [];
    }

    value.createdAt = new Date();
    value.updatedAt = new Date();

    const result = await collection.insertOne(value);
    
    // Send invitation email only in EMAIL mode
    if (invitationConfig.isEmailMode()) {
      await emailService.sendInvitationEmail(value.credentials.email, value.credentials.invitationToken, value.personalInfo.fullName);
    }
    
    // Return success with potential duplicate warnings
    const response = { 
      _id: result.insertedId, 
      ...value,
      // Include invitation mode and default password info for frontend
      invitationInfo: {
        mode: value.credentials.invitationMode,
        requiresPasswordChange: value.credentials.requiresPasswordChange || false,
        defaultPassword: invitationConfig.isDefaultPasswordMode() ? invitationConfig.getDefaultPassword() : null
      }
    };
    
    if (duplicateResult.hasDuplicates && !DuplicateDetectionService.shouldBlockCreation(duplicateResult)) {
      response.warnings = {
        potentialDuplicates: duplicateResult.duplicates,
        message: 'Teacher created successfully, but potential duplicates were found'
      };
    }
    
    return response;
  } catch (err) {
    console.error(`Error adding teacher: ${err.message}`);
    
    // Handle duplicate detection errors specially
    if (err.code === 'DUPLICATE_TEACHER_DETECTED') {
      throw err; // Re-throw with full duplicate info
    }
    
    // Handle MongoDB duplicate key errors (email unique constraint)
    if (err.code === 11000) {
      const field = err.message.includes('credentials.email') ? 'credentials email' : 'personal email';
      const duplicateError = new Error(`Teacher with this ${field} already exists`);
      duplicateError.code = 'EMAIL_DUPLICATE';
      throw duplicateError;
    }
    
    throw new Error(`Error adding teacher: ${err.message}`);
  }
}


async function updateTeacher(teacherId, teacherToUpdate) {
  try {
    console.log('Updating teacher with data:', JSON.stringify(teacherToUpdate));

    // Use the update validation schema instead of the full schema
    const { error, value } = validateTeacherUpdate(teacherToUpdate);
    if (error) throw new Error(`Invalid teacher data: ${error.message}`);

    const collection = await getCollection('teacher');

    // Get current teacher data to merge for duplicate detection
    const currentTeacher = await collection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });
    
    if (!currentTeacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Merge current data with updates for comprehensive duplicate detection
    const mergedTeacherData = {
      personalInfo: {
        ...currentTeacher.personalInfo,
        ...value.personalInfo
      },
      credentials: {
        ...currentTeacher.credentials,
        ...value.credentials
      }
    };

    // Run duplicate detection excluding current teacher
    if (value.personalInfo || value.credentials) {
      const duplicateResult = await DuplicateDetectionService.detectTeacherDuplicates(
        mergedTeacherData, 
        teacherId
      );
      
      if (duplicateResult.hasDuplicates) {
        if (DuplicateDetectionService.shouldBlockCreation(duplicateResult)) {
          const criticalDuplicates = duplicateResult.duplicates.filter(d => 
            d.severity === 'CRITICAL' || 
            (d.severity === 'HIGH' && ['EMAIL_DUPLICATE', 'PHONE_DUPLICATE', 'FULL_PROFILE_DUPLICATE'].includes(d.type))
          );
          
          const error = new Error('Duplicate teacher detected');
          error.code = 'DUPLICATE_TEACHER_DETECTED';
          error.duplicateInfo = {
            blocked: true,
            reason: duplicateResult.recommendation,
            duplicates: criticalDuplicates,
            totalDuplicatesFound: duplicateResult.duplicateCount
          };
          throw error;
        } else {
          console.warn('Potential duplicates detected but allowing update:', duplicateResult);
        }
      }
    }

    // If password is provided, encrypt it
    if (value.credentials && value.credentials.password) {
      value.credentials.password = await authService.encryptPassword(
        value.credentials.password
      );
    }

    value.updatedAt = new Date();

    // Remove fields that cannot be updated
    const { _id, ...updateData } = value;

    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(teacherId) },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result) throw new Error(`Teacher with id ${teacherId} not found`);
    return result;
  } catch (err) {
    console.error(`Error updating teacher: ${err.message}`);
    
    // Handle duplicate detection errors specially
    if (err.code === 'DUPLICATE_TEACHER_DETECTED') {
      throw err;
    }
    
    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
      const field = err.message.includes('credentials.email') ? 'credentials email' : 'personal email';
      const duplicateError = new Error(`Teacher with this ${field} already exists`);
      duplicateError.code = 'EMAIL_DUPLICATE';
      throw duplicateError;
    }
    
    throw new Error(`Error updating teacher: ${err.message}`);
  }
}

async function removeTeacher(teacherId) {
  try {
    const collection = await getCollection('teacher');
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(teacherId) },
      {
        $set: {
          isActive: false,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    if (!result) throw new Error(`Teacher with id ${teacherId} not found`);
    return result;
  } catch (err) {
    console.error(`Error removing teacher: ${err.message}`);
    throw new Error(`Error removing teacher: ${err.message}`);
  }
}

async function getTeacherByRole(role) {
  try {
    const collection = await getCollection('teacher');
    return await collection
      .find({
        roles: role,
        isActive: true,
      })
      .toArray();
  } catch (err) {
    console.error(`Error getting teacher by role: ${err.message}`);
    throw new Error(`Error getting teacher by role: ${err.message}`);
  }
}

async function updateTeacherSchedule(teacherId, scheduleData) {
  try {
    // Validate that all required fields have values
    const { studentId, day, startTime, duration } = scheduleData;

    if (!studentId || !day || !startTime || !duration) {
      throw new Error(
        'Schedule data is incomplete: all fields (studentId, day, startTime, duration) are required'
      );
    }

    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    
    // First verify the teacher exists
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
    });
    
    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Verify the student exists
    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    // Check for time conflicts in timeBlocks
    const hasConflict = checkScheduleConflict(teacher.teaching?.timeBlocks || [], {
      day,
      startTime,
      duration
    });
    if (hasConflict) {
      throw new Error('Time slot conflicts with an existing slot');
    }

    // Check for student schedule conflicts
    const hasStudentConflict = await checkStudentScheduleConflict(
      studentId,
      teacherId,
      day,
      startTime,
      duration
    );

    if (hasStudentConflict) {
      throw new Error('Student already has another lesson at this time');
    }

    // Calculate end time based on start time and duration
    const endTime = calculateEndTime(startTime, duration);
    
    // Create a slot with all required fields
    const scheduleSlot = {
      _id: new ObjectId(),
      studentId,
      day,
      startTime,
      endTime,
      duration,
      isAvailable: false,
      location: scheduleData.location || null,
      notes: scheduleData.notes || null,
      recurring: scheduleData.recurring || { isRecurring: true, excludeDates: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Update the teacher's schedule and student list
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      {
        $addToSet: { 'teaching.studentIds': studentId },
        $push: {
          'teaching.timeBlocks': scheduleSlot,
        },
        $set: { updatedAt: new Date() }
      }
    );

    // Create the teacher assignment for the student
    const assignment = {
      teacherId,
      scheduleSlotId: scheduleSlot._id.toString(),
      startDate: scheduleData.startDate || new Date(),
      endDate: null,
      isActive: true,
      notes: scheduleData.notes || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Update the student's teacher assignments and teacherIds (for backward compatibility)
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { 
        $push: { teacherAssignments: assignment },
        $addToSet: { teacherIds: teacherId },
        $set: { updatedAt: new Date() }
      }
    );

    return {
      success: true,
      message: 'Schedule slot created and student assigned successfully',
      teacherId,
      studentId,
      scheduleSlot,
      assignment
    };
  } catch (err) {
    console.error(`Error updating teacher schedule: ${err.message}`);
    throw new Error(`Error updating teacher schedule: ${err.message}`);
  }
}

// Helper function to check for time conflicts
function checkScheduleConflict(existingSlots, newSlot) {
  return existingSlots.some(slot => {
    // Only check slots on the same day
    if (slot.day !== newSlot.day) return false;
    
    // Convert times to minutes for easier comparison
    const slotStart = timeToMinutes(slot.startTime || slot.time); // support both old and new format
    const slotEnd = slotStart + slot.duration;
    
    const newStart = timeToMinutes(newSlot.startTime);
    const newEnd = newStart + newSlot.duration;
    
    // Check for overlap
    return (newStart < slotEnd) && (slotStart < newEnd);
  });
}

// Helper function to convert HH:MM time to minutes
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper function to check for student schedule conflicts
async function checkStudentScheduleConflict(studentId, excludeTeacherId, day, startTime, duration, excludeSlotId = null) {
  const teacherCollection = await getCollection('teacher');

  // Find all teachers who have this student assigned
  const teachers = await teacherCollection
    .find({
      'teaching.timeBlocks.assignedLessons.studentId': studentId
    })
    .toArray();

  const newStart = timeToMinutes(startTime);
  const newEnd = newStart + duration;

  // Check each teacher's schedule
  for (const teacher of teachers) {
    // Skip the excluded teacher
    if (teacher._id.toString() === excludeTeacherId) continue;

    // Check timeBlocks system
    if (teacher.teaching?.timeBlocks) {
      for (const block of teacher.teaching.timeBlocks) {
        if (block.day !== day || !block.assignedLessons) continue;

        const conflictingLessons = block.assignedLessons.filter(lesson => {
          if (lesson.studentId !== studentId || lesson.isActive === false) return false;

          const lessonStart = timeToMinutes(lesson.lessonStartTime);
          const lessonEnd = timeToMinutes(lesson.lessonEndTime);
          return (newStart < lessonEnd) && (lessonStart < newEnd);
        });
        if (conflictingLessons.length > 0) return true;
      }
    }
  }

  return false;
}

// Helper function to calculate end time based on start time and duration
function calculateEndTime(startTime, durationMinutes) {
  const [hours, minutes] = startTime.split(':').map(Number);
  
  let totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

async function addStudentToTeacher(teacherId, studentId) {
  try {
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    
    // Verify both teacher and student exist
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });
    
    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }
    
    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });
    
    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }
    
    // Add student to teacher's studentIds (for backward compatibility)
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { 
        $addToSet: { 'teaching.studentIds': studentId },
        $set: { updatedAt: new Date() }
      }
    );
    
    // Add teacher to student's teacherIds (for backward compatibility)
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { 
        $addToSet: { teacherIds: teacherId },
        $set: { updatedAt: new Date() }
      }
    );
    
    return {
      success: true,
      message: 'Student added to teacher successfully',
      teacherId,
      studentId
    };
  } catch (err) {
    console.error(`Error adding student to teacher: ${err.message}`);
    throw new Error(`Error adding student to teacher: ${err.message}`);
  }
}

async function removeStudentFromTeacher(teacherId, studentId) {
  try {
    console.log(`🔥 ATOMIC CASCADE DELETION: Starting removal of student ${studentId} from teacher ${teacherId}`);
    
    // Validate input parameters
    if (!teacherId || !ObjectId.isValid(teacherId)) {
      throw new Error(`Invalid teacher ID format: ${teacherId}`);
    }
    
    if (!studentId || !ObjectId.isValid(studentId)) {
      throw new Error(`Invalid student ID format: ${studentId}`);
    }

    const result = await withTransaction(async (session) => {
      const teacherCollection = await getCollection('teacher');
      const studentCollection = await getCollection('student');
      
      // First, verify both documents exist
      const teacher = await teacherCollection.findOne(
        { _id: ObjectId.createFromHexString(teacherId) },
        { session }
      );
      
      if (!teacher) {
        throw new Error(`Teacher with id ${teacherId} not found`);
      }
      
      const student = await studentCollection.findOne(
        { _id: ObjectId.createFromHexString(studentId) },
        { session }
      );
      
      if (!student) {
        throw new Error(`Student with id ${studentId} not found`);
      }
      
      // Log current state for debugging
      console.log(`📊 Current teacher studentIds: ${teacher.teaching?.studentIds || []}`);
      console.log(`📊 Current student teacherIds: ${student.teacherIds || []}`);
      console.log(`📊 Current student teacherAssignments: ${student.teacherAssignments?.length || 0}`);
      
      // Check if relationship exists
      const hasTeacherRelation = teacher.teaching?.studentIds?.includes(studentId);
      const hasStudentRelation = student.teacherIds?.includes(teacherId);
      const hasActiveAssignments = student.teacherAssignments?.some(
        assignment => assignment.teacherId === teacherId && assignment.isActive
      );
      
      if (!hasTeacherRelation && !hasStudentRelation && !hasActiveAssignments) {
        console.log(`⚠️ No relationship found between teacher ${teacherId} and student ${studentId}`);
        return {
          success: true,
          message: 'No relationship found to remove',
          teacherId,
          studentId,
          changes: {
            teacher: { modified: false },
            student: { modified: false }
          }
        };
      }
      
      console.log(`🔍 Found relationship - Teacher: ${hasTeacherRelation}, Student: ${hasStudentRelation}, Assignments: ${hasActiveAssignments}`);
      
      // ATOMIC OPERATION 1a: Remove student from teacher's studentIds
      const teacherUpdate = await teacherCollection.updateOne(
        { _id: ObjectId.createFromHexString(teacherId) },
        {
          $pull: {
            'teaching.studentIds': studentId
          },
          $set: {
            updatedAt: new Date(),
            'metadata.lastModifiedBy': 'cascade_deletion_system'
          }
        },
        { session }
      );

      // ATOMIC OPERATION 1b: Deactivate student's lessons in timeBlocks
      await teacherCollection.updateOne(
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
          ],
          session
        }
      );

      console.log(`📝 Teacher update result: matched ${teacherUpdate.matchedCount}, modified ${teacherUpdate.modifiedCount}`);
      
      // ATOMIC OPERATION 2: Update student document - remove teacher relationship and assignments
      const studentUpdate = await studentCollection.updateOne(
        { _id: ObjectId.createFromHexString(studentId) },
        { 
          $pull: { 
            teacherIds: teacherId 
          },
          $set: { 
            'teacherAssignments.$[elem].isActive': false,
            'teacherAssignments.$[elem].endDate': new Date(),
            'teacherAssignments.$[elem].updatedAt': new Date(),
            updatedAt: new Date(),
            'metadata.lastModifiedBy': 'cascade_deletion_system'
          }
        },
        {
          arrayFilters: [{ 'elem.teacherId': teacherId, 'elem.isActive': true }],
          session
        }
      );
      
      console.log(`📝 Student update result: matched ${studentUpdate.matchedCount}, modified ${studentUpdate.modifiedCount}`);
      
      // ATOMIC OPERATION 3: Clean up orphaned schedule info in student document
      const scheduleCleanup = await studentCollection.updateOne(
        { _id: ObjectId.createFromHexString(studentId) },
        {
          $pull: {
            'scheduleInfo.lessonSchedule': { teacherId: teacherId },
            'scheduleInfo.weeklySchedule': { teacherId: teacherId }
          },
          $set: {
            'scheduleInfo.lastUpdated': new Date()
          }
        },
        { session }
      );
      
      console.log(`📝 Schedule cleanup result: matched ${scheduleCleanup.matchedCount}, modified ${scheduleCleanup.modifiedCount}`);
      
      // Get updated documents to return
      const updatedTeacher = await teacherCollection.findOne(
        { _id: ObjectId.createFromHexString(teacherId) },
        { 
          projection: {
            'teaching.studentIds': 1,
            'teaching.timeBlocks': 1,
            updatedAt: 1
          },
          session 
        }
      );
      
      const updatedStudent = await studentCollection.findOne(
        { _id: ObjectId.createFromHexString(studentId) },
        { 
          projection: { 
            teacherIds: 1, 
            teacherAssignments: 1,
            scheduleInfo: 1,
            updatedAt: 1 
          },
          session 
        }
      );
      
      return {
        success: true,
        message: 'Student removed from teacher successfully with atomic cascade deletion',
        teacherId,
        studentId,
        changes: {
          teacher: {
            modified: teacherUpdate.modifiedCount > 0,
            studentsRemoved: hasTeacherRelation ? 1 : 0,
            currentStudentIds: updatedTeacher?.teaching?.studentIds || []
          },
          student: {
            modified: studentUpdate.modifiedCount > 0 || scheduleCleanup.modifiedCount > 0,
            teachersRemoved: hasStudentRelation ? 1 : 0,
            assignmentsDeactivated: hasActiveAssignments ? 1 : 0,
            currentTeacherIds: updatedStudent?.teacherIds || [],
            remainingActiveAssignments: updatedStudent?.teacherAssignments?.filter(a => a.isActive)?.length || 0
          }
        },
        timestamp: new Date(),
        operation: 'cascade_deletion'
      };
    });
    
    console.log(`✅ ATOMIC CASCADE DELETION COMPLETED: ${JSON.stringify(result.changes, null, 2)}`);
    return result;
    
  } catch (err) {
    console.error(`❌ ATOMIC CASCADE DELETION FAILED: ${err.message}`);
    console.error(`📊 Error details:`, {
      teacherId,
      studentId,
      error: err.message,
      stack: err.stack
    });
    
    // Provide specific error messages for different failure scenarios
    if (err.message.includes('not found')) {
      throw new Error(`Cascade deletion failed: ${err.message}`);
    }
    
    if (err.message.includes('Invalid') && err.message.includes('ID format')) {
      throw new Error(`Cascade deletion failed: ${err.message}`);
    }
    
    // Transaction was automatically rolled back by MongoDB
    throw new Error(`Cascade deletion failed - all changes have been rolled back: ${err.message}`);
  }
}

async function initializeTeachingStructure(teacherId) {
  try {
    const collection = await getCollection('teacher');
    
    const result = await collection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { 
        $set: {
          'teaching.studentIds': [],
          'teaching.timeBlocks': [],
          updatedAt: new Date()
        }
      }
    );
    
    return result;
  } catch (err) {
    console.error(`Error initializing teaching structure: ${err.message}`);
    throw new Error(`Error initializing teaching structure: ${err.message}`);
  }
}

function _buildCriteria(filterBy) {
  const criteria = {};

  if (filterBy.name) {
    criteria['personalInfo.fullName'] = {
      $regex: filterBy.name,
      $options: 'i',
    };
  }

  if (filterBy.instrument) {
    // Use regex for flexible instrument matching (e.g., "כינור" matches "כינור בארוק")
    criteria['professionalInfo.instrument'] = {
      $regex: filterBy.instrument,
      $options: 'i'
    };
  }

  // Filter by role - checks if the role is in the roles array
  // This handles teachers with multiple roles (e.g., ['מורה', 'מנצח'])
  if (filterBy.role) {
    criteria.roles = filterBy.role;
  }

  if (filterBy.studentId) {
    criteria['teaching.studentIds'] = filterBy.studentId;
  }

  if (filterBy.orchestraId) {
    criteria['conducting.orchestraIds'] = filterBy.orchestraId;
  }

  if (filterBy.ensembleId) {
    criteria['ensembleIds'] = filterBy.ensembleId;
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

// Time Block Management Functions
async function getTimeBlocks(teacherId) {
  try {
    const collection = await getCollection('teacher');
    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Return timeBlocks if they exist, otherwise fall back to schedule
    return teacher.teaching?.timeBlocks || [];
  } catch (err) {
    console.error(`Error getting time blocks: ${err.message}`);
    throw err;
  }
}

async function createTimeBlock(teacherId, timeBlockData) {
  try {
    const collection = await getCollection('teacher');

    // Verify teacher exists
    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Calculate end time if not provided
    const endTime = timeBlockData.endTime || calculateEndTime(
      timeBlockData.startTime,
      calculateDurationFromTimes(timeBlockData.startTime, timeBlockData.endTime || '23:59')
    );

    // Create new time block
    const newTimeBlock = {
      _id: new ObjectId(),
      day: timeBlockData.day,
      startTime: timeBlockData.startTime,
      endTime: endTime,
      location: timeBlockData.location || null,
      notes: timeBlockData.notes || null,
      recurring: timeBlockData.recurring || {
        isRecurring: true,
        excludeDates: []
      },
      studentId: timeBlockData.studentId || null,
      studentName: timeBlockData.studentName || null,
      instrument: timeBlockData.instrument || null,
      totalDuration: timeBlockData.totalDuration || calculateDurationFromTimes(timeBlockData.startTime, endTime),
      isAvailable: !timeBlockData.studentId, // Available if no student assigned
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add time block to teacher's timeBlocks array
    const result = await collection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      {
        $push: { 'teaching.timeBlocks': newTimeBlock },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Failed to create time block');
    }

    return newTimeBlock;
  } catch (err) {
    console.error(`Error creating time block: ${err.message}`);
    throw err;
  }
}

async function updateTimeBlock(teacherId, timeBlockId, timeBlockData) {
  try {
    const collection = await getCollection('teacher');

    // Verify teacher exists
    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Find the time block to update (check both timeBlocks and schedule)
    const timeBlocks = teacher.teaching?.timeBlocks || [];
    const timeBlock = timeBlocks.find(
      block => block._id && block._id.toString() === timeBlockId
    );

    if (!timeBlock) {
      throw new Error(`Time block with id ${timeBlockId} not found`);
    }

    // Determine which field to update
    const fieldToUpdate = 'teaching.timeBlocks';

    // Calculate end time if not provided
    const endTime = timeBlockData.endTime || calculateEndTime(
      timeBlockData.startTime,
      timeBlockData.duration || calculateDurationFromTimes(timeBlockData.startTime, timeBlock.endTime)
    );

    // Prepare update fields dynamically based on the field to update
    const updateFields = {
      [`${fieldToUpdate}.$.day`]: timeBlockData.day || timeBlock.day,
      [`${fieldToUpdate}.$.startTime`]: timeBlockData.startTime || timeBlock.startTime,
      [`${fieldToUpdate}.$.endTime`]: endTime,
      [`${fieldToUpdate}.$.location`]: timeBlockData.location !== undefined ? timeBlockData.location : timeBlock.location,
      [`${fieldToUpdate}.$.notes`]: timeBlockData.notes !== undefined ? timeBlockData.notes : timeBlock.notes,
      [`${fieldToUpdate}.$.recurring`]: timeBlockData.recurring || timeBlock.recurring,
      [`${fieldToUpdate}.$.updatedAt`]: new Date(),
      'updatedAt': new Date()
    };

    // Update the time block
    const result = await collection.updateOne(
      {
        _id: ObjectId.createFromHexString(teacherId),
        [`${fieldToUpdate}._id`]: ObjectId.createFromHexString(timeBlockId)
      },
      { $set: updateFields }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Failed to update time block');
    }

    return { success: true, timeBlockId };
  } catch (err) {
    console.error(`Error updating time block: ${err.message}`);
    throw err;
  }
}

async function deleteTimeBlock(teacherId, timeBlockId) {
  try {
    const collection = await getCollection('teacher');

    // Verify teacher exists
    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Determine which field to delete from
    const fieldToUpdate = 'teaching.timeBlocks';

    // Remove the time block
    const result = await collection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      {
        $pull: { [fieldToUpdate]: { _id: ObjectId.createFromHexString(timeBlockId) } },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Failed to delete time block');
    }

    return { success: true, timeBlockId };
  } catch (err) {
    console.error(`Error deleting time block: ${err.message}`);
    throw err;
  }
}

// Helper function to calculate duration from times
function calculateDurationFromTimes(startTime, endTime) {
  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);
  return (endHour * 60 + endMin) - (startHour * 60 + startMin);
}
