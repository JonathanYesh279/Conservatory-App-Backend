import 'dotenv/config';
import { getDB, initializeMongoDB } from '../services/mongoDB.service.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function deleteBackupCollections() {
  try {
    await initializeMongoDB(process.env.MONGODB_URI);
    const db = getDB();

    console.log('🗑️  Backup Collection Deletion Tool\n');

    // Find all backup collections
    const allCollections = await db.listCollections().toArray();
    const backupCollections = allCollections.filter(c =>
      c.name.includes('backup') ||
      c.name.includes('_ba') ||
      c.name.includes('academic') ||
      c.name.includes('contact_')
    );

    if (backupCollections.length === 0) {
      console.log('✅ No backup collections found. Database is clean!');
      rl.close();
      process.exit(0);
    }

    console.log(`Found ${backupCollections.length} backup collections to delete:\n`);

    // Get document counts
    const collectionsWithCounts = [];
    for (const coll of backupCollections) {
      const count = await db.collection(coll.name).countDocuments();
      collectionsWithCounts.push({ name: coll.name, count });
      console.log(`   ❌ ${coll.name} (${count} documents)`);
    }

    const totalDocs = collectionsWithCounts.reduce((sum, c) => sum + c.count, 0);
    console.log(`\n   Total: ${totalDocs} documents to be deleted\n`);

    console.log('⚠️  WARNING: This action cannot be undone!');
    console.log('⚠️  Make sure you have a backup if needed.\n');

    const answer = await question('Are you sure you want to DELETE all these collections? (type "yes" to confirm): ');

    if (answer.toLowerCase() !== 'yes') {
      console.log('\n❌ Deletion cancelled. No collections were deleted.');
      rl.close();
      process.exit(0);
    }

    console.log('\n🗑️  Deleting backup collections...\n');

    let deletedCount = 0;
    let deletedDocs = 0;

    for (const coll of collectionsWithCounts) {
      try {
        await db.collection(coll.name).drop();
        console.log(`   ✅ Deleted: ${coll.name} (${coll.count} documents)`);
        deletedCount++;
        deletedDocs += coll.count;
      } catch (err) {
        console.log(`   ❌ Failed to delete: ${coll.name} - ${err.message}`);
      }
    }

    console.log(`\n✅ Successfully deleted ${deletedCount} collections (${deletedDocs} documents)`);
    console.log(`💾 Freed up database space!`);

    rl.close();
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    rl.close();
    process.exit(1);
  }
}

deleteBackupCollections();
