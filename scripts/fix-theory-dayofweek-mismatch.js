/**
 * Script to detect and fix dayOfWeek mismatches in theory lessons
 *
 * Usage:
 *   Analyze only:  node scripts/fix-theory-dayofweek-mismatch.js --analyze
 *   Fix issues:    node scripts/fix-theory-dayofweek-mismatch.js --fix
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
const DAYS_OF_WEEK_HEBREW = {
  0: 'ראשון (Sunday)',
  1: 'שני (Monday)',
  2: 'שלישי (Tuesday)',
  3: 'רביעי (Wednesday)',
  4: 'חמישי (Thursday)',
  5: 'שישי (Friday)',
  6: 'שבת (Saturday)'
};

async function analyzeAndFix(shouldFix = false) {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  const dbName = process.env.MONGODB_NAME || 'Conservatory-DB';

  if (!uri) {
    console.error('❌ No MongoDB URI found in environment variables');
    process.exit(1);
  }

  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log(`   Database: ${dbName}`);
    await mongoose.connect(uri, { dbName });
    console.log('✅ Connected to MongoDB\n');

    const db = mongoose.connection.db;
    const collection = db.collection('theory_lesson');

    // Get all theory lessons
    const lessons = await collection.find({}).toArray();
    console.log(`📚 Total theory lessons in database: ${lessons.length}\n`);

    const mismatches = [];
    const noDate = [];
    const noDayOfWeek = [];
    const correct = [];

    for (const lesson of lessons) {
      if (!lesson.date) {
        noDate.push(lesson);
        continue;
      }

      if (lesson.dayOfWeek === undefined || lesson.dayOfWeek === null) {
        noDayOfWeek.push(lesson);
        continue;
      }

      // Calculate actual day of week from the stored date
      const lessonDate = dayjs(lesson.date).tz(APP_TIMEZONE);
      const actualDayOfWeek = lessonDate.day();
      const storedDayOfWeek = lesson.dayOfWeek;

      if (actualDayOfWeek !== storedDayOfWeek) {
        mismatches.push({
          _id: lesson._id,
          category: lesson.category,
          date: lessonDate.format('YYYY-MM-DD'),
          dateFormatted: lessonDate.format('dddd, DD/MM/YYYY'),
          storedDayOfWeek,
          storedDayName: DAYS_OF_WEEK_HEBREW[storedDayOfWeek],
          actualDayOfWeek,
          actualDayName: DAYS_OF_WEEK_HEBREW[actualDayOfWeek],
          teacherId: lesson.teacherId,
          startTime: lesson.startTime,
          location: lesson.location
        });
      } else {
        correct.push(lesson);
      }
    }

    // Print Summary
    console.log('=' .repeat(80));
    console.log('                    THEORY LESSONS DAY-OF-WEEK ANALYSIS');
    console.log('=' .repeat(80));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   ✅ Correct lessons (dayOfWeek matches date): ${correct.length}`);
    console.log(`   ❌ Mismatched lessons (dayOfWeek differs from date): ${mismatches.length}`);
    console.log(`   ⚠️  Lessons without date field: ${noDate.length}`);
    console.log(`   ⚠️  Lessons without dayOfWeek field: ${noDayOfWeek.length}`);
    console.log('');

    if (mismatches.length === 0) {
      console.log('🎉 No mismatches found! All lessons have correct dayOfWeek values.\n');
      await mongoose.disconnect();
      return;
    }

    // Group mismatches by category
    const byCategory = {};
    for (const m of mismatches) {
      if (!byCategory[m.category]) {
        byCategory[m.category] = [];
      }
      byCategory[m.category].push(m);
    }

    console.log('=' .repeat(80));
    console.log('                         MISMATCHED LESSONS DETAIL');
    console.log('=' .repeat(80));

    for (const [category, items] of Object.entries(byCategory)) {
      console.log(`\n📁 Category: ${category} (${items.length} lessons)`);
      console.log('-'.repeat(70));

      for (const m of items.slice(0, 10)) { // Show first 10 per category
        console.log(`   ID: ${m._id}`);
        console.log(`   Date: ${m.date} (${m.dateFormatted})`);
        console.log(`   Stored dayOfWeek: ${m.storedDayOfWeek} = ${m.storedDayName}`);
        console.log(`   Actual dayOfWeek: ${m.actualDayOfWeek} = ${m.actualDayName}`);
        console.log(`   Time: ${m.startTime}, Location: ${m.location}`);
        console.log('');
      }

      if (items.length > 10) {
        console.log(`   ... and ${items.length - 10} more lessons in this category\n`);
      }
    }

    // Summary of what will be fixed
    console.log('=' .repeat(80));
    console.log('                              FIX SUMMARY');
    console.log('=' .repeat(80));
    console.log(`\n🔧 The fix will update ${mismatches.length} lessons:`);
    console.log('   - Recalculate dayOfWeek from the actual date stored');
    console.log('   - This ensures dayOfWeek matches the real day of the lesson\n');

    // Show distribution of fixes
    const storedDistribution = {};
    const actualDistribution = {};
    for (const m of mismatches) {
      storedDistribution[m.storedDayName] = (storedDistribution[m.storedDayName] || 0) + 1;
      actualDistribution[m.actualDayName] = (actualDistribution[m.actualDayName] || 0) + 1;
    }

    console.log('📈 Current stored dayOfWeek distribution (WRONG):');
    for (const [day, count] of Object.entries(storedDistribution)) {
      console.log(`   ${day}: ${count} lessons`);
    }

    console.log('\n📈 Actual dayOfWeek distribution (CORRECT - after fix):');
    for (const [day, count] of Object.entries(actualDistribution)) {
      console.log(`   ${day}: ${count} lessons`);
    }

    if (!shouldFix) {
      console.log('\n' + '=' .repeat(80));
      console.log('⚠️  This was ANALYZE ONLY mode. No changes were made.');
      console.log('   To apply fixes, run: node scripts/fix-theory-dayofweek-mismatch.js --fix');
      console.log('=' .repeat(80) + '\n');
      await mongoose.disconnect();
      return;
    }

    // Apply fixes
    console.log('\n' + '=' .repeat(80));
    console.log('                           APPLYING FIXES...');
    console.log('=' .repeat(80) + '\n');

    let fixedCount = 0;
    let errorCount = 0;

    for (const m of mismatches) {
      try {
        await collection.updateOne(
          { _id: m._id },
          {
            $set: {
              dayOfWeek: m.actualDayOfWeek,
              updatedAt: new Date()
            }
          }
        );
        fixedCount++;

        if (fixedCount % 50 === 0) {
          console.log(`   Fixed ${fixedCount}/${mismatches.length} lessons...`);
        }
      } catch (error) {
        console.error(`   ❌ Error fixing lesson ${m._id}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n' + '=' .repeat(80));
    console.log('                              FIX COMPLETE');
    console.log('=' .repeat(80));
    console.log(`\n✅ Successfully fixed: ${fixedCount} lessons`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount} lessons`);
    }
    console.log('\n');

    await mongoose.disconnect();
    console.log('🔌 Database connection closed\n');

  } catch (error) {
    console.error('❌ Error:', error);
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
  console.log('  node scripts/fix-theory-dayofweek-mismatch.js --analyze   # Analyze only (default)');
  console.log('  node scripts/fix-theory-dayofweek-mismatch.js --fix       # Analyze and fix');
  process.exit(0);
}

console.log('\n🔍 Theory Lessons dayOfWeek Mismatch Detection & Fix Tool\n');
console.log(`Mode: ${shouldFix ? '🔧 ANALYZE + FIX' : '📊 ANALYZE ONLY'}\n`);

analyzeAndFix(shouldFix);
