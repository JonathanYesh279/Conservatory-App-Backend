import { teacherService } from './teacher.service.js'

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
}

async function getTeachers(req, res, next) {
  try {
    const filterBy = {
      name: req.query.name,
      role: req.query.role,
      studentId: req.query.studentId,
      orchestraId: req.query.orchestraId,
      ensembleId: req.query.ensembleId,
      isActive: req.query.isActive,
      showInActive: req.query.showInActive === 'true'
    }
    const teachers = await teacherService.getTeachers(filterBy)
    res.json(teachers)
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