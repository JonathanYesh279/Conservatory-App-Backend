import 'dotenv/config';
import { initializeMongoDB, getCollection } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

const args = process.argv.slice(2);
const shouldApply = args.includes('--apply');

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await initializeMongoDB();
    console.log('Connected.\n');

    console.log(shouldApply
      ? '=== REPAIR MODE: APPLYING CHANGES ===\n'
      : '=== DRY RUN MODE (use --apply to write changes) ===\n'
    );

    const results = await repairOrchestraMembership({ dryRun: !shouldApply });

    console.log('\n=== RESULTS ===');
    console.log(JSON.stringify(results, null, 2));

    process.exit(0);
  } catch (error) {
    console.error('Repair failed:', error.message);
    process.exit(1);
  }
}

async function repairOrchestraMembership({ dryRun = true }) {
  const studentCollection = await getCollection('student');
  const orchestraCollection = await getCollection('orchestra');

  const results = {
    studentToOrchestra: { checked: 0, fixed: 0, details: [] },
    orchestraToStudent: { checked: 0, fixed: 0, details: [] },
    staleReferences: [],
    errors: []
  };

  // Load all data
  const students = await studentCollection.find({}).toArray();
  const orchestras = await orchestraCollection.find({}).toArray();

  const orchestraMap = new Map(orchestras.map(o => [o._id.toString(), o]));
  const studentMap = new Map(students.map(s => [s._id.toString(), s]));

  // --- Step 1: Student → Orchestra sync ---
  console.log('Step 1: Checking student enrollments → orchestra memberIds...');

  for (const student of students) {
    const orchestraIds = student.enrollments?.orchestraIds || [];
    if (orchestraIds.length === 0) continue;

    const studentIdStr = student._id.toString();

    for (const orchestraId of orchestraIds) {
      results.studentToOrchestra.checked++;

      const orchestra = orchestraMap.get(orchestraId);
      if (!orchestra) {
        results.staleReferences.push({
          type: 'student-references-deleted-orchestra',
          studentId: studentIdStr,
          studentName: student.personalInfo?.fullName || 'Unknown',
          orchestraId
        });
        continue;
      }

      const memberIds = orchestra.memberIds || [];
      if (!memberIds.includes(studentIdStr)) {
        const detail = {
          action: 'addToSet student into orchestra.memberIds',
          orchestraId,
          orchestraName: orchestra.name,
          studentId: studentIdStr,
          studentName: student.personalInfo?.fullName || 'Unknown'
        };
        results.studentToOrchestra.details.push(detail);
        results.studentToOrchestra.fixed++;

        console.log(`  FIX: Add student "${detail.studentName}" → orchestra "${detail.orchestraName}"`);

        if (!dryRun) {
          try {
            await orchestraCollection.updateOne(
              { _id: orchestra._id },
              { $addToSet: { memberIds: studentIdStr } }
            );
          } catch (err) {
            results.errors.push(`Failed to add student ${studentIdStr} to orchestra ${orchestraId}: ${err.message}`);
          }
        }
      }
    }
  }

  // --- Step 2: Orchestra → Student sync ---
  console.log('Step 2: Checking orchestra memberIds → student enrollments...');

  for (const orchestra of orchestras) {
    const memberIds = orchestra.memberIds || [];
    if (memberIds.length === 0) continue;

    const orchestraIdStr = orchestra._id.toString();

    for (const memberId of memberIds) {
      results.orchestraToStudent.checked++;

      const student = studentMap.get(memberId);
      if (!student) {
        results.staleReferences.push({
          type: 'orchestra-references-deleted-student',
          orchestraId: orchestraIdStr,
          orchestraName: orchestra.name,
          studentId: memberId
        });
        continue;
      }

      const orchestraIds = student.enrollments?.orchestraIds || [];
      if (!orchestraIds.includes(orchestraIdStr)) {
        const detail = {
          action: 'addToSet orchestraId into student.enrollments.orchestraIds',
          studentId: memberId,
          studentName: student.personalInfo?.fullName || 'Unknown',
          orchestraId: orchestraIdStr,
          orchestraName: orchestra.name
        };
        results.orchestraToStudent.details.push(detail);
        results.orchestraToStudent.fixed++;

        console.log(`  FIX: Add orchestra "${detail.orchestraName}" → student "${detail.studentName}"`);

        if (!dryRun) {
          try {
            await studentCollection.updateOne(
              { _id: student._id },
              { $addToSet: { 'enrollments.orchestraIds': orchestraIdStr } }
            );
          } catch (err) {
            results.errors.push(`Failed to add orchestra ${orchestraIdStr} to student ${memberId}: ${err.message}`);
          }
        }
      }
    }
  }

  // --- Summary ---
  console.log('\n--- Summary ---');
  console.log(`Student→Orchestra: ${results.studentToOrchestra.checked} checked, ${results.studentToOrchestra.fixed} to fix`);
  console.log(`Orchestra→Student: ${results.orchestraToStudent.checked} checked, ${results.orchestraToStudent.fixed} to fix`);
  console.log(`Stale references: ${results.staleReferences.length}`);
  if (results.errors.length > 0) {
    console.log(`Errors: ${results.errors.length}`);
  }

  if (dryRun && (results.studentToOrchestra.fixed > 0 || results.orchestraToStudent.fixed > 0)) {
    console.log('\nRun with --apply to write these changes.');
  }

  return results;
}

run();
