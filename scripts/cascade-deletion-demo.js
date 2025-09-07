/**
 * MongoDB Cascade Deletion System Demo Script
 * Demonstrates all cascade deletion operations, aggregations, and bulk updates
 * Can be run in MongoDB shell or Node.js environment
 */

import { initializeMongoDB, getDB } from '../services/mongoDB.service.js';
import { createCascadeDeletionIndexes, analyzeCascadeDeletionIndexes } from '../migrations/cascade-deletion-indexes.js';
import { cascadeDeletionCleanup } from '../migrations/cascade-deletion-cleanup.js';
import { cascadeDeletionAggregationService } from '../services/cascadeDeletionAggregation.service.js';
import { cascadeDeletionService } from '../services/cascadeDeletion.service.js';

// Demo script for MongoDB operations
const cascadeDeletionDemo = {

  async runCompleteDemo() {
    try {
      console.log('=== MongoDB Cascade Deletion System Demo ===\n');
      
      // Initialize connection
      await initializeMongoDB();
      console.log('✓ Database connection established\n');
      
      // Step 1: Create performance indexes
      console.log('1. Creating cascade deletion indexes...');
      await createCascadeDeletionIndexes();
      console.log('✓ Indexes created successfully\n');
      
      // Step 2: Run migration setup
      console.log('2. Running migration setup...');
      await cascadeDeletionCleanup.runCompleteMigration();
      console.log('✓ Migration completed successfully\n');
      
      // Step 3: Analyze current data integrity
      console.log('3. Analyzing data integrity...');
      const integrityReport = await cascadeDeletionAggregationService.validateDataIntegrity();
      console.log('Data Integrity Score:', integrityReport.overallHealth.score + '/100');
      console.log('Issues found:');
      Object.entries(integrityReport.overallHealth.issues).forEach(([key, count]) => {
        console.log(`  - ${key}: ${count}`);
      });
      console.log('✓ Integrity analysis completed\n');
      
      // Step 4: Find orphaned references
      console.log('4. Finding orphaned student references...');
      const orphanedRefs = await cascadeDeletionAggregationService.findOrphanedStudentReferences();
      console.log('Orphaned references found:');
      Object.entries(orphanedRefs.summary.byCollection).forEach(([collection, count]) => {
        console.log(`  - ${collection}: ${count} orphaned references`);
      });
      console.log('✓ Orphaned reference analysis completed\n');
      
      // Step 5: Detect bidirectional inconsistencies
      console.log('5. Detecting bidirectional inconsistencies...');
      const inconsistencies = await cascadeDeletionAggregationService.detectBidirectionalInconsistencies();
      console.log(`Total inconsistencies found: ${inconsistencies.summary.totalInconsistencies}`);
      Object.entries(inconsistencies.summary.byType).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}`);
      });
      console.log('✓ Bidirectional inconsistency analysis completed\n');
      
      // Step 6: Demonstrate cascade deletion (if test data available)
      await this.demonstrateCascadeDeletion();
      
      // Step 7: Analyze index performance
      console.log('7. Analyzing index performance...');
      const indexAnalysis = await analyzeCascadeDeletionIndexes();
      console.log('Index Analysis Summary:');
      Object.entries(indexAnalysis).forEach(([collection, stats]) => {
        console.log(`  - ${collection}: ${stats.cascadeIndexes}/${stats.totalIndexes} cascade indexes, ${stats.documentCount} documents`);
      });
      console.log('✓ Index analysis completed\n');
      
      console.log('=== Demo completed successfully ===');
      
    } catch (error) {
      console.error('Demo failed:', error);
      throw error;
    }
  },

  async demonstrateCascadeDeletion() {
    try {
      const db = getDB();
      
      // Find a test student (inactive or test data)
      const testStudent = await db.collection('student').findOne({
        $or: [
          { isActive: false },
          { 'personalInfo.firstName': { $regex: /test/i } }
        ]
      });
      
      if (!testStudent) {
        console.log('6. Skipping cascade deletion demo - no suitable test data found\n');
        return;
      }
      
      console.log('6. Demonstrating cascade deletion...');
      console.log(`Selected test student: ${testStudent.personalInfo?.firstName} ${testStudent.personalInfo?.lastName} (ID: ${testStudent._id})`);
      
      // Generate impact report
      const impactReport = await cascadeDeletionAggregationService.generateCascadeDeletionImpactReport(testStudent._id.toString());
      console.log('Cascade deletion impact:');
      Object.entries(impactReport.impactSummary).forEach(([key, count]) => {
        console.log(`  - ${key}: ${count}`);
      });
      
      // If student is already inactive, demonstrate restoration instead
      if (!testStudent.isActive) {
        console.log('Student is already inactive - this would be suitable for restoration demo');
      } else {
        console.log('Student is active - cascade deletion would affect the above relationships');
      }
      
      console.log('✓ Cascade deletion analysis completed\n');
      
    } catch (error) {
      console.error('Error in cascade deletion demo:', error);
    }
  },

  async demonstrateBulkOperations() {
    try {
      console.log('=== Bulk Operations Demo ===\n');
      
      const db = getDB();
      
      // Demonstrate bulk schedule updates
      console.log('1. Demonstrating bulk schedule operations...');
      
      // Find some test operations (free slots from inactive students)
      const inactiveStudents = await db.collection('student')
        .find({ isActive: false })
        .limit(3)
        .toArray();
      
      if (inactiveStudents.length > 0) {
        const operations = inactiveStudents.map(student => ({
          type: 'free_student_slots',
          studentId: student._id.toString()
        }));
        
        console.log(`Preparing ${operations.length} bulk operations...`);
        
        // This would execute the bulk operations
        // const bulkResult = await cascadeDeletionService.bulkUpdateTeacherSchedules(operations);
        // console.log('Bulk operations completed:', bulkResult);
        
        console.log('✓ Bulk operations demo completed (simulated)\n');
      } else {
        console.log('No inactive students found for bulk operations demo\n');
      }
      
    } catch (error) {
      console.error('Error in bulk operations demo:', error);
    }
  },

  async runPerformanceTests() {
    try {
      console.log('=== Performance Tests ===\n');
      
      const db = getDB();
      
      console.log('1. Testing aggregation pipeline performance...');
      
      // Test orphaned reference detection performance
      const start1 = Date.now();
      await cascadeDeletionAggregationService.findOrphanedStudentReferences();
      const duration1 = Date.now() - start1;
      console.log(`Orphaned reference detection: ${duration1}ms`);
      
      // Test bidirectional consistency check performance
      const start2 = Date.now();
      await cascadeDeletionAggregationService.detectBidirectionalInconsistencies();
      const duration2 = Date.now() - start2;
      console.log(`Bidirectional consistency check: ${duration2}ms`);
      
      // Test data integrity validation performance
      const start3 = Date.now();
      await cascadeDeletionAggregationService.validateDataIntegrity();
      const duration3 = Date.now() - start3;
      console.log(`Complete data integrity validation: ${duration3}ms`);
      
      console.log('✓ Performance tests completed\n');
      
    } catch (error) {
      console.error('Error in performance tests:', error);
    }
  }
};

// Native MongoDB Shell Commands (for direct execution)
const mongoShellCommands = {
  
  // Create indexes using native MongoDB commands
  createIndexesNative: `
    // Create cascade deletion performance indexes
    
    // Student collection indexes
    db.student.createIndex({ _id: 1, isActive: 1 }, { name: "student_cascade_primary" });
    db.student.createIndex({ "teacherIds": 1, isActive: 1 }, { name: "student_teacher_cascade" });
    db.student.createIndex({ "orchestraIds": 1, isActive: 1 }, { name: "student_orchestra_cascade" });
    db.student.createIndex({ "bagrutId": 1, isActive: 1 }, { name: "student_bagrut_cascade", sparse: true });
    db.student.createIndex({ "teacherAssignments.teacherId": 1, isActive: 1 }, { name: "student_assignments_cascade" });
    
    // Teacher collection indexes
    db.teacher.createIndex({ _id: 1, isActive: 1 }, { name: "teacher_cascade_primary" });
    db.teacher.createIndex({ "teaching.studentIds": 1, isActive: 1 }, { name: "teacher_students_cascade" });
    db.teacher.createIndex({ "teaching.schedule.studentId": 1, isActive: 1 }, { name: "teacher_schedule_cascade", sparse: true });
    
    // Orchestra collection indexes
    db.orchestra.createIndex({ "memberIds": 1, isActive: 1 }, { name: "orchestra_members_cascade" });
    db.orchestra.createIndex({ "conductorId": 1, isActive: 1 }, { name: "orchestra_conductor_cascade", sparse: true });
    
    // Other collection indexes
    db.rehearsal.createIndex({ "groupId": 1, "date": -1 }, { name: "rehearsal_group_cascade" });
    db.rehearsal.createIndex({ "attendance.studentId": 1, "date": -1 }, { name: "rehearsal_attendance_cascade" });
    db.theory_lesson.createIndex({ "teacherId": 1, "date": -1 }, { name: "theory_teacher_cascade" });
    db.theory_lesson.createIndex({ "studentIds": 1, "date": -1 }, { name: "theory_students_cascade" });
    db.bagrut.createIndex({ "studentId": 1, isActive: 1 }, { name: "bagrut_student_cascade" });
    db.activity_attendance.createIndex({ "studentId": 1, "activityType": 1, "status": 1 }, { name: "attendance_student_cascade" });
  `,
  
  // Aggregation pipeline for finding orphaned students
  findOrphanedStudentsAggregation: `
    // Find all active student IDs
    var activeStudentIds = db.student.distinct("_id", { isActive: true });
    
    // Find orphaned references in teacher collection
    db.teacher.aggregate([
      { $match: { isActive: true } },
      { $unwind: "$teaching.studentIds" },
      { $match: { "teaching.studentIds": { $nin: activeStudentIds } } },
      {
        $group: {
          _id: "$teaching.studentIds",
          referencedInTeachers: { $push: "$_id" },
          count: { $sum: 1 }
        }
      }
    ]);
    
    // Find orphaned references in orchestra collection
    db.orchestra.aggregate([
      { $match: { isActive: true } },
      { $unwind: "$memberIds" },
      { $match: { memberIds: { $nin: activeStudentIds } } },
      {
        $group: {
          _id: "$memberIds",
          referencedInOrchestras: { $push: "$_id" },
          count: { $sum: 1 }
        }
      }
    ]);
  `,
  
  // Bulk cleanup operations
  bulkCleanupOperations: `
    // Get all active student IDs
    var activeStudentIds = db.student.distinct("_id", { isActive: true });
    
    // Clean up teacher references
    db.teacher.updateMany(
      { isActive: true },
      { $pull: { "teaching.studentIds": { $nin: activeStudentIds } } }
    );
    
    // Clean up teacher schedules
    db.teacher.updateMany(
      { 
        isActive: true,
        "teaching.schedule.studentId": { $nin: activeStudentIds }
      },
      {
        $set: {
          "teaching.schedule.$[slot].studentId": null,
          "teaching.schedule.$[slot].status": "available"
        }
      },
      {
        arrayFilters: [{ "slot.studentId": { $nin: activeStudentIds } }]
      }
    );
    
    // Clean up orchestra members
    db.orchestra.updateMany(
      { isActive: true },
      { $pull: { memberIds: { $nin: activeStudentIds } } }
    );
    
    // Archive orphaned bagrut records
    db.bagrut.updateMany(
      { 
        studentId: { $nin: activeStudentIds },
        isActive: true
      },
      {
        $set: { 
          isActive: false,
          archivedReason: "student_no_longer_active",
          archivedAt: new Date()
        }
      }
    );
  `,
  
  // Bidirectional consistency check
  bidirectionalConsistencyCheck: `
    // Find students that reference teachers but teachers don't reference back
    db.student.aggregate([
      { $match: { isActive: true } },
      { $unwind: "$teacherIds" },
      {
        $lookup: {
          from: "teacher",
          let: { studentId: "$_id", teacherId: "$teacherIds" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$_id", "$$teacherId"] },
                    { $eq: ["$isActive", true] },
                    { $not: { $in: ["$$studentId", "$teaching.studentIds"] } }
                  ]
                }
              }
            }
          ],
          as: "inconsistentTeacher"
        }
      },
      { $match: { inconsistentTeacher: { $ne: [] } } }
    ]);
  `
};

// Export the demo object for use
export { cascadeDeletionDemo, mongoShellCommands };

// If running directly, execute the demo
if (import.meta.url === `file://${process.argv[1]}`) {
  cascadeDeletionDemo.runCompleteDemo()
    .then(() => {
      console.log('Demo completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Demo failed:', error);
      process.exit(1);
    });
}