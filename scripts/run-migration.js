import 'dotenv/config';
import { initializeMongoDB } from '../services/mongoDB.service.js';
import { createBackup, migrateToTimeBlocks, generateMigrationReport } from '../api/schedule/migrate-to-time-blocks.js';

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isBackupOnly = args.includes('--backup-only');
const isReportOnly = args.includes('--report-only');

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    await initializeMongoDB();
    console.log('Connected.\n');

    if (isReportOnly) {
      console.log('=== MIGRATION REPORT ===\n');
      const report = await generateMigrationReport();
      console.log(JSON.stringify(report, null, 2));
      process.exit(0);
    }

    if (isBackupOnly) {
      console.log('=== CREATING BACKUP ===\n');
      const backup = await createBackup();
      console.log(`Backup saved with ${backup.teachers.length} teachers and ${backup.students.length} students`);
      process.exit(0);
    }

    // Step 1: Create backup
    console.log('=== STEP 1: CREATING BACKUP ===\n');
    const backup = await createBackup();
    console.log(`Backup saved with ${backup.teachers.length} teachers and ${backup.students.length} students\n`);

    // Step 2: Run migration
    if (isDryRun) {
      console.log('=== STEP 2: DRY RUN MIGRATION ===\n');
    } else {
      console.log('=== STEP 2: RUNNING MIGRATION ===\n');
    }

    const results = await migrateToTimeBlocks({ dryRun: isDryRun });
    console.log('\n=== MIGRATION RESULTS ===');
    console.log(JSON.stringify(results, null, 2));

    // Step 3: Report
    console.log('\n=== STEP 3: POST-MIGRATION REPORT ===\n');
    const report = await generateMigrationReport();
    console.log(JSON.stringify(report.summary, null, 2));

    if (results.errors.length > 0) {
      console.log(`\n⚠️  ${results.errors.length} errors occurred during migration:`);
      results.errors.forEach(e => console.log(`  - ${e}`));
    }

    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

run();
