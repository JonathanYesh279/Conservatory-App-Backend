import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import {
  validateCreateTimeBlock,
  validateUpdateTimeBlock,
  validateLessonAssignment,
} from './time-block.validation.js';

export const timeBlockService = {
  createTimeBlock,
  updateTimeBlock,
  deleteTimeBlock,
  getTeacherTimeBlocks,
  calculateAvailableSlots,
  assignLessonToBlock,
  removeLessonFromBlock,
  getTeacherScheduleWithBlocks,
  findOptimalSlot,
  validateTimeBlockConflicts,
};

/**
 * Create a new time block for a teacher
 * @param {string} teacherId - Teacher's ID
 * @param {object} blockData - Time block data
 * @returns {Promise<object>} - Created time block
 */
async function createTimeBlock(teacherId, blockData) {
  try {
    // Validate block data
    const { error, value } = validateCreateTimeBlock(blockData);
    if (error) throw new Error(`Invalid time block data: ${error.message}`);

    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Check for conflicts with existing time blocks
    const hasConflict = await validateTimeBlockConflicts(
      teacherId,
      value.day,
      value.startTime,
      value.endTime
    );

    if (hasConflict) {
      throw new Error('Time block conflicts with existing schedule');
    }

    // Create new time block
    const timeBlock = {
      _id: new ObjectId(),
      day: value.day,
      startTime: value.startTime,
      endTime: value.endTime,
      totalDuration: calculateDuration(value.startTime, value.endTime),
      location: value.location || null,
      notes: value.notes || null,
      isActive: true,
      assignedLessons: [],
      recurring: value.recurring || { isRecurring: true, excludeDates: [] },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add time block to teacher's schedule
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { 
        $push: { 'teaching.timeBlocks': timeBlock },
        $set: { updatedAt: new Date() }
      }
    );

    return {
      success: true,
      message: 'Time block created successfully',
      timeBlock: { ...timeBlock, teacherId }
    };
  } catch (err) {
    console.error(`Error creating time block: ${err.message}`);
    throw new Error(`Error creating time block: ${err.message}`);
  }
}

/**
 * Update an existing time block
 * @param {string} teacherId - Teacher's ID
 * @param {string} blockId - Time block ID
 * @param {object} updateData - Update data
 * @returns {Promise<object>} - Updated time block
 */
async function updateTimeBlock(teacherId, blockId, updateData) {
  try {
    // Validate update data
    const { error, value } = validateUpdateTimeBlock(updateData);
    if (error) throw new Error(`Invalid update data: ${error.message}`);

    const teacherCollection = await getCollection('teacher');

    // First get the teacher
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    // Find the specific time block (handle both ObjectId and string _id)
    const timeBlock = teacher.teaching?.timeBlocks?.find(
      block => block._id.toString() === blockId
    );

    if (!timeBlock) {
      throw new Error(`Time block with id ${blockId} not found`);
    }

    // Check if changes would conflict with existing lessons
    if (value.startTime || value.endTime || value.day) {
      const newStart = value.startTime || timeBlock.startTime;
      const newEnd = value.endTime || timeBlock.endTime;
      const newDay = value.day || timeBlock.day;

      // Validate assigned lessons still fit within new time block
      const hasLessonConflict = timeBlock.assignedLessons.some(lesson => {
        if (!lesson.isActive) return false;
        
        const lessonStart = timeToMinutes(lesson.lessonStartTime);
        const lessonEnd = timeToMinutes(lesson.lessonEndTime);
        const blockStart = timeToMinutes(newStart);
        const blockEnd = timeToMinutes(newEnd);
        
        return lessonStart < blockStart || lessonEnd > blockEnd;
      });

      if (hasLessonConflict) {
        throw new Error('Cannot update time block: would conflict with existing lesson assignments');
      }

      // Check for conflicts with other time blocks
      const hasBlockConflict = await validateTimeBlockConflicts(
        teacherId,
        newDay,
        newStart,
        newEnd,
        blockId
      );

      if (hasBlockConflict) {
        throw new Error('Updated time block would conflict with existing schedule');
      }

      // Update total duration if time changed
      if (value.startTime || value.endTime) {
        value.totalDuration = calculateDuration(newStart, newEnd);
      }
    }

    // Build update object for the specific time block
    const updateObject = {};
    for (const key in value) {
      updateObject[`teaching.timeBlocks.$.${key}`] = value[key];
    }
    updateObject['teaching.timeBlocks.$.updatedAt'] = new Date();

    // Try to update with ObjectId first (for blocks stored as ObjectId)
    let result = await teacherCollection.updateOne(
      {
        _id: ObjectId.createFromHexString(teacherId),
        'teaching.timeBlocks._id': ObjectId.createFromHexString(blockId)
      },
      { $set: updateObject }
    );

    // If no document was matched, try with string _id (for blocks stored as string)
    if (result.matchedCount === 0) {
      result = await teacherCollection.updateOne(
        {
          _id: ObjectId.createFromHexString(teacherId),
          'teaching.timeBlocks._id': blockId
        },
        { $set: updateObject }
      );
    }

    if (result.matchedCount === 0) {
      throw new Error(`Failed to update time block: no matching document found`);
    }

    // Get updated time block
    const updatedTeacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    const updatedBlock = updatedTeacher.teaching.timeBlocks.find(
      block => block._id.toString() === blockId
    );

    return {
      success: true,
      message: 'Time block updated successfully',
      timeBlock: updatedBlock
    };
  } catch (err) {
    console.error(`Error updating time block: ${err.message}`);
    throw new Error(`Error updating time block: ${err.message}`);
  }
}

