import { theoryService } from './theory.service.js';
import ConflictDetectionService from '../../services/conflictDetectionService.js';
import { sendErrorResponse, sendSuccessResponse, formatConflictResponse } from '../../utils/errorResponses.js';
import { isValidTimeFormat, isValidTimeRange } from '../../utils/timeUtils.js';
import {
  validateTheoryBulkDeleteByDate,
  validateTheoryBulkDeleteByCategory,
  validateTheoryBulkDeleteByTeacher
} from './theory.validation.js';
import { TheoryLessonValidationService } from '../../services/theoryLessonValidationService.js';

export const theoryController = {
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

async function getTheoryLessons(req, res, next) {
  try {
    console.log('🎯 Theory Controller: GET /api/theory called');
    console.log('📝 Theory Controller: Query parameters:', req.query);
    console.log('🌐 Theory Controller: Original URL:', req.originalUrl);
    console.log('👤 Theory Controller: User info:', {
      userId: req.loggedinUser?._id || req.teacher?._id,
      roles: req.loggedinUser?.roles || req.teacher?.roles,
      schoolYear: req.schoolYear?._id
    });

    // Check if schoolYearId was originally provided in the request
    const originalSchoolYearId = req.originalUrl.includes('schoolYearId') ? req.query.schoolYearId : null;
    console.log('🏫 Theory Controller: Original schoolYearId in request:', originalSchoolYearId);

    const filterBy = {};

    // Only add filters that have actual values
    if (req.query.category) filterBy.category = req.query.category;
    if (req.query.teacherId) filterBy.teacherId = req.query.teacherId;
    if (req.query.studentId) filterBy.studentId = req.query.studentId;
    if (req.query.fromDate) filterBy.fromDate = req.query.fromDate;
    if (req.query.toDate) filterBy.toDate = req.query.toDate;
    if (req.query.dayOfWeek !== undefined) filterBy.dayOfWeek = req.query.dayOfWeek;
    if (req.query.location) filterBy.location = req.query.location;

    // Only apply school year filtering if explicitly provided by the client
    if (originalSchoolYearId) {
      filterBy.schoolYearId = originalSchoolYearId;
    }

    // Extract pagination parameters
    const paginationOptions = {
      page: req.query.page,
      limit: req.query.limit,
      sortField: req.query.sortField,
      sortOrder: req.query.sortOrder
    };

    console.log('🔧 Theory Controller: Built filter object:', JSON.stringify(filterBy, null, 2));
    console.log('📄 Theory Controller: Pagination options:', JSON.stringify(paginationOptions, null, 2));

    const result = await theoryService.getTheoryLessons(filterBy, paginationOptions);
    const { data: theoryLessons, pagination } = result;

    // Validate and sanitize lesson data before sending to frontend
    let validatedLessons = [];

    if (theoryLessons && theoryLessons.length > 0) {
      try {
        validatedLessons = theoryLessons.map(lesson => {
          try {
            return TheoryLessonValidationService.sanitizeForResponse(lesson);
          } catch (validationError) {
            console.warn(`Skipping invalid lesson: ${validationError.message}`, lesson);
            return null;
          }
        }).filter(lesson => lesson !== null);

        console.log(`📊 Theory Controller: Validated ${validatedLessons.length} of ${theoryLessons.length} theory lessons`);
      } catch (validationError) {
        console.error('Error validating theory lessons:', validationError);
        return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: 'Error processing theory lessons data' }]);
      }
    }

    // If no lessons found, return appropriate message
    if (validatedLessons.length === 0 && Object.keys(filterBy).length > 0) {
      return res.status(200).json({
        success: true,
        data: [],
        message: 'No theory lessons found matching the specified criteria',
        filters: filterBy,
        pagination
      });
    }

    console.log('📊 Theory Controller: Returning', validatedLessons.length, 'validated theory lessons');
    res.json({
      success: true,
      data: validatedLessons,
      count: validatedLessons.length,
      filters: filterBy,
      pagination
    });
  } catch (err) {
    console.error(`Error in getTheoryLessons controller: ${err.message}`);

    // Enhanced error handling with specific messages
    if (err.message.includes('database') || err.message.includes('connection')) {
      return sendErrorResponse(res, 'DATABASE_ERROR', 'Unable to retrieve theory lessons due to database connectivity issues');
    }

    if (err.message.includes('filter') || err.message.includes('query')) {
      return sendErrorResponse(res, 'INVALID_FILTER', 'Invalid filter parameters provided');
    }

    next(err);
  }
}

