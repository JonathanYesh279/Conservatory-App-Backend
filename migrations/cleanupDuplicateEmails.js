import dotenv from 'dotenv';
import { getCollection } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

// Load environment variables
dotenv.config();

/**
 * Migration to clean up duplicate email entries before adding unique indexes
 * This will keep the oldest teacher and remove newer duplicates
 */
export async function cleanupDuplicateEmails() {
  try {
    console.log('Starting duplicate email cleanup...');
    
    const collection = await getCollection('teacher');
    
    // Find duplicate credentials emails
    console.log('Finding duplicate credentials emails...');
    const duplicateCredentialsEmails = await collection.aggregate([
      { $group: { _id: '$credentials.email', count: { $sum: 1 }, docs: { $push: { id: '$_id', createdAt: '$createdAt' } } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    console.log(`Found ${duplicateCredentialsEmails.length} duplicate credentials emails`);
    
    for (const duplicate of duplicateCredentialsEmails) {
      const email = duplicate._id;
      const docs = duplicate.docs.sort((a, b) => a.createdAt - b.createdAt); // Sort by creation date
      
      console.log(`\nProcessing duplicates for email: ${email}`);
      console.log(`Found ${docs.length} teachers with this email`);
      
      // Keep the first (oldest) document, remove the rest
      const toKeep = docs[0];
      const toRemove = docs.slice(1);
      
      console.log(`Keeping teacher ID: ${toKeep.id} (created: ${toKeep.createdAt})`);
      
      for (const doc of toRemove) {
        console.log(`Removing duplicate teacher ID: ${doc.id} (created: ${doc.createdAt})`);
        
        // Get the full teacher document before deletion for logging
        const teacherToDelete = await collection.findOne({ _id: doc.id });
        
        if (teacherToDelete) {
          console.log(`  - Full name: ${teacherToDelete.personalInfo?.fullName || 'Unknown'}`);
          console.log(`  - Roles: ${teacherToDelete.roles?.join(', ') || 'None'}`);
          
          // Actually delete the duplicate
          await collection.deleteOne({ _id: doc.id });
          console.log(`  ✓ Deleted duplicate teacher`);
        }
      }
    }
    
    // Find duplicate personal info emails
    console.log('\nFinding duplicate personalInfo emails...');
    const duplicatePersonalEmails = await collection.aggregate([
      { $group: { _id: '$personalInfo.email', count: { $sum: 1 }, docs: { $push: { id: '$_id', createdAt: '$createdAt' } } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    console.log(`Found ${duplicatePersonalEmails.length} duplicate personalInfo emails`);
    
    for (const duplicate of duplicatePersonalEmails) {
      const email = duplicate._id;
      const docs = duplicate.docs.sort((a, b) => a.createdAt - b.createdAt);
      
      console.log(`\nProcessing personalInfo duplicates for email: ${email}`);
      console.log(`Found ${docs.length} teachers with this personal email`);
      
      // Keep the first (oldest) document, remove the rest
      const toKeep = docs[0];
      const toRemove = docs.slice(1);
      
      console.log(`Keeping teacher ID: ${toKeep.id} (created: ${toKeep.createdAt})`);
      
      for (const doc of toRemove) {
        console.log(`Removing duplicate teacher ID: ${doc.id} (created: ${doc.createdAt})`);
        
        // Get the full teacher document before deletion for logging
        const teacherToDelete = await collection.findOne({ _id: doc.id });
        
        if (teacherToDelete) {
          console.log(`  - Full name: ${teacherToDelete.personalInfo?.fullName || 'Unknown'}`);
          console.log(`  - Roles: ${teacherToDelete.roles?.join(', ') || 'None'}`);
          
          // Only delete if this wasn't already deleted in the credentials cleanup
          const stillExists = await collection.findOne({ _id: doc.id });
          if (stillExists) {
            await collection.deleteOne({ _id: doc.id });
            console.log(`  ✓ Deleted duplicate teacher`);
          } else {
            console.log(`  - Already deleted in previous step`);
          }
        }
      }
    }
    
    // Verify cleanup
    console.log('\nVerifying cleanup...');
    const remainingCredentialsDupes = await collection.aggregate([
      { $group: { _id: '$credentials.email', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    const remainingPersonalDupes = await collection.aggregate([
      { $group: { _id: '$personalInfo.email', count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    if (remainingCredentialsDupes.length === 0 && remainingPersonalDupes.length === 0) {
      console.log('✓ All duplicates successfully cleaned up!');
      console.log('You can now run the unique index migration.');
    } else {
      console.log('⚠️ Some duplicates still remain:');
      if (remainingCredentialsDupes.length > 0) {
        console.log('  - Credentials email duplicates:', remainingCredentialsDupes.length);
      }
      if (remainingPersonalDupes.length > 0) {
        console.log('  - Personal email duplicates:', remainingPersonalDupes.length);
      }
    }
    
    console.log('\nDuplicate email cleanup completed');
    return { 
      success: true, 
      message: 'Duplicate emails cleaned up successfully',
      removedCredentialsDuplicates: duplicateCredentialsEmails.length,
      removedPersonalDuplicates: duplicatePersonalEmails.length
    };
    
  } catch (error) {
    console.error('Error in duplicate email cleanup:', error);
    throw error;
  }
}

// Auto-run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupDuplicateEmails()
    .then(result => {
      console.log('\nCleanup result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('\nCleanup failed:', error);
      process.exit(1);
    });
}