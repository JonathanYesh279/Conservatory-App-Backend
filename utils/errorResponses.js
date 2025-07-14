/**
 * Standardized error responses for theory lesson API
 */

const ErrorResponses = {
  
  // Conflict-related errors (409)
  ROOM_CONFLICT: (conflicts) => ({
    status: 409,
    success: false,
    error: 'ROOM_BOOKING_CONFLICT',
    message: 'The requested room is already booked for the specified time',
    conflicts: conflicts,
    userMessage: 'החדר כבר תפוס בזמן המבוקש'
  }),
  
  TEACHER_CONFLICT: (conflicts) => ({
    status: 409,
    success: false,
    error: 'TEACHER_SCHEDULING_CONFLICT',
    message: 'The teacher is already scheduled at the requested time',
    conflicts: conflicts,
    userMessage: 'המורה כבר מתוכנן בזמן המבוקש'
  }),
  
  MIXED_CONFLICTS: (roomConflicts, teacherConflicts) => ({
    status: 409,
    success: false,
    error: 'MULTIPLE_SCHEDULING_CONFLICTS',
    message: 'Multiple scheduling conflicts detected',
    conflicts: {
      room: roomConflicts,
      teacher: teacherConflicts,
      total: roomConflicts.length + teacherConflicts.length
    },
    userMessage: 'נמצאו התנגשויות בלוח הזמנים',
    suggestion: 'Use forceCreate=true to override these conflicts'
  }),
  
  // Validation errors (400)
  VALIDATION_ERROR: (details) => ({
    status: 400,
    success: false,
    error: 'VALIDATION_ERROR',
    message: 'Request validation failed',
    details: details,
    userMessage: 'נתונים לא תקינים'
  }),
  
  MISSING_REQUIRED_FIELDS: (missingFields) => ({
    status: 400,
    success: false,
    error: 'MISSING_REQUIRED_FIELDS',
    message: 'Missing required fields',
    missingFields: missingFields,
    userMessage: 'חסרים שדות חובה'
  }),
  
  INVALID_TIME_FORMAT: () => ({
    status: 400,
    success: false,
    error: 'INVALID_TIME_FORMAT',
    message: 'Invalid time format. Use HH:MM format.',
    userMessage: 'פורמט זמן לא תקין. השתמש בפורמט HH:MM'
  }),
  
  INVALID_TIME_RANGE: () => ({
    status: 400,
    success: false,
    error: 'INVALID_TIME_RANGE',
    message: 'Start time must be before end time',
    userMessage: 'זמן התחלה חייב להיות לפני זמן סיום'
  }),
  
  INVALID_DATE_RANGE: () => ({
    status: 400,
    success: false,
    error: 'INVALID_DATE_RANGE',
    message: 'End date must be after start date',
    userMessage: 'תאריך סיום חייב להיות אחרי תאריך התחלה'
  }),
  
  // Not found errors (404)
  LESSON_NOT_FOUND: (lessonId) => ({
    status: 404,
    success: false,
    error: 'LESSON_NOT_FOUND',
    message: 'Theory lesson not found',
    lessonId: lessonId,
    userMessage: 'שיעור התאוריה לא נמצא'
  }),
  
  TEACHER_NOT_FOUND: (teacherId) => ({
    status: 404,
    success: false,
    error: 'TEACHER_NOT_FOUND',
    message: 'Teacher not found',
    teacherId: teacherId,
    userMessage: 'המורה לא נמצא במערכת'
  }),
  
  SCHOOL_YEAR_NOT_FOUND: (schoolYearId) => ({
    status: 404,
    success: false,
    error: 'SCHOOL_YEAR_NOT_FOUND',
    message: 'School year not found',
    schoolYearId: schoolYearId,
    userMessage: 'שנת לימודים לא נמצאה'
  }),
  
  // Bad request errors (400)
  TEACHER_INACTIVE: (teacherId) => ({
    status: 400,
    success: false,
    error: 'TEACHER_INACTIVE',
    message: 'Teacher is not active',
    teacherId: teacherId,
    userMessage: 'המורה אינו פעיל במערכת'
  }),
  
  SCHOOL_YEAR_INACTIVE: (schoolYearId) => ({
    status: 400,
    success: false,
    error: 'SCHOOL_YEAR_INACTIVE',
    message: 'School year is not active',
    schoolYearId: schoolYearId,
    userMessage: 'שנת הלימודים אינה פעילה'
  }),
  
  // Success responses (201, 200)
  BULK_CREATE_SUCCESS: (data) => ({
    status: 201,
    success: true,
    message: 'Theory lessons created successfully',
    data: data,
    userMessage: `נוצרו ${data.insertedCount} שיעורי תאוריה בהצלחה`
  }),
  
  BULK_CREATE_SUCCESS_WITH_CONFLICTS: (data, conflicts) => ({
    status: 201,
    success: true,
    message: 'Theory lessons created successfully with conflicts overridden',
    data: data,
    conflicts: {
      overridden: true,
      ...conflicts
    },
    userMessage: `נוצרו ${data.insertedCount} שיעורי תאוריה בהצלחה (עם התנגשויות שנעברו)`
  }),
  
  CREATE_SUCCESS: (lesson) => ({
    status: 201,
    success: true,
    message: 'Theory lesson created successfully',
    data: lesson,
    userMessage: 'שיעור התאוריה נוצר בהצלחה'
  }),
  
  CREATE_SUCCESS_WITH_CONFLICTS: (lesson, conflicts) => ({
    status: 201,
    success: true,
    message: 'Theory lesson created successfully with conflicts overridden',
    data: lesson,
    conflicts: {
      overridden: true,
      ...conflicts
    },
    userMessage: 'שיעור התאוריה נוצר בהצלחה (עם התנגשויות שנעברו)'
  }),
  
  UPDATE_SUCCESS: (lesson) => ({
    status: 200,
    success: true,
    message: 'Theory lesson updated successfully',
    data: lesson,
    userMessage: 'שיעור התאוריה עודכן בהצלחה'
  }),
  
  UPDATE_SUCCESS_WITH_CONFLICTS: (lesson, conflicts) => ({
    status: 200,
    success: true,
    message: 'Theory lesson updated successfully with conflicts overridden',
    data: lesson,
    conflicts: {
      overridden: true,
      ...conflicts
    },
    userMessage: 'שיעור התאוריה עודכן בהצלחה (עם התנגשויות שנעברו)'
  }),
  
  DELETE_SUCCESS: (lessonId) => ({
    status: 200,
    success: true,
    message: 'Theory lesson deleted successfully',
    lessonId: lessonId,
    userMessage: 'שיעור התאוריה נמחק בהצלחה'
  }),
  
  // Server errors (500)
  INTERNAL_SERVER_ERROR: (message = 'Internal server error') => ({
    status: 500,
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: message,
    userMessage: 'שגיאת שרת פנימית'
  }),
  
  DATABASE_ERROR: (message = 'Database operation failed') => ({
    status: 500,
    success: false,
    error: 'DATABASE_ERROR',
    message: message,
    userMessage: 'שגיאת מסד נתונים'
  })
};

