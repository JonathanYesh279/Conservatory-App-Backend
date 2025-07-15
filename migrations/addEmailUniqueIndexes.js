import dotenv from 'dotenv';
import { getCollection } from '../services/mongoDB.service.js';

// Load environment variables
dotenv.config();

/**
 * Migration to add unique indexes for email fields in teacher collection
 * This ensures database-level enforcement of unique emails for security
 */
export async function addEmailUniqueIndexes() {
  try {
    console.log('Starting email unique indexes migration...');
    
    const collection = await getCollection('teacher');
    
    // Check for existing duplicate emails before creating indexes
    console.log('Checking for existing duplicate emails...');
    
    const duplicateCredentialsEmails = await collection.aggregate([
      { $group: { _id: '$credentials.email', count: { $sum: 1 }, docs: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    const duplicatePersonalEmails = await collection.aggregate([
      { $group: { _id: '$personalInfo.email', count: { $sum: 1 }, docs: { $push: '$_id' } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    
    if (duplicateCredentialsEmails.length > 0) {
      console.error('Found duplicate credentials emails:', duplicateCredentialsEmails);
      throw new Error('Cannot create unique index: duplicate credentials.email values exist. Please clean up duplicates first.');
    }
    
    if (duplicatePersonalEmails.length > 0) {
      console.error('Found duplicate personal emails:', duplicatePersonalEmails);
      throw new Error('Cannot create unique index: duplicate personalInfo.email values exist. Please clean up duplicates first.');
    }
    
    // Create unique indexes
    console.log('Creating unique index for credentials.email...');
    await collection.createIndex(
      { 'credentials.email': 1 }, 
      { 
        unique: true, 
        name: 'unique_credentials_email',
        sparse: true // Allows null values but enforces uniqueness for non-null values
      }
    );
    
    console.log('Creating unique index for personalInfo.email...');
    await collection.createIndex(
      { 'personalInfo.email': 1 }, 
      { 
        unique: true, 
        name: 'unique_personal_email',
        sparse: true
      }
    );
    
    // Create compound index for better query performance
    console.log('Creating compound index for email queries...');
    await collection.createIndex(
      { 'credentials.email': 1, 'personalInfo.email': 1, 'isActive': 1 },
      { name: 'email_status_compound' }
    );
    
    console.log('Email unique indexes migration completed successfully');
    return { success: true, message: 'Email unique indexes created successfully' };
    
  } catch (error) {
    console.error('Error in email unique indexes migration:', error);
    throw error;
  }
}

/**
 * Rollback function to remove the unique indexes
 */
export async function removeEmailUniqueIndexes() {
  try {
    console.log('Starting rollback of email unique indexes...');
    
    const collection = await getCollection('teacher');
    
    // Drop the indexes
    await collection.dropIndex('unique_credentials_email');
    await collection.dropIndex('unique_personal_email');
    await collection.dropIndex('email_status_compound');
    
    console.log('Email unique indexes rollback completed successfully');
    return { success: true, message: 'Email unique indexes removed successfully' };
    
  } catch (error) {
    console.error('Error in email unique indexes rollback:', error);
    throw error;
  }
}

// Auto-run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  addEmailUniqueIndexes()
    .then(result => {
      console.log('Migration result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}