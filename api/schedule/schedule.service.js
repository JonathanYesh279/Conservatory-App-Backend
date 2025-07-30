import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import {
  validateCreateScheduleSlot,
  validateUpdateScheduleSlot,
  validateAssignStudent,
  validateAvailableSlotsFilter,
} from './schedule.validation.js';

export const scheduleService = {
  getTeacherWeeklySchedule,
  getAvailableSlots,
  createScheduleSlot,
  assignStudentToSlot,
  removeStudentFromSlot,
  updateScheduleSlot,
  getStudentSchedule,
  getScheduleSlotById,
  // New attendance-aware functions
  getTeacherWeeklyScheduleWithAttendance,
  getStudentScheduleWithAttendance,
  getScheduleSlotWithAttendance,
};

/**
 * Get a teacher's complete weekly schedule
 * @param {string} teacherId - Teacher's ID
 * @param {object} options - Filter options
 * @returns {Promise<Array>} - Schedule data organized by day
 */
async function getTeacherWeeklySchedule(teacherId, options = {}) {
  try {
    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Extract schedule from teacher and transform into weekly structure
    const schedule = teacher.teaching?.schedule || [];
    
    // Group by day
    const weeklySchedule = {
      'ראשון': schedule.filter(slot => slot.day === 'ראשון'),
      'שני': schedule.filter(slot => slot.day === 'שני'),
      'שלישי': schedule.filter(slot => slot.day === 'שלישי'),
      'רביעי': schedule.filter(slot => slot.day === 'רביעי'),
      'חמישי': schedule.filter(slot => slot.day === 'חמישי'),
      'שישי': schedule.filter(slot => slot.day === 'שישי'),
    };

    // Get associated student information for slots with students
    if (options.includeStudentInfo && schedule.some(slot => slot.studentId)) {
      const studentCollection = await getCollection('student');
      const studentIds = [...new Set(schedule
        .filter(slot => slot.studentId)
        .map(slot => slot.studentId))];

      // Convert string IDs to ObjectIds for MongoDB query
      const objectIds = studentIds.map(id => ObjectId.createFromHexString(id));
      
      const students = await studentCollection
        .find({ _id: { $in: objectIds } })
        .project({ 
          _id: 1, 
          'personalInfo.fullName': 1,
          'academicInfo.instrumentProgress': 1 
        })
        .toArray();

      // Create a lookup for faster access
      const studentLookup = students.reduce((acc, student) => {
        acc[student._id.toString()] = {
          fullName: student.personalInfo?.fullName,
          instrument: student.academicInfo?.instrumentProgress?.find(i => i.isPrimary)?.instrumentName
        };
        return acc;
      }, {});

      // Attach student info to each slot
      Object.keys(weeklySchedule).forEach(day => {
        weeklySchedule[day] = weeklySchedule[day].map(slot => {
          if (slot.studentId && studentLookup[slot.studentId]) {
            return {
              ...slot,
              studentInfo: studentLookup[slot.studentId]
            };
          }
          return slot;
        });
      });
    }

    // Sort slots by startTime within each day
    Object.keys(weeklySchedule).forEach(day => {
      weeklySchedule[day].sort((a, b) => {
        // Convert time strings to comparable values (e.g., "14:30" -> 1430)
        const timeA = a.startTime.replace(':', '');
        const timeB = b.startTime.replace(':', '');
        return parseInt(timeA) - parseInt(timeB);
      });
    });

    return weeklySchedule;
  } catch (err) {
    console.error(`Error getting teacher weekly schedule: ${err.message}`);
    throw new Error(`Error getting teacher weekly schedule: ${err.message}`);
  }
}

/**
 * Get available slots for a teacher
 * @param {string} teacherId - Teacher's ID
 * @param {object} filters - Optional filters for day, duration, etc.
 * @returns {Promise<Array>} - Available slots
 */
