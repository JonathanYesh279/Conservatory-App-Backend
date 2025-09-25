/**
 * Test suite for theory lesson error handling and toast notifications
 *
 * This test file validates that the enhanced error handling and toast notification
 * system properly handles edge cases that were causing "None" values to appear
 * in the frontend.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TheoryLessonValidationService } from '../services/theoryLessonValidationService.js';
import { createToast, TOAST_TYPES } from '../middleware/toastNotificationMiddleware.js';

describe('Theory Lesson Error Handling', () => {
  describe('TheoryLessonValidationService', () => {

    it('should reject null/undefined lesson data', () => {
      expect(() => {
        TheoryLessonValidationService.validateLessonData(null);
      }).toThrow('No lesson data provided');

      expect(() => {
        TheoryLessonValidationService.validateLessonData(undefined);
      }).toThrow('No lesson data provided');
    });

    it('should reject invalid lesson objects', () => {
      expect(() => {
        TheoryLessonValidationService.validateSingleLesson(null);
      }).toThrow('Invalid lesson object provided');

      expect(() => {
        TheoryLessonValidationService.validateSingleLesson('not an object');
      }).toThrow('Invalid lesson object provided');
    });

    it('should reject lessons with missing required fields', () => {
      const incompleteLesson = {
        _id: '507f1f77bcf86cd799439011',
        // missing category
        teacherId: '507f1f77bcf86cd799439012',
        date: new Date(),
        startTime: '10:00',
        endTime: '11:00',
        location: 'Room 1',
        dayOfWeek: 1,
        schoolYearId: '507f1f77bcf86cd799439013'
      };

      expect(() => {
        TheoryLessonValidationService.validateSingleLesson(incompleteLesson);
      }).toThrow('Theory lesson category is required');
    });

    it('should handle "None" values in category fields', () => {
      const lessonWithNoneCategory = {
        _id: '507f1f77bcf86cd799439011',
        category: 'None',
        teacherId: '507f1f77bcf86cd799439012',
        date: new Date(),
        startTime: '10:00',
        endTime: '11:00',
        location: 'Room 1',
        dayOfWeek: 1,
        schoolYearId: '507f1f77bcf86cd799439013'
      };

      expect(() => {
        TheoryLessonValidationService.validateCategory('None');
      }).toThrow('Theory lesson category is required');

      expect(() => {
        TheoryLessonValidationService.validateCategory('null');
      }).toThrow('Theory lesson category is required');

      expect(() => {
        TheoryLessonValidationService.validateCategory('');
      }).toThrow('Theory lesson category is required');
    });

    it('should handle "None" values in ID fields', () => {
      expect(() => {
        TheoryLessonValidationService.validateId('None');
      }).toThrow('Invalid ID format');

      expect(() => {
        TheoryLessonValidationService.validateId('null');
      }).toThrow('Invalid ID format');

      expect(() => {
        TheoryLessonValidationService.validateId('undefined');
      }).toThrow('Invalid ID format');

      expect(() => {
        TheoryLessonValidationService.validateId('');
      }).toThrow('Required ID field is missing');
    });

    it('should sanitize lesson data for response', () => {
      const validLesson = {
        _id: '507f1f77bcf86cd799439011',
        category: 'תיאוריה כללית',
        teacherId: '507f1f77bcf86cd799439012',
        date: new Date(),
        startTime: '10:00',
        endTime: '11:00',
        location: 'Room 1',
        dayOfWeek: 1,
        schoolYearId: '507f1f77bcf86cd799439013',
        studentIds: [],
        attendance: { present: [], absent: [] }
      };

      const sanitized = TheoryLessonValidationService.sanitizeForResponse(validLesson);

      expect(sanitized).toBeDefined();
      expect(sanitized._id).toBe(validLesson._id);
      expect(sanitized.category).toBe(validLesson.category);
      expect(sanitized.notes).toBe(''); // Should default to empty string
      expect(sanitized.syllabus).toBe(''); // Should default to empty string
      expect(sanitized.homework).toBe(''); // Should default to empty string
    });

    it('should replace null/None category with default', () => {
      const lessonWithNullCategory = {
        _id: '507f1f77bcf86cd799439011',
        category: null,
        teacherId: '507f1f77bcf86cd799439012',
        date: new Date(),
        startTime: '10:00',
        endTime: '11:00',
        location: 'Room 1',
        dayOfWeek: 1,
        schoolYearId: '507f1f77bcf86cd799439013',
        studentIds: [],
        attendance: { present: [], absent: [] }
      };

      const sanitized = TheoryLessonValidationService.sanitizeForResponse(lessonWithNullCategory);
      expect(sanitized.category).toBe('תיאוריה כללית'); // Default category
    });

    it('should validate lesson completeness', () => {
      const completeLesson = {
        _id: '507f1f77bcf86cd799439011',
        category: 'תיאוריה כללית',
        teacherId: '507f1f77bcf86cd799439012',
        date: new Date(),
        startTime: '10:00',
        endTime: '11:00',
        location: 'Room 1',
        dayOfWeek: 1,
        schoolYearId: '507f1f77bcf86cd799439013',
        studentIds: [],
        attendance: { present: [], absent: [] }
      };

      const result = TheoryLessonValidationService.checkLessonCompleteness(completeLesson);
      expect(result.isComplete).toBe(true);
      expect(result.missingFields).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect incomplete lessons', () => {
      const incompleteLesson = {
        _id: 'None',
        category: 'None',
        teacherId: '507f1f77bcf86cd799439012'
        // missing required fields
      };

      const result = TheoryLessonValidationService.checkLessonCompleteness(incompleteLesson);
      expect(result.isComplete).toBe(false);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContain('Lesson category is not properly set');
      expect(result.warnings).toContain('Lesson ID is not properly set');
    });
  });

  describe('Toast Notification System', () => {
    it('should create error toast with correct structure', () => {
      const toast = createToast(TOAST_TYPES.ERROR, 'Test error message', {
        title: 'Test Error',
        duration: 5000
      });

      expect(toast).toMatchObject({
        type: 'error',
        message: 'Test error message',
        title: 'Test Error',
        duration: 5000,
        position: 'bottom-left',
        dismissible: true
      });

      expect(toast.timestamp).toBeDefined();
    });

    it('should create success toast with default duration', () => {
      const toast = createToast(TOAST_TYPES.SUCCESS, 'Success message');

      expect(toast.type).toBe('success');
      expect(toast.duration).toBe(3000); // Default for success
      expect(toast.position).toBe('bottom-left');
    });

    it('should create error toast with longer default duration', () => {
      const toast = createToast(TOAST_TYPES.ERROR, 'Error message');

      expect(toast.type).toBe('error');
      expect(toast.duration).toBe(5000); // Default for error
    });
  });

  describe('Edge Case Handling', () => {
    it('should handle array of lessons with mixed validity', () => {
      const lessons = [
        {
          _id: '507f1f77bcf86cd799439011',
          category: 'תיאוריה כללית',
          teacherId: '507f1f77bcf86cd799439012',
          date: new Date(),
          startTime: '10:00',
          endTime: '11:00',
          location: 'Room 1',
          dayOfWeek: 1,
          schoolYearId: '507f1f77bcf86cd799439013'
        },
        {
          _id: 'None', // Invalid
          category: 'None', // Invalid
          teacherId: '507f1f77bcf86cd799439012'
          // Missing required fields
        },
        {
          _id: '507f1f77bcf86cd799439014',
          category: 'הרמוניה',
          teacherId: '507f1f77bcf86cd799439015',
          date: new Date(),
          startTime: '11:00',
          endTime: '12:00',
          location: 'Room 2',
          dayOfWeek: 2,
          schoolYearId: '507f1f77bcf86cd799439013'
        }
      ];

      // Simulate how the controller would handle this
      const validatedLessons = lessons.map(lesson => {
        try {
          return TheoryLessonValidationService.sanitizeForResponse(lesson);
        } catch (error) {
          return null; // Skip invalid lessons
        }
      }).filter(lesson => lesson !== null);

      expect(validatedLessons).toHaveLength(2); // Only valid lessons should remain
      expect(validatedLessons.every(lesson => lesson._id !== 'None')).toBe(true);
      expect(validatedLessons.every(lesson => lesson.category !== 'None')).toBe(true);
    });

    it('should handle empty or null arrays gracefully', () => {
      expect(() => {
        TheoryLessonValidationService.validateLessonData([]);
      }).not.toThrow();

      const result = TheoryLessonValidationService.validateLessonData([]);
      expect(result).toEqual([]);
    });

    it('should validate time formats correctly', () => {
      expect(() => {
        TheoryLessonValidationService.validateTime('25:00'); // Invalid hour
      }).toThrow('Invalid time format');

      expect(() => {
        TheoryLessonValidationService.validateTime('12:60'); // Invalid minute
      }).toThrow('Invalid time format');

      expect(() => {
        TheoryLessonValidationService.validateTime('not a time');
      }).toThrow('Invalid time format');

      expect(() => {
        TheoryLessonValidationService.validateTime('');
      }).toThrow('Time is required');

      // Valid times should not throw
      expect(() => {
        TheoryLessonValidationService.validateTime('09:30');
      }).not.toThrow();

      expect(() => {
        TheoryLessonValidationService.validateTime('23:59');
      }).not.toThrow();
    });
  });
});