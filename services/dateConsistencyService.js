/**
 * Date Consistency Service
 * Provides utilities to check and ensure date consistency across the conservatory app
 */

import { getCollection } from './mongoDB.service.js';
import { 
  createAppDate, 
  formatDate, 
  isValidDate,
  now,
  isSameDay,
  getStartOfDay,
  getEndOfDay
} from '../utils/dateHelpers.js';

class DateConsistencyService {

  /**
   * Check for date inconsistencies across all collections
   * @returns {Object} Consistency report
   */
  async performConsistencyCheck() {
    const report = {
      timestamp: now().format(),
      collections: {},
      summary: {
        total: 0,
        valid: 0,
        invalid: 0,
        warnings: 0
      },
      issues: []
    };

    try {
      // Check theory lessons
      report.collections.theoryLessons = await this.checkTheoryLessonDates();
      
      // Check rehearsals
      report.collections.rehearsals = await this.checkRehearsalDates();
      
      // Check attendance records
      report.collections.attendance = await this.checkAttendanceDates();
      
      // Check schedule slots
      report.collections.scheduleSlots = await this.checkScheduleDates();

      // Calculate summary
      this.calculateSummary(report);

      return report;
    } catch (error) {
      report.error = error.message;
      return report;
    }
  }

  /**
   * Check theory lesson date consistency
   */
  async checkTheoryLessonDates() {
    const results = {
      collection: 'theory_lesson',
      total: 0,
      valid: 0,
      invalid: 0,
      issues: []
    };

    try {
      const collection = await getCollection('theory_lesson');
      const lessons = await collection.find({}).toArray();

      results.total = lessons.length;

      for (const lesson of lessons) {
        const issues = this.validateLessonDateFields(lesson, 'theory_lesson');
        if (issues.length > 0) {
          results.invalid++;
          results.issues.push({
            _id: lesson._id.toString(),
            date: lesson.date,
            issues: issues
          });
        } else {
          results.valid++;
        }

        // Check day of week consistency
        if (lesson.date && lesson.dayOfWeek !== undefined) {
          const actualDayOfWeek = createAppDate(lesson.date).day();
          if (actualDayOfWeek !== lesson.dayOfWeek) {
            results.issues.push({
              _id: lesson._id.toString(),
              date: lesson.date,
              issues: [`Day of week mismatch: stored=${lesson.dayOfWeek}, actual=${actualDayOfWeek}`]
            });
          }
        }
      }
    } catch (error) {
      results.error = error.message;
    }

    return results;
  }

  /**
   * Check rehearsal date consistency
   */
  async checkRehearsalDates() {
    const results = {
      collection: 'rehearsal',
      total: 0,
      valid: 0,
      invalid: 0,
      issues: []
    };

    try {
      const collection = await getCollection('rehearsal');
      const rehearsals = await collection.find({}).toArray();

      results.total = rehearsals.length;

      for (const rehearsal of rehearsals) {
        const issues = this.validateLessonDateFields(rehearsal, 'rehearsal');
        if (issues.length > 0) {
          results.invalid++;
          results.issues.push({
            _id: rehearsal._id.toString(),
            date: rehearsal.date,
            issues: issues
          });
        } else {
          results.valid++;
        }

        // Check day of week consistency
        if (rehearsal.date && rehearsal.dayOfWeek !== undefined) {
          const actualDayOfWeek = createAppDate(rehearsal.date).day();
          if (actualDayOfWeek !== rehearsal.dayOfWeek) {
            results.issues.push({
              _id: rehearsal._id.toString(),
              date: rehearsal.date,
              issues: [`Day of week mismatch: stored=${rehearsal.dayOfWeek}, actual=${actualDayOfWeek}`]
            });
          }
        }
      }
    } catch (error) {
      results.error = error.message;
    }

    return results;
  }

  /**
   * Check attendance record date consistency
   */
  async checkAttendanceDates() {
    const results = {
      collection: 'activity_attendance',
      total: 0,
      valid: 0,
      invalid: 0,
      issues: []
    };

    try {
      const collection = await getCollection('activity_attendance');
      const records = await collection.find({}).toArray();

      results.total = records.length;

      for (const record of records) {
        const issues = [];

        // Check date field
        if (!record.date || !isValidDate(record.date)) {
          issues.push('Invalid or missing date field');
        }

        // Check createdAt field
        if (!record.createdAt || !isValidDate(record.createdAt)) {
          issues.push('Invalid or missing createdAt field');
        }

        // Check logical consistency
        if (record.date && record.createdAt) {
          const recordDate = createAppDate(record.date);
          const createdDate = createAppDate(record.createdAt);
          
          // Attendance shouldn't be marked before the lesson date (except for advance planning)
          if (recordDate.isAfter(createdDate.add(1, 'day'))) {
            issues.push('Attendance marked more than 1 day before lesson date');
          }
        }

        if (issues.length > 0) {
          results.invalid++;
          results.issues.push({
            _id: record._id.toString(),
            date: record.date,
            issues: issues
          });
        } else {
          results.valid++;
        }
      }
    } catch (error) {
      results.error = error.message;
    }

    return results;
  }

