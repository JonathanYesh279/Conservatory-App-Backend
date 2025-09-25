import { getCollection } from './services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupOrchestraMembers() {
  try {
    console.log('========================================');
    console.log('Orchestra Member Cleanup Utility');
    console.log('========================================\n');

    const orchestraCollection = await getCollection('orchestra');
    const studentCollection = await getCollection('student');
    
    // Get all orchestras
    const orchestras = await orchestraCollection.find({ isActive: true }).toArray();
    
    console.log(`Found ${orchestras.length} active orchestras\n`);
    
    let totalOrphaned = 0;
    let totalCleaned = 0;
    
    for (const orchestra of orchestras) {
      if (!orchestra.memberIds || orchestra.memberIds.length === 0) {
        continue;
      }
      
      console.log(`\nChecking orchestra: ${orchestra.name} (${orchestra._id})`);
      console.log(`  Current member IDs: ${orchestra.memberIds.length}`);
      
      const validMemberIds = [];
      const orphanedMemberIds = [];
      
      // Check each member ID
      for (const memberId of orchestra.memberIds) {
        try {
          const student = await studentCollection.findOne({ 
            _id: ObjectId.createFromHexString(memberId) 
          });
          
          if (student) {
            validMemberIds.push(memberId);
          } else {
            orphanedMemberIds.push(memberId);
            console.log(`    ❌ Orphaned member ID: ${memberId}`);
          }
        } catch (error) {
          // Invalid ObjectId format
          orphanedMemberIds.push(memberId);
          console.log(`    ⚠️ Invalid member ID format: ${memberId}`);
        }
      }
      
      if (orphanedMemberIds.length > 0) {
        totalOrphaned += orphanedMemberIds.length;
        
        console.log(`  Found ${orphanedMemberIds.length} orphaned member(s)`);
        console.log(`  Valid members remaining: ${validMemberIds.length}`);
        
        // Update the orchestra to remove orphaned members
        const updateResult = await orchestraCollection.updateOne(
          { _id: orchestra._id },
          { $set: { memberIds: validMemberIds } }
        );
        
        if (updateResult.modifiedCount > 0) {
          console.log(`  ✅ Cleaned up orchestra - removed ${orphanedMemberIds.length} orphaned member(s)`);
          totalCleaned++;
        }
      } else {
        console.log(`  ✅ All members are valid`);
      }
    }
    
    console.log('\n========================================');
    console.log('CLEANUP SUMMARY:');
    console.log(`Total orchestras checked: ${orchestras.length}`);
    console.log(`Total orphaned members found: ${totalOrphaned}`);
    console.log(`Total orchestras cleaned: ${totalCleaned}`);
    console.log('========================================\n');
    
    // Special check for the specific orchestra mentioned
    const targetId = '687a77cdca26e53e23b0ce4b';
    const targetOrchestra = await orchestraCollection.findOne({ 
      _id: ObjectId.createFromHexString(targetId) 
    });
    
    if (targetOrchestra) {
      console.log('SPECIFIC ORCHESTRA CHECK:');
      console.log(`Orchestra: ${targetOrchestra.name}`);
      console.log(`Current member IDs: ${targetOrchestra.memberIds}`);
      console.log(`Member count: ${targetOrchestra.memberIds ? targetOrchestra.memberIds.length : 0}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupOrchestraMembers();