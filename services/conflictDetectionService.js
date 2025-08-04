import { getCollection } from './mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { doTimesOverlap } from '../utils/timeUtils.js';
import { 
  toUTC, 
  createAppDate, 
  getStartOfDay, 
  getEndOfDay,
  formatDate,
  generateDatesForDayOfWeek,
  isValidDate,
  isSameDay
} from '../utils/dateHelpers.js';

class ConflictDetectionService {
  
  /**
   * Check for room booking conflicts
   * @param {Object} lessonData - The lesson data to check
   * @param {string} excludeId - Optional lesson ID to exclude from conflict check
   * @returns {Array} Array of room conflicts
   */
  async checkRoomConflicts(lessonData, excludeId = null) {
    try {
      const { date, startTime, endTime, location } = lessonData;
      
      if (!date || !startTime || !endTime || !location) {
        return [];
      }

      // Validate date input
      if (!isValidDate(date)) {
        throw new Error('Invalid date provided for conflict check');
      }

      const collection = await getCollection('theory_lesson');
      
      // Use timezone-aware date range query for better accuracy
      const targetDate = createAppDate(date);
      const startOfDay = getStartOfDay(targetDate);
      const endOfDay = getEndOfDay(targetDate);
      
      // Build query to find lessons on the same date and location
      const query = {
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        location: location,
        ...(excludeId && { _id: { $ne: ObjectId.createFromHexString(excludeId) } })
      };
      
      // Find all lessons that could potentially conflict
      const existingLessons = await collection.find(query).toArray();
      
      // Filter for actual time conflicts using timezone-aware date comparison
      const conflictingLessons = existingLessons.filter(lesson => {
        // Ensure we're comparing the same day in app timezone
        const lessonAppDate = createAppDate(lesson.date);
        const isSameDay = targetDate.format('YYYY-MM-DD') === lessonAppDate.format('YYYY-MM-DD');
        
        return isSameDay && doTimesOverlap(startTime, endTime, lesson.startTime, lesson.endTime);
      });
      
      // Format conflicts for response with timezone-aware date formatting
      return conflictingLessons.map(lesson => ({
        type: 'room',
        conflictId: lesson._id.toString(),
        date: formatDate(lesson.date, 'YYYY-MM-DD'),
        location: lesson.location,
        existingTime: `${lesson.startTime}-${lesson.endTime}`,
        newTime: `${startTime}-${endTime}`,
        teacherId: lesson.teacherId,
        description: `Room ${location} is already booked on ${formatDate(date, 'DD/MM/YYYY')} from ${lesson.startTime}-${lesson.endTime}`,
        existingLesson: lesson
      }));
    } catch (error) {
      console.error('Error checking room conflicts:', error);
      throw new Error(`Failed to check room conflicts: ${error.message}`);
    }
  }
  
  /**
   * Check for teacher scheduling conflicts
   * @param {Object} lessonData - The lesson data to check
   * @param {string} excludeId - Optional lesson ID to exclude from conflict check
   * @returns {Array} Array of teacher conflicts
   */
  async checkTeacherConflicts(lessonData, excludeId = null) {
    try {
      const { date, startTime, endTime, teacherId, location } = lessonData;
      
      if (!date || !startTime || !endTime || !teacherId) {
        return [];
      }

      // Validate date input
      if (!isValidDate(date)) {
        throw new Error('Invalid date provided for teacher conflict check');
      }

      const collection = await getCollection('theory_lesson');
      
      // Use timezone-aware date range query
      const targetDate = createAppDate(date);
      const startOfDay = getStartOfDay(targetDate);
      const endOfDay = getEndOfDay(targetDate);
      
      // Build query to find lessons with the same teacher on the same date
      const query = {
        date: {
          $gte: startOfDay,
          $lte: endOfDay
        },
        teacherId: teacherId,
        location: { $ne: location }, // Different room (same room would be caught by room conflict)
        ...(excludeId && { _id: { $ne: ObjectId.createFromHexString(excludeId) } })
      };
      
      // Find all lessons that could potentially conflict
      const existingLessons = await collection.find(query).toArray();
      
      // Filter for actual time conflicts using timezone-aware date comparison
      const conflictingLessons = existingLessons.filter(lesson => {
        // Ensure we're comparing the same day in app timezone
        const lessonAppDate = createAppDate(lesson.date);
        const isSameDay = targetDate.format('YYYY-MM-DD') === lessonAppDate.format('YYYY-MM-DD');
        
        return isSameDay && doTimesOverlap(startTime, endTime, lesson.startTime, lesson.endTime);
      });
      
      // Format conflicts for response with timezone-aware date formatting
      return conflictingLessons.map(lesson => ({
        type: 'teacher',
        conflictId: lesson._id.toString(),
        date: formatDate(lesson.date, 'YYYY-MM-DD'),
        existingLocation: lesson.location,
        newLocation: location,
        existingTime: `${lesson.startTime}-${lesson.endTime}`,
        newTime: `${startTime}-${endTime}`,
        teacherId: lesson.teacherId,
        description: `Teacher is already scheduled on ${formatDate(date, 'DD/MM/YYYY')} from ${lesson.startTime}-${lesson.endTime} in ${lesson.location}`,
        existingLesson: lesson
      }));
    } catch (error) {
      console.error('Error checking teacher conflicts:', error);
      throw new Error(`Failed to check teacher conflicts: ${error.message}`);
    }
  }
  
