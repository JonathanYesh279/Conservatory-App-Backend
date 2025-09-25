/**
 * Theory Lesson Validation Service
 *
 * This service provides enhanced validation and error handling specifically
 * for theory lessons to prevent null/undefined values from reaching the frontend
 */

import { ObjectId } from 'mongodb';

export class TheoryLessonValidationService {

  /**
   * Validate and sanitize theory lesson data before sending to frontend
   * @param {object|array} lessonData - Single lesson or array of lessons
   * @returns {object|array} Validated and sanitized lesson data
   */
  static validateLessonData(lessonData) {
    if (!lessonData) {
      throw new Error('No lesson data provided');
    }

    if (Array.isArray(lessonData)) {
      return lessonData.map(lesson => this.validateSingleLesson(lesson));
    }

    return this.validateSingleLesson(lessonData);
  }

  /**
   * Validate a single theory lesson object
   * @param {object} lesson - Theory lesson object
   * @returns {object} Validated lesson object
   */
  static validateSingleLesson(lesson) {
    if (!lesson || typeof lesson !== 'object') {
      throw new Error('Invalid lesson object provided');
    }

    // Ensure required fields are present and valid
    const validatedLesson = {
      _id: this.validateId(lesson._id),
      category: this.validateCategory(lesson.category),
      teacherId: this.validateId(lesson.teacherId),
      date: this.validateDate(lesson.date),
      startTime: this.validateTime(lesson.startTime),
      endTime: this.validateTime(lesson.endTime),
      location: this.validateLocation(lesson.location),
      dayOfWeek: this.validateDayOfWeek(lesson.dayOfWeek),
      schoolYearId: this.validateId(lesson.schoolYearId),
      studentIds: this.validateStudentIds(lesson.studentIds),
      attendance: this.validateAttendance(lesson.attendance),
      notes: lesson.notes || '',
      syllabus: lesson.syllabus || '',
      homework: lesson.homework || '',
      createdAt: lesson.createdAt || new Date(),
      updatedAt: lesson.updatedAt || new Date()
    };

    return validatedLesson;
  }

  /**
   * Validate ObjectId fields
   * @param {string|ObjectId} id - ID to validate
   * @returns {string} Valid ID string
   */
  static validateId(id) {
    if (!id) {
      throw new Error('Required ID field is missing');
    }

    if (typeof id === 'object' && id._id) {
      id = id._id;
    }

    if (ObjectId.isValid(id)) {
      return id.toString();
    }

    throw new Error(`Invalid ID format: ${id}`);
  }

  /**
   * Validate theory lesson category
   * @param {string} category - Category to validate
   * @returns {string} Valid category
   */
  static validateCategory(category) {
    if (!category || typeof category !== 'string' || category.trim() === '' || category === 'None' || category === 'null' || category === 'undefined') {
      throw new Error('Theory lesson category is required and cannot be empty');
    }

    const trimmedCategory = category.trim();

    // Common theory categories in Hebrew
    const validCategories = [
      'תיאוריה כללית',
      'הרמוניה',
      'היסטוריה של המוזיקה',
      'צורות מוזיקליות',
      'אוזן מוזיקלית',
      'כתיבה והכתבה',
      'ניתוח מוזיקלי'
    ];

    return trimmedCategory;
  }

  /**
   * Validate date field
   * @param {string|Date} date - Date to validate
   * @returns {Date} Valid date object
   */
  static validateDate(date) {
    if (!date) {
      throw new Error('Date is required for theory lesson');
    }

    const parsedDate = new Date(date);

    if (isNaN(parsedDate.getTime())) {
      throw new Error(`Invalid date format: ${date}`);
    }

    return parsedDate;
  }

  /**
   * Validate time field (HH:MM format)
   * @param {string} time - Time to validate
   * @returns {string} Valid time string
   */
  static validateTime(time) {
    if (!time || typeof time !== 'string') {
      throw new Error('Time is required and must be a string');
    }

    const timePattern = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    if (!timePattern.test(time)) {
      throw new Error(`Invalid time format: ${time}. Expected format: HH:MM`);
    }

    return time;
  }