/**
 * Delete a time block
 * @param {string} teacherId - Teacher's ID
 * @param {string} blockId - Time block ID
 * @returns {Promise<object>} - Success message
 */
async function deleteTimeBlock(teacherId, blockId) {
  try {
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');

    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
      'teaching.timeBlocks._id': ObjectId.createFromHexString(blockId)
    });

    if (!teacher) {
      throw new Error(`Teacher or time block not found`);
    }

    // Find the time block to check for assigned lessons
    const timeBlock = teacher.teaching.timeBlocks.find(
      block => block._id.toString() === blockId
    );

    if (!timeBlock) {
      throw new Error(`Time block with id ${blockId} not found`);
    }

    // Handle assigned lessons
    const activeAssignments = timeBlock.assignedLessons.filter(lesson => lesson.isActive);
    
    if (activeAssignments.length > 0) {
      // Update student records to mark assignments as inactive
      for (const lesson of activeAssignments) {
        await studentCollection.updateOne(
          { 
            _id: ObjectId.createFromHexString(lesson.studentId),
            'teacherAssignments.timeBlockId': blockId
          },
          { 
            $set: { 
              'teacherAssignments.$[elem].isActive': false,
              'teacherAssignments.$[elem].endDate': new Date(),
              'teacherAssignments.$[elem].updatedAt': new Date()
            }
          },
          {
            arrayFilters: [{ 'elem.timeBlockId': blockId, 'elem.isActive': true }]
          }
        );
      }
    }

    // Remove the time block
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { 
        $pull: { 'teaching.timeBlocks': { _id: ObjectId.createFromHexString(blockId) } },
        $set: { updatedAt: new Date() }
      }
    );

    return {
      success: true,
      message: 'Time block deleted successfully',
      affectedStudents: activeAssignments.length
    };
  } catch (err) {
    console.error(`Error deleting time block: ${err.message}`);
    throw new Error(`Error deleting time block: ${err.message}`);
  }
}

/**
 * Get all time blocks for a teacher
 * @param {string} teacherId - Teacher's ID
 * @param {object} options - Filter options
 * @returns {Promise<Array>} - Teacher's time blocks
 */
async function getTeacherTimeBlocks(teacherId, options = {}) {
  try {
    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    let timeBlocks = teacher.teaching?.timeBlocks || [];

    // Filter by day if specified
    if (options.day) {
      timeBlocks = timeBlocks.filter(block => block.day === options.day);
    }

    // Filter by active status
    if (options.activeOnly !== false) {
      timeBlocks = timeBlocks.filter(block => block.isActive);
    }

    // Sort by day and start time
    timeBlocks.sort((a, b) => {
      const dayOrder = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
      const dayComparison = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
      
      if (dayComparison !== 0) return dayComparison;
      
      const timeA = timeToMinutes(a.startTime);
      const timeB = timeToMinutes(b.startTime);
      return timeA - timeB;
    });

    // Include available slots calculation if requested
    if (options.includeAvailableSlots) {
      timeBlocks = timeBlocks.map(block => ({
        ...block,
        availableSlots: calculateBlockAvailability(block)
      }));
    }

    return timeBlocks;
  } catch (err) {
    console.error(`Error getting teacher time blocks: ${err.message}`);
    throw new Error(`Error getting teacher time blocks: ${err.message}`);
  }
}

