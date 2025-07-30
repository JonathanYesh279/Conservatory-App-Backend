/**
 * Migration Script: Teacher-Student Lesson Synchronization
 * 
 * This script implements the comprehensive backend synchronization strategy
 * to fix the "אין שיעורים" issue by establishing student teacherAssignments
 * as the single source of truth for lesson data.
 * 
 * Usage: node migrations/sync-teacher-student-lessons.js [--dry-run]
 */

import 'dotenv/config';
import { getCollection } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

const MIGRATION_CONFIG = {
  BATCH_SIZE: 100,
  LOG_PROGRESS_EVERY: 50,
  VALIDATION_ENABLED: true,
  BACKUP_COLLECTIONS: true
};

async function runMigration() {
  console.log('🚀 Starting Teacher-Student Lesson Synchronization Migration');
  console.log('===========================================================\n');

  const migrationStats = {
    startTime: new Date(),
    teachers: {
      processed: 0,
      updated: 0,
      scheduleRemoved: 0,
      errors: 0
    },
    students: {
      processed: 0,
      updated: 0,
      assignmentsFixed: 0,
      errors: 0
    },
    relationships: {
      synced: 0,
      orphansRemoved: 0,
      inconsistenciesFixed: 0
    },
    errors: []
  };

  try {
    const isDryRun = process.argv.includes('--dry-run');
    
    if (isDryRun) {
      console.log('🧪 DRY RUN MODE - No actual changes will be made\n');
    } else {
      console.log('⚠️  LIVE MIGRATION MODE - Database will be modified\n');
      
      // Create backup if requested
      if (MIGRATION_CONFIG.BACKUP_COLLECTIONS) {
        await createBackup();
      }
    }

    // Phase 1: Analyze current state
    console.log('📊 Phase 1: Analyzing current data state...');
    const analysisReport = await analyzeCurrentState();
    printAnalysisReport(analysisReport);

    // Phase 2: Sync teacher-student relationships
    console.log('\n🔄 Phase 2: Synchronizing teacher-student relationships...');
    await syncTeacherStudentRelationships(migrationStats, isDryRun);

    // Phase 3: Validate and fix teacherAssignments
    console.log('\n✅ Phase 3: Validating and fixing teacherAssignments...');
    await validateAndFixTeacherAssignments(migrationStats, isDryRun);

    // Phase 4: Remove redundant teacher schedules
    console.log('\n🗑️  Phase 4: Removing redundant teacher.teaching.schedule data...');
    await removeRedundantTeacherSchedules(migrationStats, isDryRun);

    // Phase 5: Final validation
    console.log('\n🔍 Phase 5: Final consistency validation...');
    const finalValidation = await performFinalValidation();
    printValidationResults(finalValidation);

    // Print final statistics
    migrationStats.endTime = new Date();
    printMigrationSummary(migrationStats, isDryRun);

    if (migrationStats.errors.length > 0) {
      console.log('\n⚠️  Migration completed with errors. Review the error log above.');
      return false;
    }

    console.log('\n🎉 Migration completed successfully!');
    return true;

  } catch (error) {
    console.error('\n💥 Migration failed with fatal error:', error);
    migrationStats.errors.push(`Fatal error: ${error.message}`);
    return false;
  }
}

async function createBackup() {
  console.log('💾 Creating backup of collections...');
  
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Create backup collections
    const studentBackupName = `student_backup_${timestamp}`;
    const teacherBackupName = `teacher_backup_${timestamp}`;
    
    // Copy students
    const students = await studentCollection.find({}).toArray();
    if (students.length > 0) {
      const studentBackupCollection = await getCollection(studentBackupName);
      await studentBackupCollection.insertMany(students);
      console.log(`   ✅ Backed up ${students.length} student records to ${studentBackupName}`);
    }
    
    // Copy teachers
    const teachers = await teacherCollection.find({}).toArray();
    if (teachers.length > 0) {
      const teacherBackupCollection = await getCollection(teacherBackupName);
      await teacherBackupCollection.insertMany(teachers);
      console.log(`   ✅ Backed up ${teachers.length} teacher records to ${teacherBackupName}`);
    }
    
    console.log('   💾 Backup completed successfully');
    
  } catch (error) {
    console.error('   ❌ Backup failed:', error.message);
    throw new Error(`Backup failed: ${error.message}`);
  }
}

async function analyzeCurrentState() {
  const analysis = {
    teachers: {
      total: 0,
      withStudentIds: 0,
      withSchedule: 0,
      withTimeBlocks: 0
    },
    students: {
      total: 0,
      withTeacherIds: 0,
      withTeacherAssignments: 0,
      withCompleteAssignments: 0
    },
    dataIssues: {
      teachersWithoutStudents: 0,
      studentsWithoutTeachers: 0,
      incompleteAssignments: 0,
      orphanedReferences: 0
    }
  };

  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    // Analyze teachers
    const teachers = await teacherCollection.find({ isActive: { $ne: false } }).toArray();
    analysis.teachers.total = teachers.length;
    
    for (const teacher of teachers) {
      if (teacher.teaching?.studentIds?.length > 0) {
        analysis.teachers.withStudentIds++;
      }
      if (teacher.teaching?.schedule?.length > 0) {
        analysis.teachers.withSchedule++;
      }
      if (teacher.teaching?.timeBlocks?.length > 0) {
        analysis.teachers.withTimeBlocks++;
      }
    }

    // Analyze students
    const students = await studentCollection.find({ isActive: { $ne: false } }).toArray();
    analysis.students.total = students.length;
    
    for (const student of students) {
      if (student.teacherIds?.length > 0) {
        analysis.students.withTeacherIds++;
      }
      if (student.teacherAssignments?.length > 0) {
        analysis.students.withTeacherAssignments++;
        
        // Check for complete assignments
        const completeAssignments = student.teacherAssignments.filter(assignment =>
          assignment.teacherId && assignment.day && assignment.time && assignment.duration
        );
        
        if (completeAssignments.length === student.teacherAssignments.length) {
          analysis.students.withCompleteAssignments++;
        } else {
          analysis.dataIssues.incompleteAssignments++;
        }
      }
    }

    return analysis;
    
  } catch (error) {
    console.error('Analysis failed:', error);
    throw error;
  }
}

function printAnalysisReport(analysis) {
  console.log('📈 Current Data State Analysis:');
  console.log(`   👨‍🏫 Teachers: ${analysis.teachers.total} total`);
  console.log(`      - With studentIds: ${analysis.teachers.withStudentIds}`);
  console.log(`      - With schedule data: ${analysis.teachers.withSchedule}`);
  console.log(`      - With timeBlocks: ${analysis.teachers.withTimeBlocks}`);
  
  console.log(`   👥 Students: ${analysis.students.total} total`);
  console.log(`      - With teacherIds: ${analysis.students.withTeacherIds}`);
  console.log(`      - With teacherAssignments: ${analysis.students.withTeacherAssignments}`);
  console.log(`      - With complete assignments: ${analysis.students.withCompleteAssignments}`);
  
  if (analysis.dataIssues.incompleteAssignments > 0) {
    console.log(`   ⚠️  Data Issues:`);
    console.log(`      - Incomplete assignments: ${analysis.dataIssues.incompleteAssignments}`);
  }
}

