/**
 * Fix Unlinked Students
 *
 * Links students to their teachers based on the Excel data.
 * These students exist in DB but have no teacherIds.
 */

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import XLSX from 'xlsx';

const STUDENT_FILE = '/mnt/c/Projects/conservatory-app/מידע/תלמידים -כלי קשת.xlsx';
const stringsInstruments = ['כינור', 'ויולה', 'נבל', "צ'לו", 'צלו', 'קונטרבס'];

// Name utilities
function normalizeName(name) {
  if (!name) return '';
  return name
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\u0590-\u05FFa-zA-Z\s-]/g, '')
    .toLowerCase();
}

function reverseName(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  } else if (parts.length === 3) {
    return `${parts[2]} ${parts[0]} ${parts[1]}`;
  } else if (parts.length === 4) {
    return `${parts[3]} ${parts[0]} ${parts[1]} ${parts[2]}`;
  }
  return name;
}

function namesMatch(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  const r1 = normalizeName(reverseName(name1));
  const r2 = normalizeName(reverseName(name2));

  if (n1 === n2 || n1 === r2 || r1 === n2 || r1 === r2) return true;

  // Partial match for longer names
  const parts1 = n1.split(' ');
  const parts2 = n2.split(' ');

  if (parts1.length >= 2 && parts2.length >= 2) {
    // Check if first and last parts match
    if (parts1[0] === parts2[0] && parts1[parts1.length - 1] === parts2[parts2.length - 1]) {
      return true;
    }
    // Check if last and first parts match (reversed)
    if (parts1[0] === parts2[parts2.length - 1] && parts1[parts1.length - 1] === parts2[0]) {
      return true;
    }
  }

  return false;
}

function parseLessonDuration(group) {
  if (!group) return 45;
  const match = group.match(/(\d+)\s*דק/);
  return match ? parseInt(match[1]) : 45;
}