/**
 * Calculate available lesson slots within time blocks for specific duration
 * @param {string} teacherId - Teacher's ID
 * @param {number} duration - Requested lesson duration (30, 45, or 60)
 * @param {object} preferences - Student preferences
 * @returns {Promise<Array>} - Available lesson slots
 */
async function calculateAvailableSlots(teacherId, duration, preferences = {}) {
  try {
    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    const timeBlocks = teacher.teaching?.timeBlocks || [];
    const availableSlots = [];

    for (const block of timeBlocks) {
      if (!block.isActive) continue;

      // Filter by day preference if specified
      if (preferences.preferredDays && !preferences.preferredDays.includes(block.day)) {
        continue;
      }

      // Calculate available segments within this time block
      const availableSegments = calculateAvailableSegments(block, duration);
      
      for (const segment of availableSegments) {
        // Generate possible lesson slots within the segment
        const segmentSlots = generateLessonSlots(segment, duration, block);
        availableSlots.push(...segmentSlots);
      }
    }

    // Filter by time preferences
    let filteredSlots = availableSlots;
    
    if (preferences.preferredStartTime) {
      const preferredMinutes = timeToMinutes(preferences.preferredStartTime);
      filteredSlots = filteredSlots.filter(slot => {
        const slotMinutes = timeToMinutes(slot.startTime);
        return Math.abs(slotMinutes - preferredMinutes) <= 60; // Within 1 hour
      });
    }

    if (preferences.maxEndTime) {
      const maxMinutes = timeToMinutes(preferences.maxEndTime);
      filteredSlots = filteredSlots.filter(slot => {
        const endMinutes = timeToMinutes(slot.endTime);
        return endMinutes <= maxMinutes;
      });
    }

    // Sort by preference score
    filteredSlots = sortSlotsByPreference(filteredSlots, preferences);

    return filteredSlots;
  } catch (err) {
    console.error(`Error calculating available slots: ${err.message}`);
    throw new Error(`Error calculating available slots: ${err.message}`);
  }
}

/**
 * Assign a lesson to a time block
 * @param {object} assignmentData - Assignment data
 * @returns {Promise<object>} - Assignment result
 */