  /**
   * Check teacher schedule date consistency
   */
  async checkScheduleDates() {
    const results = {
      collection: 'teacher_schedules',
      total: 0,
      valid: 0,
      invalid: 0,
      issues: []
    };

    try {
      const collection = await getCollection('teacher');
      const teachers = await collection.find({}).toArray();

      for (const teacher of teachers) {
        // Check timeBlocks system
        if (teacher.teaching && teacher.teaching.timeBlocks) {
          for (const block of teacher.teaching.timeBlocks) {
            if (!block.assignedLessons) continue;
            for (const lesson of block.assignedLessons) {
              results.total++;
              const issues = [];

              if (lesson.createdAt && !isValidDate(lesson.createdAt)) {
                issues.push('Invalid createdAt timestamp in timeBlock lesson');
              }
              if (lesson.updatedAt && !isValidDate(lesson.updatedAt)) {
                issues.push('Invalid updatedAt timestamp in timeBlock lesson');
              }

              if (issues.length > 0) {
                results.invalid++;
                results.issues.push({
                  teacherId: teacher._id.toString(),
                  blockId: block._id?.toString(),
                  lessonId: lesson._id?.toString(),
                  issues: issues
                });
              } else {
                results.valid++;
              }
            }
          }
        }
      }
    } catch (error) {
      results.error = error.message;
    }

    return results;
  }

  /**
   * Validate common date fields in lesson-like objects
   */
  validateLessonDateFields(obj, collectionName) {
    const issues = [];

    // Check main date field
    if (!obj.date || !isValidDate(obj.date)) {
      issues.push('Invalid or missing date field');
    }

    // Check timestamps
    if (!obj.createdAt || !isValidDate(obj.createdAt)) {
      issues.push('Invalid or missing createdAt timestamp');
    }

    if (!obj.updatedAt || !isValidDate(obj.updatedAt)) {
      issues.push('Invalid or missing updatedAt timestamp');
    }

    // Check logical consistency
    if (obj.createdAt && obj.updatedAt) {
      const created = createAppDate(obj.createdAt);
      const updated = createAppDate(obj.updatedAt);
      
      if (updated.isBefore(created)) {
        issues.push('updatedAt is before createdAt');
      }
    }

    return issues;
  }

  /**
   * Calculate summary statistics for the report
   */
  calculateSummary(report) {
    const collections = Object.values(report.collections);
    
    report.summary.total = collections.reduce((sum, col) => sum + (col.total || 0), 0);
    report.summary.valid = collections.reduce((sum, col) => sum + (col.valid || 0), 0);
    report.summary.invalid = collections.reduce((sum, col) => sum + (col.invalid || 0), 0);
    
    // Collect all issues
    report.issues = collections.reduce((allIssues, col) => {
      if (col.issues) {
        return allIssues.concat(col.issues.map(issue => ({
          collection: col.collection,
          ...issue
        })));
      }
      return allIssues;
    }, []);

    report.summary.warnings = report.issues.length;
  }

  /**
   * Fix common date consistency issues
   * @param {Object} options - Fix options
   */
  async fixDateConsistencies(options = {}) {
    const { dryRun = true, collections = ['all'] } = options;
    const results = {
      timestamp: now().format(),
      dryRun,
      collections: {},
      summary: {
        totalFixed: 0,
        errors: 0
      }
    };

    try {
      if (collections.includes('all') || collections.includes('theory_lesson')) {
        results.collections.theoryLessons = await this.fixTheoryLessonDates(dryRun);
      }

      if (collections.includes('all') || collections.includes('rehearsal')) {
        results.collections.rehearsals = await this.fixRehearsalDates(dryRun);
      }

      // Calculate summary
      const collectionResults = Object.values(results.collections);
      results.summary.totalFixed = collectionResults.reduce((sum, col) => sum + (col.fixed || 0), 0);
      results.summary.errors = collectionResults.reduce((sum, col) => sum + (col.errors || 0), 0);

    } catch (error) {
      results.error = error.message;
    }

    return results;
  }

