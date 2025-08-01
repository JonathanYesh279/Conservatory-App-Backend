import { initializeMongoDB, getCollection } from './services/mongoDB.service.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function clearActivityAttendance() {
  try {
    console.log('Connecting to MongoDB...');
    await initializeMongoDB();
    
    console.log('Getting activity_attendance collection...');
    const activityCollection = await getCollection('activity_attendance');
    
    // Count documents before deletion
    const beforeCount = await activityCollection.countDocuments();
    console.log(`Found ${beforeCount} documents in activity_attendance collection`);
    
    if (beforeCount === 0) {
      console.log('Collection is already empty. Nothing to delete.');
      process.exit(0);
    }
    
    // Ask for confirmation
    console.log('\n⚠️  WARNING: This will permanently delete ALL documents from the activity_attendance collection!');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...\n');
    
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('Deleting all documents from activity_attendance collection...');
    const result = await activityCollection.deleteMany({});
    
    console.log(`✅ Successfully deleted ${result.deletedCount} documents from activity_attendance collection`);
    
    // Verify deletion
    const afterCount = await activityCollection.countDocuments();
    console.log(`Documents remaining in collection: ${afterCount}`);
    
    if (afterCount === 0) {
      console.log('🎉 Collection cleared successfully! Starting fresh.');
    } else {
      console.log('⚠️  Warning: Some documents may still remain in the collection.');
    }
    
  } catch (error) {
    console.error('❌ Error clearing activity_attendance collection:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the cleanup
clearActivityAttendance();