async function assignLessonToBlock(assignmentData) {
  try {
    // Validate assignment data
    const { error, value } = validateLessonAssignment(assignmentData);
    if (error) throw new Error(`Invalid assignment data: ${error.message}`);

    const { teacherId, studentId, timeBlockId, startTime, duration } = value;
    
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');

    // Find teacher and time block
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
      'teaching.timeBlocks._id': ObjectId.createFromHexString(timeBlockId)
    });

    if (!teacher) {
      throw new Error(`Teacher or time block not found`);
    }

    // Find student
    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    if (!student) {
      throw new Error(`Student with id ${studentId} not found`);
    }

    // Find the specific time block
    const timeBlock = teacher.teaching.timeBlocks.find(
      block => block._id.toString() === timeBlockId
    );

    if (!timeBlock || !timeBlock.isActive) {
      throw new Error(`Time block not found or not active`);
    }

    // Calculate lesson end time
    const endTime = addMinutesToTime(startTime, duration);

    // Validate lesson fits within time block
    const blockStart = timeToMinutes(timeBlock.startTime);
    const blockEnd = timeToMinutes(timeBlock.endTime);
    const lessonStart = timeToMinutes(startTime);
    const lessonEnd = timeToMinutes(endTime);

    if (lessonStart < blockStart || lessonEnd > blockEnd) {
      throw new Error(`Lesson time (${startTime}-${endTime}) doesn't fit within time block (${timeBlock.startTime}-${timeBlock.endTime})`);
    }

    // Check for conflicts with existing lessons in this block
    const hasConflict = timeBlock.assignedLessons.some(lesson => {
      if (!lesson.isActive) return false;
      
      const existingStart = timeToMinutes(lesson.lessonStartTime);
      const existingEnd = timeToMinutes(lesson.lessonEndTime);
      
      return (lessonStart < existingEnd) && (existingStart < lessonEnd);
    });

    if (hasConflict) {
      throw new Error(`Lesson time conflicts with existing assignment in time block`);
    }

    // Check for student schedule conflicts across all teachers
    const hasStudentConflict = await checkStudentScheduleConflict(
      studentId,
      teacherId,
      timeBlock.day,
      startTime,
      duration
    );

    if (hasStudentConflict) {
      throw new Error(`Student already has another lesson at this time`);
    }

    // Create lesson assignment
    const lessonAssignment = {
      _id: new ObjectId(),
      studentId,
      lessonStartTime: startTime,
      lessonEndTime: endTime,
      duration,
      assignmentDate: new Date(),
      isActive: true,
      notes: value.notes || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Add lesson to time block
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
      }
    );

    // Create teacher assignment for student
    const teacherAssignment = {
      teacherId,
      timeBlockId,
      lessonId: lessonAssignment._id.toString(),
      startDate: value.startDate || new Date(),
      endDate: null,
      isActive: true,
      scheduleInfo: {
        day: timeBlock.day,
        startTime,
        endTime,
        duration,
        location: timeBlock.location
      },
      notes: value.notes || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Update student record
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { 
        $push: { teacherAssignments: teacherAssignment },
        $addToSet: { teacherIds: teacherId },
        $set: { updatedAt: new Date() }
      }
    );

    return {
      success: true,
      message: 'Lesson assigned successfully',
      teacherId,
      studentId,
      timeBlockId,
      lessonAssignment,
      teacherAssignment
    };
  } catch (err) {
    console.error(`Error assigning lesson to block: ${err.message}`);
    throw new Error(`Error assigning lesson to block: ${err.message}`);
  }
}

/**
 * Remove a lesson from a time block
 * @param {string} teacherId - Teacher's ID
 * @param {string} timeBlockId - Time block ID
 * @param {string} lessonId - Lesson ID
 * @returns {Promise<object>} - Removal result
 */
async function removeLessonFromBlock(teacherId, timeBlockId, lessonId) {
  try {
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');

    // Find teacher and time block
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
      'teaching.timeBlocks._id': ObjectId.createFromHexString(timeBlockId)
    });

    if (!teacher) {
      throw new Error(`Teacher or time block not found`);
    }

    // Find the time block and lesson
    const timeBlock = teacher.teaching.timeBlocks.find(
      block => block._id.toString() === timeBlockId
    );

    if (!timeBlock) {
      throw new Error(`Time block not found`);
    }

    const lesson = timeBlock.assignedLessons.find(
      lesson => lesson._id.toString() === lessonId
    );

    if (!lesson) {
      throw new Error(`Lesson not found in time block`);
    }

    const studentId = lesson.studentId;

    // Mark lesson as inactive in time block
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
        ]
      }
    );

    // Mark teacher assignment as inactive for student
    await studentCollection.updateOne(
      { 
        _id: ObjectId.createFromHexString(studentId),
        'teacherAssignments.lessonId': lessonId
      },
      { 
        $set: { 
          'teacherAssignments.$[elem].isActive': false,
          'teacherAssignments.$[elem].endDate': new Date(),
          'teacherAssignments.$[elem].updatedAt': new Date()
        }
      },
      {
        arrayFilters: [{ 'elem.lessonId': lessonId, 'elem.isActive': true }]
      }
    );

    // Check if this was the last active lesson with this teacher
    const updatedStudent = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    if (updatedStudent) {
      const hasActiveAssignments = updatedStudent.teacherAssignments?.some(
        assignment => assignment.teacherId === teacherId && assignment.isActive
      );

      // If no more active assignments, remove from teacherIds array
      if (!hasActiveAssignments) {
        await studentCollection.updateOne(
          { _id: ObjectId.createFromHexString(studentId) },
          { $pull: { teacherIds: teacherId } }
        );

        // Also remove student from teacher's studentIds if no active lessons
        const updatedTeacher = await teacherCollection.findOne({
          _id: ObjectId.createFromHexString(teacherId)
        });

        const hasActiveLessons = updatedTeacher.teaching?.timeBlocks?.some(block =>
          block.assignedLessons?.some(lesson => 
            lesson.studentId === studentId && lesson.isActive
          )
        );

        if (!hasActiveLessons) {
          await teacherCollection.updateOne(
            { _id: ObjectId.createFromHexString(teacherId) },
            { $pull: { 'teaching.studentIds': studentId } }
          );
        }
      }
    }

    return {
      success: true,
      message: 'Lesson removed successfully',
      teacherId,
      studentId,
      timeBlockId,
      lessonId
    };
  } catch (err) {
    console.error(`Error removing lesson from block: ${err.message}`);
    throw new Error(`Error removing lesson from block: ${err.message}`);
  }
}