async function fixUnlinkedStudents() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB');

  console.log('============================================================');
  console.log('  FIX UNLINKED STUDENTS');
  console.log('============================================================\n');

  // Load Excel data
  const workbook = XLSX.readFile(STUDENT_FILE);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = XLSX.utils.sheet_to_json(sheet);

  const excelStudents = excelData.map(row => ({
    name: row['שם משתתף'] || row['שם'] || '',
    teacher: row['שם חוג'] || row['מורה'] || '',
    instrument: row['תת מחלקה'] || row['כלי'] || '',
    group: row['שם קבוצה'] || ''
  })).filter(s => s.name && s.teacher && s.teacher !== 'מורה אחר');

  console.log(`Loaded ${excelStudents.length} students from Excel (with valid teachers)\n`);

  // Get all strings teachers
  const dbTeachers = await db.collection('teacher').find({
    'professionalInfo.instrument': { $in: stringsInstruments }
  }).toArray();

  console.log(`Found ${dbTeachers.length} strings teachers in database\n`);

  // Create teacher name to ID map
  const teacherMap = new Map();
  for (const teacher of dbTeachers) {
    const name = teacher.personalInfo?.fullName;
    if (name) {
      teacherMap.set(normalizeName(name), teacher._id.toString());
      teacherMap.set(normalizeName(reverseName(name)), teacher._id.toString());
    }
  }

  // Get all strings students without teacher links
  const unlinkedStudents = await db.collection('student').find({
    'academicInfo.instrumentProgress.instrumentName': { $in: stringsInstruments },
    $or: [
      { teacherIds: { $exists: false } },
      { teacherIds: [] },
      { teacherIds: null }
    ]
  }).toArray();

  console.log(`Found ${unlinkedStudents.length} unlinked strings students in database\n`);

  // Process each unlinked student
  let linked = 0;
  let notFound = 0;

  console.log('--- Linking Students ---\n');

  for (const dbStudent of unlinkedStudents) {
    const dbName = dbStudent.personalInfo?.fullName;

    // Find matching Excel student
    const excelStudent = excelStudents.find(es => namesMatch(es.name, dbName));

    if (!excelStudent) {
      console.log(`  ⚠ No Excel match: ${dbName}`);
      notFound++;
      continue;
    }

    // Find teacher ID
    const teacherId = teacherMap.get(normalizeName(excelStudent.teacher)) ||
                      teacherMap.get(normalizeName(reverseName(excelStudent.teacher)));

    if (!teacherId) {
      console.log(`  ⚠ Teacher not found: ${excelStudent.teacher} (for: ${dbName})`);
      notFound++;
      continue;
    }

    const lessonDuration = parseLessonDuration(excelStudent.group);

    // Update student with teacher link
    await db.collection('student').updateOne(
      { _id: dbStudent._id },
      {
        $set: {
          teacherIds: [teacherId],
          teacherAssignments: [{
            teacherId: teacherId,
            day: null,
            time: null,
            duration: lessonDuration,
            isActive: true,
            startDate: new Date(),
            isRecurring: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }],
          'enrollments.teacherIds': [teacherId],
          'enrollments.teacherAssignments': [{
            teacherId: teacherId,
            day: null,
            time: null,
            duration: lessonDuration,
            isActive: true,
            startDate: new Date(),
            isRecurring: true,
            createdAt: new Date(),
            updatedAt: new Date()
          }]
        }
      }
    );

    // Add student to teacher's studentIds
    await db.collection('teacher').updateOne(
      { _id: new ObjectId(teacherId) },
      { $addToSet: { 'teaching.studentIds': dbStudent._id.toString() } }
    );

    // Get teacher name for logging
    const teacher = dbTeachers.find(t => t._id.toString() === teacherId);
    console.log(`  ✓ Linked: ${dbName} -> ${teacher?.personalInfo?.fullName}`);
    linked++;
  }

  // Also fix students that have enrollments.teacherIds but not root teacherIds
  console.log('\n--- Fixing Students with Partial Links ---\n');

  const partiallyLinked = await db.collection('student').find({
    'academicInfo.instrumentProgress.instrumentName': { $in: stringsInstruments },
    teacherIds: { $exists: false },
    'enrollments.teacherIds': { $exists: true, $ne: [] }
  }).toArray();

  let partialFixed = 0;
  for (const student of partiallyLinked) {
    await db.collection('student').updateOne(
      { _id: student._id },
      {
        $set: {
          teacherIds: student.enrollments.teacherIds,
          teacherAssignments: student.enrollments.teacherAssignments || []
        }
      }
    );
    console.log(`  ✓ Fixed partial: ${student.personalInfo?.fullName}`);
    partialFixed++;
  }

  // Summary
  console.log('\n============================================================');
  console.log('  SUMMARY');
  console.log('============================================================\n');

  console.log(`Students linked: ${linked}`);
  console.log(`Partial links fixed: ${partialFixed}`);
  console.log(`Not matched/found: ${notFound}`);

  // Final verification
  const stringsTeacherIds = dbTeachers.map(t => t._id.toString());
  const finalLinkedCount = await db.collection('student').countDocuments({
    teacherIds: { $in: stringsTeacherIds }
  });

  console.log(`\nTotal students now linked to strings teachers: ${finalLinkedCount}`);

  // Verify teacher student counts
  console.log('\n--- Teacher Student Counts ---\n');
  for (const teacher of dbTeachers) {
    const studentCount = await db.collection('student').countDocuments({
      teacherIds: teacher._id.toString()
    });
    const teacherStudentIds = teacher.teaching?.studentIds?.length || 0;
    console.log(`  ${teacher.personalInfo?.fullName}: ${studentCount} students (teaching.studentIds: ${teacherStudentIds})`);
  }

  await client.close();

  console.log('\n============================================================');
  console.log('  COMPLETE');
  console.log('============================================================');
}

fixUnlinkedStudents().catch(console.error);