async function syncTeacherStudentRelationships(migrationStats, isDryRun) {
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    // Find all students with teacher relationships
    const students = await studentCollection.find({
      $and: [
        { isActive: { $ne: false } },
        {
          $or: [
            { teacherIds: { $exists: true, $ne: [] } },
            { teacherAssignments: { $exists: true, $ne: [] } }
          ]
        }
      ]
    }).toArray();

    console.log(`   Processing ${students.length} students with teacher relationships...`);

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      migrationStats.students.processed++;

      try {
        let studentUpdated = false;
        const studentId = student._id.toString();

        // Extract all teacher IDs from various sources
        const teacherIdsFromLegacy = student.teacherIds || [];
        const teacherIdsFromAssignments = student.teacherAssignments?.map(a => a.teacherId) || [];
        const allTeacherIds = [...new Set([...teacherIdsFromLegacy, ...teacherIdsFromAssignments])];

        // Process each teacher relationship
        for (const teacherId of allTeacherIds) {
          if (!ObjectId.isValid(teacherId)) {
            console.warn(`     ⚠️  Invalid teacherId format: ${teacherId} for student ${studentId}`);
            continue;
          }

          // Verify teacher exists
          const teacher = await teacherCollection.findOne({
            _id: ObjectId.createFromHexString(teacherId),
            isActive: { $ne: false }
          });

          if (!teacher) {
            console.warn(`     ⚠️  Teacher ${teacherId} not found for student ${studentId}`);
            migrationStats.relationships.orphansRemoved++;
            
            // Remove orphaned reference from student
            if (!isDryRun) {
              await studentCollection.updateOne(
                { _id: student._id },
                {
                  $pull: { 
                    teacherIds: teacherId,
                    teacherAssignments: { teacherId: teacherId }
                  }
                }
              );
              studentUpdated = true;
            }
            continue;
          }

          // Ensure teacher has student in studentIds
          const teacherStudentIds = teacher.teaching?.studentIds || [];
          if (!teacherStudentIds.includes(studentId)) {
            console.log(`     🔄 Adding student ${studentId} to teacher ${teacherId} studentIds`);
            migrationStats.relationships.synced++;
            
            if (!isDryRun) {
              await teacherCollection.updateOne(
                { _id: ObjectId.createFromHexString(teacherId) },
                {
                  $addToSet: { 'teaching.studentIds': studentId },
                  $set: { updatedAt: new Date() }
                }
              );
            }
          }
        }

        // Update student's teacherIds to be consistent with teacherAssignments
        if (student.teacherAssignments?.length > 0) {
          const consistentTeacherIds = [...new Set(student.teacherAssignments.map(a => a.teacherId))];
          const currentTeacherIds = student.teacherIds || [];
          
          if (JSON.stringify(consistentTeacherIds.sort()) !== JSON.stringify(currentTeacherIds.sort())) {
            console.log(`     🔄 Syncing teacherIds for student ${studentId}`);
            migrationStats.relationships.inconsistenciesFixed++;
            
            if (!isDryRun) {
              await studentCollection.updateOne(
                { _id: student._id },
                {
                  $set: { 
                    teacherIds: consistentTeacherIds,
                    updatedAt: new Date()
                  }
                }
              );
              studentUpdated = true;
            }
          }
        }

        if (studentUpdated) {
          migrationStats.students.updated++;
        }

        // Progress logging
        if ((i + 1) % MIGRATION_CONFIG.LOG_PROGRESS_EVERY === 0) {
          console.log(`     📊 Progress: ${i + 1}/${students.length} students processed`);
        }

      } catch (error) {
        console.error(`     ❌ Error processing student ${student._id}:`, error.message);
        migrationStats.students.errors++;
        migrationStats.errors.push(`Student ${student._id}: ${error.message}`);
      }
    }

    console.log(`   ✅ Relationship sync completed: ${migrationStats.relationships.synced} relationships synced`);

  } catch (error) {
    console.error('   ❌ Teacher-student relationship sync failed:', error);
    throw error;
  }
}