/**
 * Send standardized error response
 * @param {Object} res - Express response object
 * @param {string} errorType - Type of error from ErrorResponses
 * @param {...any} args - Arguments to pass to the error response function
 */
const sendErrorResponse = (res, errorType, ...args) => {
  const response = ErrorResponses[errorType](...args);
  return res.status(response.status).json(response);
};

/**
 * Send standardized success response
 * @param {Object} res - Express response object
 * @param {string} successType - Type of success from ErrorResponses
 * @param {...any} args - Arguments to pass to the success response function
 */
const sendSuccessResponse = (res, successType, ...args) => {
  const response = ErrorResponses[successType](...args);
  return res.status(response.status).json(response);
};

/**
 * Format conflict response for frontend consumption
 * @param {Array} roomConflicts - Array of room conflicts
 * @param {Array} teacherConflicts - Array of teacher conflicts
 * @returns {Object} Formatted conflict response
 */
const formatConflictResponse = (roomConflicts = [], teacherConflicts = []) => {
  const hasRoomConflicts = roomConflicts.length > 0;
  const hasTeacherConflicts = teacherConflicts.length > 0;
  
  if (hasRoomConflicts && hasTeacherConflicts) {
    return ErrorResponses.MIXED_CONFLICTS(roomConflicts, teacherConflicts);
  } else if (hasRoomConflicts) {
    return ErrorResponses.ROOM_CONFLICT(roomConflicts);
  } else if (hasTeacherConflicts) {
    return ErrorResponses.TEACHER_CONFLICT(teacherConflicts);
  }
  
  return null;
};

export {
  ErrorResponses,
  sendErrorResponse,
  sendSuccessResponse,
  formatConflictResponse
};