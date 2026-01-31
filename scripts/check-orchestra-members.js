/**
 * Script to check orchestra membership status
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function checkOrchestraMembers() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const dbName = process.env.MONGODB_NAME || 'Conservatory-DB';

  await mongoose.connect(uri, { dbName });
  const db = mongoose.connection.db;

  // Check students
  const students = await db.collection('student').find({}).toArray();

  console.log('=== STUDENTS STATUS ===');
  console.log('Total students:', students.length);

  // Check how many students have orchestra enrollment
  let studentsWithOrchestra = 0;
  const orchestraEnrollments = {};

  for (const student of students) {
    const orchIds = student.orchestraIds || [];
    if (orchIds.length > 0) {
      studentsWithOrchestra++;
      for (const orchId of orchIds) {
        const key = orchId.toString();
        if (!orchestraEnrollments[key]) {
          orchestraEnrollments[key] = [];
        }
        orchestraEnrollments[key].push({
          id: student._id.toString(),
          name: student.personalInfo?.fullName || 'Unknown'
        });
      }
    }
  }

  console.log('Students with orchestraIds:', studentsWithOrchestra);
  console.log('');

  // Get orchestra names and current memberIds
  const orchestras = await db.collection('orchestra').find({}).toArray();

  console.log('=== ORCHESTRA STATUS ===');
  for (const orch of orchestras) {
    const currentMembers = orch.memberIds?.length || 0;
    const expectedMembers = orchestraEnrollments[orch._id.toString()]?.length || 0;

    console.log(`\n${orch.name} (${orch._id}):`);
    console.log(`  Current memberIds in orchestra: ${currentMembers}`);
    console.log(`  Expected from student.orchestraIds: ${expectedMembers}`);

    if (currentMembers !== expectedMembers) {
      console.log(`  ⚠️  MISMATCH!`);
    }

    if (expectedMembers > 0) {
      console.log(`  Expected members:`);
      const members = orchestraEnrollments[orch._id.toString()];
      for (const m of members.slice(0, 5)) {
        console.log(`    - ${m.name} (${m.id})`);
      }
      if (members.length > 5) {
        console.log(`    ... and ${members.length - 5} more`);
      }
    }
  }

  if (Object.keys(orchestraEnrollments).length === 0) {
    console.log('\n⚠️  No students have orchestraIds - this is the root cause!');
    console.log('The student documents may have been seeded without orchestra enrollment.');
  }

  await mongoose.disconnect();
}

checkOrchestraMembers();
