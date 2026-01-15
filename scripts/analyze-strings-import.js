/**
 * Analyze Strings Department Import
 *
 * Compares Excel source files with database to identify:
 * 1. Missing students
 * 2. Missing teacher schedules
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const STUDENT_FILE = '/mnt/c/Projects/conservatory-app/מידע/תלמידים -כלי קשת.xlsx';
const SCHEDULE_FILE = '/mnt/c/Projects/conservatory-app/מידע/יומן מורים - כלי קשת.xlsx';

const stringsInstruments = ['כינור', 'ויולה', 'נבל', "צ'לו", 'צלו', 'קונטרבס'];

// Helper to normalize names for comparison
function normalizeName(name) {
  if (!name) return '';
  return name
    .toString()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\u0590-\u05FFa-zA-Z\s-]/g, '') // Remove non-Hebrew/English chars except space and hyphen
    .toLowerCase();
}

// Reverse name order (LastName FirstName -> FirstName LastName)
function reverseName(name) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 2) {
    return `${parts[1]} ${parts[0]}`;
  } else if (parts.length === 3) {
    return `${parts[2]} ${parts[0]} ${parts[1]}`;
  }
  return name;
}

// Create all possible name variations for matching
function getNameVariations(name) {
  const normalized = normalizeName(name);
  const reversed = normalizeName(reverseName(name));
  return [normalized, reversed];
}

// Check if two names match (considering various formats)
function namesMatch(name1, name2) {
  const vars1 = getNameVariations(name1);
  const vars2 = getNameVariations(name2);

  for (const v1 of vars1) {
    for (const v2 of vars2) {
      if (v1 && v2 && v1 === v2) return true;
      // Also check if one contains the other (for partial matches)
      if (v1 && v2 && v1.length > 3 && v2.length > 3) {
        if (v1.includes(v2) || v2.includes(v1)) return true;
      }
    }
  }
  return false;
}

async function analyze() {
  console.log('============================================================');
  console.log('  STRINGS DEPARTMENT IMPORT ANALYSIS');
  console.log('============================================================\n');

  // ========================================
  // STEP 1: Parse Excel Files
  // ========================================
  console.log('--- Step 1: Parsing Excel Files ---\n');

  // Parse student file
  const studentWorkbook = XLSX.readFile(STUDENT_FILE);
  const studentSheet = studentWorkbook.Sheets[studentWorkbook.SheetNames[0]];
  const studentData = XLSX.utils.sheet_to_json(studentSheet);

  console.log(`Student file: ${studentData.length} rows`);

  // Extract student info
  const excelStudents = studentData.map(row => ({
    name: row['שם משתתף'] || row['שם'] || '',
    teacher: row['שם חוג'] || row['מורה'] || '',
    instrument: row['תת מחלקה'] || row['כלי'] || '',
    group: row['שם קבוצה'] || ''
  })).filter(s => s.name && s.name.trim());

  console.log(`Extracted ${excelStudents.length} students from Excel`);

  // Parse schedule file
  const scheduleWorkbook = XLSX.readFile(SCHEDULE_FILE);
  const scheduleSheet = scheduleWorkbook.Sheets[scheduleWorkbook.SheetNames[0]];
  const scheduleData = XLSX.utils.sheet_to_json(scheduleSheet, { header: 1 });

  // Parse the complex schedule format
  const excelSchedules = {};
  let currentTeacher = null;
  let currentDay = null;

  for (let i = 0; i < scheduleData.length; i++) {
    const row = scheduleData[i];
    if (!row || row.length === 0) continue;

    const firstCell = (row[0] || '').toString().trim();

    // Check if this is a teacher header row
    if (firstCell && !firstCell.includes("יום") && !firstCell.match(/^\d/) &&
        !['שעה', 'משפחה', 'פרטי', 'משך'].some(h => firstCell.includes(h))) {
      // Could be a teacher name
      const possibleTeacher = firstCell.replace(/[:\-–]/g, '').trim();
      if (possibleTeacher.length > 2 && possibleTeacher.length < 30) {
        currentTeacher = possibleTeacher;
        if (!excelSchedules[currentTeacher]) {
          excelSchedules[currentTeacher] = [];
        }
      }
    }

    // Check for day header
    if (firstCell.includes("יום")) {
      const dayMatch = firstCell.match(/יום\s*([א-ת]'?)/);
      if (dayMatch) {
        const dayMap = {
          "א": "ראשון", "א'": "ראשון",
          "ב": "שני", "ב'": "שני",
          "ג": "שלישי", "ג'": "שלישי",
          "ד": "רביעי", "ד'": "רביעי",
          "ה": "חמישי", "ה'": "חמישי",
          "ו": "שישי", "ו'": "שישי"
        };
        currentDay = dayMap[dayMatch[1]] || dayMatch[1];
      }
    }

    // Check if this is a schedule entry row (has time in first column)
    if (currentTeacher && currentDay && firstCell.match(/^\d{1,2}:\d{2}/)) {
      const time = firstCell;
      const lastName = (row[1] || '').toString().trim();
      const firstName = (row[2] || '').toString().trim();
      const duration = parseInt(row[3]) || 45;

      if (lastName || firstName) {
        const studentName = `${firstName} ${lastName}`.trim();
        excelSchedules[currentTeacher].push({
          day: currentDay,
          time,
          studentName,
          lastName,
          firstName,
          duration
        });
      }
    }
  }

  const totalScheduleEntries = Object.values(excelSchedules).flat().length;
  console.log(`Extracted ${totalScheduleEntries} schedule entries from Excel`);
  console.log(`Teachers found in schedule: ${Object.keys(excelSchedules).length}`);

  // ========================================
  // STEP 2: Query Database
  // ========================================
  console.log('\n--- Step 2: Querying Database ---\n');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB');

  // Get all strings teachers
  const dbTeachers = await db.collection('teacher').find({
    'professionalInfo.instrument': { $in: stringsInstruments }
  }).toArray();

  console.log(`Database has ${dbTeachers.length} strings teachers`);

  // Get teacher IDs
  const teacherIds = dbTeachers.map(t => t._id.toString());

  // Get all students linked to strings teachers
  const dbStudents = await db.collection('student').find({
    $or: [
      { teacherIds: { $in: teacherIds } },
      { 'enrollments.teacherIds': { $in: teacherIds } }
    ]
  }).toArray();

  console.log(`Database has ${dbStudents.length} students linked to strings teachers`);

  // ========================================
  // STEP 3: Compare Students
  // ========================================
  console.log('\n--- Step 3: Comparing Students ---\n');

  const matchedStudents = [];
  const missingStudents = [];

  for (const excelStudent of excelStudents) {
    const found = dbStudents.find(dbStudent =>
      namesMatch(excelStudent.name, dbStudent.personalInfo?.fullName)
    );

    if (found) {
      matchedStudents.push({
        excelName: excelStudent.name,
        dbName: found.personalInfo?.fullName,
        teacher: excelStudent.teacher,
        instrument: excelStudent.instrument
      });
    } else {
      missingStudents.push({
        name: excelStudent.name,
        teacher: excelStudent.teacher,
        instrument: excelStudent.instrument,
        group: excelStudent.group
      });
    }
  }

  console.log(`Matched students: ${matchedStudents.length}`);
  console.log(`Missing students: ${missingStudents.length}`);

  // ========================================
  // STEP 4: Compare Schedules
  // ========================================
  console.log('\n--- Step 4: Comparing Schedules ---\n');

  const scheduleComparison = {};

  for (const [excelTeacherName, excelLessons] of Object.entries(excelSchedules)) {
    // Find matching DB teacher
    const dbTeacher = dbTeachers.find(t =>
      namesMatch(excelTeacherName, t.personalInfo?.fullName)
    );

    if (!dbTeacher) {
      scheduleComparison[excelTeacherName] = {
        status: 'TEACHER_NOT_FOUND',
        excelLessons: excelLessons.length,
        dbLessons: 0,
        matched: [],
        missing: excelLessons,
        extra: []
      };
      continue;
    }

    const dbSchedule = dbTeacher.teaching?.schedule || [];
    const dbTimeBlocks = dbTeacher.teaching?.timeBlocks || [];

    // Get all DB lessons (from schedule and timeBlocks with students)
    const dbLessons = [
      ...dbSchedule.map(s => ({
        day: s.day,
        time: s.startTime || s.time,
        studentName: s.studentName
      })),
      ...dbTimeBlocks.filter(tb => tb.studentName).map(tb => ({
        day: tb.day,
        time: tb.startTime,
        studentName: tb.studentName
      }))
    ];

    const matched = [];
    const missing = [];
    const matchedDbIndices = new Set();

    for (const excelLesson of excelLessons) {
      let found = false;

      for (let i = 0; i < dbLessons.length; i++) {
        if (matchedDbIndices.has(i)) continue;

        const dbLesson = dbLessons[i];

        // Match by day and student name (time might differ slightly)
        if (dbLesson.day === excelLesson.day &&
            namesMatch(excelLesson.studentName, dbLesson.studentName)) {
          matched.push({
            day: excelLesson.day,
            time: excelLesson.time,
            studentName: excelLesson.studentName,
            dbStudentName: dbLesson.studentName
          });
          matchedDbIndices.add(i);
          found = true;
          break;
        }
      }

      if (!found) {
        missing.push(excelLesson);
      }
    }

    // Find extra lessons in DB not in Excel
    const extra = dbLessons.filter((_, i) => !matchedDbIndices.has(i));

    scheduleComparison[excelTeacherName] = {
      status: 'FOUND',
      dbTeacherName: dbTeacher.personalInfo?.fullName,
      instrument: dbTeacher.professionalInfo?.instrument,
      excelLessons: excelLessons.length,
      dbLessons: dbLessons.length,
      matched,
      missing,
      extra
    };
  }

  await client.close();

  // ========================================
  // STEP 5: Generate Report
  // ========================================
  console.log('\n============================================================');
  console.log('  ANALYSIS REPORT');
  console.log('============================================================\n');

  // Section A: Student Import Status
  console.log('=== SECTION A: STUDENT IMPORT STATUS ===\n');

  console.log(`✅ IMPORTED STUDENTS (${matchedStudents.length}):\n`);
  matchedStudents.slice(0, 10).forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.excelName} -> ${s.dbName} (${s.teacher})`);
  });
  if (matchedStudents.length > 10) {
    console.log(`   ... and ${matchedStudents.length - 10} more`);
  }

  console.log(`\n❌ MISSING STUDENTS (${missingStudents.length}):\n`);
  missingStudents.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.name} (Teacher: ${s.teacher}, Instrument: ${s.instrument})`);
  });

  // Section B: Schedule Status
  console.log('\n=== SECTION B: TEACHER SCHEDULE STATUS ===\n');

  let totalExcelLessons = 0;
  let totalDbLessons = 0;
  let totalMatched = 0;
  let totalMissing = 0;

  for (const [teacherName, data] of Object.entries(scheduleComparison)) {
    console.log(`📅 ${teacherName} ${data.dbTeacherName ? `(DB: ${data.dbTeacherName})` : ''}`);

    if (data.status === 'TEACHER_NOT_FOUND') {
      console.log(`   ❌ TEACHER NOT FOUND IN DATABASE`);
      console.log(`   Excel lessons: ${data.excelLessons}`);
    } else {
      console.log(`   Instrument: ${data.instrument}`);
      console.log(`   Excel lessons: ${data.excelLessons}, DB lessons: ${data.dbLessons}`);
      console.log(`   Matched: ${data.matched.length}, Missing: ${data.missing.length}`);

      if (data.missing.length > 0) {
        console.log(`\n   ❌ MISSING LESSONS:`);
        data.missing.forEach(m => {
          console.log(`      - ${m.day} ${m.time}: ${m.studentName} (${m.duration} min)`);
        });
      }
    }
    console.log('');

    totalExcelLessons += data.excelLessons;
    totalDbLessons += data.dbLessons;
    totalMatched += data.matched?.length || 0;
    totalMissing += data.missing?.length || 0;
  }

  // Section C: Summary
  console.log('=== SECTION C: SUMMARY ===\n');

  console.log('Students:');
  console.log(`  - Total in Excel: ${excelStudents.length}`);
  console.log(`  - Matched in DB: ${matchedStudents.length}`);
  console.log(`  - Missing from DB: ${missingStudents.length}`);
  console.log(`  - Success Rate: ${((matchedStudents.length / excelStudents.length) * 100).toFixed(1)}%`);

  console.log('\nSchedules:');
  console.log(`  - Total lessons in Excel: ${totalExcelLessons}`);
  console.log(`  - Total lessons in DB: ${totalDbLessons}`);
  console.log(`  - Matched: ${totalMatched}`);
  console.log(`  - Missing: ${totalMissing}`);
  console.log(`  - Success Rate: ${((totalMatched / totalExcelLessons) * 100).toFixed(1)}%`);

  // ========================================
  // STEP 6: Save Reports
  // ========================================
  console.log('\n--- Saving Reports ---\n');

  // Create reports directory
  const reportsDir = path.join(process.cwd(), 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  // Save missing students JSON
  fs.writeFileSync(
    path.join(reportsDir, 'missing-students.json'),
    JSON.stringify(missingStudents, null, 2)
  );
  console.log('✓ Saved: reports/missing-students.json');

  // Save missing schedules JSON
  const missingSchedules = {};
  for (const [teacher, data] of Object.entries(scheduleComparison)) {
    if (data.missing?.length > 0) {
      missingSchedules[teacher] = data.missing;
    }
  }
  fs.writeFileSync(
    path.join(reportsDir, 'missing-schedules.json'),
    JSON.stringify(missingSchedules, null, 2)
  );
  console.log('✓ Saved: reports/missing-schedules.json');

  // Save full report
  const reportContent = `
STRINGS DEPARTMENT IMPORT ANALYSIS REPORT
Generated: ${new Date().toISOString()}
============================================================

STUDENT IMPORT STATUS
---------------------
Total in Excel: ${excelStudents.length}
Matched in DB: ${matchedStudents.length}
Missing from DB: ${missingStudents.length}
Success Rate: ${((matchedStudents.length / excelStudents.length) * 100).toFixed(1)}%

Missing Students:
${missingStudents.map((s, i) => `${i + 1}. ${s.name} (Teacher: ${s.teacher}, Instrument: ${s.instrument})`).join('\n')}

SCHEDULE STATUS
---------------
Total lessons in Excel: ${totalExcelLessons}
Matched in DB: ${totalMatched}
Missing from DB: ${totalMissing}
Success Rate: ${((totalMatched / totalExcelLessons) * 100).toFixed(1)}%

Missing Schedules by Teacher:
${Object.entries(missingSchedules).map(([teacher, lessons]) =>
  `\n${teacher}:\n${lessons.map(l => `  - ${l.day} ${l.time}: ${l.studentName}`).join('\n')}`
).join('\n')}
`;

  fs.writeFileSync(
    path.join(reportsDir, 'strings-import-analysis.txt'),
    reportContent
  );
  console.log('✓ Saved: reports/strings-import-analysis.txt');

  console.log('\n============================================================');
  console.log('  ANALYSIS COMPLETE');
  console.log('============================================================');

  return { missingStudents, missingSchedules, scheduleComparison };
}

analyze().catch(console.error);
