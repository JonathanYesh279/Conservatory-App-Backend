import { getCollection } from '../../services/mongoDB.service.js';
import {
  validateTeacher,
  validateTeacherUpdate,
} from './teacher.validation.js';
import { ObjectId } from 'mongodb';
import { authService } from '../auth/auth.service.js';
import { DuplicateDetectionService } from '../../services/duplicateDetectionService.js';
import { emailService } from '../../services/emailService.js';
import crypto from 'crypto';

export const teacherService = {
  getTeachers,
  getTeacherById,
  addTeacher,
  updateTeacher,
  removeTeacher,
  getTeacherByRole,
  updateTeacherSchedule,
  addStudentToTeacher,
  removeStudentFromTeacher,
  initializeTeachingStructure,
};

async function getTeachers(filterBy) {
  try {
    const collection = await getCollection('teacher');
    const criteria = _buildCriteria(filterBy);

    const teachers = await collection.find(criteria).toArray();
    return teachers;
  } catch (err) {
    console.error(`Error getting teachers: ${err.message}`);
    throw new Error(`Error getting teachers: ${err.message}`);
  }
}

async function getTeacherById(teacherId) {
  try {
    const collection = await getCollection('teacher');
    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
    });

    if (!teacher) throw new Error(`Teacher with id ${teacherId} not found`);
    return teacher;
  } catch (err) {
    console.error(`Error getting teacher by id: ${err.message}`);
    throw new Error(`Error getting teacher by id: ${err.message}`);
  }
}

async function addTeacher(teacherToAdd, adminId) {
  try {
    const { error, value } = validateTeacher(teacherToAdd);
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

    // Generate invitation token instead of setting password
    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Remove password from teacher data and set invitation data
    // Always remove password for invitation system (handle null, empty string, or any value)
    delete value.credentials.password;
    
    value.credentials.invitationToken = invitationToken;
    value.credentials.invitationExpiry = invitationExpiry;
    value.credentials.isInvitationAccepted = false;
    value.credentials.invitedAt = new Date();
    value.credentials.invitedBy = adminId;

    // Initialize teaching structure if not present
    if (!value.teaching) {
      value.teaching = {
        studentIds: [],
        schedule: [], // Legacy slot-based schedule
        timeBlocks: [] // New time block system
      };
    } else {
      // Ensure arrays are initialized
      if (!value.teaching.studentIds) value.teaching.studentIds = [];
      if (!value.teaching.schedule) value.teaching.schedule = [];
      if (!value.teaching.timeBlocks) value.teaching.timeBlocks = [];
    }

    value.createdAt = new Date();
    value.updatedAt = new Date();

    const result = await collection.insertOne(value);
    
    // Send invitation email
    await emailService.sendInvitationEmail(value.credentials.email, invitationToken, value.personalInfo.fullName);
    
    // Return success with potential duplicate warnings
    const response = { _id: result.insertedId, ...value };
    
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

    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(teacherId) },
      { $set: value },
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

    // Check for time conflicts
    const hasConflict = checkScheduleConflict(teacher.teaching?.schedule || [], {
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
          'teaching.schedule': scheduleSlot,
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
    .find({ 'teaching.schedule.studentId': studentId })
    .toArray();
  
  // Check each teacher's schedule
  for (const teacher of teachers) {
    // Skip the excluded teacher
    if (teacher._id.toString() === excludeTeacherId) continue;
    
    const conflictingSlots = teacher.teaching.schedule.filter(slot => {
      // Skip if not assigned to this student or if it's the excluded slot
      if (slot.studentId !== studentId || 
         (excludeSlotId && slot._id.toString() === excludeSlotId)) {
        return false;
      }
      
      // Skip if not on the same day
      if (slot.day !== day) return false;
      
      // Convert times to minutes for easier comparison
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = slotStart + slot.duration;
      
      const newStart = timeToMinutes(startTime);
      const newEnd = newStart + duration;
      
      // Check for overlap
      return (newStart < slotEnd) && (slotStart < newEnd);
    });
    
    if (conflictingSlots.length > 0) return true;
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
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    
    // Remove all schedule slots for this student from this teacher
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { 
        $pull: { 
          'teaching.studentIds': studentId,
          'teaching.schedule': { studentId: studentId }
        },
        $set: { updatedAt: new Date() }
      }
    );
    
    // Mark all teacher assignments as inactive and remove from teacherIds
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { 
        $pull: { teacherIds: teacherId },
        $set: { 
          'teacherAssignments.$[elem].isActive': false,
          'teacherAssignments.$[elem].endDate': new Date(),
          updatedAt: new Date()
        }
      },
      {
        arrayFilters: [{ 'elem.teacherId': teacherId, 'elem.isActive': true }]
      }
    );
    
    return {
      success: true,
      message: 'Student removed from teacher successfully',
      teacherId,
      studentId
    };
  } catch (err) {
    console.error(`Error removing student from teacher: ${err.message}`);
    throw new Error(`Error removing student from teacher: ${err.message}`);
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
          'teaching.schedule': [], // Legacy slot-based schedule
          'teaching.timeBlocks': [], // New time block system
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
    criteria['personalInfo.instrument'] = filterBy.instrument;
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