async function getTheoryLessonById(req, res, next) {
  try {
    const { id } = req.params;

    if (!id || id === 'null' || id === 'undefined' || id === 'None') {
      return res.status(400).json({
        success: false,
        error: 'Valid theory lesson ID is required',
        toast: {
          type: 'error',
          message: 'No lesson selected. Please select a valid lesson to view details.',
          title: 'No Lesson Selected',
          duration: 3000,
          position: 'bottom-left'
        }
      });
    }

    // Validate ID format
    try {
      TheoryLessonValidationService.validateId(id);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid lesson ID format',
        toast: {
          type: 'error',
          message: 'The lesson ID provided is not valid. Please try again.',
          title: 'Invalid Lesson ID',
          duration: 3000,
          position: 'bottom-left'
        }
      });
    }

    const theoryLesson = await theoryService.getTheoryLessonById(id);

    // Validate and sanitize the lesson data
    const validatedLesson = TheoryLessonValidationService.sanitizeForResponse(theoryLesson);

    res.json({
      success: true,
      data: validatedLesson
    });
  } catch (err) {
    console.error(`Error in getTheoryLessonById controller: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Theory lesson not found',
        toast: {
          type: 'error',
          message: 'The requested theory lesson could not be found. It may have been deleted or moved.',
          title: 'Lesson Not Found',
          duration: 5000,
          position: 'bottom-left'
        }
      });
    }

    if (err.message.includes('validation') || err.message.includes('invalid')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid lesson data',
        toast: {
          type: 'error',
          message: 'The lesson data is incomplete or invalid. Please contact support if this problem persists.',
          title: 'Data Error',
          duration: 5000,
          position: 'bottom-left'
        }
      });
    }

    next(err);
  }
}

async function getTheoryLessonsByCategory(req, res, next) {
  try {
    const { category } = req.params;

    if (!category || category === 'null' || category === 'undefined' || category === 'None') {
      return res.status(400).json({
        success: false,
        error: 'Theory lesson category is required',
        toast: {
          type: 'error',
          message: 'No lesson category selected. Please select a valid category to view lessons.',
          title: 'No Category Selected',
          duration: 3000,
          position: 'bottom-left'
        }
      });
    }

    // Validate category
    try {
      TheoryLessonValidationService.validateCategory(category);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category format',
        toast: {
          type: 'error',
          message: 'The lesson category provided is not valid. Please select a different category.',
          title: 'Invalid Category',
          duration: 3000,
          position: 'bottom-left'
        }
      });
    }

    const filterBy = {
      teacherId: req.query.teacherId,
      studentId: req.query.studentId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      dayOfWeek: req.query.dayOfWeek,
      location: req.query.location,
      schoolYearId: req.query.schoolYearId,
    };

    // Extract pagination parameters
    const paginationOptions = {
      page: req.query.page,
      limit: req.query.limit,
      sortField: req.query.sortField,
      sortOrder: req.query.sortOrder
    };

    const result = await theoryService.getTheoryLessonsByCategory(
      category,
      filterBy,
      paginationOptions
    );
    const { data: theoryLessons, pagination } = result;

    // Validate and sanitize lesson data
    let validatedLessons = [];
    if (theoryLessons && theoryLessons.length > 0) {
      validatedLessons = theoryLessons.map(lesson => {
        try {
          return TheoryLessonValidationService.sanitizeForResponse(lesson);
        } catch (validationError) {
          console.warn(`Skipping invalid lesson in category ${category}:`, validationError.message);
          return null;
        }
      }).filter(lesson => lesson !== null);
    }

    res.json({
      success: true,
      data: validatedLessons,
      count: validatedLessons.length,
      category: category,
      filters: filterBy,
      pagination
    });
  } catch (err) {
    console.error(
      `Error in getTheoryLessonsByCategory controller: ${err.message}`
    );

    if (err.message.includes('not found') || err.message.includes('No lessons found')) {
      return res.status(200).json({
        success: true,
        data: [],
        message: `No theory lessons found for category: ${req.params.category}`,
        category: req.params.category,
        toast: {
          type: 'info',
          message: `No lessons found for the selected category.`,
          title: 'No Lessons Found',
          duration: 3000,
          position: 'bottom-left'
        }
      });
    }

    next(err);
  }
}

async function getTheoryLessonsByTeacher(req, res, next) {
  try {
    const { teacherId } = req.params;

    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID is required' });
    }

    const filterBy = {
      category: req.query.category,
      studentId: req.query.studentId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      dayOfWeek: req.query.dayOfWeek,
      location: req.query.location,
      schoolYearId: req.query.schoolYearId,
    };

    // Extract pagination parameters
    const paginationOptions = {
      page: req.query.page,
      limit: req.query.limit,
      sortField: req.query.sortField,
      sortOrder: req.query.sortOrder
    };

    const result = await theoryService.getTheoryLessonsByTeacher(
      teacherId,
      filterBy,
      paginationOptions
    );

    res.json(result);
  } catch (err) {
    console.error(
      `Error in getTheoryLessonsByTeacher controller: ${err.message}`
    );
    next(err);
  }
}

async function addTheoryLesson(req, res, next) {
  try {
    const theoryLessonToAdd = req.body;

    if (!theoryLessonToAdd || Object.keys(theoryLessonToAdd).length === 0) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: 'Theory lesson data is required' }]);
    }

    // Validate required fields
    const requiredFields = ['category', 'teacherId', 'date', 'startTime', 'endTime', 'location'];
    const missingFields = requiredFields.filter(field => !theoryLessonToAdd[field]);
    
    if (missingFields.length > 0) {
      return sendErrorResponse(res, 'MISSING_REQUIRED_FIELDS', missingFields);
    }

    // Validate time format
    if (!isValidTimeFormat(theoryLessonToAdd.startTime) || !isValidTimeFormat(theoryLessonToAdd.endTime)) {
      return sendErrorResponse(res, 'INVALID_TIME_FORMAT');
    }

    // Validate time range
    if (!isValidTimeRange(theoryLessonToAdd.startTime, theoryLessonToAdd.endTime)) {
      return sendErrorResponse(res, 'INVALID_TIME_RANGE');
    }

    // Add schoolYearId from middleware if not provided
    if (
      !theoryLessonToAdd.schoolYearId &&
      req.schoolYear &&
      req.schoolYear._id
    ) {
      theoryLessonToAdd.schoolYearId = req.schoolYear._id.toString();
    }

    // Check for conflicts
    const conflictValidation = await ConflictDetectionService.validateSingleLesson(theoryLessonToAdd);
    
    if (conflictValidation.hasConflicts && !theoryLessonToAdd.forceCreate) {
      const conflictResponse = formatConflictResponse(conflictValidation.roomConflicts, conflictValidation.teacherConflicts);
      conflictResponse.message = 'Use forceCreate=true to override these conflicts';
      return res.status(409).json(conflictResponse);
    }

    const addedTheoryLesson = await theoryService.addTheoryLesson(
      theoryLessonToAdd
    );
    
    // Return success response with or without conflict override info
    if (conflictValidation.hasConflicts) {
      return sendSuccessResponse(res, 'CREATE_SUCCESS_WITH_CONFLICTS', addedTheoryLesson, conflictValidation);
    } else {
      return sendSuccessResponse(res, 'CREATE_SUCCESS', addedTheoryLesson);
    }
  } catch (err) {
    console.error(`Error in addTheoryLesson controller: ${err.message}`);

    if (err.message.includes('Validation error')) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: err.message }]);
    }

    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

async function updateTheoryLesson(req, res, next) {
  try {
    const { id } = req.params;
    const theoryLessonToUpdate = req.body;

    if (!id) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: 'Theory lesson ID is required' }]);
    }

    if (
      !theoryLessonToUpdate ||
      Object.keys(theoryLessonToUpdate).length === 0
    ) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: 'Theory lesson data is required' }]);
    }

    // Validate time format if provided
    if (theoryLessonToUpdate.startTime && !isValidTimeFormat(theoryLessonToUpdate.startTime)) {
      return sendErrorResponse(res, 'INVALID_TIME_FORMAT');
    }
    if (theoryLessonToUpdate.endTime && !isValidTimeFormat(theoryLessonToUpdate.endTime)) {
      return sendErrorResponse(res, 'INVALID_TIME_FORMAT');
    }

    // Check if scheduling fields are being modified
    const schedulingFields = ['date', 'startTime', 'endTime', 'location', 'teacherId'];
    const isScheduleModified = schedulingFields.some(field => 
      theoryLessonToUpdate[field] !== undefined
    );

    let conflictValidation = null;
    
    if (isScheduleModified) {
      // Get existing lesson to merge with updates
      const existingLesson = await theoryService.getTheoryLessonById(id);
      const mergedLessonData = { ...existingLesson, ...theoryLessonToUpdate };
      
      // Validate time range if both times are provided
      if (mergedLessonData.startTime && mergedLessonData.endTime) {
        if (!isValidTimeRange(mergedLessonData.startTime, mergedLessonData.endTime)) {
          return sendErrorResponse(res, 'INVALID_TIME_RANGE');
        }
      }
      
      // Validate conflicts (excluding current lesson)
      conflictValidation = await ConflictDetectionService.validateSingleLesson(
        mergedLessonData, 
        id
      );
      
      if (conflictValidation.hasConflicts && !theoryLessonToUpdate.forceUpdate) {
        const conflictResponse = formatConflictResponse(conflictValidation.roomConflicts, conflictValidation.teacherConflicts);
        conflictResponse.message = 'Use forceUpdate=true to override these conflicts';
        return res.status(409).json(conflictResponse);
      }
    }

    const updatedTheoryLesson = await theoryService.updateTheoryLesson(
      id,
      theoryLessonToUpdate
    );
    
    // Return success response with or without conflict override info
    if (conflictValidation && conflictValidation.hasConflicts) {
      return sendSuccessResponse(res, 'UPDATE_SUCCESS_WITH_CONFLICTS', updatedTheoryLesson, conflictValidation);
    } else {
      return sendSuccessResponse(res, 'UPDATE_SUCCESS', updatedTheoryLesson);
    }
  } catch (err) {
    console.error(`Error in updateTheoryLesson controller: ${err.message}`);

    if (err.message.includes('not found')) {
      return sendErrorResponse(res, 'LESSON_NOT_FOUND', id);
    }

    if (err.message.includes('Validation error')) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: err.message }]);
    }

    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

async function removeTheoryLesson(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Theory lesson ID is required' });
    }

    const removedTheoryLesson = await theoryService.removeTheoryLesson(id);
    res.json(removedTheoryLesson);
  } catch (err) {
    console.error(`Error in removeTheoryLesson controller: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    next(err);
  }
}

