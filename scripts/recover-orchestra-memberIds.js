/**
 * Orchestra MemberIds Recovery Script
 *
 * This script recovers lost memberIds in orchestra documents by scanning
 * all student documents and checking their enrollments.orchestraIds.
 *
 * The bug that caused data loss:
 * - Frontend sent partial updates (name, type, location, conductorId)
 * - Backend validation applied default([]) to memberIds
 * - $set operator overwrote the entire document including memberIds
 *
 * Since students still have orchestraIds in their enrollments, we can
 * rebuild the memberIds arrays.
 *
 * Usage:
 *   node scripts/recover-orchestra-memberIds.js --dry-run    # Preview changes
 *   node scripts/recover-orchestra-memberIds.js --apply      # Apply changes
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.MONGODB_NAME || process.env.DB_NAME || 'Conservatory-DB';

async function recoverOrchestraMemberIds(applyChanges = false) {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('🔌 Connected to MongoDB');

    const db = client.db(DB_NAME);
    const orchestraCollection = db.collection('orchestra');
    const studentCollection = db.collection('student');

    // Step 1: Get all active orchestras
    console.log('\n📋 Step 1: Fetching all active orchestras...');
    const orchestras = await orchestraCollection.find({ isActive: true }).toArray();
    console.log(`   Found ${orchestras.length} active orchestras`);

    // Step 2: Get all active students with orchestraIds
    console.log('\n📋 Step 2: Fetching all students with orchestra enrollments...');
    const students = await studentCollection.find({
      isActive: true,
      'enrollments.orchestraIds': { $exists: true, $ne: [] }
    }).toArray();
    console.log(`   Found ${students.length} students with orchestra enrollments`);

    // Step 3: Build a map of orchestraId -> studentIds from student documents
    console.log('\n📋 Step 3: Building orchestra membership map from student records...');
    const orchestraMembershipMap = new Map();

    for (const student of students) {
      const studentId = student._id.toString();
      const orchestraIds = student.enrollments?.orchestraIds || [];

      for (const orchestraId of orchestraIds) {
        if (!orchestraMembershipMap.has(orchestraId)) {
          orchestraMembershipMap.set(orchestraId, []);
        }
        if (!orchestraMembershipMap.get(orchestraId).includes(studentId)) {
          orchestraMembershipMap.get(orchestraId).push(studentId);
        }
      }
    }

    console.log(`   Built membership map for ${orchestraMembershipMap.size} orchestras`);

    // Step 4: Compare and identify discrepancies
    console.log('\n📋 Step 4: Analyzing discrepancies...\n');

    const recoveryNeeded = [];
    let totalMissingMembers = 0;

    for (const orchestra of orchestras) {
      const orchestraId = orchestra._id.toString();
      const orchestraName = orchestra.name;
      const currentMemberIds = orchestra.memberIds || [];
      const expectedMemberIds = orchestraMembershipMap.get(orchestraId) || [];

      // Find members that are in student records but not in orchestra
      const missingMemberIds = expectedMemberIds.filter(id => !currentMemberIds.includes(id));

      // Find members that are in orchestra but not in any student record (orphans)
      const orphanMemberIds = currentMemberIds.filter(id => !expectedMemberIds.includes(id));

      if (missingMemberIds.length > 0 || orphanMemberIds.length > 0) {
        console.log(`🎻 Orchestra: "${orchestraName}" (${orchestraId})`);
        console.log(`   Current memberIds: ${currentMemberIds.length}`);
        console.log(`   Expected memberIds: ${expectedMemberIds.length}`);

        if (missingMemberIds.length > 0) {
          console.log(`   ⚠️  Missing ${missingMemberIds.length} members (need to add):`);

          // Get student names for missing members
          for (const memberId of missingMemberIds) {
            try {
              const student = await studentCollection.findOne({ _id: new ObjectId(memberId) });
              const studentName = student?.personalInfo?.fullName || 'Unknown';
              console.log(`      - ${memberId} (${studentName})`);
            } catch (e) {
              console.log(`      - ${memberId} (could not fetch name)`);
            }
          }

          totalMissingMembers += missingMemberIds.length;
        }

        if (orphanMemberIds.length > 0) {
          console.log(`   🔍 Found ${orphanMemberIds.length} orphan members (in orchestra but not in any student)`);
          for (const memberId of orphanMemberIds) {
            console.log(`      - ${memberId}`);
          }
        }

        console.log('');

        recoveryNeeded.push({
          orchestraId,
          orchestraName,
          currentMemberIds,
          expectedMemberIds,
          missingMemberIds,
          orphanMemberIds,
          // For recovery, add missing members to current (preserves order + adds new)
          recoveredMemberIds: [...new Set([...currentMemberIds, ...missingMemberIds])]
        });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 RECOVERY SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total orchestras analyzed: ${orchestras.length}`);
    console.log(`Orchestras needing recovery: ${recoveryNeeded.length}`);
    console.log(`Total missing members to recover: ${totalMissingMembers}`);

    if (recoveryNeeded.length === 0) {
      console.log('\n✅ No recovery needed! All orchestra memberIds are in sync with student records.');
      return;
    }

    // Step 5: Apply recovery if requested
    if (applyChanges) {
      console.log('\n📋 Step 5: Applying recovery...\n');

      for (const recovery of recoveryNeeded) {
        console.log(`🔧 Recovering "${recovery.orchestraName}"...`);
        console.log(`   Adding ${recovery.missingMemberIds.length} missing members`);

        try {
          const result = await orchestraCollection.updateOne(
            { _id: new ObjectId(recovery.orchestraId) },
            {
              $set: {
                memberIds: recovery.recoveredMemberIds,
                lastModified: new Date()
              }
            }
          );

          if (result.modifiedCount > 0) {
            console.log(`   ✅ Successfully recovered ${recovery.missingMemberIds.length} members`);
          } else {
            console.log(`   ⚠️  No changes made (document might not exist)`);
          }
        } catch (error) {
          console.error(`   ❌ Error recovering orchestra: ${error.message}`);
        }
      }

      console.log('\n✅ Recovery complete!');

    } else {
      console.log('\n⚠️  DRY RUN MODE - No changes applied');
      console.log('   Run with --apply to apply the recovery');
    }

  } catch (error) {
    console.error('❌ Error during recovery:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const applyChanges = args.includes('--apply');
const dryRun = args.includes('--dry-run') || !applyChanges;

if (!args.includes('--apply') && !args.includes('--dry-run')) {
  console.log('Usage:');
  console.log('  node scripts/recover-orchestra-memberIds.js --dry-run    # Preview changes');
  console.log('  node scripts/recover-orchestra-memberIds.js --apply      # Apply changes');
  console.log('');
  console.log('Running in dry-run mode by default...\n');
}

recoverOrchestraMemberIds(applyChanges)
  .then(() => {
    console.log('\n🎉 Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error);
    process.exit(1);
  });