async function getAvailableSlots(teacherId, filters = {}) {
  try {
    // Validate filters if provided
    if (Object.keys(filters).length > 0) {
      const { error } = validateAvailableSlotsFilter(filters);
      if (error) throw new Error(`Invalid filter data: ${error.message}`);
    }

    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Extract schedule from teacher
    let availableSlots = (teacher.teaching?.schedule || [])
      .filter(slot => slot.isAvailable === true);

    // Apply filters if provided
    if (filters.day) {
      availableSlots = availableSlots.filter(slot => slot.day === filters.day);
    }
    
    if (filters.minDuration) {
      availableSlots = availableSlots.filter(slot => slot.duration >= filters.minDuration);
    }
    
    if (filters.startTimeAfter) {
      availableSlots = availableSlots.filter(slot => {
        // Convert time strings to comparable values
        const slotTime = slot.startTime.replace(':', '');
        const filterTime = filters.startTimeAfter.replace(':', '');
        return parseInt(slotTime) >= parseInt(filterTime);
      });
    }
    
    if (filters.startTimeBefore) {
      availableSlots = availableSlots.filter(slot => {
        // Convert time strings to comparable values
        const slotTime = slot.startTime.replace(':', '');
        const filterTime = filters.startTimeBefore.replace(':', '');
        return parseInt(slotTime) <= parseInt(filterTime);
      });
    }
    
    if (filters.location) {
      availableSlots = availableSlots.filter(slot => 
        slot.location && slot.location.includes(filters.location));
    }

    // Sort slots by day and startTime
    availableSlots.sort((a, b) => {
      const dayOrder = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
      const dayComparison = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
      
      if (dayComparison !== 0) return dayComparison;
      
      // If same day, sort by start time
      const timeA = a.startTime.replace(':', '');
      const timeB = b.startTime.replace(':', '');
      return parseInt(timeA) - parseInt(timeB);
    });

    return availableSlots;
  } catch (err) {
    console.error(`Error getting available slots: ${err.message}`);
    throw new Error(`Error getting available slots: ${err.message}`);
  }
}

/**
 * Create a new schedule slot for a teacher
 * @param {string} teacherId - Teacher's ID
 * @param {object} slotData - Schedule slot data
 * @returns {Promise<object>} - Created schedule slot
 */
async function createScheduleSlot(teacherId, slotData) {
  try {
    // Validate slot data
    const { error, value } = validateCreateScheduleSlot(slotData);
    if (error) throw new Error(`Invalid schedule data: ${error.message}`);

    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Check for time conflicts with existing slots
    const hasConflict = checkSlotConflict(teacher.teaching?.schedule || [], value);
    if (hasConflict) {
      throw new Error('Time slot conflicts with an existing slot');
    }

    // Generate new slot ID
    const slotId = new ObjectId();
    
    // Calculate end time based on start time and duration
    const endTime = calculateEndTime(value.startTime, value.duration);
    
    // Prepare the new slot
    const newSlot = {
      _id: slotId,
      studentId: null,
      day: value.day,
      startTime: value.startTime,
      endTime: endTime,
      duration: value.duration,
      isAvailable: true,
      location: value.location || null,
      notes: value.notes || null,
      recurring: value.recurring || { isRecurring: true, excludeDates: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add slot to teacher's schedule
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { 
        $push: { 'teaching.schedule': newSlot },
        $set: { updatedAt: new Date() }
      }
    );

    return { ...newSlot, teacherId };
  } catch (err) {
    console.error(`Error creating schedule slot: ${err.message}`);
    throw new Error(`Error creating schedule slot: ${err.message}`);
  }
}

/**
 * Assign a student to a specific schedule slot
 * @param {object} assignmentData - Assignment data
 * @returns {Promise<object>} - Updated schedule slot and student assignment
 */
async function assignStudentToSlot(assignmentData) {
  try {
    // Validate assignment data
    const { error, value } = validateAssignStudent(assignmentData);
    if (error) throw new Error(`Invalid assignment data: ${error.message}`);

    const { teacherId, studentId, scheduleSlotId } = value;
    
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');

    // Find the teacher and the specific slot
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
      'teaching.schedule._id': ObjectId.createFromHexString(scheduleSlotId)
    });

    if (!teacher) {
      throw new Error(`Teacher or schedule slot not found`);
    }

    // Find the student
    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    // Find the specific slot
    const scheduleSlot = teacher.teaching.schedule.find(
      slot => slot._id.toString() === scheduleSlotId
    );

    if (!scheduleSlot) {
      throw new Error(`Schedule slot with id ${scheduleSlotId} not found`);
    }

    if (!scheduleSlot.isAvailable) {
      throw new Error(`Schedule slot is not available for assignment`);
    }

    // Check for student double booking
    const hasConflict = await checkStudentScheduleConflict(
      studentId,
      teacherId,
      scheduleSlot.day,
      scheduleSlot.startTime,
      scheduleSlot.duration
    );

    if (hasConflict) {
      throw new Error(`Student already has another lesson at this time`);
    }

    // Update the teacher's schedule slot
    await teacherCollection.updateOne(
      { 
        _id: ObjectId.createFromHexString(teacherId),
        'teaching.schedule._id': ObjectId.createFromHexString(scheduleSlotId)
      },
      { 
        $set: { 
          'teaching.schedule.$.studentId': studentId,
          'teaching.schedule.$.isAvailable': false,
          'teaching.schedule.$.updatedAt': new Date()
        },
        $addToSet: { 'teaching.studentIds': studentId }
      }
    );

    // Create the teacher assignment for the student
    const assignment = {
      teacherId,
      scheduleSlotId,
      startDate: value.startDate || new Date(),
      endDate: null,
      isActive: true,
      notes: value.notes || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Initialize teacherAssignments array if it doesn't exist, then update the student
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { 
        $addToSet: { 
          teacherIds: teacherId, // For backward compatibility
        },
        $set: { updatedAt: new Date() }
      }
    );

    // Ensure teacherAssignments array exists and push the assignment
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { 
        $push: { teacherAssignments: assignment }
      }
    );

    return { 
      success: true,
      message: 'Student successfully assigned to schedule slot',
      teacherId,
      studentId,
      scheduleSlotId,
      assignment
    };
  } catch (err) {
    console.error(`Error assigning student to slot: ${err.message}`);
    throw new Error(`Error assigning student to slot: ${err.message}`);
  }
}

