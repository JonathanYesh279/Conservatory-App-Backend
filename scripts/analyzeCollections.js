import 'dotenv/config';
import { getDB, initializeMongoDB } from '../services/mongoDB.service.js';

async function analyzeCollections() {
  try {
    await initializeMongoDB(process.env.MONGODB_URI);
    const db = getDB();

    console.log('📊 Analyzing Database Collections...\n');

    // Get all collections
    const collections = await db.listCollections().toArray();

    // Get stats for each collection
    const collectionStats = [];

    for (const coll of collections) {
      try {
        const stats = await db.collection(coll.name).stats();
        const count = await db.collection(coll.name).countDocuments();

        collectionStats.push({
          name: coll.name,
          size: stats.size,
          storageSize: stats.storageSize,
          count: count,
          avgObjSize: stats.avgObjSize || 0
        });
      } catch (err) {
        console.log(`⚠️  Could not get stats for: ${coll.name}`);
      }
    }

    // Sort by storage size descending
    collectionStats.sort((a, b) => b.storageSize - a.storageSize);

    // Format bytes to human readable
    const formatBytes = (bytes) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    console.log('Collection Name'.padEnd(40) + 'Documents'.padEnd(15) + 'Size'.padEnd(15) + 'Storage');
    console.log('='.repeat(85));

    let totalSize = 0;
    let totalStorage = 0;

    collectionStats.forEach(coll => {
      console.log(
        coll.name.padEnd(40) +
        coll.count.toString().padEnd(15) +
        formatBytes(coll.size).padEnd(15) +
        formatBytes(coll.storageSize)
      );
      totalSize += coll.size;
      totalStorage += coll.storageSize;
    });

    console.log('='.repeat(85));
    console.log('TOTAL'.padEnd(40) + ''.padEnd(15) + formatBytes(totalSize).padEnd(15) + formatBytes(totalStorage));

    console.log('\n📋 Collection Categories:\n');

    const production = collectionStats.filter(c =>
      !c.name.includes('backup') &&
      !c.name.includes('_ba') &&
      !c.name.includes('academic') &&
      !c.name.includes('contact_')
    );

    const backups = collectionStats.filter(c =>
      c.name.includes('backup') ||
      c.name.includes('_ba') ||
      c.name.includes('academic') ||
      c.name.includes('contact_')
    );

    console.log('✅ Production Collections (' + production.length + '):');
    production.forEach(c => console.log('   - ' + c.name));
    console.log(`   Total Storage: ${formatBytes(production.reduce((sum, c) => sum + c.storageSize, 0))}`);

    console.log('\n🗑️  Backup/Unnecessary Collections (' + backups.length + '):');
    backups.forEach(c => console.log('   - ' + c.name + ' (' + c.count + ' docs, ' + formatBytes(c.storageSize) + ')'));
    console.log(`\n   Total Wasted Storage: ${formatBytes(backups.reduce((sum, c) => sum + c.storageSize, 0))}`);
    console.log(`   Total Wasted Documents: ${backups.reduce((sum, c) => sum + c.count, 0)}`);

    if (backups.length > 0) {
      console.log('\n💡 RECOMMENDATION:');
      console.log('   You can safely DELETE these backup collections to free up space.');
      console.log('   These appear to be old backups or test data that are no longer needed.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

analyzeCollections();
