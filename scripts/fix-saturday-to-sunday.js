/**
 * Script to fix Saturday lessons that should be on Sunday
 *
 * Background: Due to a timezone bug, lessons meant for Sunday were stored with
 * Saturday dates. This script shifts those dates forward by 1 day.
 *
 * Usage:
 *   Analyze only:  node scripts/fix-saturday-to-sunday.js --analyze
 *   Fix issues:    node scripts/fix-saturday-to-sunday.js --fix
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dotenv.config();
dayjs.extend(utc);
dayjs.extend(timezone);

const APP_TIMEZONE = 'Asia/Jerusalem';

async function analyzeAndFix(shouldFix = false) {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const dbName = process.env.MONGODB_NAME || 'Conservatory-DB';

  if (!uri) {
    console.error('No MongoDB URI found in environment variables');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri, { dbName });
    console.log('Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('theory_lesson');

    // Find all lessons on Saturday (dayOfWeek=6)
    const saturdayLessons = await collection.find({ dayOfWeek: 6 }).toArray();

    console.log('================================================================================');
    console.log('              SATURDAY LESSONS ANALYSIS');
    console.log('================================================================================\n');

    console.log(`Found ${saturdayLessons.length} lessons currently on Saturday (dayOfWeek=6)`);
    console.log('These lessons should be moved to Sunday.\n');

    if (saturdayLessons.length === 0) {
      console.log('No Saturday lessons found. Nothing to fix!');
      await mongoose.disconnect();
      return;
    }

    // Group by category
    const byCategory = {};
    for (const lesson of saturdayLessons) {
      if (!byCategory[lesson.category]) {
        byCategory[lesson.category] = [];
      }
      byCategory[lesson.category].push(lesson);
    }

    console.log('Lessons by category:');
    for (const [category, lessons] of Object.entries(byCategory)) {
      console.log(`  ${category}: ${lessons.length} lessons`);
    }

    console.log('\nSample lessons to be fixed:');
    for (const lesson of saturdayLessons.slice(0, 5)) {
      const date = dayjs(lesson.date).tz(APP_TIMEZONE);
      const newDate = date.add(1, 'day');
      console.log(`  ${lesson._id}:`);
      console.log(`    Current: ${date.format('YYYY-MM-DD')} (Saturday)`);
      console.log(`    New:     ${newDate.format('YYYY-MM-DD')} (Sunday)`);
      console.log(`    Category: ${lesson.category}`);
      console.log('');
    }

    if (!shouldFix) {
      console.log('================================================================================');
      console.log('This was ANALYZE ONLY mode. No changes were made.');
      console.log('To apply fixes, run: node scripts/fix-saturday-to-sunday.js --fix');
      console.log('================================================================================\n');
      await mongoose.disconnect();
      return;
    }

    // Apply fixes
    console.log('================================================================================');
    console.log('                      APPLYING FIXES...');
    console.log('================================================================================\n');

    let fixedCount = 0;
    let errorCount = 0;

    for (const lesson of saturdayLessons) {
      try {
        // Get the current date and add 1 day
        const currentDate = dayjs(lesson.date).tz(APP_TIMEZONE);
        const newDate = currentDate.add(1, 'day');

        // Verify new date is Sunday
        if (newDate.day() !== 0) {
          console.log(`ERROR: New date for ${lesson._id} is not Sunday: ${newDate.format('YYYY-MM-DD')} (day=${newDate.day()})`);
          errorCount++;
          continue;
        }

        // Update the lesson - set to noon to avoid timezone issues
        await collection.updateOne(
          { _id: lesson._id },
          {
            $set: {
              date: newDate.hour(12).minute(0).second(0).utc().toDate(),
              dayOfWeek: 0, // Sunday
              updatedAt: new Date()
            }
          }
        );

        fixedCount++;

        if (fixedCount % 20 === 0) {
          console.log(`  Fixed ${fixedCount}/${saturdayLessons.length} lessons...`);
        }
      } catch (error) {
        console.log(`  Error fixing lesson ${lesson._id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n================================================================================');
    console.log('                           FIX COMPLETE');
    console.log('================================================================================');
    console.log(`\nSuccessfully fixed: ${fixedCount} lessons`);
    if (errorCount > 0) {
      console.log(`Errors: ${errorCount} lessons`);
    }

    // Verify
    const remainingSaturday = await collection.countDocuments({ dayOfWeek: 6 });
    const totalSunday = await collection.countDocuments({ dayOfWeek: 0 });
    console.log('\nAfter fix:');
    console.log(`  Saturday lessons (should be 0): ${remainingSaturday}`);
    console.log(`  Sunday lessons: ${totalSunday}`);

    await mongoose.disconnect();
    console.log('\nDatabase connection closed\n');

  } catch (error) {
    console.error('Error:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const shouldFix = args.includes('--fix');
const shouldAnalyze = args.includes('--analyze') || args.length === 0;

if (!shouldFix && !shouldAnalyze) {
  console.log('Usage:');
  console.log('  node scripts/fix-saturday-to-sunday.js --analyze   # Analyze only (default)');
  console.log('  node scripts/fix-saturday-to-sunday.js --fix       # Analyze and fix');
  process.exit(0);
}

console.log('\nSaturday to Sunday Fix Tool\n');
console.log(`Mode: ${shouldFix ? 'ANALYZE + FIX' : 'ANALYZE ONLY'}\n`);

analyzeAndFix(shouldFix);