/**
 * Get teacher's complete schedule with time blocks and lessons
 * @param {string} teacherId - Teacher's ID
 * @param {object} options - Options
 * @returns {Promise<object>} - Complete schedule data
 */
async function getTeacherScheduleWithBlocks(teacherId, options = {}) {
  try {
    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
    });

    if (!teacher) {
      throw new Error(`Teacher with id ${teacherId} not found`);
    }

    const timeBlocks = teacher.teaching?.timeBlocks || [];
    
    // Group time blocks by day
    const weeklySchedule = {
      'ראשון': [],
      'שני': [],
      'שלישי': [],
      'רביעי': [],
      'חמישי': [],
      'שישי': [],
    };

    // Populate time blocks
    timeBlocks.forEach(block => {
      if (block.isActive) {
        const blockWithUtilization = {
          ...block,
          utilization: calculateBlockUtilization(block)
        };

        // Include student info if requested
        if (options.includeStudentInfo) {
          blockWithUtilization.assignedLessons = block.assignedLessons.map(lesson => ({
            ...lesson,
            studentInfo: null // Will be populated separately
          }));
        }

        weeklySchedule[block.day].push(blockWithUtilization);
      }
    });

    // Sort blocks by start time within each day
    Object.keys(weeklySchedule).forEach(day => {
      weeklySchedule[day].sort((a, b) => {
        const timeA = timeToMinutes(a.startTime);
        const timeB = timeToMinutes(b.startTime);
        return timeA - timeB;
      });
    });

    // Get student information if requested
    if (options.includeStudentInfo) {
      const studentCollection = await getCollection('student');
      const allStudentIds = [...new Set(
        timeBlocks.flatMap(block => 
          block.assignedLessons
            .filter(lesson => lesson.isActive)
            .map(lesson => lesson.studentId)
        )
      )];

      if (allStudentIds.length > 0) {
        const students = await studentCollection
          .find({ 
            _id: { $in: allStudentIds.map(id => ObjectId.createFromHexString(id)) }
          })
          .project({ 
            _id: 1, 
            'personalInfo.fullName': 1,
            'academicInfo.instrumentProgress': 1 
          })
          .toArray();

        const studentLookup = students.reduce((acc, student) => {
          acc[student._id.toString()] = {
            fullName: student.personalInfo?.fullName,
            instrument: student.academicInfo?.instrumentProgress?.find(i => i.isPrimary)?.instrumentName
          };
          return acc;
        }, {});

        // Attach student info to lessons
        Object.keys(weeklySchedule).forEach(day => {
          weeklySchedule[day].forEach(block => {
            if (block.assignedLessons) {
              block.assignedLessons.forEach(lesson => {
                if (lesson.studentId && studentLookup[lesson.studentId]) {
                  lesson.studentInfo = studentLookup[lesson.studentId];
                }
              });
            }
          });
        });
      }
    }

    return {
      teacherId,
      teacherName: teacher.personalInfo?.fullName,
      weeklySchedule,
      statistics: calculateScheduleStatistics(timeBlocks)
    };
  } catch (err) {
    console.error(`Error getting teacher schedule with blocks: ${err.message}`);
    throw new Error(`Error getting teacher schedule with blocks: ${err.message}`);
  }
}

/**
 * Find optimal lesson slot for student preferences
 * @param {string} teacherId - Teacher's ID
 * @param {number} duration - Lesson duration
 * @param {object} preferences - Student preferences
 * @returns {Promise<object>} - Optimal slot recommendation
 */
