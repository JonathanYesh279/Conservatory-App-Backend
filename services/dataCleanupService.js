/**
 * Data Cleanup Service
 * 
 * This service provides functions to detect and fix data inconsistencies
 * between teacher and student documents, specifically:
 * - Orphaned studentIds in teacher documents
 * - Orphaned teacherIds in student documents
 * - Inactive teacherAssignments with active references
 * - Mismatched schedule information
 */

import { getCollection, withTransaction } from './mongoDB.service.js';
import { ObjectId } from 'mongodb';

export const dataCleanupService = {
  detectInconsistencies,
  fixAllInconsistencies,
  fixTeacherStudentRelationships,
  fixOrphanedTeacherAssignments,
  fixOrphanedScheduleInfo,
  generateCleanupReport
};

/**
 * Detect all data inconsistencies in teacher-student relationships
 */
async function detectInconsistencies() {
  try {
    console.log('🔍 CLEANUP DETECTION: Starting comprehensive data consistency check...');
    
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    
    const issues = {
      orphanedStudentIds: [],
      orphanedTeacherIds: [],
      inactiveAssignmentsWithActiveRefs: [],
      missingTeacherAssignments: [],
      orphanedScheduleInfo: [],
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        warnings: 0
      }
    };
    
    // Get all teachers and students
    const teachers = await teacherCollection.find({}).toArray();
    const students = await studentCollection.find({}).toArray();
    
    console.log(`📊 Analyzing ${teachers.length} teachers and ${students.length} students...`);
    
    // Check for orphaned studentIds in teacher documents
    for (const teacher of teachers) {
      if (teacher.teaching?.studentIds?.length > 0) {
        for (const studentId of teacher.teaching.studentIds) {
          const studentExists = students.find(s => s._id.toString() === studentId);
          if (!studentExists) {
            issues.orphanedStudentIds.push({
              teacherId: teacher._id.toString(),
              teacherName: teacher.personalInfo?.fullName || 'Unknown',
              orphanedStudentId: studentId,
              severity: 'HIGH'
            });
          } else {
            // Check if student has corresponding teacherId
            const hasTeacherRef = studentExists.teacherIds?.includes(teacher._id.toString());
            if (!hasTeacherRef) {
              issues.missingTeacherAssignments.push({
                teacherId: teacher._id.toString(),
                teacherName: teacher.personalInfo?.fullName || 'Unknown',
                studentId: studentId,
                studentName: studentExists.personalInfo?.fullName || 'Unknown',
                issue: 'Teacher has studentId but student missing teacherId',
                severity: 'CRITICAL'
              });
            }
          }
        }
      }
    }
    
    // Check for orphaned teacherIds and teacherAssignments in student documents
    for (const student of students) {
      try {
        const studentId = student._id.toString();
        const studentName = student.personalInfo?.fullName || 'Unknown';
        
        // Check orphaned teacherIds
        if (student.teacherIds && Array.isArray(student.teacherIds) && student.teacherIds.length > 0) {
          for (const teacherId of student.teacherIds) {
            const teacherExists = teachers.find(t => t._id.toString() === teacherId);
            if (!teacherExists) {
              issues.orphanedTeacherIds.push({
                studentId,
                studentName,
                orphanedTeacherId: teacherId,
                severity: 'HIGH'
              });
            } else {
              // Check if teacher has corresponding studentId
              const hasStudentRef = teacherExists.teaching?.studentIds?.includes(studentId);
              if (!hasStudentRef) {
                issues.missingTeacherAssignments.push({
                  studentId,
                  studentName,
                  teacherId,
                  teacherName: teacherExists.personalInfo?.fullName || 'Unknown',
                  issue: 'Student has teacherId but teacher missing studentId',
                  severity: 'CRITICAL'
                });
              }
            }
          }
        }
      
        // Check teacherAssignments for inconsistencies
        if (student.teacherAssignments && Array.isArray(student.teacherAssignments) && student.teacherAssignments.length > 0) {
          for (const assignment of student.teacherAssignments) {
            if (assignment && assignment.teacherId) {
              const teacherId = assignment.teacherId;
              const teacherExists = teachers.find(t => t._id.toString() === teacherId);
              
              if (!teacherExists) {
                issues.orphanedTeacherAssignments.push({
                  studentId,
                  studentName,
                  assignmentId: assignment._id || 'no-id',
                  orphanedTeacherId: teacherId,
                  isActive: assignment.isActive,
                  severity: 'HIGH'
                });
              } else if (assignment.isActive) {
                // Check if active assignment has proper references
                const hasTeacherStudentRef = teacherExists.teaching?.studentIds?.includes(studentId);
                const hasStudentTeacherRef = student.teacherIds?.includes(teacherId);
                
                if (!hasTeacherStudentRef || !hasStudentTeacherRef) {
                  issues.inactiveAssignmentsWithActiveRefs.push({
                    studentId,
                    studentName,
                    teacherId,
                    teacherName: teacherExists.personalInfo?.fullName || 'Unknown',
                    assignmentId: assignment._id || 'no-id',
                    hasTeacherRef: hasTeacherStudentRef,
                    hasStudentRef: hasStudentTeacherRef,
                    severity: 'CRITICAL'
                  });
                }
              }
            }
          }
        }
      
      // Check schedule info for orphaned references
      try {
        if (student.scheduleInfo && 
            student.scheduleInfo.lessonSchedule && 
            Array.isArray(student.scheduleInfo.lessonSchedule) &&
            student.scheduleInfo.lessonSchedule.length > 0) {
          
          for (const lesson of student.scheduleInfo.lessonSchedule) {
            if (lesson && lesson.teacherId) {
              const teacherExists = teachers.find(t => t._id.toString() === lesson.teacherId);
              const hasActiveAssignment = student.teacherAssignments?.some(
                a => a.teacherId === lesson.teacherId && a.isActive
              );
              
              if (!teacherExists || !hasActiveAssignment) {
                issues.orphanedScheduleInfo.push({
                  studentId,
                  studentName,
                  scheduleItem: lesson,
                  teacherExists: !!teacherExists,
                  hasActiveAssignment,
                  severity: 'MEDIUM'
                });
              }
            }
          }
        }
      } catch (scheduleError) {
        console.warn(`⚠️ Error checking schedule info for student ${studentId}: ${scheduleError.message}`);
        // Continue processing other students
      }
      
      } catch (studentError) {
        console.warn(`⚠️ Error processing student ${student._id}: ${studentError.message}`);
        // Continue processing other students
      }
    }
    
    // Calculate summary with safety checks
    issues.summary.totalIssues = 
      (issues.orphanedStudentIds?.length || 0) +
      (issues.orphanedTeacherIds?.length || 0) +
      (issues.inactiveAssignmentsWithActiveRefs?.length || 0) +
      (issues.missingTeacherAssignments?.length || 0) +
      (issues.orphanedTeacherAssignments?.length || 0) +
      (issues.orphanedScheduleInfo?.length || 0);
      
    issues.summary.criticalIssues = 
      (issues.inactiveAssignmentsWithActiveRefs?.length || 0) +
      (issues.missingTeacherAssignments?.length || 0);
      
    issues.summary.warnings = 
      (issues.orphanedStudentIds?.length || 0) +
      (issues.orphanedTeacherIds?.length || 0) +
      (issues.orphanedTeacherAssignments?.length || 0) +
      (issues.orphanedScheduleInfo?.length || 0);
    
    console.log(`🔍 CLEANUP DETECTION COMPLETE: Found ${issues.summary.totalIssues} issues (${issues.summary.criticalIssues} critical, ${issues.summary.warnings} warnings)`);
    
    return issues;
    
  } catch (err) {
    console.error(`❌ Error detecting inconsistencies: ${err.message}`);
    throw new Error(`Error detecting inconsistencies: ${err.message}`);
  }
}

