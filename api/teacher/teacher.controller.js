import { teacherService } from './teacher.service.js';
import { teacherLessonsService } from './teacher-lessons.service.js';

export const teacherController = {
  getTeachers,
  getTeacherById,
  getMyProfile,
  updateMyProfile,
  getTeacherIds,
  addTeacher,
  updateTeacher,
  removeTeacher,
  getTeacherByRole,
  updateTeacherSchedule,
  // Student management
  addStudentToTeacher,
  removeStudentFromTeacher,
  // New lesson-focused endpoints
  getTeacherLessons,
  getTeacherWeeklySchedule,
  getTeacherDaySchedule,
  getTeacherLessonStats,
  getTeacherStudentsWithLessons,
  validateTeacherLessonData,
  // Time block management
  getTimeBlocks,
  createTimeBlock,
  updateTimeBlock,
  deleteTimeBlock,
}

async function getTeachers(req, res, next) {
  try {
    const filterBy = {
      name: req.query.name,
      instrument: req.query.instrument,
      role: req.query.role,
      studentId: req.query.studentId,
      orchestraId: req.query.orchestraId,
      ensembleId: req.query.ensembleId,
      isActive: req.query.isActive,
      showInActive: req.query.showInActive === 'true'
    };

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 0; // 0 means no pagination (return all)

    const result = await teacherService.getTeachers(filterBy, page, limit);
    res.json(result);
  } catch (err) {
    next(err)
  }
}

async function getTeacherById(req, res, next) {
  try {
    const { id } = req.params;
    console.log(`Controller: Getting teacher by ID: ${id}`);
    
    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Teacher ID is required',
        code: 'MISSING_TEACHER_ID'
      });
    }
    
    const teacher = await teacherService.getTeacherById(id);
    
    res.json({
      success: true,
      data: teacher
    });
  } catch (err) {
    console.error(`Controller error getting teacher by ID: ${err.message}`);
    
    if (err.message.includes('Invalid teacher ID format')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid teacher ID format',
        code: 'INVALID_TEACHER_ID'
      });
    }
    
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Teacher not found',
        code: 'TEACHER_NOT_FOUND'
      });
    }
    
    next(err);
  }
}

async function getMyProfile(req, res, next) {
  try {
    // Get the authenticated user's ID from the token
    const teacherId = req.teacher._id.toString();
    console.log(`Getting profile for authenticated teacher: ${teacherId}`);
    
    const teacher = await teacherService.getTeacherById(teacherId);
    
    res.json({
      success: true,
      data: teacher
    });
  } catch (err) {
    console.error(`Error getting teacher profile: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Teacher profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }
    
    next(err);
  }
}

async function updateMyProfile(req, res, next) {
  try {
    // Get the authenticated user's ID from the token
    const teacherId = req.teacher._id.toString();
    console.log(`Updating profile for authenticated teacher: ${teacherId}`);
    console.log('Request body received:', JSON.stringify(req.body, null, 2));
    
    const updatedTeacher = await teacherService.updateTeacher(teacherId, req.body);
    
    res.json({
      success: true,
      data: updatedTeacher,
      message: 'Profile updated successfully'
    });
  } catch (err) {
    console.error(`Error updating teacher profile: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Teacher profile not found',
        code: 'PROFILE_NOT_FOUND'
      });
    }
    
    if (err.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid profile data',
        code: 'VALIDATION_ERROR',
        details: err.message
      });
    }
    
    next(err);
  }
}

async function getTeacherIds(req, res, next) {
  try {
    const teachers = await teacherService.getTeacherIds();
    
    res.json({
      success: true,
      data: {
        count: teachers.length,
        teachers: teachers
      }
    });
  } catch (err) {
    console.error(`Error getting teacher IDs: ${err.message}`);
    next(err);
  }
}

