/**
 * 🔥 CRITICAL SYNC REPAIR UTILITY
 *
 * This script fixes the bidirectional sync between students and teachers.
 *
 * Problem: Students have teacherAssignments with teacherIds, but teachers
 * don't have those students in their teaching.studentIds array.
 *
 * Solution: This script scans all students, extracts active teacherAssignments,
 * and ensures the corresponding teachers have those students in their studentIds.
 *
 * Usage: node scripts/sync-teacher-student-relationships.js [--dry-run]
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/conservatory';
const MONGODB_NAME = process.env.MONGODB_NAME || 'Conservatory-DB';
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log('🔧 Teacher-Student Relationship Sync Utility');
  console.log('='.repeat(60));
  console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN (no changes will be made)' : '⚡ LIVE (will make changes)'}`);
  console.log(`Database: ${MONGODB_NAME}`);
  console.log('');

  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db(MONGODB_NAME);
    const studentCollection = db.collection('student');
    const teacherCollection = db.collection('teacher');

    // Step 1: Get all students with teacherAssignments
    console.log('\n📊 Step 1: Analyzing student records...');
    const students = await studentCollection.find({
      'teacherAssignments.0': { $exists: true }
    }).toArray();

    console.log(`Found ${students.length} students with teacher assignments`);

    // Step 2: Build a map of teacher -> students that should be assigned
    const teacherStudentMap = new Map(); // teacherId -> Set of studentIds

    for (const student of students) {
      const studentId = student._id.toString();
      const assignments = student.teacherAssignments || [];

      for (const assignment of assignments) {
        if (!assignment.teacherId || assignment.isActive === false) continue;

        const teacherId = assignment.teacherId;

        if (!teacherStudentMap.has(teacherId)) {
          teacherStudentMap.set(teacherId, new Set());
        }
        teacherStudentMap.get(teacherId).add(studentId);
      }
    }

    console.log(`\n📊 Step 2: Found ${teacherStudentMap.size} teachers with active student assignments`);

    // Step 3: Compare with actual teacher records and find discrepancies
    console.log('\n📊 Step 3: Checking teacher records for sync issues...');

    const syncIssues = [];
    let totalMissingStudents = 0;
    let totalExtraStudents = 0;

    for (const [teacherId, expectedStudentIds] of teacherStudentMap) {
      try {
        const teacher = await teacherCollection.findOne({
          _id: new ObjectId(teacherId)
        });

        if (!teacher) {
          console.log(`⚠️  Teacher ${teacherId} not found in database - skipping`);
          continue;
        }

        const actualStudentIds = new Set(teacher.teaching?.studentIds || []);
        const teacherName = teacher.personalInfo?.fullName || 'Unknown';

        // Find students that should be in teacher but aren't
        const missingStudents = [...expectedStudentIds].filter(id => !actualStudentIds.has(id));

        // Find students in teacher that don't have active assignments (potential cleanup)
        const extraStudents = [...actualStudentIds].filter(id => !expectedStudentIds.has(id));

        if (missingStudents.length > 0 || extraStudents.length > 0) {
          syncIssues.push({
            teacherId,
            teacherName,
            expectedCount: expectedStudentIds.size,
            actualCount: actualStudentIds.size,
            missingStudents,
            extraStudents
          });
          totalMissingStudents += missingStudents.length;
          totalExtraStudents += extraStudents.length;
        }
      } catch (err) {
        console.error(`❌ Error processing teacher ${teacherId}:`, err.message);
      }
    }

    // Step 4: Report findings
    console.log('\n' + '='.repeat(60));
    console.log('📋 SYNC ISSUES REPORT');
    console.log('='.repeat(60));

    if (syncIssues.length === 0) {
      console.log('✅ No sync issues found! All teachers are in sync with their students.');
    } else {
      console.log(`❌ Found ${syncIssues.length} teachers with sync issues:`);
      console.log(`   - Total missing students: ${totalMissingStudents}`);
      console.log(`   - Total extra students (no active assignments): ${totalExtraStudents}`);
      console.log('');

      for (const issue of syncIssues) {
        console.log(`\n👨‍🏫 Teacher: ${issue.teacherName} (${issue.teacherId})`);
        console.log(`   Expected: ${issue.expectedCount} students, Actual: ${issue.actualCount} students`);

        if (issue.missingStudents.length > 0) {
          console.log(`   🔴 Missing ${issue.missingStudents.length} students:`);

          // Get student names for better readability
          for (const studentId of issue.missingStudents) {
            try {
              const student = await studentCollection.findOne({ _id: new ObjectId(studentId) });
              const name = student?.personalInfo?.fullName || 'Unknown';
              console.log(`      - ${name} (${studentId})`);
            } catch {
              console.log(`      - Unknown (${studentId})`);
            }
          }
        }

        if (issue.extraStudents.length > 0) {
          console.log(`   🟡 Extra ${issue.extraStudents.length} students (no active assignment):`);
          for (const studentId of issue.extraStudents) {
            try {
              const student = await studentCollection.findOne({ _id: new ObjectId(studentId) });
              const name = student?.personalInfo?.fullName || 'Unknown';
              console.log(`      - ${name} (${studentId})`);
            } catch {
              console.log(`      - Unknown (${studentId})`);
            }
          }
        }
      }
    }

    // Step 5: Fix the issues (if not dry run)
    if (syncIssues.length > 0 && !DRY_RUN) {
      console.log('\n' + '='.repeat(60));
      console.log('🔧 FIXING SYNC ISSUES...');
      console.log('='.repeat(60));

      let fixedTeachers = 0;
      let addedStudents = 0;

      for (const issue of syncIssues) {
        if (issue.missingStudents.length > 0) {
          try {
            const result = await teacherCollection.updateOne(
              { _id: new ObjectId(issue.teacherId) },
              {
                $addToSet: {
                  'teaching.studentIds': { $each: issue.missingStudents }
                },
                $set: { updatedAt: new Date() }
              }
            );

            if (result.modifiedCount > 0) {
              fixedTeachers++;
              addedStudents += issue.missingStudents.length;
              console.log(`✅ Fixed ${issue.teacherName}: added ${issue.missingStudents.length} students`);
            }
          } catch (err) {
            console.error(`❌ Failed to fix ${issue.teacherName}:`, err.message);
          }
        }
      }

      console.log('\n' + '='.repeat(60));
      console.log('📊 FIX SUMMARY');
      console.log('='.repeat(60));
      console.log(`✅ Fixed ${fixedTeachers} teachers`);
      console.log(`✅ Added ${addedStudents} student relationships`);

    } else if (syncIssues.length > 0 && DRY_RUN) {
      console.log('\n⚠️  DRY RUN: No changes were made. Run without --dry-run to apply fixes.');
    }

    // Step 6: Verify the reverse relationship (students -> teacherIds)
    console.log('\n' + '='.repeat(60));
    console.log('📊 CHECKING REVERSE RELATIONSHIPS (student.teacherIds)');
    console.log('='.repeat(60));

    let studentsWithMissingTeacherIds = 0;

    for (const student of students) {
      const studentId = student._id.toString();
      const studentName = student.personalInfo?.fullName || 'Unknown';
      const assignments = student.teacherAssignments || [];
      const teacherIds = new Set(student.teacherIds || []);

      const activeTeacherIdsFromAssignments = [...new Set(
        assignments
          .filter(a => a.isActive !== false && a.teacherId)
          .map(a => a.teacherId)
      )];

      const missingFromTeacherIds = activeTeacherIdsFromAssignments.filter(
        tid => !teacherIds.has(tid)
      );

      if (missingFromTeacherIds.length > 0) {
        studentsWithMissingTeacherIds++;
        console.log(`\n🔴 Student: ${studentName} (${studentId})`);
        console.log(`   Missing ${missingFromTeacherIds.length} teachers in teacherIds array`);

        if (!DRY_RUN) {
          // Fix by adding missing teacherIds
          await studentCollection.updateOne(
            { _id: student._id },
            {
              $addToSet: { teacherIds: { $each: missingFromTeacherIds } },
              $set: { updatedAt: new Date() }
            }
          );
          console.log(`   ✅ Fixed: added missing teacherIds`);
        }
      }
    }

    if (studentsWithMissingTeacherIds === 0) {
      console.log('✅ All students have correct teacherIds arrays');
    } else {
      console.log(`\n❌ Found ${studentsWithMissingTeacherIds} students with missing teacherIds`);
      if (DRY_RUN) {
        console.log('⚠️  DRY RUN: No changes were made.');
      }
    }

    console.log('\n✅ Sync utility completed successfully!');

  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

main();
