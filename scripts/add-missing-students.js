/**
 * Add Missing Students to Database
 *
 * This script adds students that were found in the Excel file
 * but not imported to the database.
 */

import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';
import fs from 'fs';

const stringsInstruments = ['כינור', 'ויולה', 'נבל', "צ'לו", 'צלו', 'קונטרבס'];

// Reverse name order (LastName FirstName -> FirstName LastName)
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

// Normalize name for comparison
function normalizeName(name) {
  if (!name) return '';
  return name
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\u0590-\u05FFa-zA-Z\s-]/g, '')
    .toLowerCase();
}

// Check if names match
function namesMatch(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  const r1 = normalizeName(reverseName(name1));
  const r2 = normalizeName(reverseName(name2));

  return n1 === n2 || n1 === r2 || r1 === n2 || r1 === r2;
}

// Parse lesson duration from group string
function parseLessonDuration(group) {
  if (!group) return 45;
  const match = group.match(/(\d+)\s*דק/);
  return match ? parseInt(match[1]) : 45;
}

async function addMissingStudents() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB');

  console.log('============================================================');
  console.log('  ADD MISSING STUDENTS');
  console.log('============================================================\n');

  // Load missing students from report
  const missingStudentsRaw = JSON.parse(
    fs.readFileSync('reports/missing-students.json', 'utf-8')
  );

  // Filter out students with "מורה אחר" (unassigned teacher)
  const validMissingStudents = missingStudentsRaw.filter(
    s => s.teacher && s.teacher !== 'מורה אחר'
  );

  console.log(`Total missing students: ${missingStudentsRaw.length}`);
  console.log(`Students with valid teachers: ${validMissingStudents.length}`);
  console.log(`Students with "מורה אחר" (skipped): ${missingStudentsRaw.length - validMissingStudents.length}`);
  console.log('');

  // Get all strings teachers from database
  const dbTeachers = await db.collection('teacher').find({
    'professionalInfo.instrument': { $in: stringsInstruments }
  }).toArray();

  console.log(`Found ${dbTeachers.length} strings teachers in database\n`);

  // Create teacher name to ID map (support both name orders)
  const teacherMap = new Map();
  for (const teacher of dbTeachers) {
    const name = teacher.personalInfo?.fullName;
    if (name) {
      teacherMap.set(normalizeName(name), teacher._id.toString());
      teacherMap.set(normalizeName(reverseName(name)), teacher._id.toString());
    }
  }

  // Get school year
  const schoolYear = await db.collection('school_year').findOne({ isCurrent: true });
  const schoolYearId = schoolYear?._id?.toString();

  if (!schoolYearId) {
    console.log('ERROR: No active school year found');
    await client.close();
    return;
  }

  console.log(`Using school year: ${schoolYear.name}\n`);

  // Process each missing student
  let created = 0;
  let skipped = 0;
  let teacherNotFound = 0;

  console.log('--- Adding Students ---\n');

  for (const missingStudent of validMissingStudents) {
    // Find teacher ID
    const teacherNameNormalized = normalizeName(missingStudent.teacher);
    const teacherId = teacherMap.get(teacherNameNormalized);

    if (!teacherId) {
      console.log(`  ⚠ Teacher not found: ${missingStudent.teacher} (for student: ${missingStudent.name})`);
      teacherNotFound++;
      continue;
    }

    // Reverse name order (Excel has LastName FirstName, we want FirstName LastName)
    const fullName = reverseName(missingStudent.name);

    // Check if student already exists (by any name variation)
    const existingStudent = await db.collection('student').findOne({
      $or: [
        { 'personalInfo.fullName': fullName },
        { 'personalInfo.fullName': missingStudent.name },
        { 'personalInfo.fullName': { $regex: normalizeName(missingStudent.name).split(' ').join('.*'), $options: 'i' } }
      ]
    });

    if (existingStudent) {
      console.log(`  ⚠ Student already exists: ${fullName} (as: ${existingStudent.personalInfo?.fullName})`);
      skipped++;
      continue;
    }

    // Parse lesson duration
    const lessonDuration = parseLessonDuration(missingStudent.group);

    // Map instrument
    const instrumentMap = {
      'כינור': 'כינור',
      'ויולה': 'ויולה',
      'נבל': 'נבל',
      "צ'לו": "צ'לו",
      'קונטרבס': 'קונטרבס'
    };
    const instrument = instrumentMap[missingStudent.instrument] || missingStudent.instrument;

    // Create student document
    const student = {
      personalInfo: {
        fullName: fullName,
        phone: '',
        age: null,
        address: '',
        parentName: '',
        parentPhone: '',
        parentEmail: '',
        studentEmail: ''
      },
      academicInfo: {
        instrumentProgress: [{
          instrumentName: instrument,
          isPrimary: true,
          currentStage: 1
        }],
        class: 'אחר',
        tests: {
          stageTest: { status: 'לא נבחן', lastTestDate: null, nextTestDate: null, notes: '' },
          technicalTest: { status: 'לא נבחן', lastTestDate: null, nextTestDate: null, notes: '' }
        }
      },
      // Root level fields - THIS IS CRITICAL FOR UI TO WORK
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
      // Also add to enrollments for compatibility
      enrollments: {
        orchestraIds: [],
        ensembleIds: [],
        schoolYears: [{ schoolYearId: schoolYearId, isActive: true }],
        theoryLessonIds: [],
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
        }]
      },
      scheduleInfo: {
        day: null,
        startTime: null,
        endTime: null,
        duration: lessonDuration,
        location: null,
        notes: null,
        isActive: true
      },
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Insert student
    const result = await db.collection('student').insertOne(student);
    const studentId = result.insertedId.toString();

    // Add student to teacher's studentIds
    await db.collection('teacher').updateOne(
      { _id: new ObjectId(teacherId) },
      { $addToSet: { 'teaching.studentIds': studentId } }
    );

    console.log(`  ✓ Created: ${fullName} -> ${missingStudent.teacher} (${instrument})`);
    created++;
  }

  // Summary
  console.log('\n============================================================');
  console.log('  SUMMARY');
  console.log('============================================================\n');

  console.log(`Students created: ${created}`);
  console.log(`Students skipped (already exist): ${skipped}`);
  console.log(`Students skipped (teacher not found): ${teacherNotFound}`);
  console.log(`Students skipped (מורה אחר): ${missingStudentsRaw.length - validMissingStudents.length}`);

  // Verify final counts
  const totalStringsStudents = await db.collection('student').countDocuments({
    teacherIds: { $in: dbTeachers.map(t => t._id.toString()) }
  });

  console.log(`\nTotal strings students in DB: ${totalStringsStudents}`);

  await client.close();

  console.log('\n============================================================');
  console.log('  COMPLETE');
  console.log('============================================================');
}

addMissingStudents().catch(console.error);
