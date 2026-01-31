/**
 * Check String Instruments Data Script
 *
 * Analyzes the current state of string instruments in the database:
 * - Teachers with violin (כינור/כנור), cello (צ'לו), viola (ויולה)
 * - Students with these instruments
 * - Identifies spelling inconsistencies
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_NAME || 'Conservatory-DB';

async function checkStringsData() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('🔌 Connected to MongoDB\n');

    const db = client.db(DB_NAME);
    const teacherCollection = db.collection('teacher');
    const studentCollection = db.collection('student');

    // ==================== TEACHERS ====================
    console.log('='.repeat(60));
    console.log('📋 TEACHERS WITH STRING INSTRUMENTS');
    console.log('='.repeat(60) + '\n');

    // Find all teachers with string instruments
    const stringTeachers = await teacherCollection.find({
      $or: [
        { 'professionalInfo.instrument': { $regex: 'כ.?נור', $options: 'i' } },
        { 'professionalInfo.instrument': { $regex: "צ.?לו", $options: 'i' } },
        { 'professionalInfo.instrument': { $regex: 'ויולה', $options: 'i' } },
        { 'professionalInfo.instrument': { $regex: 'קונטרבס', $options: 'i' } },
      ],
      isActive: true
    }).toArray();

    console.log(`Found ${stringTeachers.length} active string teachers:\n`);

    const teachersByInstrument = {};
    let teachersWithSpellingIssue = [];

    for (const teacher of stringTeachers) {
      const name = teacher.personalInfo?.fullName || 'Unknown';
      const instrument = teacher.professionalInfo?.instrument || 'N/A';
      const studentCount = (teacher.studentIds || []).length;
      const scheduleCount = (teacher.schedule || []).length;

      // Check for spelling issue (כנור without י)
      const hasSpellingIssue = instrument.includes('כנור') && !instrument.includes('כינור');

      if (hasSpellingIssue) {
        teachersWithSpellingIssue.push({ name, instrument, _id: teacher._id });
      }

      const flag = hasSpellingIssue ? '⚠️  WRONG SPELLING' : '✅';

      console.log(`${flag} ${name}`);
      console.log(`   ID: ${teacher._id}`);
      console.log(`   Instrument: "${instrument}"`);
      console.log(`   Students: ${studentCount}, Schedule entries: ${scheduleCount}`);
      console.log('');

      // Group by instrument
      if (!teachersByInstrument[instrument]) {
        teachersByInstrument[instrument] = [];
      }
      teachersByInstrument[instrument].push(name);
    }

    console.log('\n--- Teachers by Instrument ---');
    for (const [instrument, teachers] of Object.entries(teachersByInstrument)) {
      console.log(`"${instrument}": ${teachers.join(', ')}`);
    }

    // ==================== STUDENTS ====================
    console.log('\n' + '='.repeat(60));
    console.log('📋 STUDENTS WITH STRING INSTRUMENTS');
    console.log('='.repeat(60) + '\n');

    // Find all students with string instruments
    const stringStudents = await studentCollection.find({
      $or: [
        { 'academicInfo.instrumentProgress.instrumentName': { $regex: 'כ.?נור', $options: 'i' } },
        { 'academicInfo.instrumentProgress.instrumentName': { $regex: "צ.?לו", $options: 'i' } },
        { 'academicInfo.instrumentProgress.instrumentName': { $regex: 'ויולה', $options: 'i' } },
        { 'academicInfo.instrumentProgress.instrumentName': { $regex: 'קונטרבס', $options: 'i' } },
      ],
      isActive: true
    }).toArray();

    console.log(`Found ${stringStudents.length} active string students\n`);

    // Count by instrument name (exact)
    const instrumentCounts = {};
    const studentsWithSpellingIssue = [];

    for (const student of stringStudents) {
      const name = student.personalInfo?.fullName || 'Unknown';
      const instruments = student.academicInfo?.instrumentProgress || [];

      for (const prog of instruments) {
        const instrName = prog.instrumentName;
        if (instrName) {
          instrumentCounts[instrName] = (instrumentCounts[instrName] || 0) + 1;

          // Check for spelling issue
          if (instrName.includes('כנור') && !instrName.includes('כינור')) {
            studentsWithSpellingIssue.push({ name, instrument: instrName, _id: student._id });
          }
        }
      }
    }

    console.log('--- Student counts by instrument name ---');
    for (const [instrument, count] of Object.entries(instrumentCounts).sort((a, b) => b[1] - a[1])) {
      const hasIssue = instrument.includes('כנור') && !instrument.includes('כינור');
      const flag = hasIssue ? '⚠️' : '✅';
      console.log(`${flag} "${instrument}": ${count} students`);
    }

    // ==================== TEACHER-STUDENT LINKS ====================
    console.log('\n' + '='.repeat(60));
    console.log('📋 TEACHER-STUDENT ASSIGNMENTS');
    console.log('='.repeat(60) + '\n');

    for (const teacher of stringTeachers) {
      const name = teacher.personalInfo?.fullName || 'Unknown';
      const studentIds = teacher.studentIds || [];
      const scheduleEntries = teacher.schedule || [];

      console.log(`📚 ${name} (${teacher.professionalInfo?.instrument})`);
      console.log(`   studentIds array: ${studentIds.length} students`);
      console.log(`   schedule array: ${scheduleEntries.length} entries`);

      if (scheduleEntries.length > 0) {
        const uniqueStudents = [...new Set(scheduleEntries.map(s => s.studentName))];
        console.log(`   Unique students in schedule: ${uniqueStudents.length}`);
        console.log(`   Names: ${uniqueStudents.slice(0, 5).join(', ')}${uniqueStudents.length > 5 ? '...' : ''}`);
      }
      console.log('');
    }

    // ==================== SUMMARY ====================
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60) + '\n');

    console.log(`Total string teachers: ${stringTeachers.length}`);
    console.log(`Total string students: ${stringStudents.length}`);
    console.log(`Teachers with spelling issues: ${teachersWithSpellingIssue.length}`);
    console.log(`Students with spelling issues: ${studentsWithSpellingIssue.length}`);

    if (teachersWithSpellingIssue.length > 0) {
      console.log('\n⚠️  Teachers needing instrument name fix (כנור → כינור):');
      for (const t of teachersWithSpellingIssue) {
        console.log(`   - ${t.name} (ID: ${t._id})`);
      }
    }

    if (studentsWithSpellingIssue.length > 0) {
      console.log('\n⚠️  Students needing instrument name fix (כנור → כינור):');
      for (const s of studentsWithSpellingIssue.slice(0, 10)) {
        console.log(`   - ${s.name} (ID: ${s._id})`);
      }
      if (studentsWithSpellingIssue.length > 10) {
        console.log(`   ... and ${studentsWithSpellingIssue.length - 10} more`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkStringsData()
  .then(() => {
    console.log('\n🎉 Check completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Check failed:', error);
    process.exit(1);
  });
