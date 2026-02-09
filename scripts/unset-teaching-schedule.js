import 'dotenv/config';
import { initializeMongoDB, getCollection } from '../services/mongoDB.service.js';

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await initializeMongoDB();
    console.log('Connected.\n');

    const teacherCollection = await getCollection('teacher');

    // Check how many teachers still have teaching.schedule
    const countBefore = await teacherCollection.countDocuments({
      'teaching.schedule': { $exists: true }
    });
    console.log(`Teachers with teaching.schedule before: ${countBefore}`);

    if (countBefore === 0) {
      console.log('No teachers have teaching.schedule — nothing to unset.');
      process.exit(0);
    }

    // Remove teaching.schedule from all teacher documents
    const result = await teacherCollection.updateMany(
      { 'teaching.schedule': { $exists: true } },
      {
        $unset: { 'teaching.schedule': '' },
        $set: { updatedAt: new Date() }
      }
    );

    console.log(`\nRemoved teaching.schedule from ${result.modifiedCount} teachers.`);

    // Verify
    const countAfter = await teacherCollection.countDocuments({
      'teaching.schedule': { $exists: true }
    });
    console.log(`Teachers with teaching.schedule after: ${countAfter}`);

    if (countAfter === 0) {
      console.log('\n✅ teaching.schedule has been fully removed from all teacher documents.');
    } else {
      console.log(`\n⚠️  ${countAfter} teachers still have teaching.schedule!`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Failed:', error.message);
    process.exit(1);
  }
}

run();