async function validateAndFixTeacherAssignments(migrationStats, isDryRun) {
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    const students = await studentCollection.find({
      teacherAssignments: { $exists: true, $ne: [] },
      isActive: { $ne: false }
    }).toArray();

    console.log(`   Validating ${students.length} students with teacherAssignments...`);

    for (let i = 0; i < students.length; i++) {
      const student = students[i];
      
      try {
        let assignmentsFixed = false;
        const validatedAssignments = [];

        for (const assignment of student.teacherAssignments || []) {
          // Skip invalid assignments
          if (!assignment.teacherId || !ObjectId.isValid(assignment.teacherId)) {
            console.warn(`     ⚠️  Invalid teacherId in assignment for student ${student._id}`);
            migrationStats.students.assignmentsFixed++;
            continue;
          }

          // Verify teacher exists
          const teacher = await teacherCollection.findOne({
            _id: ObjectId.createFromHexString(assignment.teacherId),
            isActive: { $ne: false }
          });

          if (!teacher) {
            console.warn(`     ⚠️  Teacher ${assignment.teacherId} not found for assignment in student ${student._id}`);
            migrationStats.students.assignmentsFixed++;
            continue;
          }

          // Validate required fields
          const validatedAssignment = { ...assignment };
          let assignmentModified = false;

          // Ensure required fields are present
          if (!validatedAssignment.day) {
            console.warn(`     ⚠️  Missing day in assignment for student ${student._id}, teacher ${assignment.teacherId}`);
            // Try to infer from scheduleSlotId if available
            if (assignment.scheduleSlotId && teacher.teaching?.timeBlocks) {
              const timeBlock = teacher.teaching.timeBlocks.find(block => 
                block._id.toString() === assignment.scheduleSlotId
              );
              if (timeBlock?.day) {
                validatedAssignment.day = timeBlock.day;
                assignmentModified = true;
              }
            }
          }

          if (!validatedAssignment.time) {
            console.warn(`     ⚠️  Missing time in assignment for student ${student._id}, teacher ${assignment.teacherId}`);
            // Try to infer from scheduleSlotId
            if (assignment.scheduleSlotId && teacher.teaching?.timeBlocks) {
              const timeBlock = teacher.teaching.timeBlocks.find(block => 
                block._id.toString() === assignment.scheduleSlotId
              );
              if (timeBlock?.startTime) {
                validatedAssignment.time = timeBlock.startTime;
                assignmentModified = true;
              }
            }
          }

          if (!validatedAssignment.duration) {
            console.warn(`     ⚠️  Missing duration in assignment for student ${student._id}, teacher ${assignment.teacherId}`);
            validatedAssignment.duration = 45; // Default duration
            assignmentModified = true;
          }

          // Ensure proper structure
          if (!validatedAssignment.scheduleInfo && (validatedAssignment.day || validatedAssignment.time || validatedAssignment.duration)) {
            validatedAssignment.scheduleInfo = {
              day: validatedAssignment.day,
              startTime: validatedAssignment.time,
              endTime: calculateEndTime(validatedAssignment.time, validatedAssignment.duration),
              duration: validatedAssignment.duration
            };
            assignmentModified = true;
          }

          // Set default values for missing fields
          if (!validatedAssignment.isActive) {
            validatedAssignment.isActive = true;
            assignmentModified = true;
          }

          if (!validatedAssignment.createdAt) {
            validatedAssignment.createdAt = new Date();
            assignmentModified = true;
          }

          validatedAssignment.updatedAt = new Date();

          if (assignmentModified) {
            assignmentsFixed = true;
            migrationStats.students.assignmentsFixed++;
          }

          validatedAssignments.push(validatedAssignment);
        }

        // Update student if assignments were fixed
        if (assignmentsFixed && !isDryRun) {
          await studentCollection.updateOne(
            { _id: student._id },
            {
              $set: {
                teacherAssignments: validatedAssignments,
                updatedAt: new Date()
              }
            }
          );
          migrationStats.students.updated++;
        }

        // Progress logging
        if ((i + 1) % MIGRATION_CONFIG.LOG_PROGRESS_EVERY === 0) {
          console.log(`     📊 Progress: ${i + 1}/${students.length} students validated`);
        }

      } catch (error) {
        console.error(`     ❌ Error validating student ${student._id}:`, error.message);
        migrationStats.students.errors++;
        migrationStats.errors.push(`Student validation ${student._id}: ${error.message}`);
      }
    }

    console.log(`   ✅ Assignment validation completed: ${migrationStats.students.assignmentsFixed} assignments fixed`);

  } catch (error) {
    console.error('   ❌ TeacherAssignments validation failed:', error);
    throw error;
  }
}