/**
 * Fix all detected inconsistencies
 */
async function fixAllInconsistencies(dryRun = true) {
  try {
    console.log(`🔧 CLEANUP FIX: Starting comprehensive fix (dry run: ${dryRun})...`);
    
    const issues = await detectInconsistencies();
    
    if (issues.summary.totalIssues === 0) {
      return {
        success: true,
        message: 'No inconsistencies found - database is clean',
        fixes: [],
        summary: { totalFixes: 0 }
      };
    }
    
    const fixes = [];
    
    if (dryRun) {
      console.log('🔍 DRY RUN MODE: No actual changes will be made');
      
      // Generate fix plan
      if (issues.orphanedStudentIds?.length > 0) {
        fixes.push(...issues.orphanedStudentIds.map(issue => ({
          type: 'remove_orphaned_student_id',
          teacherId: issue.teacherId,
          studentId: issue.orphanedStudentId,
          action: 'Remove from teacher.teaching.studentIds',
          severity: issue.severity
        })));
      }
      
      if (issues.orphanedTeacherIds?.length > 0) {
        fixes.push(...issues.orphanedTeacherIds.map(issue => ({
          type: 'remove_orphaned_teacher_id', 
          studentId: issue.studentId,
          teacherId: issue.orphanedTeacherId,
          action: 'Remove from student.teacherIds',
          severity: issue.severity
        })));
      }
      
      if (issues.orphanedTeacherAssignments?.length > 0) {
        fixes.push(...issues.orphanedTeacherAssignments.map(issue => ({
          type: 'deactivate_orphaned_assignment',
          studentId: issue.studentId,
          teacherId: issue.orphanedTeacherId,
          assignmentId: issue.assignmentId,
          action: 'Set assignment.isActive = false',
          severity: issue.severity
        })));
      }
      
      if (issues.inactiveAssignmentsWithActiveRefs?.length > 0) {
        fixes.push(...issues.inactiveAssignmentsWithActiveRefs.map(issue => ({
          type: 'fix_assignment_references',
          studentId: issue.studentId,
          teacherId: issue.teacherId,
          hasTeacherRef: issue.hasTeacherRef,
          hasStudentRef: issue.hasStudentRef,
          action: 'Synchronize references or deactivate assignment',
          severity: issue.severity
        })));
      }
      
      return {
        success: true,
        dryRun: true,
        message: `Fix plan generated for ${fixes.length} issues`,
        issues,
        fixPlan: fixes,
        summary: { 
          totalIssues: issues.summary.totalIssues,
          plannedFixes: fixes.length 
        }
      };
    }
    
    // Execute actual fixes
    return await withTransaction(async (session) => {
      const teacherCollection = await getCollection('teacher');
      const studentCollection = await getCollection('student');
      
      let fixedCount = 0;
      
      // Fix orphaned studentIds in teacher documents
      for (const issue of issues.orphanedStudentIds) {
        await teacherCollection.updateOne(
          { _id: ObjectId.createFromHexString(issue.teacherId) },
          { 
            $pull: { 'teaching.studentIds': issue.orphanedStudentId },
            $set: { 
              updatedAt: new Date(),
              'metadata.lastModifiedBy': 'data_cleanup_service'
            }
          },
          { session }
        );
        
        fixes.push({
          type: 'remove_orphaned_student_id',
          teacherId: issue.teacherId,
          studentId: issue.orphanedStudentId,
          status: 'fixed'
        });
        fixedCount++;
      }
      
      // Fix orphaned teacherIds in student documents
      for (const issue of issues.orphanedTeacherIds) {
        await studentCollection.updateOne(
          { _id: ObjectId.createFromHexString(issue.studentId) },
          { 
            $pull: { teacherIds: issue.orphanedTeacherId },
            $set: { 
              updatedAt: new Date(),
              'metadata.lastModifiedBy': 'data_cleanup_service'
            }
          },
          { session }
        );
        
        fixes.push({
          type: 'remove_orphaned_teacher_id',
          studentId: issue.studentId,
          teacherId: issue.orphanedTeacherId,
          status: 'fixed'
        });
        fixedCount++;
      }
      
      // Deactivate orphaned teacher assignments
      for (const issue of issues.orphanedTeacherAssignments) {
        await studentCollection.updateOne(
          { 
            _id: ObjectId.createFromHexString(issue.studentId),
            'teacherAssignments.teacherId': issue.orphanedTeacherId
          },
          { 
            $set: { 
              'teacherAssignments.$.isActive': false,
              'teacherAssignments.$.endDate': new Date(),
              'teacherAssignments.$.updatedAt': new Date(),
              updatedAt: new Date(),
              'metadata.lastModifiedBy': 'data_cleanup_service'
            }
          },
          { session }
        );
        
        fixes.push({
          type: 'deactivate_orphaned_assignment',
          studentId: issue.studentId,
          teacherId: issue.orphanedTeacherId,
          status: 'fixed'
        });
        fixedCount++;
      }
      
      return {
        success: true,
        message: `Successfully fixed ${fixedCount} data inconsistencies`,
        fixes,
        summary: { 
          totalIssues: issues.summary.totalIssues,
          totalFixes: fixedCount 
        },
        timestamp: new Date()
      };
    });
    
  } catch (err) {
    console.error(`❌ Error fixing inconsistencies: ${err.message}`);
    throw new Error(`Error fixing inconsistencies: ${err.message}`);
  }
}