  /**
   * Validate location field
   * @param {string} location - Location to validate
   * @returns {string} Valid location
   */
  static validateLocation(location) {
    if (!location || typeof location !== 'string' || location.trim() === '') {
      throw new Error('Location is required for theory lesson');
    }

    return location.trim();
  }

  /**
   * Validate day of week (0-6, Sunday=0)
   * @param {number} dayOfWeek - Day of week to validate
   * @returns {number} Valid day of week
   */
  static validateDayOfWeek(dayOfWeek) {
    const day = parseInt(dayOfWeek);

    if (isNaN(day) || day < 0 || day > 6) {
      throw new Error(`Invalid day of week: ${dayOfWeek}. Must be 0-6 (Sunday=0)`);
    }

    return day;
  }

  /**
   * Validate student IDs array
   * @param {array} studentIds - Array of student IDs
   * @returns {array} Valid student IDs array
   */
  static validateStudentIds(studentIds) {
    if (!studentIds) {
      return [];
    }

    if (!Array.isArray(studentIds)) {
      throw new Error('Student IDs must be an array');
    }

    return studentIds.filter(id => {
      try {
        return ObjectId.isValid(id);
      } catch {
        return false;
      }
    });
  }

  /**
   * Validate attendance object
   * @param {object} attendance - Attendance object
   * @returns {object} Valid attendance object
   */
  static validateAttendance(attendance) {
    if (!attendance || typeof attendance !== 'object') {
      return { present: [], absent: [] };
    }

    return {
      present: Array.isArray(attendance.present) ? attendance.present : [],
      absent: Array.isArray(attendance.absent) ? attendance.absent : []
    };
  }

  /**
   * Check if a lesson has all required data for display
   * @param {object} lesson - Lesson to check
   * @returns {object} Validation result with any missing fields
   */
  static checkLessonCompleteness(lesson) {
    const result = {
      isComplete: true,
      missingFields: [],
      warnings: []
    };

    try {
      this.validateSingleLesson(lesson);
    } catch (error) {
      result.isComplete = false;
      result.missingFields.push(error.message);
    }

    // Additional checks for display purposes
    if (!lesson.category || lesson.category === 'None' || lesson.category === 'null') {
      result.warnings.push('Lesson category is not properly set');
    }

    if (!lesson._id || lesson._id === 'None' || lesson._id === 'null') {
      result.warnings.push('Lesson ID is not properly set');
    }

    return result;
  }

  /**
   * Sanitize lesson data for API response to prevent null/undefined display
   * @param {object} lesson - Lesson to sanitize
   * @returns {object} Sanitized lesson
   */
  static sanitizeForResponse(lesson) {
    if (!lesson) {
      return null;
    }

    const sanitized = { ...lesson };

    // Replace null/undefined values with appropriate defaults
    if (!sanitized.category || sanitized.category === 'null' || sanitized.category === 'None') {
      sanitized.category = 'תיאוריה כללית'; // Default category
    }

    if (!sanitized._id || sanitized._id === 'null' || sanitized._id === 'None') {
      // This should not happen, but if it does, we need to handle it
      console.error('Lesson missing ID:', lesson);
      throw new Error('Lesson is missing required ID field');
    }

    if (!sanitized.teacherId || sanitized.teacherId === 'null' || sanitized.teacherId === 'None') {
      throw new Error('Lesson is missing teacher information');
    }

    // Ensure all required fields have valid values
    sanitized.notes = sanitized.notes || '';
    sanitized.syllabus = sanitized.syllabus || '';
    sanitized.homework = sanitized.homework || '';
    sanitized.studentIds = sanitized.studentIds || [];
    sanitized.attendance = sanitized.attendance || { present: [], absent: [] };

    return sanitized;
  }
}

export default TheoryLessonValidationService;