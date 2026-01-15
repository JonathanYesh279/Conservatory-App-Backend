/**
 * Fix Strings Department Data
 *
 * Issues fixed:
 * 1. Move enrollments.teacherIds -> root teacherIds
 * 2. Move enrollments.teacherAssignments -> root teacherAssignments
 * 3. Fix name order: "LastName FirstName" -> "FirstName LastName"
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const stringsInstruments = ['כינור', 'ויולה', 'נבל', "צ'לו", 'צלו', 'קונטרבס'];

function reverseName(name) {
  if (!name) return name;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  } else if (parts.length === 3) {
    // Handle names like "שורץ ציגלר כחל" -> "כחל שורץ ציגלר"
    return `${parts[2]} ${parts[0]} ${parts[1]}`;
  }
  return name;
}

async function fixData() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB');

  console.log('============================================================');
  console.log('  FIX STRINGS DEPARTMENT DATA');
  console.log('============================================================\n');

  // ========================================
  // PART 1: Fix Student-Teacher Links
  // ========================================
  console.log('--- Part 1: Fixing Student-Teacher Links ---\n');

  // Find students with enrollments.teacherIds but missing root teacherIds
  const studentsToFix = await db.collection('student').find({
    $or: [
      { 'enrollments.teacherIds': { $exists: true, $ne: [] }, teacherIds: { $exists: false } },
      { 'enrollments.teacherIds': { $exists: true, $ne: [] }, teacherIds: [] },
      { 'enrollments.teacherAssignments': { $exists: true, $ne: [] }, teacherAssignments: { $exists: false } },
      { 'enrollments.teacherAssignments': { $exists: true, $ne: [] }, teacherAssignments: [] }
    ]
  }).toArray();

  console.log(`Found ${studentsToFix.length} students needing link fixes`);

  let fixedLinks = 0;
  for (const student of studentsToFix) {
    const updates = {};

    // Copy enrollments.teacherIds to root teacherIds
    if (student.enrollments?.teacherIds?.length > 0 &&
        (!student.teacherIds || student.teacherIds.length === 0)) {
      updates.teacherIds = student.enrollments.teacherIds;
    }

    // Copy enrollments.teacherAssignments to root teacherAssignments
    if (student.enrollments?.teacherAssignments?.length > 0 &&
        (!student.teacherAssignments || student.teacherAssignments.length === 0)) {
      updates.teacherAssignments = student.enrollments.teacherAssignments;
    }

    if (Object.keys(updates).length > 0) {
      await db.collection('student').updateOne(
        { _id: student._id },
        { $set: updates }
      );
      fixedLinks++;
      console.log(`  ✓ Fixed: ${student.personalInfo?.fullName}`);
    }
  }

  console.log(`\nFixed ${fixedLinks} student links\n`);

  // ========================================
  // PART 2: Fix Teacher Names
  // ========================================
  console.log('--- Part 2: Fixing Teacher Names ---\n');

  const teachers = await db.collection('teacher').find({
    'professionalInfo.instrument': { $in: stringsInstruments }
  }).toArray();

  let fixedTeacherNames = 0;
  for (const teacher of teachers) {
    const oldName = teacher.personalInfo?.fullName;
    if (!oldName) continue;

    const newName = reverseName(oldName);
    if (oldName !== newName) {
      await db.collection('teacher').updateOne(
        { _id: teacher._id },
        { $set: { 'personalInfo.fullName': newName } }
      );
      fixedTeacherNames++;
      console.log(`  ✓ "${oldName}" -> "${newName}"`);
    }
  }

  console.log(`\nFixed ${fixedTeacherNames} teacher names\n`);

  // ========================================
  // PART 3: Fix Student Names
  // ========================================
  console.log('--- Part 3: Fixing Student Names ---\n');

  // Get all strings teacher IDs
  const stringsTeachers = await db.collection('teacher').find({
    'professionalInfo.instrument': { $in: stringsInstruments }
  }).toArray();
  const stringsTeacherIds = stringsTeachers.map(t => t._id.toString());

  // Find students linked to strings teachers
  const stringsStudents = await db.collection('student').find({
    $or: [
      { teacherIds: { $in: stringsTeacherIds } },
      { 'enrollments.teacherIds': { $in: stringsTeacherIds } }
    ]
  }).toArray();

  let fixedStudentNames = 0;
  for (const student of stringsStudents) {
    const oldName = student.personalInfo?.fullName;
    if (!oldName) continue;

    const newName = reverseName(oldName);
    if (oldName !== newName) {
      await db.collection('student').updateOne(
        { _id: student._id },
        { $set: { 'personalInfo.fullName': newName } }
      );
      fixedStudentNames++;
      console.log(`  ✓ "${oldName}" -> "${newName}"`);
    }
  }

  console.log(`\nFixed ${fixedStudentNames} student names\n`);

  // ========================================
  // PART 4: Fix Names in Teacher Schedules & Time Blocks
  // ========================================
  console.log('--- Part 4: Fixing Names in Teacher Schedules ---\n');

  let fixedScheduleNames = 0;
  for (const teacher of stringsTeachers) {
    let updated = false;
    const updates = {};

    // Fix schedule entries
    if (teacher.teaching?.schedule?.length > 0) {
      const newSchedule = teacher.teaching.schedule.map(entry => {
        if (entry.studentName) {
          const newName = reverseName(entry.studentName);
          if (entry.studentName !== newName) {
            updated = true;
            return { ...entry, studentName: newName };
          }
        }
        return entry;
      });
      if (updated) {
        updates['teaching.schedule'] = newSchedule;
      }
    }

    // Fix timeBlocks with studentName
    if (teacher.teaching?.timeBlocks?.length > 0) {
      let timeBlocksUpdated = false;
      const newTimeBlocks = teacher.teaching.timeBlocks.map(block => {
        if (block.studentName) {
          const newName = reverseName(block.studentName);
          if (block.studentName !== newName) {
            timeBlocksUpdated = true;
            return { ...block, studentName: newName };
          }
        }
        return block;
      });
      if (timeBlocksUpdated) {
        updates['teaching.timeBlocks'] = newTimeBlocks;
        updated = true;
      }
    }

    if (Object.keys(updates).length > 0) {
      await db.collection('teacher').updateOne(
        { _id: teacher._id },
        { $set: updates }
      );
      fixedScheduleNames++;
      const teacherName = teacher.personalInfo?.fullName;
      console.log(`  ✓ Updated schedule/timeBlocks for: ${reverseName(teacherName)}`);
    }
  }

  console.log(`\nFixed schedules for ${fixedScheduleNames} teachers\n`);

  // ========================================
  // VERIFICATION
  // ========================================
  console.log('============================================================');
  console.log('  VERIFICATION');
  console.log('============================================================\n');

  // Verify a sample teacher
  const sampleTeacher = await db.collection('teacher').findOne({
    'professionalInfo.instrument': { $in: stringsInstruments },
    'teaching.studentIds': { $exists: true, $ne: [] }
  });

  if (sampleTeacher) {
    console.log(`Sample Teacher: ${sampleTeacher.personalInfo?.fullName}`);
    console.log(`  teaching.studentIds count: ${sampleTeacher.teaching?.studentIds?.length || 0}`);

    // Check if students can be queried
    const teacherId = sampleTeacher._id.toString();
    const linkedStudents = await db.collection('student').find({
      teacherIds: teacherId
    }).toArray();

    console.log(`  Students with root teacherIds: ${linkedStudents.length}`);
    if (linkedStudents.length > 0) {
      console.log(`  Sample student names:`);
      linkedStudents.slice(0, 3).forEach(s => {
        console.log(`    - ${s.personalInfo?.fullName}`);
      });
    }
  }

  // Final counts
  const finalStudentsWithRootTeacherIds = await db.collection('student').countDocuments({
    teacherIds: { $exists: true, $ne: [] }
  });

  console.log(`\nFinal count - Students with root teacherIds: ${finalStudentsWithRootTeacherIds}`);

  await client.close();

  console.log('\n============================================================');
  console.log('  COMPLETE');
  console.log('============================================================');
}

fixData().catch(console.error);