/**
 * Fix specific teacher-student relationship inconsistencies
 */
async function fixTeacherStudentRelationships(teacherId, studentId) {
  try {
    console.log(`🔧 RELATIONSHIP FIX: Fixing relationship between teacher ${teacherId} and student ${studentId}`);
    
    return await withTransaction(async (session) => {
      const teacherCollection = await getCollection('teacher');
      const studentCollection = await getCollection('student');
      
      const teacher = await teacherCollection.findOne(
        { _id: ObjectId.createFromHexString(teacherId) },
        { session }
      );
      
      const student = await studentCollection.findOne(
        { _id: ObjectId.createFromHexString(studentId) },
        { session }
      );
      
      if (!teacher || !student) {
        throw new Error('Teacher or student not found');
      }
      
      const fixes = [];
      
      // Check and fix teacher's studentIds
      const hasStudentRef = teacher.teaching?.studentIds?.includes(studentId);
      const hasTeacherRef = student.teacherIds?.includes(teacherId);
      const hasActiveAssignment = student.teacherAssignments?.some(
        a => a.teacherId === teacherId && a.isActive
      );
      
      // If no active assignment exists, remove all references
      if (!hasActiveAssignment) {
        if (hasStudentRef) {
          await teacherCollection.updateOne(
            { _id: ObjectId.createFromHexString(teacherId) },
            { 
              $pull: { 'teaching.studentIds': studentId },
              $set: { updatedAt: new Date() }
            },
            { session }
          );
          fixes.push('Removed studentId from teacher');
        }
        
        if (hasTeacherRef) {
          await studentCollection.updateOne(
            { _id: ObjectId.createFromHexString(studentId) },
            { 
              $pull: { teacherIds: teacherId },
              $set: { updatedAt: new Date() }
            },
            { session }
          );
          fixes.push('Removed teacherId from student');
        }
      } else {
        // If active assignment exists, ensure both references exist
        if (!hasStudentRef) {
          await teacherCollection.updateOne(
            { _id: ObjectId.createFromHexString(teacherId) },
            { 
              $addToSet: { 'teaching.studentIds': studentId },
              $set: { updatedAt: new Date() }
            },
            { session }
          );
          fixes.push('Added studentId to teacher');
        }
        
        if (!hasTeacherRef) {
          await studentCollection.updateOne(
            { _id: ObjectId.createFromHexString(studentId) },
            { 
              $addToSet: { teacherIds: teacherId },
              $set: { updatedAt: new Date() }
            },
            { session }
          );
          fixes.push('Added teacherId to student');
        }
      }
      
      return {
        success: true,
        message: `Relationship between teacher ${teacherId} and student ${studentId} synchronized`,
        fixes,
        hasActiveAssignment
      };
    });
    
  } catch (err) {
    console.error(`❌ Error fixing relationship: ${err.message}`);
    throw new Error(`Error fixing relationship: ${err.message}`);
  }
}