async function findOptimalSlot(teacherId, duration, preferences = {}) {
  try {
    const availableSlots = await calculateAvailableSlots(teacherId, duration, preferences);
    
    if (availableSlots.length === 0) {
      return {
        success: false,
        message: 'No available slots found for the requested duration and preferences',
        alternatives: await calculateAvailableSlots(teacherId, duration) // Without preferences
      };
    }

    // Score slots based on preferences
    const scoredSlots = availableSlots.map(slot => ({
      ...slot,
      score: calculateSlotScore(slot, preferences)
    }));

    // Sort by score (highest first)
    scoredSlots.sort((a, b) => b.score - a.score);

    return {
      success: true,
      optimalSlot: scoredSlots[0],
      alternatives: scoredSlots.slice(1, 5), // Top 5 alternatives
      totalOptions: scoredSlots.length
    };
  } catch (err) {
    console.error(`Error finding optimal slot: ${err.message}`);
    throw new Error(`Error finding optimal slot: ${err.message}`);
  }
}

/**
 * Validate time block conflicts
 * @param {string} teacherId - Teacher's ID
 * @param {string} day - Day of week
 * @param {string} startTime - Start time
 * @param {string} endTime - End time
 * @param {string} excludeBlockId - Block ID to exclude from check
 * @returns {Promise<boolean>} - Whether there's a conflict
 */
async function validateTimeBlockConflicts(teacherId, day, startTime, endTime, excludeBlockId = null) {
  try {
    const teacherCollection = await getCollection('teacher');
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
    });

    if (!teacher || !teacher.teaching?.timeBlocks) {
      return false;
    }

    const newStart = timeToMinutes(startTime);
    const newEnd = timeToMinutes(endTime);

    return teacher.teaching.timeBlocks.some(block => {
      if (!block.isActive || block.day !== day) return false;
      if (excludeBlockId && block._id.toString() === excludeBlockId) return false;

      const blockStart = timeToMinutes(block.startTime);
      const blockEnd = timeToMinutes(block.endTime);

      // Check for overlap
      return (newStart < blockEnd) && (blockStart < newEnd);
    });
  } catch (err) {
    console.error(`Error validating time block conflicts: ${err.message}`);
    return true; // Err on the side of caution
  }
}

// Helper functions

function calculateDuration(startTime, endTime) {
  return timeToMinutes(endTime) - timeToMinutes(startTime);
}

function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