async function bulkCreateTheoryLessons(req, res, next) {
  try {
    const bulkData = req.body;

    if (!bulkData || Object.keys(bulkData).length === 0) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: 'Bulk creation data is required' }]);
    }

    // Add schoolYearId from request if not in body
    if (!bulkData.schoolYearId && req.schoolYear && req.schoolYear._id) {
      bulkData.schoolYearId = req.schoolYear._id.toString();
      console.log(
        'Setting schoolYearId in bulk data from middleware:',
        bulkData.schoolYearId
      );
    }

    console.log(
      'Bulk create theory lessons data received:',
      JSON.stringify(bulkData, null, 2)
    );

    // Validate that we have schoolYearId
    if (!bulkData.schoolYearId) {
      console.error('Missing schoolYearId in bulk theory lesson data');
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: 'Missing schoolYearId in bulk theory lesson data' }]);
    }

    // Ensure all required fields are present
    const requiredFields = [
      'category',
      'teacherId',
      'startDate',
      'endDate',
      'dayOfWeek',
      'startTime',
      'endTime',
      'location',
    ];

    const missingFields = requiredFields.filter(field => 
      !bulkData[field] && bulkData[field] !== 0 // Allow 0 for dayOfWeek
    );

    if (missingFields.length > 0) {
      return sendErrorResponse(res, 'MISSING_REQUIRED_FIELDS', missingFields);
    }

    // Validate time format
    if (!isValidTimeFormat(bulkData.startTime) || !isValidTimeFormat(bulkData.endTime)) {
      return sendErrorResponse(res, 'INVALID_TIME_FORMAT');
    }

    // Validate time range
    if (!isValidTimeRange(bulkData.startTime, bulkData.endTime)) {
      return sendErrorResponse(res, 'INVALID_TIME_RANGE');
    }

    // Validate date range
    if (new Date(bulkData.endDate) <= new Date(bulkData.startDate)) {
      return sendErrorResponse(res, 'INVALID_DATE_RANGE');
    }

    // Validate day of week
    if (bulkData.dayOfWeek < 0 || bulkData.dayOfWeek > 6) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: 'Day of week must be between 0 (Sunday) and 6 (Saturday)' }]);
    }

    // Check for conflicts
    const conflictValidation = await ConflictDetectionService.validateBulkLessons(bulkData);
    
    // If conflicts exist and not forced, return conflict information
    if (conflictValidation.hasConflicts && !bulkData.forceCreate) {
      const conflictResponse = formatConflictResponse(conflictValidation.roomConflicts, conflictValidation.teacherConflicts);
      conflictResponse.affectedDates = conflictValidation.affectedDates;
      conflictResponse.message = 'Use forceCreate=true to override these conflicts';
      return res.status(409).json(conflictResponse);
    }

    const result = await theoryService.bulkCreateTheoryLessons(bulkData);
    
    // Return success response with or without conflict override info
    if (conflictValidation.hasConflicts) {
      return sendSuccessResponse(res, 'BULK_CREATE_SUCCESS_WITH_CONFLICTS', result, conflictValidation);
    } else {
      return sendSuccessResponse(res, 'BULK_CREATE_SUCCESS', result);
    }
  } catch (err) {
    console.error(`Error in bulk create theory lessons: ${err.message}`);

    if (err.message.includes('Validation error')) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: err.message }]);
    }

    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

