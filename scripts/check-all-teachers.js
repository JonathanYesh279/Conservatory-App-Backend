/**
 * Check All Teachers Script
 * Lists all teachers in the database grouped by instrument
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_NAME || 'Conservatory-DB';

async function checkAllTeachers() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('🔌 Connected to MongoDB\n');

    const db = client.db(DB_NAME);

    // Get ALL teachers
    const allTeachers = await db.collection('teacher').find({ isActive: true }).toArray();

    console.log('='.repeat(60));
    console.log('📋 ALL ACTIVE TEACHERS');
    console.log('='.repeat(60) + '\n');
    console.log(`Total: ${allTeachers.length}\n`);

    const byInstrument = {};
    for (const t of allTeachers) {
      const instr = t.professionalInfo?.instrument || 'N/A';
      const name = t.personalInfo?.fullName;
      const studentCount = (t.studentIds || []).length;
      if (!byInstrument[instr]) byInstrument[instr] = [];
      byInstrument[instr].push({ name, studentCount, id: t._id });
    }

    for (const [instr, teachers] of Object.entries(byInstrument).sort()) {
      console.log(`"${instr}": ${teachers.length} teacher(s)`);
      teachers.forEach(t => console.log(`   - ${t.name} (${t.studentCount} students)`));
      console.log('');
    }

    // Check for expected string teachers by name
    console.log('\n' + '='.repeat(60));
    console.log('📋 CHECKING FOR EXPECTED STRING TEACHERS BY NAME');
    console.log('='.repeat(60) + '\n');

    const expectedStringTeachers = [
      'סבטלנה אברהם',
      'אנה ארונזון',
      'מרסל ברגמן',
      'סשה דולוב',
      'אלה סלטקין',
      'מרינה זיסקינד',
      'ורוניקה לוין',
      'אלונה קוטליאר',
      'אלסיה פלדמן',
      'לובה רבין'
    ];

    let foundCount = 0;
    for (const name of expectedStringTeachers) {
      // Search with flexible name matching (could be "FirstName LastName" or "LastName FirstName")
      const nameParts = name.split(' ');
      const found = await db.collection('teacher').findOne({
        $or: [
          { 'personalInfo.fullName': { $regex: name, $options: 'i' } },
          { 'personalInfo.fullName': { $regex: nameParts.reverse().join(' '), $options: 'i' } }
        ]
      });

      if (found) {
        foundCount++;
        console.log(`✅ Found: ${found.personalInfo.fullName} (${found.professionalInfo?.instrument || 'N/A'})`);
      } else {
        console.log(`❌ NOT FOUND: ${name}`);
      }
    }

    console.log(`\nFound ${foundCount}/${expectedStringTeachers.length} expected string teachers`);

    // Student counts
    console.log('\n' + '='.repeat(60));
    console.log('📋 STUDENT COUNTS');
    console.log('='.repeat(60) + '\n');

    const totalStudents = await db.collection('student').countDocuments({ isActive: true });
    const totalInactive = await db.collection('student').countDocuments({ isActive: false });

    console.log(`Active students: ${totalStudents}`);
    console.log(`Inactive students: ${totalInactive}`);

    // Count students by instrument
    console.log('\n--- Active Students by Instrument ---');
    const students = await db.collection('student').find({ isActive: true }).toArray();

    const studentsByInstrument = {};
    for (const s of students) {
      const instruments = s.academicInfo?.instrumentProgress || [];
      for (const prog of instruments) {
        const instr = prog.instrumentName || 'N/A';
        if (!studentsByInstrument[instr]) studentsByInstrument[instr] = 0;
        studentsByInstrument[instr]++;
      }
    }

    for (const [instr, count] of Object.entries(studentsByInstrument).sort((a, b) => b[1] - a[1])) {
      console.log(`"${instr}": ${count} students`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

checkAllTeachers()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