/**
 * Fix orphaned teacher assignments
 */
async function fixOrphanedTeacherAssignments(studentId) {
  try {
    console.log(`🔧 ASSIGNMENT FIX: Fixing orphaned assignments for student ${studentId}`);
    
    return await withTransaction(async (session) => {
      const studentCollection = await getCollection('student');
      const teacherCollection = await getCollection('teacher');
      
      const student = await studentCollection.findOne(
        { _id: ObjectId.createFromHexString(studentId) },
        { session }
      );
      
      if (!student) {
        throw new Error('Student not found');
      }
      
      const fixes = [];
      
      if (student.teacherAssignments?.length > 0) {
        for (const assignment of student.teacherAssignments) {
          if (assignment.isActive) {
            const teacher = await teacherCollection.findOne(
              { _id: ObjectId.createFromHexString(assignment.teacherId) },
              { session }
            );
            
            if (!teacher) {
              // Deactivate assignment for non-existent teacher
              await studentCollection.updateOne(
                { 
                  _id: ObjectId.createFromHexString(studentId),
                  'teacherAssignments.teacherId': assignment.teacherId
                },
                { 
                  $set: { 
                    'teacherAssignments.$.isActive': false,
                    'teacherAssignments.$.endDate': new Date(),
                    'teacherAssignments.$.updatedAt': new Date(),
                    updatedAt: new Date()
                  }
                },
                { session }
              );
              
              fixes.push(`Deactivated assignment for non-existent teacher ${assignment.teacherId}`);
            }
          }
        }
      }
      
      return {
        success: true,
        message: `Fixed ${fixes.length} orphaned assignments for student ${studentId}`,
        fixes
      };
    });
    
  } catch (err) {
    console.error(`❌ Error fixing orphaned assignments: ${err.message}`);
    throw new Error(`Error fixing orphaned assignments: ${err.message}`);
  }
}

/**
 * Fix orphaned schedule information
 */