async function removeRedundantTeacherSchedules(migrationStats, isDryRun) {
  try {
    const teacherCollection = await getCollection('teacher');

    // Find teachers with schedule data
    const teachersWithSchedule = await teacherCollection.find({
      'teaching.schedule': { $exists: true, $ne: [] },
      isActive: { $ne: false }
    }).toArray();

    console.log(`   Found ${teachersWithSchedule.length} teachers with redundant schedule data...`);

    for (let i = 0; i < teachersWithSchedule.length; i++) {
      const teacher = teachersWithSchedule[i];
      migrationStats.teachers.processed++;

      try {
        console.log(`     🗑️  Removing schedule from teacher ${teacher._id} (${teacher.personalInfo?.fullName || 'Unknown'})`);
        
        if (!isDryRun) {
          await teacherCollection.updateOne(
            { _id: teacher._id },
            {
              $unset: { 'teaching.schedule': 1 },
              $set: { updatedAt: new Date() }
            }
          );
        }

        migrationStats.teachers.scheduleRemoved++;
        migrationStats.teachers.updated++;

        // Progress logging
        if ((i + 1) % MIGRATION_CONFIG.LOG_PROGRESS_EVERY === 0) {
          console.log(`     📊 Progress: ${i + 1}/${teachersWithSchedule.length} teachers processed`);
        }

      } catch (error) {
        console.error(`     ❌ Error removing schedule from teacher ${teacher._id}:`, error.message);
        migrationStats.teachers.errors++;
        migrationStats.errors.push(`Teacher schedule removal ${teacher._id}: ${error.message}`);
      }
    }

    console.log(`   ✅ Schedule removal completed: ${migrationStats.teachers.scheduleRemoved} schedules removed`);

  } catch (error) {
    console.error('   ❌ Teacher schedule removal failed:', error);
    throw error;
  }
}

async function performFinalValidation() {
  const validation = {
    passed: true,
    issues: [],
    summary: {
      teachersAnalyzed: 0,
      studentsAnalyzed: 0,
      relationshipIssues: 0,
      dataIntegrityIssues: 0
    }
  };

  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    // Validate teacher-student relationships
    const students = await studentCollection.find({
      teacherAssignments: { $exists: true, $ne: [] },
      isActive: { $ne: false }
    }).toArray();

    validation.summary.studentsAnalyzed = students.length;

    for (const student of students) {
      const studentId = student._id.toString();
      
      for (const assignment of student.teacherAssignments || []) {
        if (!assignment.teacherId || !ObjectId.isValid(assignment.teacherId)) {
          validation.issues.push({
            type: 'INVALID_TEACHER_ID',
            studentId,
            teacherId: assignment.teacherId
          });
          validation.summary.dataIntegrityIssues++;
          continue;
        }

        // Check if teacher has student in studentIds
        const teacher = await teacherCollection.findOne({
          _id: ObjectId.createFromHexString(assignment.teacherId)
        });

        if (!teacher) {
          validation.issues.push({
            type: 'TEACHER_NOT_FOUND',
            studentId,
            teacherId: assignment.teacherId
          });
          validation.summary.relationshipIssues++;
          continue;
        }

        const teacherStudentIds = teacher.teaching?.studentIds || [];
        if (!teacherStudentIds.includes(studentId)) {
          validation.issues.push({
            type: 'MISSING_BIDIRECTIONAL_REFERENCE',
            studentId,
            teacherId: assignment.teacherId
          });
          validation.summary.relationshipIssues++;
        }

        // Validate assignment completeness
        if (!assignment.day || !assignment.time || !assignment.duration) {
          validation.issues.push({
            type: 'INCOMPLETE_ASSIGNMENT',
            studentId,
            teacherId: assignment.teacherId,
            missing: {
              day: !assignment.day,
              time: !assignment.time,
              duration: !assignment.duration
            }
          });
          validation.summary.dataIntegrityIssues++;
        }
      }
    }

    // Check for orphaned teacher references
    const teachers = await teacherCollection.find({
      'teaching.studentIds': { $exists: true, $ne: [] },
      isActive: { $ne: false }
    }).toArray();

    validation.summary.teachersAnalyzed = teachers.length;

    for (const teacher of teachers) {
      const teacherId = teacher._id.toString();
      
      for (const studentId of teacher.teaching?.studentIds || []) {
        const student = await studentCollection.findOne({
          _id: ObjectId.createFromHexString(studentId)
        });

        if (!student) {
          validation.issues.push({
            type: 'STUDENT_NOT_FOUND',
            teacherId,
            studentId
          });
          validation.summary.relationshipIssues++;
          continue;
        }

        // Check if student has teacher in assignments
        const hasAssignment = student.teacherAssignments?.some(assignment => 
          assignment.teacherId === teacherId
        );

        if (!hasAssignment) {
          validation.issues.push({
            type: 'MISSING_STUDENT_ASSIGNMENT',
            teacherId,
            studentId
          });
          validation.summary.relationshipIssues++;
        }
      }
    }

    validation.passed = validation.issues.length === 0;
    
  } catch (error) {
    validation.passed = false;
    validation.issues.push({
      type: 'VALIDATION_ERROR',
      error: error.message
    });
  }

  return validation;
}