async function addTeacher(req, res, next) { 
  try {
    console.log('=== ADD TEACHER CONTROLLER ===');
    console.log('Request method:', req.method);
    console.log('Request path:', req.path);
    console.log('Request body keys:', Object.keys(req.body));
    console.log('Admin user:', req.teacher?._id);
    console.log('Is admin flag:', req.isAdmin);
    console.log('=================================');
    
    const teacherToAdd = req.body
    const adminId = req.teacher?._id // Get admin ID from authenticated user
    const addedTeacher = await teacherService.addTeacher(teacherToAdd, adminId)
    
    // Check if there are warnings (non-blocking duplicates)
    if (addedTeacher.warnings) {
      return res.status(201).json({
        success: true,
        data: addedTeacher,
        warnings: addedTeacher.warnings
      });
    }
    
    res.status(201).json({ success: true, data: addedTeacher })
  } catch (err) {
    console.error(`Error adding teacher: ${err.message}`);

    // Handle validation errors - parse field-level errors from the message
    if (err.message && err.message.startsWith('Error adding teacher: Invalid teacher data:')) {
      const validationErrors = {};
      const errorParts = err.message.replace('Error adding teacher: Invalid teacher data: ', '').split('. ');

      errorParts.forEach(part => {
        const fieldMatch = part.match(/"([^"]+)"/);
        if (fieldMatch) {
          const fieldPath = fieldMatch[1];
          const message = part.replace(`"${fieldPath}" `, '');
          validationErrors[fieldPath] = message;
        }
      });

      return res.status(400).json({
        error: 'שגיאת אימות נתונים',
        code: 'VALIDATION_ERROR',
        validationErrors: validationErrors,
        message: err.message
      });
    }

    // Handle duplicate detection errors
    if (err.code === 'DUPLICATE_TEACHER_DETECTED') {
      return res.status(409).json({
        error: 'Duplicate teacher detected',
        code: 'DUPLICATE_TEACHER_DETECTED',
        details: err.duplicateInfo
      });
    }

    // Handle email duplicate errors
    if (err.code === 'EMAIL_DUPLICATE') {
      return res.status(409).json({
        error: err.message,
        code: 'EMAIL_DUPLICATE',
        suggestion: 'A teacher with this email already exists. Please check if you need to resend invitation or update existing teacher.'
      });
    }

    next(err)
  }
}

async function updateTeacher(req, res, next) {
  try {
    const { id } = req.params
    const teacherToUpdate = req.body
    const updatedTeacher = await teacherService.updateTeacher(id, teacherToUpdate)
    res.json({ success: true, data: updatedTeacher })
  } catch (err) {
    console.error(`Error updating teacher: ${err.message}`);

    // Handle validation errors - parse field-level errors from the message
    if (err.message && err.message.startsWith('Invalid teacher data:')) {
      // Extract field errors from Joi-style error message
      const validationErrors = {};
      const errorParts = err.message.replace('Invalid teacher data: ', '').split('. ');

      errorParts.forEach(part => {
        // Match patterns like "personalInfo.email" must be a valid email
        const fieldMatch = part.match(/"([^"]+)"/);
        if (fieldMatch) {
          const fieldPath = fieldMatch[1];
          const message = part.replace(`"${fieldPath}" `, '');
          validationErrors[fieldPath] = message;
        }
      });

      return res.status(400).json({
        error: 'שגיאת אימות נתונים',
        code: 'VALIDATION_ERROR',
        validationErrors: validationErrors,
        message: err.message
      });
    }

    // Handle duplicate detection errors
    if (err.code === 'DUPLICATE_TEACHER_DETECTED') {
      return res.status(409).json({
        error: 'Duplicate teacher detected',
        code: 'DUPLICATE_TEACHER_DETECTED',
        details: err.duplicateInfo
      });
    }

    // Handle email duplicate errors
    if (err.code === 'EMAIL_DUPLICATE') {
      return res.status(409).json({
        error: err.message,
        code: 'EMAIL_DUPLICATE',
        suggestion: 'A teacher with this email already exists. Please check if you need to resend invitation or update existing teacher.'
      });
    }

    next(err)
  }
}

async function removeTeacher(req, res, next) { 
  try {
    const { id } = req.params
    const removedTeacher = await teacherService.removeTeacher(id)
    res.json(removedTeacher)
  } catch (err) {
    next(err)
  }
}

async function getTeacherByRole(req, res, next) {
  try {
    const { role } = req.params
    const teachers = await teacherService.getTeacherByRole(role)
    res.json(teachers)
  } catch (err) {
    next(err)
  }
}

async function updateTeacherSchedule(req, res, next) {
   try {
    const { id: teacherId } = req.params
    const scheduleData = req.body
    
    const result = await teacherService.updateTeacherSchedule(teacherId, scheduleData)
    res.json(result)
  } catch (err) {
    next(err)
  }
}

// ===== NEW LESSON-FOCUSED ENDPOINTS =====
// These implement the single source of truth approach using student teacherAssignments

/**
 * Get all lessons for a teacher (from student records)
 * @route GET /api/teachers/:teacherId/lessons
 */