function addMinutesToTime(timeString, minutes) {
  const totalMinutes = timeToMinutes(timeString) + minutes;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function calculateAvailableSegments(timeBlock, requestedDuration) {
  const blockStart = timeToMinutes(timeBlock.startTime);
  const blockEnd = timeToMinutes(timeBlock.endTime);
  
  // Get all active lesson times
  const busyPeriods = timeBlock.assignedLessons
    .filter(lesson => lesson.isActive)
    .map(lesson => ({
      start: timeToMinutes(lesson.lessonStartTime),
      end: timeToMinutes(lesson.lessonEndTime)
    }))
    .sort((a, b) => a.start - b.start);

  const availableSegments = [];
  let currentStart = blockStart;

  for (const busy of busyPeriods) {
    // Check if there's a gap before this busy period
    if (currentStart + requestedDuration <= busy.start) {
      availableSegments.push({
        start: currentStart,
        end: busy.start,
        duration: busy.start - currentStart
      });
    }
    currentStart = Math.max(currentStart, busy.end);
  }

  // Check for segment after last busy period
  if (currentStart + requestedDuration <= blockEnd) {
    availableSegments.push({
      start: currentStart,
      end: blockEnd,
      duration: blockEnd - currentStart
    });
  }

  return availableSegments.filter(segment => segment.duration >= requestedDuration);
}

function generateLessonSlots(segment, duration, timeBlock) {
  const slots = [];
  const segmentStart = segment.start;
  const segmentEnd = segment.end;
  
  // Generate slots at 15-minute intervals
  for (let start = segmentStart; start + duration <= segmentEnd; start += 15) {
    const startTime = minutesToTime(start);
    const endTime = minutesToTime(start + duration);
    
    slots.push({
      timeBlockId: timeBlock._id.toString(),
      day: timeBlock.day,
      startTime,
      endTime,
      duration,
      location: timeBlock.location,
      blockStart: timeBlock.startTime,
      blockEnd: timeBlock.endTime
    });
  }
  
  return slots;
}

function minutesToTime(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function sortSlotsByPreference(slots, preferences) {
  return slots.sort((a, b) => {
    // Earlier times preferred by default
    const timeA = timeToMinutes(a.startTime);
    const timeB = timeToMinutes(b.startTime);
    
    // Apply preference scoring
    let scoreA = 0;
    let scoreB = 0;
    
    if (preferences.preferredStartTime) {
      const preferred = timeToMinutes(preferences.preferredStartTime);
      scoreA -= Math.abs(timeA - preferred);
      scoreB -= Math.abs(timeB - preferred);
    } else {
      // Default preference for earlier times
      scoreA -= timeA * 0.1;
      scoreB -= timeB * 0.1;
    }
    
    return scoreB - scoreA;
  });
}

function calculateBlockUtilization(timeBlock) {
  const totalDuration = timeBlock.totalDuration;
  const usedDuration = timeBlock.assignedLessons
    .filter(lesson => lesson.isActive)
    .reduce((sum, lesson) => sum + lesson.duration, 0);
  
  return {
    totalMinutes: totalDuration,
    usedMinutes: usedDuration,
    availableMinutes: totalDuration - usedDuration,
    utilizationPercentage: totalDuration > 0 ? (usedDuration / totalDuration) * 100 : 0
  };
}

function calculateScheduleStatistics(timeBlocks) {
  const activeBlocks = timeBlocks.filter(block => block.isActive);
  
  const totalMinutes = activeBlocks.reduce((sum, block) => sum + block.totalDuration, 0);
  const usedMinutes = activeBlocks.reduce((sum, block) => 
    sum + block.assignedLessons
      .filter(lesson => lesson.isActive)
      .reduce((lessonSum, lesson) => lessonSum + lesson.duration, 0), 0);
  
  return {
    totalBlocks: activeBlocks.length,
    totalHours: Math.round(totalMinutes / 60 * 100) / 100,
    usedHours: Math.round(usedMinutes / 60 * 100) / 100,
    utilizationPercentage: totalMinutes > 0 ? Math.round((usedMinutes / totalMinutes) * 100) : 0,
    averageBlockSize: activeBlocks.length > 0 ? Math.round(totalMinutes / activeBlocks.length) : 0
  };
}

function calculateSlotScore(slot, preferences) {
  let score = 100; // Base score
  
  // Prefer earlier times by default
  const slotTime = timeToMinutes(slot.startTime);
  score -= slotTime * 0.01; // Small penalty for later times
  
  // Apply preference bonuses
  if (preferences.preferredStartTime) {
    const preferred = timeToMinutes(preferences.preferredStartTime);
    const timeDiff = Math.abs(slotTime - preferred);
    score += Math.max(0, 50 - timeDiff); // Bonus for being close to preferred time
  }
  
  if (preferences.preferredDays && preferences.preferredDays.includes(slot.day)) {
    score += 25; // Bonus for preferred day
  }
  
  return score;
}

// Check student schedule conflicts across all teachers
async function checkStudentScheduleConflict(studentId, excludeTeacherId, day, startTime, duration) {
  const teacherCollection = await getCollection('teacher');
  
  const teachers = await teacherCollection
    .find({ 'teaching.timeBlocks.assignedLessons.studentId': studentId })
    .toArray();

  const lessonStart = timeToMinutes(startTime);
  const lessonEnd = lessonStart + duration;

  for (const teacher of teachers) {
    if (teacher._id.toString() === excludeTeacherId) continue;

    // Check time block conflicts
    if (teacher.teaching?.timeBlocks) {
      for (const block of teacher.teaching.timeBlocks) {
        if (block.day !== day || !block.isActive) continue;
        
        const blockConflicts = block.assignedLessons.filter(lesson => {
          if (lesson.studentId !== studentId || !lesson.isActive) return false;
          
          const lessonStartTime = timeToMinutes(lesson.lessonStartTime);
          const lessonEndTime = timeToMinutes(lesson.lessonEndTime);
          
          return (lessonStart < lessonEndTime) && (lessonStartTime < lessonEnd);
        });
        
        if (blockConflicts.length > 0) return true;
      }
    }
  }
  
  return false;
}