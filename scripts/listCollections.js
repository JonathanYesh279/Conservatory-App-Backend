import 'dotenv/config';
import { getDB, initializeMongoDB } from '../services/mongoDB.service.js';

async function listCollections() {
  try {
    await initializeMongoDB(process.env.MONGODB_URI);
    const db = getDB();

    console.log('📊 Analyzing Database Collections...\n');

    // Get all collections
    const collections = await db.listCollections().toArray();

    // Get document counts for each collection
    const collectionInfo = [];

    for (const coll of collections) {
      try {
        const count = await db.collection(coll.name).countDocuments();
        collectionInfo.push({
          name: coll.name,
          count: count
        });
      } catch (err) {
        console.log(`⚠️  Could not count documents for: ${coll.name}`);
      }
    }

    // Sort by count descending
    collectionInfo.sort((a, b) => b.count - a.count);

    console.log('Collection Name'.padEnd(50) + 'Documents');
    console.log('='.repeat(70));

    let totalDocs = 0;

    collectionInfo.forEach(coll => {
      console.log(coll.name.padEnd(50) + coll.count.toString());
      totalDocs += coll.count;
    });

    console.log('='.repeat(70));
    console.log('TOTAL'.padEnd(50) + totalDocs.toString());

    console.log('\n📋 Collection Analysis:\n');

    // Categorize collections
    const production = collectionInfo.filter(c =>
      !c.name.includes('backup') &&
      !c.name.includes('_ba') &&
      !c.name.includes('academic') &&
      !c.name.includes('contact_')
    );

    const backups = collectionInfo.filter(c =>
      c.name.includes('backup') ||
      c.name.includes('_ba') ||
      c.name.includes('academic') ||
      c.name.includes('contact_')
    );

    console.log('✅ PRODUCTION COLLECTIONS (' + production.length + ' collections):');
    production.forEach(c => {
      const status = c.count > 0 ? '✓' : '✗ (empty)';
      console.log(`   ${status} ${c.name.padEnd(40)} - ${c.count} documents`);
    });
    console.log(`\n   Total Production Documents: ${production.reduce((sum, c) => sum + c.count, 0)}`);

    if (backups.length > 0) {
      console.log('\n\n🗑️  BACKUP/UNNECESSARY COLLECTIONS (' + backups.length + ' collections):');
      backups.forEach(c => {
        console.log(`   ❌ ${c.name.padEnd(40)} - ${c.count} documents`);
      });
      console.log(`\n   Total Backup Documents: ${backups.reduce((sum, c) => sum + c.count, 0)}`);

      console.log('\n\n💡 RECOMMENDATION:');
      console.log('   ================');
      console.log('   These backup collections can be SAFELY DELETED:');
      backups.forEach(c => {
        console.log(`   • ${c.name}`);
      });

      console.log('\n   ⚠️  This will free up space and reduce your MongoDB storage usage.');
      console.log('   ⚠️  These appear to be old backup snapshots that are no longer needed.');
      console.log('\n   To delete these collections, you can:');
      console.log('   1. Go to MongoDB Atlas → Browse Collections');
      console.log('   2. Click on each backup collection');
      console.log('   3. Click "Delete Collection"');
      console.log('\n   Or run: node scripts/deleteBackups.js (I can create this script for you)');
    } else {
      console.log('\n✅ No backup collections found! Your database is clean.');
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

listCollections();
