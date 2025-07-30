#!/usr/bin/env node

/**
 * 🔥 CRITICAL BACKEND SYNC FIX SCRIPT
 * 
 * This script fixes the teacher-student sync issue where:
 * - Students have teacherAssignments but teachers don't have corresponding lessons in timeBlocks
 * - This causes frontend calendar and attendance features to break
 * 
 * Run this script AFTER deploying the backend fixes to repair existing data.
 * 
 * Usage: node scripts/fix-teacher-student-sync.js [--dry-run] [--fix]
 */

import { getCollection } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const shouldFix = args.includes('--fix');

console.log(`🔥 TEACHER-STUDENT SYNC REPAIR SCRIPT STARTING`);
console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : shouldFix ? 'FIX MODE (will make changes)' : 'CHECK ONLY'}`);
console.log(`================================================`);

async function checkTeacherStudentSync() {
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');
    const syncIssues = [];
    const repairActions = [];

    console.log(`📊 Analyzing student records for sync issues...`);

    // Get all students with teacher assignments
    const students = await studentCollection.find({
      teacherAssignments: { $exists: true, $ne: [] }
    }).toArray();

    console.log(`Found ${students.length} students with teacher assignments`);

    for (const student of students) {
      if (!student.teacherAssignments || student.teacherAssignments.length === 0) continue;

      console.log(`\n🔍 Checking student: ${student.personalInfo?.fullName} (${student._id})`);
      console.log(`   Has ${student.teacherAssignments.length} teacher assignments`);

      for (const assignment of student.teacherAssignments) {
        if (!assignment.isActive) continue;

        const { teacherId, timeBlockId, lessonId } = assignment;
        
        if (!teacherId || !timeBlockId) {
          console.log(`   ⚠️  Invalid assignment: missing teacherId or timeBlockId`);
          continue;
        }

        // Check if teacher has corresponding lesson in timeBlock
        const teacher = await teacherCollection.findOne({
          _id: ObjectId.createFromHexString(teacherId),
          'teaching.timeBlocks._id': ObjectId.createFromHexString(timeBlockId)
        });

        if (!teacher) {
          const issue = {
            type: 'TEACHER_OR_TIMEBLOCK_NOT_FOUND',
            studentId: student._id.toString(),
            studentName: student.personalInfo?.fullName,
            teacherId,
            timeBlockId,
            lessonId,
            assignment
          };
          syncIssues.push(issue);
          console.log(`   ❌ Teacher ${teacherId} or timeBlock ${timeBlockId} not found`);
          continue;
        }

        const timeBlock = teacher.teaching.timeBlocks.find(tb => tb._id.toString() === timeBlockId);
        if (!timeBlock) {
          const issue = {
            type: 'TIMEBLOCK_NOT_FOUND',
            studentId: student._id.toString(),
            studentName: student.personalInfo?.fullName,
            teacherId,
            timeBlockId,
            lessonId,
            assignment
          };
          syncIssues.push(issue);
          console.log(`   ❌ TimeBlock ${timeBlockId} not found in teacher record`);
          continue;
        }

        // Check if lesson exists in teacher's timeBlock
        const hasMatchingLesson = timeBlock.assignedLessons?.some(lesson =>
          lesson.studentId === student._id.toString() &&
          lesson.isActive &&
          (lessonId ? lesson._id.toString() === lessonId : true)
        );

        if (!hasMatchingLesson) {
          const issue = {
            type: 'MISSING_TEACHER_LESSON',
            studentId: student._id.toString(),
            studentName: student.personalInfo?.fullName,
            teacherId,
            teacherName: teacher.personalInfo?.fullName,
            timeBlockId,
            lessonId,
            assignment,
            timeBlock
          };
          syncIssues.push(issue);
          console.log(`   ❌ SYNC ISSUE: Student has assignment but teacher timeBlock lacks corresponding lesson`);
          console.log(`      Assignment: ${assignment.scheduleInfo?.day} ${assignment.scheduleInfo?.startTime}-${assignment.scheduleInfo?.endTime}`);
          console.log(`      TimeBlock has ${timeBlock.assignedLessons?.length || 0} lessons`);

          // Prepare repair action
          const repairAction = {
            type: 'ADD_MISSING_LESSON',
            teacherId,
            timeBlockId,
            lessonToAdd: {
              _id: lessonId ? ObjectId.createFromHexString(lessonId) : new ObjectId(),
              studentId: student._id.toString(),
              studentName: student.personalInfo?.fullName || 'Unknown Student',
              lessonStartTime: assignment.scheduleInfo?.startTime || '00:00',
              lessonEndTime: assignment.scheduleInfo?.endTime || '00:45',
              duration: assignment.scheduleInfo?.duration || 45,
              notes: assignment.notes || '',
              attended: undefined,
              isActive: true,
              isRecurring: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          };
          repairActions.push(repairAction);
        } else {
          console.log(`   ✅ Sync OK: Teacher has corresponding lesson`);
        }
      }
    }

    // Check for orphaned teacher lessons (lessons without corresponding student assignments)
    console.log(`\n📊 Checking for orphaned teacher lessons...`);
    
    const teachers = await teacherCollection.find({
      'teaching.timeBlocks.assignedLessons': { $exists: true, $ne: [] }
    }).toArray();

    for (const teacher of teachers) {
      if (!teacher.teaching?.timeBlocks) continue;

      for (const timeBlock of teacher.teaching.timeBlocks) {
        if (!timeBlock.assignedLessons || timeBlock.assignedLessons.length === 0) continue;

        for (const lesson of timeBlock.assignedLessons) {
          if (!lesson.isActive || !lesson.studentId) continue;

          // Check if student has corresponding assignment
          const student = await studentCollection.findOne({
            _id: ObjectId.createFromHexString(lesson.studentId),
            'teacherAssignments.teacherId': teacher._id.toString(),
            'teacherAssignments.timeBlockId': timeBlock._id.toString(),
            'teacherAssignments.isActive': true
          });

          if (!student) {
            const issue = {
              type: 'ORPHANED_TEACHER_LESSON',
              teacherId: teacher._id.toString(),
              teacherName: teacher.personalInfo?.fullName,
              timeBlockId: timeBlock._id.toString(),
              lessonId: lesson._id.toString(),
              studentId: lesson.studentId,
              studentName: lesson.studentName,
              lesson
            };
            syncIssues.push(issue);
            console.log(`   ❌ ORPHAN: Teacher ${teacher.personalInfo?.fullName} has lesson for student ${lesson.studentName} but student lacks assignment`);
          }
        }
      }
    }

    // Summary
    console.log(`\n📋 SYNC ISSUE SUMMARY`);
    console.log(`=====================`);
    console.log(`Total sync issues found: ${syncIssues.length}`);
    
    const issueTypes = syncIssues.reduce((acc, issue) => {
      acc[issue.type] = (acc[issue.type] || 0) + 1;
      return acc;
    }, {});

    Object.entries(issueTypes).forEach(([type, count]) => {
      console.log(`  ${type}: ${count}`);
    });

    console.log(`\nRepair actions prepared: ${repairActions.length}`);

    // Execute repairs if in fix mode
    if (shouldFix && !isDryRun) {
      console.log(`\n🔧 EXECUTING REPAIRS...`);
      
      for (const action of repairActions) {
        try {
          if (action.type === 'ADD_MISSING_LESSON') {
            await teacherCollection.updateOne(
              { 
                _id: ObjectId.createFromHexString(action.teacherId),
                'teaching.timeBlocks._id': ObjectId.createFromHexString(action.timeBlockId)
              },
              { 
                $push: { 'teaching.timeBlocks.$.assignedLessons': action.lessonToAdd },
                $addToSet: { 'teaching.studentIds': action.lessonToAdd.studentId },
                $set: { 
                  'teaching.timeBlocks.$.updatedAt': new Date(),
                  updatedAt: new Date()
                }
              }
            );
            console.log(`   ✅ Added missing lesson for student ${action.lessonToAdd.studentName} to teacher timeBlock`);
          }
        } catch (err) {
          console.error(`   ❌ Failed to repair ${action.type}:`, err.message);
        }
      }

      console.log(`\n✅ REPAIR COMPLETED`);
      console.log(`Fixed ${repairActions.length} sync issues`);
    } else if (shouldFix && isDryRun) {
      console.log(`\n🔧 DRY RUN: Would execute ${repairActions.length} repair actions`);
      repairActions.forEach((action, index) => {
        console.log(`   ${index + 1}. ${action.type} for ${action.lessonToAdd?.studentName || 'unknown'}`);
      });
    }

    // Output detailed issues for manual review
    if (syncIssues.length > 0) {
      console.log(`\n📝 DETAILED ISSUES FOR MANUAL REVIEW:`);
      console.log(`=====================================`);
      
      syncIssues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.type}`);
        console.log(`   Student: ${issue.studentName} (${issue.studentId})`);
        if (issue.teacherName) console.log(`   Teacher: ${issue.teacherName} (${issue.teacherId})`);
        if (issue.timeBlockId) console.log(`   TimeBlock: ${issue.timeBlockId}`);
        if (issue.assignment?.scheduleInfo) {
          console.log(`   Schedule: ${issue.assignment.scheduleInfo.day} ${issue.assignment.scheduleInfo.startTime}-${issue.assignment.scheduleInfo.endTime}`);
        }
      });
    }

    return {
      totalIssues: syncIssues.length,
      issueTypes,
      repairActions: repairActions.length,
      issues: syncIssues
    };

  } catch (err) {
    console.error('❌ Error during sync check:', err);
    throw err;
  }
}

// Run the check
checkTeacherStudentSync()
  .then(result => {
    console.log(`\n🎯 SYNC CHECK COMPLETED`);
    console.log(`Found ${result.totalIssues} sync issues`);
    
    if (result.totalIssues === 0) {
      console.log(`✅ All teacher-student records are in sync!`);
    } else {
      console.log(`\nTo fix these issues:`);
      console.log(`1. Run: node scripts/fix-teacher-student-sync.js --fix --dry-run  (to preview changes)`);
      console.log(`2. Run: node scripts/fix-teacher-student-sync.js --fix           (to apply fixes)`);
    }
    
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });