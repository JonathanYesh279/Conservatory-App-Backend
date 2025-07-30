#!/usr/bin/env node

/**
 * Standalone migration runner for private lesson attendance
 * This script properly loads environment variables and runs the migration
 */

import 'dotenv/config';
import { migratePrivateLessonAttendance, validateAttendanceMigration } from './migrations/add-private-lesson-attendance.js';

async function runMigration() {
  console.log('🚀 Starting Private Lesson Attendance Migration...\n');

  try {
    // Check environment
    const mongoUri = process.env.MONGODB_URI?.trim();
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable is not set');
    }
    
    console.log('✅ Environment variables loaded');
    console.log('📡 MongoDB URI found');
    
    // Step 1: Dry run first
    console.log('\n🧪 Running dry run migration...');
    const dryRunResult = await migratePrivateLessonAttendance({ dryRun: true });
    
    console.log('✅ Dry run completed successfully!');
    console.log('📊 Summary:');
    console.log(`   - Teachers to process: ${dryRunResult.summary.teachersProcessed}`);
    console.log(`   - Slots to update: ${dryRunResult.summary.slotsUpdated}`);
    console.log(`   - Indexes to create: ${dryRunResult.summary.indexesCreated}`);
    console.log(`   - Collections to create: ${dryRunResult.summary.collectionsCreated}`);
    
    if (dryRunResult.errors.length > 0) {
      console.log('⚠️  Dry run found some issues:');
      dryRunResult.errors.forEach(error => {
        console.log(`   - ${error.operation}: ${error.error}`);
      });
      console.log('\nContinuing with actual migration...\n');
    }
    
    // Step 2: Run actual migration
    console.log('🔄 Running actual migration...');
    const migrationResult = await migratePrivateLessonAttendance({ dryRun: false });
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 Final Summary:');
    console.log(`   - Teachers processed: ${migrationResult.summary.teachersProcessed}`);
    console.log(`   - Slots updated: ${migrationResult.summary.slotsUpdated}`);
    console.log(`   - Indexes created: ${migrationResult.summary.indexesCreated}`);
    console.log(`   - Collections created: ${migrationResult.summary.collectionsCreated}`);
    
    if (migrationResult.errors.length > 0) {
      console.log('⚠️  Some non-critical errors occurred:');
      migrationResult.errors.forEach(error => {
        console.log(`   - ${error.operation}: ${error.error}`);
      });
    }
    
    // Step 3: Validate migration
    console.log('\n🔍 Validating migration...');
    const validation = await validateAttendanceMigration();
    
    if (validation.isValid) {
      console.log('✅ Migration validation passed!');
      console.log('📊 Validation Summary:');
      console.log(`   - Activity collection exists: ${validation.summary.activityCollectionExists}`);
      console.log(`   - Teachers with schedules: ${validation.summary.teachersWithSchedules}`);
      console.log(`   - Slots with attendance fields: ${validation.summary.slotsWithAttendanceFields}`);
      console.log(`   - Indexes present: ${validation.summary.indexesPresent}`);
    } else {
      console.log('❌ Migration validation failed:');
      validation.issues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
    }
    
    console.log('\n🎉 Migration completed successfully!');
    console.log('🚀 Your attendance system is ready to use!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run: npm run dev');
    console.log('   2. Your frontend can now use the attendance APIs');
    console.log('   3. Teachers can start marking attendance immediately');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('   1. Check your MongoDB connection');
    console.error('   2. Verify MONGODB_URI in .env file');
    console.error('   3. Ensure database is accessible');
    
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Migration interrupted by user');
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection during migration:', reason);
  process.exit(1);
});

// Run the migration
runMigration();