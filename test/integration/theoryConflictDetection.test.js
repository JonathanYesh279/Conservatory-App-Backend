import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getCollection } from '../../services/mongoDB.service.js';
import ConflictDetectionService from '../../services/conflictDetectionService.js';
import { ObjectId } from 'mongodb';

describe('Theory Lesson Conflict Detection', () => {
  let theoryLessonCollection;
  let testLessonIds = [];

  beforeEach(async () => {
    theoryLessonCollection = await getCollection('theory_lesson');
    testLessonIds = []; // Keep track of test lessons to clean up
  });

  afterEach(async () => {
    // Clean up test lessons
    if (testLessonIds.length > 0) {
      await theoryLessonCollection.deleteMany({
        _id: { $in: testLessonIds }
      });
    }
  });

  describe('Room Conflict Detection', () => {
    it('should detect exact room and time conflicts', async () => {
      // Create an existing lesson
      const existingLesson = {
        _id: new ObjectId(),
        date: new Date('2024-07-14'),
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה א',
        teacherId: 'teacher1',
        category: 'מתחילים',
        schoolYearId: 'school1'
      };

      const result = await theoryLessonCollection.insertOne(existingLesson);
      testLessonIds.push(result.insertedId);

      // Test conflicting lesson data
      const conflictingLesson = {
        date: '2024-07-14',
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה א',
        teacherId: 'teacher2'
      };

      const conflicts = await ConflictDetectionService.checkRoomConflicts(conflictingLesson);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('room');
      expect(conflicts[0].location).toBe('חדר תאוריה א');
    });

    it('should detect partial time overlaps', async () => {
      // Create an existing lesson
      const existingLesson = {
        _id: new ObjectId(),
        date: new Date('2024-07-14'),
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה א',
        teacherId: 'teacher1',
        category: 'מתחילים',
        schoolYearId: 'school1'
      };

      const result = await theoryLessonCollection.insertOne(existingLesson);
      testLessonIds.push(result.insertedId);

      // Test overlapping scenarios
      const overlappingScenarios = [
        { start: '14:30', end: '15:30' }, // Starts before, ends during
        { start: '15:30', end: '16:30' }, // Starts during, ends after
        { start: '14:30', end: '16:30' }, // Encompasses existing
        { start: '15:15', end: '15:45' }  // Within existing
      ];

      for (const scenario of overlappingScenarios) {
        const conflictingLesson = {
          date: '2024-07-14',
          startTime: scenario.start,
          endTime: scenario.end,
          location: 'חדר תאוריה א',
          teacherId: 'teacher2'
        };

        const conflicts = await ConflictDetectionService.checkRoomConflicts(conflictingLesson);
        
        expect(conflicts.length).toBeGreaterThan(0);
        expect(conflicts[0].type).toBe('room');
      }
    });

    it('should NOT detect conflicts for different rooms', async () => {
      // Create an existing lesson
      const existingLesson = {
        _id: new ObjectId(),
        date: new Date('2024-07-14'),
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה א',
        teacherId: 'teacher1',
        category: 'מתחילים',
        schoolYearId: 'school1'
      };

      const result = await theoryLessonCollection.insertOne(existingLesson);
      testLessonIds.push(result.insertedId);

      // Test different room, same time
      const differentRoomLesson = {
        date: '2024-07-14',
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה ב', // Different room
        teacherId: 'teacher2'
      };

      const conflicts = await ConflictDetectionService.checkRoomConflicts(differentRoomLesson);
      
      expect(conflicts).toHaveLength(0);
    });

    it('should NOT detect conflicts for different dates', async () => {
      // Create an existing lesson
      const existingLesson = {
        _id: new ObjectId(),
        date: new Date('2024-07-14'),
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה א',
        teacherId: 'teacher1',
        category: 'מתחילים',
        schoolYearId: 'school1'
      };

      const result = await theoryLessonCollection.insertOne(existingLesson);
      testLessonIds.push(result.insertedId);

      // Test different date, same room and time
      const differentDateLesson = {
        date: '2024-07-15', // Different date
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה א',
        teacherId: 'teacher2'
      };

      const conflicts = await ConflictDetectionService.checkRoomConflicts(differentDateLesson);
      
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('Teacher Conflict Detection', () => {
    it('should detect teacher conflicts in different rooms', async () => {
      // Create an existing lesson
      const existingLesson = {
        _id: new ObjectId(),
        date: new Date('2024-07-14'),
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה א',
        teacherId: 'teacher1',
        category: 'מתחילים',
        schoolYearId: 'school1'
      };

      const result = await theoryLessonCollection.insertOne(existingLesson);
      testLessonIds.push(result.insertedId);

      // Test same teacher, different room, same time
      const sameTeacherLesson = {
        date: '2024-07-14',
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה ב', // Different room
        teacherId: 'teacher1' // Same teacher
      };

      const conflicts = await ConflictDetectionService.checkTeacherConflicts(sameTeacherLesson);
      
      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].type).toBe('teacher');
      expect(conflicts[0].teacherId).toBe('teacher1');
    });

    it('should NOT detect teacher conflicts in same room (covered by room conflict)', async () => {
      // Create an existing lesson
      const existingLesson = {
        _id: new ObjectId(),
        date: new Date('2024-07-14'),
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה א',
        teacherId: 'teacher1',
        category: 'מתחילים',
        schoolYearId: 'school1'
      };

      const result = await theoryLessonCollection.insertOne(existingLesson);
      testLessonIds.push(result.insertedId);

      // Test same teacher, same room, same time
      const sameTeacherSameRoomLesson = {
        date: '2024-07-14',
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה א', // Same room
        teacherId: 'teacher1' // Same teacher
      };

      const conflicts = await ConflictDetectionService.checkTeacherConflicts(sameTeacherSameRoomLesson);
      
      expect(conflicts).toHaveLength(0); // Should be 0 because same room is excluded
    });
  });

  describe('Bulk Validation', () => {
    it('should validate bulk lesson creation with conflicts', async () => {
      // Create existing lessons for multiple dates
      const existingDates = ['2024-07-14', '2024-07-21', '2024-07-28'];
      
      for (const dateStr of existingDates) {
        const existingLesson = {
          _id: new ObjectId(),
          date: new Date(dateStr),
          startTime: '15:00',
          endTime: '16:00',
          location: 'חדר תאוריה א',
          teacherId: 'teacher1',
          category: 'מתחילים',
          schoolYearId: 'school1'
        };

        const result = await theoryLessonCollection.insertOne(existingLesson);
        testLessonIds.push(result.insertedId);
      }

      // Test bulk creation with conflicts
      const bulkData = {
        startDate: '2024-07-14',
        endDate: '2024-08-04',
        dayOfWeek: 0, // Sunday
        startTime: '15:30',
        endTime: '16:30',
        location: 'חדר תאוריה א',
        teacherId: 'teacher2'
      };

      const validation = await ConflictDetectionService.validateBulkLessons(bulkData);
      
      expect(validation.hasConflicts).toBe(true);
      expect(validation.roomConflicts.length).toBe(3); // 3 conflicting Sundays
      expect(validation.affectedDates).toHaveLength(4); // 4 Sundays total
    });

    it('should generate correct recurrence dates', async () => {
      const dates = ConflictDetectionService.generateRecurrenceDates(
        '2024-07-14', // Sunday
        '2024-08-04', // Sunday
        0, // Sunday
        ['2024-07-21'] // Exclude one Sunday
      );

      expect(dates).toHaveLength(3); // 4 Sundays minus 1 excluded
      expect(dates).toContain('2024-07-14');
      expect(dates).toContain('2024-07-28');
      expect(dates).toContain('2024-08-04');
      expect(dates).not.toContain('2024-07-21');
    });
  });

  describe('Single Lesson Validation', () => {
    it('should validate single lesson with mixed conflicts', async () => {
      // Create room conflict
      const roomConflictLesson = {
        _id: new ObjectId(),
        date: new Date('2024-07-14'),
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה א',
        teacherId: 'teacher1',
        category: 'מתחילים',
        schoolYearId: 'school1'
      };

      // Create teacher conflict
      const teacherConflictLesson = {
        _id: new ObjectId(),
        date: new Date('2024-07-14'),
        startTime: '15:00',
        endTime: '16:00',
        location: 'חדר תאוריה ב',
        teacherId: 'teacher2',
        category: 'מתקדמים',
        schoolYearId: 'school1'
      };

      const result1 = await theoryLessonCollection.insertOne(roomConflictLesson);
      const result2 = await theoryLessonCollection.insertOne(teacherConflictLesson);
      testLessonIds.push(result1.insertedId, result2.insertedId);

      // Test lesson that conflicts with both
      const newLesson = {
        date: '2024-07-14',
        startTime: '15:30',
        endTime: '16:30',
        location: 'חדר תאוריה א', // Room conflict
        teacherId: 'teacher2' // Teacher conflict
      };

      const validation = await ConflictDetectionService.validateSingleLesson(newLesson);
      
      expect(validation.hasConflicts).toBe(true);
      expect(validation.roomConflicts).toHaveLength(1);
      expect(validation.teacherConflicts).toHaveLength(1);
      expect(validation.totalConflicts).toBe(2);
    });
  });
});