/**
 * Remove a student from a schedule slot
 * @param {string} scheduleSlotId - Schedule slot ID
 * @returns {Promise<object>} - Success message
 */
async function removeStudentFromSlot(scheduleSlotId) {
  try {
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');

    // Find the teacher with this schedule slot
    const teacher = await teacherCollection.findOne({
      'teaching.schedule._id': ObjectId.createFromHexString(scheduleSlotId)
    });

    if (!teacher) {
      throw new Error(`Schedule slot with id ${scheduleSlotId} not found`);
    }

    // Find the specific slot to get the student ID
    const scheduleSlot = teacher.teaching.schedule.find(
      slot => slot._id.toString() === scheduleSlotId
    );

    if (!scheduleSlot) {
      throw new Error(`Schedule slot with id ${scheduleSlotId} not found`);
    }

    const studentId = scheduleSlot.studentId;
    
    if (!studentId) {
      throw new Error(`No student assigned to this slot`);
    }

    // Update the teacher's schedule slot
    await teacherCollection.updateOne(
      { 
        _id: teacher._id,
        'teaching.schedule._id': ObjectId.createFromHexString(scheduleSlotId)
      },
      { 
        $set: { 
          'teaching.schedule.$.studentId': null,
          'teaching.schedule.$.isAvailable': true,
          'teaching.schedule.$.updatedAt': new Date()
        }
      }
    );

    // Mark the student's teacher assignment as inactive
    await studentCollection.updateOne(
      { 
        _id: ObjectId.createFromHexString(studentId),
        'teacherAssignments.scheduleSlotId': scheduleSlotId
      },
      { 
        $set: { 
          'teacherAssignments.$.isActive': false,
          'teacherAssignments.$.endDate': new Date(),
          'teacherAssignments.$.updatedAt': new Date(),
          updatedAt: new Date()
        }
      }
    );

    // Check if this was the last active schedule with this teacher
    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    if (student) {
      const hasActiveAssignments = student.teacherAssignments?.some(
        assignment => assignment.teacherId === teacher._id.toString() && assignment.isActive
      );

      // If no more active assignments, remove from teacherIds array (backward compatibility)
      if (!hasActiveAssignments) {
        await studentCollection.updateOne(
          { _id: ObjectId.createFromHexString(studentId) },
          { $pull: { teacherIds: teacher._id.toString() } }
        );

        // Also remove student from teacher's studentIds
        await teacherCollection.updateOne(
          { _id: teacher._id },
          { $pull: { 'teaching.studentIds': studentId } }
        );
      }
    }

    return { 
      success: true,
      message: 'Student successfully removed from schedule slot',
      teacherId: teacher._id.toString(),
      studentId,
      scheduleSlotId
    };
  } catch (err) {
    console.error(`Error removing student from slot: ${err.message}`);
    throw new Error(`Error removing student from slot: ${err.message}`);
  }
}

