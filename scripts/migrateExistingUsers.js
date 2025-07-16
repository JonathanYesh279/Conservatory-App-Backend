import { getCollection } from '../services/mongoDB.service.js';

/**
 * Migration script to update existing users with invitation system fields
 * This should be run once after implementing the invitation system
 */
export async function migrateExistingUsers() {
  try {
    console.log('Starting migration of existing users...');
    
    const collection = await getCollection('teacher');
    
    // Find all teachers that don't have invitation fields
    const teachersToUpdate = await collection.find({
      'credentials.isInvitationAccepted': { $exists: false }
    }).toArray();
    
    console.log(`Found ${teachersToUpdate.length} teachers to migrate`);
    
    if (teachersToUpdate.length === 0) {
      console.log('No teachers need migration');
      return;
    }
    
    // Update each teacher
    for (const teacher of teachersToUpdate) {
      const updateResult = await collection.updateOne(
        { _id: teacher._id },
        {
          $set: {
            'credentials.isInvitationAccepted': true, // Mark as accepted (legacy accounts)
            'credentials.passwordSetAt': teacher.createdAt || new Date(),
            updatedAt: new Date()
          }
        }
      );
      
      if (updateResult.modifiedCount === 1) {
        console.log(`✅ Updated teacher: ${teacher.personalInfo.fullName} (${teacher._id})`);
      } else {
        console.log(`❌ Failed to update teacher: ${teacher.personalInfo.fullName} (${teacher._id})`);
      }
    }
    
    console.log('Migration completed successfully!');
    
    // Verify the migration
    const remainingTeachers = await collection.find({
      'credentials.isInvitationAccepted': { $exists: false }
    }).toArray();
    
    console.log(`Remaining teachers without invitation fields: ${remainingTeachers.length}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * Run the migration if this file is executed directly
 */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  migrateExistingUsers()
    .then(() => {
      console.log('✅ Migration script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}