async function updateTheoryAttendance(req, res, next) {
  try {
    const { id } = req.params;
    const attendanceData = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Theory lesson ID is required' });
    }

    if (!attendanceData || Object.keys(attendanceData).length === 0) {
      return res.status(400).json({ error: 'Attendance data is required' });
    }

    const updatedTheoryLesson = await theoryService.updateTheoryAttendance(
      id,
      attendanceData
    );
    res.json(updatedTheoryLesson);
  } catch (err) {
    console.error(`Error in updateTheoryAttendance controller: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    if (err.message.includes('Validation error')) {
      return res.status(400).json({ error: err.message });
    }

    next(err);
  }
}

async function getTheoryAttendance(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Theory lesson ID is required' });
    }

    const attendance = await theoryService.getTheoryAttendance(id);
    res.json(attendance);
  } catch (err) {
    console.error(`Error in getTheoryAttendance controller: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    next(err);
  }
}

async function addStudentToTheory(req, res, next) {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Theory lesson ID is required' });
    }

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    const updatedTheoryLesson = await theoryService.addStudentToTheory(
      id,
      studentId
    );
    res.json(updatedTheoryLesson);
  } catch (err) {
    console.error(`Error in addStudentToTheory controller: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    next(err);
  }
}

async function removeStudentFromTheory(req, res, next) {
  try {
    const { id, studentId } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Theory lesson ID is required' });
    }

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    const updatedTheoryLesson = await theoryService.removeStudentFromTheory(
      id,
      studentId
    );
    res.json(updatedTheoryLesson);
  } catch (err) {
    console.error(
      `Error in removeStudentFromTheory controller: ${err.message}`
    );

    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    next(err);
  }
}

async function getStudentTheoryAttendanceStats(req, res, next) {
  try {
    const { studentId } = req.params;
    const { category } = req.query;

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    const stats = await theoryService.getStudentTheoryAttendanceStats(
      studentId,
      category
    );
    res.json(stats);
  } catch (err) {
    console.error(
      `Error in getStudentTheoryAttendanceStats controller: ${err.message}`
    );
    next(err);
  }
}

async function bulkDeleteTheoryLessonsByDate(req, res, next) {
  try {
    const { startDate, endDate } = req.body;

    // Input validation with Joi schema
    const { error } = validateTheoryBulkDeleteByDate({ startDate, endDate });
    if (error) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', error.details);
    }

    const userId = req.loggedinUser?._id || req.teacher?._id;
    const isAdmin = req.loggedinUser?.roles?.includes('מנהל') || req.teacher?.roles?.includes('מנהל');

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required for bulk delete operation'
      });
    }

    // Authorization check - only admin and theory instructors can bulk delete
    if (!isAdmin && !req.loggedinUser?.roles?.includes('מורה תאוריה') && !req.teacher?.roles?.includes('מורה תאוריה')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions to bulk delete theory lessons'
      });
    }

    const result = await theoryService.bulkDeleteTheoryLessonsByDate(
      startDate,
      endDate,
      userId,
      isAdmin
    );

    res.status(200).json({
      deletedCount: result.deletedCount,
      message: result.message
    });
  } catch (err) {
    console.error(`Error in bulkDeleteTheoryLessonsByDate controller: ${err.message}`);

    if (err.message.includes('Invalid start or end date')) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: err.message }]);
    }

    if (err.message.includes('End date must be after start date')) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: err.message }]);
    }

    if (err.message.includes('Database error')) {
      return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
    }

    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

async function bulkDeleteTheoryLessonsByCategory(req, res, next) {
  try {
    const { category } = req.params;

    // Input validation with Joi schema
    const { error } = validateTheoryBulkDeleteByCategory({ category });
    if (error) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', error.details);
    }

    const userId = req.loggedinUser?._id || req.teacher?._id;
    const isAdmin = req.loggedinUser?.roles?.includes('מנהל') || req.teacher?.roles?.includes('מנהל');

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required for bulk delete operation'
      });
    }

    // Authorization check - only admin and theory instructors can bulk delete
    if (!isAdmin && !req.loggedinUser?.roles?.includes('מורה תאוריה') && !req.teacher?.roles?.includes('מורה תאוריה')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions to bulk delete theory lessons'
      });
    }

    const result = await theoryService.bulkDeleteTheoryLessonsByCategory(
      category,
      userId,
      isAdmin
    );

    res.status(200).json({
      deletedCount: result.deletedCount,
      message: result.message
    });
  } catch (err) {
    console.error(`Error in bulkDeleteTheoryLessonsByCategory controller: ${err.message}`);

    if (err.message.includes('Category is required')) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: err.message }]);
    }

    if (err.message.includes('Database error')) {
      return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
    }

    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

async function bulkDeleteTheoryLessonsByTeacher(req, res, next) {
  try {
    const { teacherId } = req.params;

    // Input validation with Joi schema
    const { error } = validateTheoryBulkDeleteByTeacher({ teacherId });
    if (error) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', error.details);
    }

    const userId = req.loggedinUser?._id || req.teacher?._id;
    const isAdmin = req.loggedinUser?.roles?.includes('מנהל') || req.teacher?.roles?.includes('מנהל');

    if (!userId) {
      return res.status(401).json({
        error: 'Authentication required for bulk delete operation'
      });
    }

    // Authorization check - only admin and theory instructors can bulk delete
    // Teachers can delete their own lessons
    const canDelete = isAdmin || 
      req.loggedinUser?.roles?.includes('מורה תאוריה') || 
      req.teacher?.roles?.includes('מורה תאוריה') ||
      teacherId === userId.toString();

    if (!canDelete) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions to bulk delete theory lessons for this teacher'
      });
    }

    const result = await theoryService.bulkDeleteTheoryLessonsByTeacher(
      teacherId,
      userId,
      isAdmin
    );

    res.status(200).json({
      deletedCount: result.deletedCount,
      message: result.message
    });
  } catch (err) {
    console.error(`Error in bulkDeleteTheoryLessonsByTeacher controller: ${err.message}`);

    if (err.message.includes('Valid teacher ID is required')) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{ message: err.message }]);
    }

    if (err.message.includes('Not authorized')) {
      return res.status(403).json({
        error: 'Forbidden',
        message: err.message
      });
    }

    if (err.message.includes('Database error')) {
      return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
    }

    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}