/**
 * Update a schedule slot
 * @param {string} scheduleSlotId - Schedule slot ID
 * @param {object} updateData - Data to update
 * @returns {Promise<object>} - Updated schedule slot
 */
async function updateScheduleSlot(scheduleSlotId, updateData) {
  try {
    // Validate update data
    const { error, value } = validateUpdateScheduleSlot(updateData);
    if (error) throw new Error(`Invalid update data: ${error.message}`);

    const teacherCollection = await getCollection('teacher');

    // Find the teacher with this schedule slot
    const teacher = await teacherCollection.findOne({
      'teaching.schedule._id': ObjectId.createFromHexString(scheduleSlotId)
    });

    if (!teacher) {
      throw new Error(`Schedule slot with id ${scheduleSlotId} not found`);
    }

    // Find the original slot
    const originalSlot = teacher.teaching.schedule.find(
      slot => slot._id.toString() === scheduleSlotId
    );

    if (!originalSlot) {
      throw new Error(`Schedule slot with id ${scheduleSlotId} not found`);
    }

    // If changing time or day, check for conflicts
    if ((value.day && value.day !== originalSlot.day) || 
        (value.startTime && value.startTime !== originalSlot.startTime) ||
        (value.duration && value.duration !== originalSlot.duration)) {
      
      // Create a test slot with the new values for conflict checking
      const testSlot = {
        ...originalSlot,
        day: value.day || originalSlot.day,
        startTime: value.startTime || originalSlot.startTime,
        duration: value.duration || originalSlot.duration
      };

      // Filter out the current slot for conflict checking
      const otherSlots = teacher.teaching.schedule.filter(
        slot => slot._id.toString() !== scheduleSlotId
      );

      const hasConflict = checkSlotConflict(otherSlots, testSlot);
      if (hasConflict) {
        throw new Error('Updated time slot conflicts with an existing slot');
      }

      // If assigned to a student, check for student conflicts too
      if (originalSlot.studentId) {
        const hasStudentConflict = await checkStudentScheduleConflict(
          originalSlot.studentId,
          teacher._id.toString(),
          testSlot.day,
          testSlot.startTime,
          testSlot.duration,
          scheduleSlotId // Exclude this slot from conflict check
        );

        if (hasStudentConflict) {
          throw new Error(`Student already has another lesson at this updated time`);
        }
      }

      // Calculate new end time if start time or duration changed
      if (value.startTime || value.duration) {
        const newStartTime = value.startTime || originalSlot.startTime;
        const newDuration = value.duration || originalSlot.duration;
        value.endTime = calculateEndTime(newStartTime, newDuration);
      }
    }

    // Build the update object
    const updateObject = {};
    for (const key in value) {
      updateObject[`teaching.schedule.$.${key}`] = value[key];
    }
    
    // Always update the timestamp
    updateObject['teaching.schedule.$.updatedAt'] = new Date();

    // Update the schedule slot
    await teacherCollection.updateOne(
      { 
        _id: teacher._id,
        'teaching.schedule._id': ObjectId.createFromHexString(scheduleSlotId)
      },
      { $set: updateObject }
    );

    // Retrieve the updated teacher to get the fresh slot data
    const updatedTeacher = await teacherCollection.findOne({
      _id: teacher._id
    });

    const updatedSlot = updatedTeacher.teaching.schedule.find(
      slot => slot._id.toString() === scheduleSlotId
    );

    return { 
      success: true,
      message: 'Schedule slot updated successfully',
      teacherId: teacher._id.toString(),
      scheduleSlot: updatedSlot
    };
  } catch (err) {
    console.error(`Error updating schedule slot: ${err.message}`);
    throw new Error(`Error updating schedule slot: ${err.message}`);
  }
}

/**
 * Get a student's complete schedule across all teachers
 * @param {string} studentId - Student's ID
 * @returns {Promise<object>} - Student's schedule organized by day and teacher
 */