function printValidationResults(validation) {
  console.log('🔍 Final Validation Results:');
  console.log(`   📊 Summary:`);
  console.log(`      - Teachers analyzed: ${validation.summary.teachersAnalyzed}`);
  console.log(`      - Students analyzed: ${validation.summary.studentsAnalyzed}`);
  console.log(`      - Relationship issues: ${validation.summary.relationshipIssues}`);
  console.log(`      - Data integrity issues: ${validation.summary.dataIntegrityIssues}`);

  if (validation.passed) {
    console.log('   ✅ All validations passed!');
  } else {
    console.log('   ⚠️  Validation issues found:');
    validation.issues.slice(0, 10).forEach((issue, index) => {
      console.log(`      ${index + 1}. ${issue.type}: ${JSON.stringify(issue, null, 2)}`);
    });
    
    if (validation.issues.length > 10) {
      console.log(`      ... and ${validation.issues.length - 10} more issues`);
    }
  }
}

function printMigrationSummary(stats, isDryRun) {
  const duration = (stats.endTime - stats.startTime) / 1000;
  
  console.log('\n📈 Migration Summary:');
  console.log('===================');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  console.log();
  
  console.log('👨‍🏫 Teachers:');
  console.log(`   - Processed: ${stats.teachers.processed}`);
  console.log(`   - Updated: ${stats.teachers.updated}`);
  console.log(`   - Schedules removed: ${stats.teachers.scheduleRemoved}`);
  console.log(`   - Errors: ${stats.teachers.errors}`);
  
  console.log('\n👥 Students:');
  console.log(`   - Processed: ${stats.students.processed}`);
  console.log(`   - Updated: ${stats.students.updated}`);
  console.log(`   - Assignments fixed: ${stats.students.assignmentsFixed}`);
  console.log(`   - Errors: ${stats.students.errors}`);
  
  console.log('\n🔄 Relationships:');
  console.log(`   - Synced: ${stats.relationships.synced}`);
  console.log(`   - Orphans removed: ${stats.relationships.orphansRemoved}`);
  console.log(`   - Inconsistencies fixed: ${stats.relationships.inconsistenciesFixed}`);
  
  if (stats.errors.length > 0) {
    console.log('\n❌ Errors:');
    stats.errors.slice(0, 5).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
    
    if (stats.errors.length > 5) {
      console.log(`   ... and ${stats.errors.length - 5} more errors`);
    }
  }
}

// Helper function to calculate end time
function calculateEndTime(startTime, duration) {
  if (!startTime || !duration) return null;
  
  const [hours, minutes] = startTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes + duration;
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  
  return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
}

// Execute migration if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigration()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Migration execution failed:', error);
      process.exit(1);
    });
}

export { runMigration };