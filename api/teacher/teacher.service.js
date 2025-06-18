import { getCollection } from '../../services/mongoDB.service.js';
import {
  validateTeacher,
  validateTeacherUpdate,
} from './teacher.validation.js';
import { ObjectId } from 'mongodb';
import { authService } from '../auth/auth.service.js';

export const teacherService = {
  getTeachers,
  getTeacherById,
  addTeacher,
  updateTeacher,
  removeTeacher,
  getTeacherByRole,
  updateTeacherSchedule,
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

async function addTeacher(teacherToAdd) {
  try {
    const { error, value } = validateTeacher(teacherToAdd);
    if (error) throw new Error(`Invalid teacher data: ${error.message}`);

    value.credentials.password = await authService.encryptPassword(
      value.credentials.password
    );

    value.createdAt = new Date();
    value.updatedAt = new Date();

    const collection = await getCollection('teacher');
    const result = await collection.insertOne(value);
    return { _id: result.insertedId, ...value };
  } catch (err) {
    console.error(`Error adding teacher: ${err.message}`);
    throw new Error(`Error adding teacher: ${err.message}`);
  }
}

async function updateTeacher(teacherId, teacherToUpdate) {
  try {
    console.log('Updating teacher with data:', JSON.stringify(teacherToUpdate));

    // Use the update validation schema instead of the full schema
    const { error, value } = validateTeacherUpdate(teacherToUpdate);
    if (error) throw new Error(`Invalid teacher data: ${error.message}`);

    // If password is provided, encrypt it
    if (value.credentials && value.credentials.password) {
      value.credentials.password = await authService.encryptPassword(
        value.credentials.password
      );
    }

    value.updatedAt = new Date();

    const collection = await getCollection('teacher');
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(teacherId) },
      { $set: value },
      { returnDocument: 'after' }
    );

    if (!result) throw new Error(`Teacher with id ${teacherId} not found`);
    return result;
  } catch (err) {
    console.error(`Error updating teacher: ${err.message}`);
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
  // Validate that all required fields have values
  const { studentId, day, startTime, duration } = scheduleData;

  if (!studentId || !day || !startTime || !duration) {
    throw new Error(
      'Schedule data is incomplete: all fields (studentId, day, startTime, duration) are required'
    );
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

  const collection = await getCollection('teacher');
  
  // First check for time conflicts
  const teacher = await collection.findOne({
    _id: ObjectId.createFromHexString(teacherId),
  });
  
  if (teacher) {
    const hasConflict = checkScheduleConflict(teacher.teaching?.schedule || [], scheduleSlot);
    if (hasConflict) {
      throw new Error('Time slot conflicts with an existing slot');
    }
  }
  
  // Update the teacher's schedule
  return await collection.updateOne(
    { _id: ObjectId.createFromHexString(teacherId) },
    {
      $addToSet: { 'teaching.studentIds': studentId },
      $push: {
        'teaching.schedule': scheduleSlot,
      },
    }
  );
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

// Helper function to calculate end time based on start time and duration
function calculateEndTime(startTime, durationMinutes) {
  const [hours, minutes] = startTime.split(':').map(Number);
  
  let totalMinutes = hours * 60 + minutes + durationMinutes;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
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