  /**
   * Fix theory lesson date inconsistencies
   */
  async fixTheoryLessonDates(dryRun = true) {
    const results = {
      collection: 'theory_lesson',
      fixed: 0,
      errors: 0,
      details: []
    };

    try {
      const collection = await getCollection('theory_lesson');
      const lessons = await collection.find({}).toArray();

      for (const lesson of lessons) {
        try {
          let needsUpdate = false;
          const updates = {};

          // Fix day of week if inconsistent
          if (lesson.date && lesson.dayOfWeek !== undefined) {
            const actualDayOfWeek = createAppDate(lesson.date).day();
            if (actualDayOfWeek !== lesson.dayOfWeek) {
              updates.dayOfWeek = actualDayOfWeek;
              needsUpdate = true;
              results.details.push({
                _id: lesson._id.toString(),
                fix: `Updated dayOfWeek from ${lesson.dayOfWeek} to ${actualDayOfWeek}`
              });
            }
          }

          if (needsUpdate && !dryRun) {
            await collection.updateOne(
              { _id: lesson._id },
              { $set: updates }
            );
            results.fixed++;
          } else if (needsUpdate) {
            results.fixed++; // Count what would be fixed in dry run
          }
        } catch (error) {
          results.errors++;
          results.details.push({
            _id: lesson._id.toString(),
            error: error.message
          });
        }
      }
    } catch (error) {
      results.error = error.message;
    }

    return results;
  }

  /**
   * Fix rehearsal date inconsistencies
   */
  async fixRehearsalDates(dryRun = true) {
    const results = {
      collection: 'rehearsal',
      fixed: 0,
      errors: 0,
      details: []
    };

    try {
      const collection = await getCollection('rehearsal');
      const rehearsals = await collection.find({}).toArray();

      for (const rehearsal of rehearsals) {
        try {
          let needsUpdate = false;
          const updates = {};

          // Fix day of week if inconsistent
          if (rehearsal.date && rehearsal.dayOfWeek !== undefined) {
            const actualDayOfWeek = createAppDate(rehearsal.date).day();
            if (actualDayOfWeek !== rehearsal.dayOfWeek) {
              updates.dayOfWeek = actualDayOfWeek;
              needsUpdate = true;
              results.details.push({
                _id: rehearsal._id.toString(),
                fix: `Updated dayOfWeek from ${rehearsal.dayOfWeek} to ${actualDayOfWeek}`
              });
            }
          }

          if (needsUpdate && !dryRun) {
            await collection.updateOne(
              { _id: rehearsal._id },
              { $set: updates }
            );
            results.fixed++;
          } else if (needsUpdate) {
            results.fixed++; // Count what would be fixed in dry run
          }
        } catch (error) {
          results.errors++;
          results.details.push({
            _id: rehearsal._id.toString(),
            error: error.message
          });
        }
      }
    } catch (error) {
      results.error = error.message;
    }

    return results;
  }

  /**
   * Get date statistics across collections
   */
  async getDateStatistics() {
    const stats = {
      timestamp: now().format(),
      collections: {}
    };

    try {
      // Theory lessons date range
      const theoryCollection = await getCollection('theory_lesson');
      const theoryStats = await theoryCollection.aggregate([
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            minDate: { $min: '$date' },
            maxDate: { $max: '$date' },
            avgDate: { $avg: { $toLong: '$date' } }
          }
        }
      ]).toArray();

      if (theoryStats[0]) {
        stats.collections.theoryLessons = {
          count: theoryStats[0].count,
          dateRange: {
            min: formatDate(theoryStats[0].minDate, 'DD/MM/YYYY'),
            max: formatDate(theoryStats[0].maxDate, 'DD/MM/YYYY')
          }
        };
      }

      // Rehearsals date range
      const rehearsalCollection = await getCollection('rehearsal');
      const rehearsalStats = await rehearsalCollection.aggregate([
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            minDate: { $min: '$date' },
            maxDate: { $max: '$date' }
          }
        }
      ]).toArray();

      if (rehearsalStats[0]) {
        stats.collections.rehearsals = {
          count: rehearsalStats[0].count,
          dateRange: {
            min: formatDate(rehearsalStats[0].minDate, 'DD/MM/YYYY'),
            max: formatDate(rehearsalStats[0].maxDate, 'DD/MM/YYYY')
          }
        };
      }

      // Attendance records date range
      const attendanceCollection = await getCollection('activity_attendance');
      const attendanceStats = await attendanceCollection.aggregate([
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            minDate: { $min: '$date' },
            maxDate: { $max: '$date' }
          }
        }
      ]).toArray();

      if (attendanceStats[0]) {
        stats.collections.attendance = {
          count: attendanceStats[0].count,
          dateRange: {
            min: formatDate(attendanceStats[0].minDate, 'DD/MM/YYYY'),
            max: formatDate(attendanceStats[0].maxDate, 'DD/MM/YYYY')
          }
        };
      }

    } catch (error) {
      stats.error = error.message;
    }

    return stats;
  }
}

export default new DateConsistencyService();