/**
 * Fix All Teacher Assignments
 *
 * This script ensures consistency between:
 * 1. student.teacherIds - array of teacher IDs
 * 2. student.teacherAssignments - array of assignment objects with teacherId
 * 3. teacher.teaching.studentIds - array of student IDs
 *
 * Rules:
 * - If a student has teacherIds = [X], they should ONLY have teacherAssignments for X
 * - Teacher.teaching.studentIds should match students with teacherIds pointing to that teacher
 */

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const stringsInstruments = ['כינור', 'ויולה', 'נבל', "צ'לו", 'צלו', 'קונטרבס'];

async function fix() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB');

  console.log('============================================================');
  console.log('  FIX ALL TEACHER ASSIGNMENTS');
  console.log('============================================================\n');

  // Get all strings teachers
  const teachers = await db.collection('teacher').find({
    'professionalInfo.instrument': { $in: stringsInstruments }
  }).toArray();

  const teacherMap = new Map();
  teachers.forEach(t => teacherMap.set(t._id.toString(), t));

  console.log(`Found ${teachers.length} strings teachers\n`);

  // Part 1: Fix student teacherAssignments to match teacherIds
  console.log('--- Part 1: Fixing Student teacherAssignments ---\n');

  const allStudents = await db.collection('student').find({
    $or: [
      { teacherIds: { $exists: true, $ne: [] } },
      { 'teacherAssignments.0': { $exists: true } }
    ]
  }).toArray();

  let studentsFixed = 0;
  let assignmentsRemoved = 0;

  for (const student of allStudents) {
    const studentId = student._id.toString();
    const teacherIds = student.teacherIds || [];
    const teacherAssignments = student.teacherAssignments || [];

    // Check for orphaned assignments (assignments pointing to teachers not in teacherIds)
    const orphanedAssignments = teacherAssignments.filter(
      a => !teacherIds.includes(a.teacherId)
    );

    if (orphanedAssignments.length > 0) {
      console.log(`${student.personalInfo?.fullName}:`);
      console.log(`  teacherIds: [${teacherIds.join(', ')}]`);
      console.log(`  Orphaned assignments to: ${orphanedAssignments.map(a => a.teacherId).join(', ')}`);

      // Keep only valid assignments
      const validAssignments = teacherAssignments.filter(
        a => teacherIds.includes(a.teacherId)
      );

      await db.collection('student').updateOne(
        { _id: student._id },
        { $set: { teacherAssignments: validAssignments } }
      );

      console.log(`  ✓ Removed ${orphanedAssignments.length} orphaned assignments\n`);
      studentsFixed++;
      assignmentsRemoved += orphanedAssignments.length;
    }

    // Also ensure enrollments.teacherAssignments matches
    const enrollmentAssignments = student.enrollments?.teacherAssignments || [];
    const orphanedEnrollmentAssignments = enrollmentAssignments.filter(
      a => !teacherIds.includes(a.teacherId)
    );

    if (orphanedEnrollmentAssignments.length > 0) {
      const validEnrollmentAssignments = enrollmentAssignments.filter(
        a => teacherIds.includes(a.teacherId)
      );

      await db.collection('student').updateOne(
        { _id: student._id },
        { $set: { 'enrollments.teacherAssignments': validEnrollmentAssignments } }
      );
    }
  }

  console.log(`Fixed ${studentsFixed} students, removed ${assignmentsRemoved} orphaned assignments\n`);

  // Part 2: Sync teacher.teaching.studentIds
  console.log('--- Part 2: Syncing Teacher studentIds ---\n');

  for (const teacher of teachers) {
    const teacherId = teacher._id.toString();
    const teacherName = teacher.personalInfo?.fullName;

    // Find all students that have this teacher in their teacherIds
    const linkedStudents = await db.collection('student').find({
      teacherIds: teacherId
    }).toArray();

    const correctStudentIds = linkedStudents.map(s => s._id.toString());
    const currentStudentIds = teacher.teaching?.studentIds || [];

    // Check if update needed
    const needsUpdate =
      currentStudentIds.length !== correctStudentIds.length ||
      !currentStudentIds.every(id => correctStudentIds.includes(id));

    if (needsUpdate) {
      await db.collection('teacher').updateOne(
        { _id: teacher._id },
        { $set: { 'teaching.studentIds': correctStudentIds } }
      );
      console.log(`✓ ${teacherName}: ${currentStudentIds.length} -> ${correctStudentIds.length} students`);
    }
  }

  // Part 3: Verify final state
  console.log('\n--- Part 3: Final Verification ---\n');

  let allGood = true;

  for (const teacher of teachers) {
    const teacherId = teacher._id.toString();
    const teacherName = teacher.personalInfo?.fullName;

    const byTeacherIds = await db.collection('student').countDocuments({
      teacherIds: teacherId
    });

    const byAssignments = await db.collection('student').countDocuments({
      'teacherAssignments.teacherId': teacherId,
      'teacherAssignments.isActive': { $ne: false }
    });

    const updatedTeacher = await db.collection('teacher').findOne({ _id: teacher._id });
    const teacherStudentIds = updatedTeacher?.teaching?.studentIds?.length || 0;

    const match = byTeacherIds === byAssignments && byTeacherIds === teacherStudentIds;

    if (!match) {
      console.log(`⚠️ ${teacherName}: teacherIds=${byTeacherIds}, assignments=${byAssignments}, teacher.studentIds=${teacherStudentIds}`);
      allGood = false;
    } else {
      console.log(`✓ ${teacherName}: ${byTeacherIds} students (all counts match)`);
    }
  }

  if (allGood) {
    console.log('\n✅ All teacher-student relationships are now consistent!');
  } else {
    console.log('\n⚠️ Some inconsistencies remain. Please investigate.');
  }

  await client.close();

  console.log('\n============================================================');
  console.log('  COMPLETE');
  console.log('============================================================');
}

fix().catch(console.error);