async function getTeacherLessons(req, res, next) {
  try {
    const { teacherId } = req.params;
    const options = {
      day: req.query.day,
      studentId: req.query.studentId,
      includeInactive: req.query.includeInactive === 'true'
    };

    // Verify permission (teachers can only view their own lessons unless admin)
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view lessons for this teacher',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    console.log(`🔍 Getting lessons for teacher ${teacherId} using new single source approach`);
    
    const lessons = await teacherLessonsService.getTeacherLessons(teacherId, options);

    res.json({
      success: true,
      data: {
        teacherId,
        lessons,
        count: lessons.length,
        source: 'student_teacherAssignments' // Indicate data source
      }
    });

  } catch (err) {
    console.error(`❌ Error getting teacher lessons: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Teacher not found',
        code: 'TEACHER_NOT_FOUND'
      });
    }
    
    if (err.message.includes('Invalid teacher ID')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid teacher ID format',
        code: 'INVALID_TEACHER_ID'
      });
    }

    next(err);
  }
}

/**
 * Get teacher's weekly schedule organized by days
 * @route GET /api/teachers/:teacherId/weekly-schedule
 */
async function getTeacherWeeklySchedule(req, res, next) {
  try {
    const { teacherId } = req.params;
    const options = {
      includeStudentInfo: req.query.includeStudentInfo !== 'false',
      includeInactive: req.query.includeInactive === 'true'
    };

    // Verify permission
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view this teacher\'s schedule',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    console.log(`📅 Getting weekly schedule for teacher ${teacherId}`);
    
    const weeklySchedule = await teacherLessonsService.getTeacherWeeklySchedule(teacherId, options);

    res.json({
      success: true,
      data: weeklySchedule,
      message: 'Schedule retrieved from student assignments (single source of truth)'
    });

  } catch (err) {
    console.error(`❌ Error getting weekly schedule: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Teacher not found',
        code: 'TEACHER_NOT_FOUND'
      });
    }

    next(err);
  }
}

/**
 * Get teacher's schedule for a specific day
 * @route GET /api/teachers/:teacherId/day-schedule/:day
 */
async function getTeacherDaySchedule(req, res, next) {
  try {
    const { teacherId, day } = req.params;

    // Verify permission
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view this teacher\'s schedule',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    console.log(`📅 Getting ${day} schedule for teacher ${teacherId}`);
    
    const daySchedule = await teacherLessonsService.getTeacherDaySchedule(teacherId, day);

    res.json({
      success: true,
      data: {
        teacherId,
        day,
        lessons: daySchedule,
        count: daySchedule.length
      }
    });

  } catch (err) {
    console.error(`❌ Error getting day schedule: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Teacher not found',
        code: 'TEACHER_NOT_FOUND'
      });
    }

    next(err);
  }
}

/**
 * Get lesson statistics for a teacher
 * @route GET /api/teachers/:teacherId/lesson-stats
 */
async function getTeacherLessonStats(req, res, next) {
  try {
    const { teacherId } = req.params;

    // Verify permission
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view this teacher\'s statistics',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    console.log(`📊 Getting lesson statistics for teacher ${teacherId}`);
    
    const stats = await teacherLessonsService.getTeacherLessonStats(teacherId);

    res.json({
      success: true,
      data: {
        teacherId,
        statistics: stats,
        generatedAt: new Date()
      }
    });

  } catch (err) {
    console.error(`❌ Error getting lesson stats: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Teacher not found',
        code: 'TEACHER_NOT_FOUND'
      });
    }

    next(err);
  }
}

/**
 * Get all students with their lesson details for a teacher
 * @route GET /api/teachers/:teacherId/students-with-lessons
 */
async function getTeacherStudentsWithLessons(req, res, next) {
  try {
    const { teacherId } = req.params;

    // Verify permission
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to view this teacher\'s students',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    console.log(`👥 Getting students with lessons for teacher ${teacherId}`);
    
    const students = await teacherLessonsService.getTeacherStudentsWithLessons(teacherId);

    res.json({
      success: true,
      data: {
        teacherId,
        students,
        totalStudents: students.length,
        totalLessons: students.reduce((sum, student) => sum + student.lessons.length, 0)
      }
    });

  } catch (err) {
    console.error(`❌ Error getting students with lessons: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Teacher not found',
        code: 'TEACHER_NOT_FOUND'
      });
    }

    next(err);
  }
}

/**
 * Validate teacher lesson data consistency
 * @route GET /api/teachers/:teacherId/validate-lessons
 */
async function validateTeacherLessonData(req, res, next) {
  try {
    const { teacherId } = req.params;

    // Only allow admin or the teacher themselves to validate
    if (!req.isAdmin && req.teacher._id.toString() !== teacherId) {
      return res.status(403).json({
        success: false,
        error: 'You are not authorized to validate this teacher\'s lesson data',
        code: 'UNAUTHORIZED_ACCESS'
      });
    }

    console.log(`🔍 Validating lesson data for teacher ${teacherId}`);
    
    const validation = await teacherLessonsService.validateTeacherLessonData(teacherId);

    const statusCode = validation.isValid ? 200 : 400;
    
    res.status(statusCode).json({
      success: validation.isValid,
      data: validation,
      message: validation.isValid ? 
        'All lesson data is consistent' : 
        `Found ${validation.issues.length} consistency issues`
    });

  } catch (err) {
    console.error(`❌ Error validating lesson data: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Teacher not found',
        code: 'TEACHER_NOT_FOUND'
      });
    }

    next(err);
  }
}

/**
 * Add student to teacher
 * @route POST /api/teacher/:teacherId/student/:studentId
 */
async function addStudentToTeacher(req, res, next) {
  try {
    const { teacherId, studentId } = req.params;
    
    console.log(`➕ Adding student ${studentId} to teacher ${teacherId}`);
    
    const result = await teacherService.addStudentToTeacher(teacherId, studentId);
    
    res.status(200).json({
      success: true,
      data: result,
      message: 'Student added to teacher successfully'
    });

  } catch (err) {
    console.error(`❌ Error adding student to teacher: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: err.message,
        code: 'RESOURCE_NOT_FOUND'
      });
    }

    next(err);
  }
}

/**
 * Remove student from teacher
 * @route DELETE /api/teacher/:teacherId/student/:studentId
 */
async function removeStudentFromTeacher(req, res, next) {
  try {
    const { teacherId, studentId } = req.params;
    
    console.log(`➖ Removing student ${studentId} from teacher ${teacherId}`);
    
    const result = await teacherService.removeStudentFromTeacher(teacherId, studentId);
    
    res.status(200).json({
      success: true,
      data: result,
      message: 'Student removed from teacher successfully'
    });

  } catch (err) {
    console.error(`❌ Error removing student from teacher: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: err.message,
        code: 'RESOURCE_NOT_FOUND'
      });
    }

    next(err);
  }
}

// Time Block Management Controllers
async function getTimeBlocks(req, res, next) {
  try {
    const { teacherId } = req.params;
    const timeBlocks = await teacherService.getTimeBlocks(teacherId);

    res.json({
      success: true,
      data: timeBlocks
    });
  } catch (err) {
    console.error(`Error getting time blocks: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: err.message,
        code: 'TEACHER_NOT_FOUND'
      });
    }

    next(err);
  }
}

async function createTimeBlock(req, res, next) {
  try {
    const { teacherId } = req.params;
    const timeBlockData = req.body;

    const timeBlock = await teacherService.createTimeBlock(teacherId, timeBlockData);

    res.status(201).json({
      success: true,
      data: timeBlock,
      message: 'Time block created successfully'
    });
  } catch (err) {
    console.error(`Error creating time block: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: err.message,
        code: 'TEACHER_NOT_FOUND'
      });
    }

    if (err.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        error: err.message,
        code: 'VALIDATION_ERROR'
      });
    }

    next(err);
  }
}

async function updateTimeBlock(req, res, next) {
  try {
    const { teacherId, timeBlockId } = req.params;
    const timeBlockData = req.body;

    const result = await teacherService.updateTimeBlock(teacherId, timeBlockId, timeBlockData);

    res.json({
      success: true,
      data: result,
      message: 'Time block updated successfully'
    });
  } catch (err) {
    console.error(`Error updating time block: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: err.message,
        code: 'RESOURCE_NOT_FOUND'
      });
    }

    if (err.message.includes('validation')) {
      return res.status(400).json({
        success: false,
        error: err.message,
        code: 'VALIDATION_ERROR'
      });
    }

    next(err);
  }
}

async function deleteTimeBlock(req, res, next) {
  try {
    const { teacherId, timeBlockId } = req.params;

    const result = await teacherService.deleteTimeBlock(teacherId, timeBlockId);

    res.json({
      success: true,
      data: result,
      message: 'Time block deleted successfully'
    });
  } catch (err) {
    console.error(`Error deleting time block: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: err.message,
        code: 'RESOURCE_NOT_FOUND'
      });
    }

    next(err);
  }
}