  /**
   * Validate a single lesson for conflicts
   * @param {Object} lessonData - The lesson data to validate
   * @param {string} excludeId - Optional lesson ID to exclude from conflict check
   * @returns {Object} Conflict validation result
   */
  async validateSingleLesson(lessonData, excludeId = null) {
    try {
      const roomConflicts = await this.checkRoomConflicts(lessonData, excludeId);
      const teacherConflicts = await this.checkTeacherConflicts(lessonData, excludeId);
      
      return {
        hasConflicts: roomConflicts.length > 0 || teacherConflicts.length > 0,
        roomConflicts,
        teacherConflicts,
        totalConflicts: roomConflicts.length + teacherConflicts.length
      };
    } catch (error) {
      console.error('Error validating single lesson:', error);
      throw new Error(`Failed to validate lesson: ${error.message}`);
    }
  }
  
  /**
   * Validate bulk lesson creation for conflicts
   * @param {Object} bulkData - The bulk creation data
   * @returns {Object} Bulk conflict validation result
   */
  async validateBulkLessons(bulkData) {
    try {
      const { startDate, endDate, dayOfWeek, startTime, endTime, location, teacherId, excludeDates = [] } = bulkData;
      
      // Validate input dates
      if (!isValidDate(startDate) || !isValidDate(endDate)) {
        throw new Error('Invalid start or end date provided for bulk validation');
      }
      
      // Generate all lesson dates using timezone-aware date generation
      const lessonDates = generateDatesForDayOfWeek(startDate, endDate, dayOfWeek, excludeDates);
      
      let allRoomConflicts = [];
      let allTeacherConflicts = [];
      
      // Check each date for conflicts
      for (const utcDate of lessonDates) {
        // Convert UTC date back to app timezone for display
        const appDate = createAppDate(utcDate);
        const dateString = appDate.format('YYYY-MM-DD');
        
        const lessonData = { date: dateString, startTime, endTime, location, teacherId };
        
        const roomConflicts = await this.checkRoomConflicts(lessonData);
        const teacherConflicts = await this.checkTeacherConflicts(lessonData);
        
        allRoomConflicts.push(...roomConflicts);
        allTeacherConflicts.push(...teacherConflicts);
      }
      
      return {
        hasConflicts: allRoomConflicts.length > 0 || allTeacherConflicts.length > 0,
        roomConflicts: allRoomConflicts,
        teacherConflicts: allTeacherConflicts,
        totalConflicts: allRoomConflicts.length + allTeacherConflicts.length,
        affectedDates: lessonDates.map(utcDate => formatDate(utcDate, 'YYYY-MM-DD')),
        totalLessons: lessonDates.length
      };
    } catch (error) {
      console.error('Error validating bulk lessons:', error);
      throw new Error(`Failed to validate bulk lessons: ${error.message}`);
    }
  }
  
  /**
   * Generate dates for recurring lessons (Legacy method - now uses timezone-aware helper)
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @param {number} dayOfWeek - Day of week (0=Sunday, 6=Saturday)
   * @param {Array} excludeDates - Array of dates to exclude
   * @returns {Array} Array of date strings
   * @deprecated Use generateDatesForDayOfWeek from dateHelpers instead
   */
  generateRecurrenceDates(startDate, endDate, dayOfWeek, excludeDates = []) {
    // Use the new timezone-aware date generation
    const utcDates = generateDatesForDayOfWeek(startDate, endDate, dayOfWeek, excludeDates);
    
    // Convert UTC dates back to date strings for backward compatibility
    return utcDates.map(utcDate => formatDate(utcDate, 'YYYY-MM-DD'));
  }

  /**
   * Get detailed conflict information for frontend display
   * @param {Array} conflicts - Array of conflicts from validation
   * @returns {Object} Formatted conflict information
   */
  formatConflictsForFrontend(conflicts) {
    const roomConflicts = conflicts.filter(c => c.type === 'room');
    const teacherConflicts = conflicts.filter(c => c.type === 'teacher');
    
    return {
      summary: {
        total: conflicts.length,
        room: roomConflicts.length,
        teacher: teacherConflicts.length
      },
      details: {
        roomConflicts: roomConflicts.map(c => ({
          date: c.date,
          location: c.location,
          existingTime: c.existingTime,
          newTime: c.newTime,
          message: `החדר ${c.location} תפוס ב-${formatDate(c.date, 'DD/MM/YYYY')} בין ${c.existingTime}`
        })),
        teacherConflicts: teacherConflicts.map(c => ({
          date: c.date,
          existingLocation: c.existingLocation,
          newLocation: c.newLocation,
          existingTime: c.existingTime,
          newTime: c.newTime,
          message: `המורה תפוס ב-${formatDate(c.date, 'DD/MM/YYYY')} בין ${c.existingTime} ב${c.existingLocation}`
        }))
      }
    };
  }
}

export default new ConflictDetectionService();