async function getStudentSchedule(studentId) {
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    // Get all teacher assignments
    const activeAssignments = student.teacherAssignments?.filter(a => a.isActive) || [];
    
    if (activeAssignments.length === 0) {
      return {
        studentId,
        studentName: student.personalInfo?.fullName,
        schedule: {
          'ראשון': [],
          'שני': [],
          'שלישי': [],
          'רביעי': [],
          'חמישי': [],
          'שישי': [],
        }
      };
    }

    // Get all teachers with their schedule data
    const teacherIds = [...new Set(activeAssignments.map(a => a.teacherId))];
    const objectTeacherIds = teacherIds.map(id => ObjectId.createFromHexString(id));
    
    const teachers = await teacherCollection
      .find({ _id: { $in: objectTeacherIds } })
      .project({ 
        _id: 1, 
        'personalInfo.fullName': 1,
        'professionalInfo.instrument': 1,
        'teaching.schedule': 1 
      })
      .toArray();

    // Create a lookup for schedule slots
    const scheduleSlots = {};
    const teacherInfo = {};
    
    teachers.forEach(teacher => {
      teacherInfo[teacher._id.toString()] = {
        teacherId: teacher._id.toString(),
        teacherName: teacher.personalInfo?.fullName,
        instrument: teacher.professionalInfo?.instrument
      };
      
      teacher.teaching.schedule.forEach(slot => {
        if (slot.studentId === studentId) {
          scheduleSlots[slot._id.toString()] = {
            ...slot,
            teacherId: teacher._id.toString(),
            teacherName: teacher.personalInfo?.fullName,
            instrument: teacher.professionalInfo?.instrument
          };
        }
      });
    });

    // Create weekly schedule structure
    const weeklySchedule = {
      'ראשון': [],
      'שני': [],
      'שלישי': [],
      'רביעי': [],
      'חמישי': [],
      'שישי': [],
    };

    // Populate the schedule
    Object.values(scheduleSlots).forEach(slot => {
      weeklySchedule[slot.day].push(slot);
    });

    // Sort slots by startTime within each day
    Object.keys(weeklySchedule).forEach(day => {
      weeklySchedule[day].sort((a, b) => {
        const timeA = a.startTime.replace(':', '');
        const timeB = b.startTime.replace(':', '');
        return parseInt(timeA) - parseInt(timeB);
      });
    });

    return {
      studentId,
      studentName: student.personalInfo?.fullName,
      schedule: weeklySchedule,
      teachers: Object.values(teacherInfo)
    };
  } catch (err) {
    console.error(`Error getting student schedule: ${err.message}`);
    throw new Error(`Error getting student schedule: ${err.message}`);
  }
}

/**
 * Get a specific schedule slot by ID
 * @param {string} scheduleSlotId - Schedule slot ID
 * @returns {Promise<object>} - Schedule slot with teacher info
 */
async function getScheduleSlotById(scheduleSlotId) {
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

    // Add teacher info to the slot
    return {
      ...scheduleSlot,
      teacherId: teacher._id.toString(),
      teacherName: teacher.personalInfo?.fullName,
      instrument: teacher.professionalInfo?.instrument
    };
  } catch (err) {
    console.error(`Error getting schedule slot: ${err.message}`);
    throw new Error(`Error getting schedule slot: ${err.message}`);
  }
}

