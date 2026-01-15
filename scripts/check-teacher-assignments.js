/**
 * Check teacherAssignments for all strings teachers
 */

import 'dotenv/config';
import { MongoClient } from 'mongodb';

const stringsInstruments = ['כינור', 'ויולה', 'נבל', "צ'לו", 'צלו', 'קונטרבס'];

async function check() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_NAME || 'Conservatory-DB');

  console.log('============================================================');
  console.log('  CHECK TEACHER ASSIGNMENTS');
  console.log('============================================================\n');

  // Get all strings teachers
  const teachers = await db.collection('teacher').find({
    'professionalInfo.instrument': { $in: stringsInstruments }
  }).toArray();

  for (const teacher of teachers) {
    const teacherId = teacher._id.toString();
    const teacherName = teacher.personalInfo?.fullName;

    // Find students with teacherIds pointing to this teacher
    const studentsByTeacherId = await db.collection('student').countDocuments({
      teacherIds: teacherId
    });

    // Find students with teacherAssignments pointing to this teacher
    const studentsByAssignment = await db.collection('student').countDocuments({
      'teacherAssignments.teacherId': teacherId,
      'teacherAssignments.isActive': { $ne: false }
    });

    const mismatch = studentsByTeacherId !== studentsByAssignment ? '⚠️ MISMATCH!' : '✓';

    console.log(`${teacherName}:`);
    console.log(`  teacherIds count: ${studentsByTeacherId}`);
    console.log(`  teacherAssignments count: ${studentsByAssignment}`);
    console.log(`  ${mismatch}`);
    console.log('');
  }

  await client.close();
}

check().catch(console.error);
