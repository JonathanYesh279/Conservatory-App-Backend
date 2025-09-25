import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI;
const DB_NAME = 'Conservatory-DB';

console.log('🧹 Starting cleanup of orphaned orchestra member references...');

async function cleanupOrphanedMembers() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(DB_NAME);
    const orchestraCollection = db.collection('orchestra');
    const studentCollection = db.collection('student');
    
    // Step 1: Find all orchestras
    const orchestras = await orchestraCollection.find({}).toArray();
    console.log(`📊 Found ${orchestras.length} orchestras to check`);
    
    let totalOrphansFound = 0;
    let totalOrchestrasFixed = 0;
    
    for (const orchestra of orchestras) {
      if (!orchestra.memberIds || orchestra.memberIds.length === 0) {
        console.log(`⏭️  Orchestra "${orchestra.name}" has no members, skipping`);
        continue;
      }
      
      console.log(`\n🔍 Checking orchestra "${orchestra.name}" (${orchestra._id})`);
      console.log(`   Current memberIds: [${orchestra.memberIds.join(', ')}]`);
      
      // Check which student IDs actually exist
      const existingStudents = await studentCollection.find({
        _id: { 
          $in: orchestra.memberIds.map(id => {
            try {
              return new ObjectId(id);
            } catch (e) {
              console.log(`   ⚠️  Invalid ObjectId format: ${id}`);
              return null;
            }
          }).filter(Boolean)
        }
      }).toArray();
      
      const existingStudentIds = existingStudents.map(s => s._id.toString());
      console.log(`   ✅ Existing students: [${existingStudentIds.join(', ')}]`);
      
      // Find orphaned student IDs
      const orphanedIds = orchestra.memberIds.filter(id => !existingStudentIds.includes(id));
      
      if (orphanedIds.length > 0) {
        console.log(`   ❌ Orphaned student IDs found: [${orphanedIds.join(', ')}]`);
        totalOrphansFound += orphanedIds.length;
        
        // Remove orphaned IDs from memberIds array
        const cleanedMemberIds = orchestra.memberIds.filter(id => existingStudentIds.includes(id));
        
        console.log(`   🧹 Cleaning memberIds: [${orchestra.memberIds.join(', ')}] → [${cleanedMemberIds.join(', ')}]`);
        
        // Update the orchestra document
        const result = await orchestraCollection.updateOne(
          { _id: orchestra._id },
          { $set: { memberIds: cleanedMemberIds } }
        );
        
        if (result.modifiedCount === 1) {
          console.log(`   ✅ Successfully cleaned orchestra "${orchestra.name}"`);
          totalOrchestrasFixed++;
        } else {
          console.log(`   ❌ Failed to update orchestra "${orchestra.name}"`);
        }
      } else {
        console.log(`   ✅ No orphaned references found in "${orchestra.name}"`);
      }
    }
    
    console.log('\n🎯 Cleanup Summary:');
    console.log(`   📊 Total orchestras checked: ${orchestras.length}`);
    console.log(`   🧹 Total orphaned references found: ${totalOrphansFound}`);
    console.log(`   ✅ Total orchestras fixed: ${totalOrchestrasFixed}`);
    
    if (totalOrchestrasFixed > 0) {
      console.log('\n🔄 Verifying cleanup results...');
      
      // Verify the specific orchestra that was causing issues
      const verifyOrchestra = await orchestraCollection.findOne({
        memberIds: { 
          $in: ['68813849abdf329e8afc2688', '68813849abdf329e8afc265e', '68813849abdf329e8afc264f'] 
        }
      });
      
      if (!verifyOrchestra) {
        console.log('✅ Verification successful: No orchestras contain the problematic student IDs');
      } else {
        console.log('⚠️  Verification failed: Found orchestra still containing problematic IDs:');
        console.log('   Orchestra:', verifyOrchestra.name);
        console.log('   MemberIds:', verifyOrchestra.memberIds);
      }
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await client.close();
    console.log('🔐 Database connection closed');
  }
}

// Run the cleanup
cleanupOrphanedMembers()
  .then(() => {
    console.log('🎉 Cleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  });