// Helper function to check for time conflicts
function checkSlotConflict(existingSlots, newSlot) {
  return existingSlots.some(slot => {
    // Only check slots on the same day
    if (slot.day !== newSlot.day) return false;
    
    // Convert times to minutes for easier comparison
    const slotStart = timeToMinutes(slot.startTime);
    const slotEnd = slotStart + slot.duration;
    
    const newStart = timeToMinutes(newSlot.startTime);
    const newEnd = newStart + newSlot.duration;
    
    // Check for overlap
    return (newStart < slotEnd) && (slotStart < newEnd);
  });
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

// Helper function to convert HH:MM time to minutes
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper function to calculate end time based on start time and duration
function calculateEndTime(startTime, durationMinutes) {
  const [hours, minutes] = startTime.split(':').map(Number);
  
  let totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

/**
 * Get teacher's weekly schedule with attendance data included
 * @param {string} teacherId - Teacher's ID
 * @param {object} options - Filter options
 * @returns {Promise<object>} - Schedule data with attendance information
 */
async function getTeacherWeeklyScheduleWithAttendance(teacherId, options = {}) {
  try {
    // Get the base schedule (non-breaking - uses existing function)
    const baseSchedule = await getTeacherWeeklySchedule(teacherId, options);
    
    // For each slot with a student, include attendance summary if available
    Object.keys(baseSchedule).forEach(day => {
      baseSchedule[day] = baseSchedule[day].map(slot => {
        const enrichedSlot = { ...slot };
        
        // Add attendance summary if attendance data exists
        if (slot.attendance) {
          enrichedSlot.attendanceSummary = {
            hasAttendanceData: true,
            status: slot.attendance.status,
            markedAt: slot.attendance.markedAt,
            markedBy: slot.attendance.markedBy,
            notes: slot.attendance.notes
          };
        } else {
          enrichedSlot.attendanceSummary = {
            hasAttendanceData: false,
            status: 'pending'
          };
        }
        
        return enrichedSlot;
      });
    });
    
    return baseSchedule;
  } catch (err) {
    console.error(`Error getting teacher weekly schedule with attendance: ${err.message}`);
    throw err;
  }
}

/**
 * Get student's schedule with attendance data included
 * @param {string} studentId - Student's ID
 * @param {object} options - Options including attendance details
 * @returns {Promise<object>} - Student schedule with attendance information
 */
async function getStudentScheduleWithAttendance(studentId, options = {}) {
  try {
    // Get the base schedule (non-breaking - uses existing function)
    const baseSchedule = await getStudentSchedule(studentId);
    
    // Add attendance information to each slot
    Object.keys(baseSchedule.schedule).forEach(day => {
      baseSchedule.schedule[day] = baseSchedule.schedule[day].map(slot => {
        const enrichedSlot = { ...slot };
        
        // Add attendance summary if available
        if (slot.attendance) {
          enrichedSlot.attendanceSummary = {
            hasAttendanceData: true,
            status: slot.attendance.status,
            markedAt: slot.attendance.markedAt,
            lessonCompleted: slot.attendance.lessonCompleted,
            notes: slot.attendance.notes
          };
        } else {
          enrichedSlot.attendanceSummary = {
            hasAttendanceData: false,
            status: 'pending',
            lessonCompleted: null
          };
        }
        
        return enrichedSlot;
      });
    });
    
    // Optionally add attendance statistics
    if (options.includeStats) {
      try {
        const { attendanceService } = await import('./attendance.service.js');
        baseSchedule.attendanceStats = await attendanceService.getStudentPrivateLessonStats(studentId);
      } catch (importErr) {
        // Gracefully handle if attendance service is not available
        console.warn('Attendance service not available for stats:', importErr.message);
        baseSchedule.attendanceStats = null;
      }
    }
    
    return baseSchedule;
  } catch (err) {
    console.error(`Error getting student schedule with attendance: ${err.message}`);
    throw err;
  }
}

/**
 * Get a specific schedule slot with attendance data
 * @param {string} scheduleSlotId - Schedule slot ID
 * @param {object} options - Options for attendance details
 * @returns {Promise<object>} - Schedule slot with attendance information
 */
async function getScheduleSlotWithAttendance(scheduleSlotId, options = {}) {
  try {
    // Get the base slot (non-breaking - uses existing function)
    const baseSlot = await getScheduleSlotById(scheduleSlotId);
    
    // Enrich with attendance data
    const enrichedSlot = { ...baseSlot };
    
    if (baseSlot.attendance) {
      enrichedSlot.attendanceData = {
        hasAttendanceData: true,
        status: baseSlot.attendance.status,
        markedAt: baseSlot.attendance.markedAt,
        markedBy: baseSlot.attendance.markedBy,
        lessonCompleted: baseSlot.attendance.lessonCompleted,
        notes: baseSlot.attendance.notes,
        lessonDate: baseSlot.attendance.lessonDate
      };
    } else {
      enrichedSlot.attendanceData = {
        hasAttendanceData: false,
        status: 'pending',
        lessonCompleted: null
      };
    }
    
    // Optionally include attendance history
    if (options.includeHistory && baseSlot.studentId) {
      try {
        const { attendanceService } = await import('./attendance.service.js');
        enrichedSlot.attendanceHistory = await attendanceService.getStudentAttendanceHistory(
          baseSlot.studentId,
          { teacherId: baseSlot.teacherId, limit: 10 }
        );
      } catch (importErr) {
        console.warn('Attendance service not available for history:', importErr.message);
        enrichedSlot.attendanceHistory = [];
      }
    }
    
    return enrichedSlot;
  } catch (err) {
    console.error(`Error getting schedule slot with attendance: ${err.message}`);
    throw err;
  }
}