async function fixOrphanedScheduleInfo(studentId) {
  try {
    console.log(`🔧 SCHEDULE FIX: Fixing orphaned schedule info for student ${studentId}`);
    
    return await withTransaction(async (session) => {
      const studentCollection = await getCollection('student');
      const teacherCollection = await getCollection('teacher');
      
      const student = await studentCollection.findOne(
        { _id: ObjectId.createFromHexString(studentId) },
        { session }
      );
      
      if (!student) {
        throw new Error('Student not found');
      }
      
      const fixes = [];
      const cleanupOperations = [];
      
      // Check lesson schedule
      try {
        if (student.scheduleInfo && 
            student.scheduleInfo.lessonSchedule && 
            Array.isArray(student.scheduleInfo.lessonSchedule) &&
            student.scheduleInfo.lessonSchedule.length > 0) {
          
          for (const lesson of student.scheduleInfo.lessonSchedule) {
            if (lesson && lesson.teacherId) {
              const hasActiveAssignment = student.teacherAssignments?.some(
                a => a.teacherId === lesson.teacherId && a.isActive
              );
              
              if (!hasActiveAssignment) {
                cleanupOperations.push({
                  field: 'scheduleInfo.lessonSchedule',
                  value: { teacherId: lesson.teacherId }
                });
                fixes.push(`Marked lesson for teacher ${lesson.teacherId} for removal`);
              }
            }
          }
        }
      } catch (scheduleError) {
        console.warn(`⚠️ Error processing schedule info for student ${studentId}: ${scheduleError.message}`);
        // Continue with cleanup
      }
      
      // Execute cleanup operations
      if (cleanupOperations.length > 0) {
        const pullOperations = {};
        
        for (const op of cleanupOperations) {
          if (!pullOperations[op.field]) {
            pullOperations[op.field] = [];
          }
          pullOperations[op.field].push(op.value);
        }
        
        const updateDoc = { $pull: {} };
        for (const [field, values] of Object.entries(pullOperations)) {
          updateDoc.$pull[field] = { $in: values };
        }
        
        updateDoc.$set = {
          'scheduleInfo.lastUpdated': new Date(),
          updatedAt: new Date()
        };
        
        await studentCollection.updateOne(
          { _id: ObjectId.createFromHexString(studentId) },
          updateDoc,
          { session }
        );
      }
      
      return {
        success: true,
        message: `Fixed ${fixes.length} orphaned schedule items for student ${studentId}`,
        fixes
      };
    });
    
  } catch (err) {
    console.error(`❌ Error fixing orphaned schedule info: ${err.message}`);
    throw new Error(`Error fixing orphaned schedule info: ${err.message}`);
  }
}

/**
 * Generate a comprehensive cleanup report
 */
async function generateCleanupReport() {
  try {
    console.log('📊 CLEANUP REPORT: Generating comprehensive data consistency report...');
    
    const issues = await detectInconsistencies();
    
    const report = {
      timestamp: new Date(),
      summary: issues.summary,
      issues: issues,
      recommendations: [],
      priority: 'NORMAL'
    };
    
    // Add recommendations based on findings
    if (issues.summary.criticalIssues > 0) {
      report.priority = 'HIGH';
      report.recommendations.push({
        type: 'IMMEDIATE_ACTION',
        message: `${issues.summary.criticalIssues} critical inconsistencies found that could cause data corruption`,
        action: 'Run fixAllInconsistencies() immediately'
      });
    }
    
    if (issues.orphanedStudentIds.length > 0) {
      report.recommendations.push({
        type: 'CLEANUP',
        message: `${issues.orphanedStudentIds.length} teachers have references to non-existent students`,
        action: 'Remove orphaned studentIds from teacher documents'
      });
    }
    
    if (issues.orphanedTeacherIds.length > 0) {
      report.recommendations.push({
        type: 'CLEANUP',
        message: `${issues.orphanedTeacherIds.length} students have references to non-existent teachers`,
        action: 'Remove orphaned teacherIds from student documents'
      });
    }
    
    if (issues.inactiveAssignmentsWithActiveRefs.length > 0) {
      report.recommendations.push({
        type: 'CRITICAL',
        message: `${issues.inactiveAssignmentsWithActiveRefs.length} active assignments with missing cross-references`,
        action: 'Synchronize references or deactivate invalid assignments'
      });
    }
    
    if (issues.summary.totalIssues === 0) {
      report.recommendations.push({
        type: 'SUCCESS',
        message: 'No data inconsistencies detected - database is clean',
        action: 'No action required'
      });
    }
    
    console.log(`📊 CLEANUP REPORT COMPLETE: ${issues.summary.totalIssues} issues found`);
    
    return report;
    
  } catch (err) {
    console.error(`❌ Error generating cleanup report: ${err.message}`);
    throw new Error(`Error generating cleanup report: ${err.message}`);
  }
}