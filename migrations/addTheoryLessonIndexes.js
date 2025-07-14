import 'dotenv/config';
import { getCollection, initializeMongoDB } from '../services/mongoDB.service.js';

/**
 * Migration script to add indexes for theory lesson conflict prevention
 * 
 * This migration adds the following indexes:
 * 1. Conflict detection index for efficient room/time queries
 * 2. Teacher conflict detection index
 * 3. Compound index for general sorting and filtering
 * 
 * Run this script to add the necessary indexes to the theory_lesson collection
 */

async function addTheoryLessonIndexes() {
  try {
    console.log('Starting migration: Adding theory lesson indexes...');
    console.log('Connecting to MongoDB...');
    
    // Initialize MongoDB connection
    await initializeMongoDB();
    console.log('✅ Connected to MongoDB');
    
    const collection = await getCollection('theory_lesson');
    
    if (!collection) {
      throw new Error('Could not get theory_lesson collection');
    }

    // 1. Add UNIQUE constraint to prevent room double-booking (CRITICAL FOR CONFLICT PREVENTION)
    console.log('Adding UNIQUE constraint to prevent room double-booking...');
    try {
      await collection.createIndex(
        {
          date: 1,
          location: 1,
          startTime: 1,
          endTime: 1
        },
        {
          name: 'unique_room_time_booking',
          unique: true,
          background: true
        }
      );
      console.log('✅ Unique constraint added successfully');
    } catch (error) {
      if (error.code === 11000) {
        console.warn('⚠️ Unique constraint already exists or conflicts with existing data');
      } else {
        throw error;
      }
    }

    // 2. Add conflict detection index for room booking conflicts (non-unique for queries)
    console.log('Adding conflict detection index for room bookings...');
    await collection.createIndex(
      {
        date: 1,
        location: 1,
        startTime: 1,
        endTime: 1
      },
      {
        name: 'conflict_detection_room_index',
        background: true
      }
    );

    // 2. Add teacher conflict detection index
    console.log('Adding conflict detection index for teacher scheduling...');
    await collection.createIndex(
      {
        date: 1,
        teacherId: 1,
        startTime: 1,
        endTime: 1
      },
      {
        name: 'conflict_detection_teacher_index',
        background: true
      }
    );

    // 3. Add compound index for general queries and sorting
    console.log('Adding compound index for general queries...');
    await collection.createIndex(
      {
        schoolYearId: 1,
        date: 1,
        startTime: 1
      },
      {
        name: 'school_year_date_time_index',
        background: true
      }
    );

    // 4. Add index for category-based queries
    console.log('Adding category index...');
    await collection.createIndex(
      {
        category: 1,
        date: 1
      },
      {
        name: 'category_date_index',
        background: true
      }
    );

    // 5. Add index for teacher-based queries
    console.log('Adding teacher index...');
    await collection.createIndex(
      {
        teacherId: 1,
        date: 1
      },
      {
        name: 'teacher_date_index',
        background: true
      }
    );

    // 6. Add index for location-based queries
    console.log('Adding location index...');
    await collection.createIndex(
      {
        location: 1,
        date: 1
      },
      {
        name: 'location_date_index',
        background: true
      }
    );

    // List all indexes to verify
    console.log('Listing all indexes on theory_lesson collection:');
    const indexes = await collection.indexes();
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('✅ Migration completed successfully!');
    
    return {
      success: true,
      message: 'Theory lesson indexes added successfully',
      indexesAdded: [
        'unique_room_time_booking',
        'conflict_detection_room_index',
        'conflict_detection_teacher_index', 
        'school_year_date_time_index',
        'category_date_index',
        'teacher_date_index',
        'location_date_index'
      ]
    };

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Rollback function to remove the indexes if needed
 */
async function removeTheoryLessonIndexes() {
  try {
    console.log('Starting rollback: Removing theory lesson indexes...');
    console.log('Connecting to MongoDB...');
    
    // Initialize MongoDB connection
    await initializeMongoDB();
    console.log('✅ Connected to MongoDB');
    
    const collection = await getCollection('theory_lesson');
    
    if (!collection) {
      throw new Error('Could not get theory_lesson collection');
    }

    const indexesToRemove = [
      'unique_room_time_booking',
      'conflict_detection_room_index',
      'conflict_detection_teacher_index',
      'school_year_date_time_index',
      'category_date_index',
      'teacher_date_index',
      'location_date_index'
    ];

    for (const indexName of indexesToRemove) {
      try {
        console.log(`Removing index: ${indexName}`);
        await collection.dropIndex(indexName);
        console.log(`✅ Removed index: ${indexName}`);
      } catch (error) {
        if (error.message.includes('index not found')) {
          console.log(`ℹ️  Index ${indexName} not found, skipping`);
        } else {
          console.error(`❌ Error removing index ${indexName}:`, error);
        }
      }
    }

    console.log('✅ Rollback completed successfully!');
    
    return {
      success: true,
      message: 'Theory lesson indexes removed successfully'
    };

  } catch (error) {
    console.error('❌ Rollback failed:', error);
    throw error;
  }
}

// Export functions for use in other scripts
export { addTheoryLessonIndexes, removeTheoryLessonIndexes };

// If running directly, execute the migration
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const command = process.argv[2];
  
  if (command === 'rollback') {
    removeTheoryLessonIndexes()
      .then(() => {
        console.log('Rollback completed');
        process.exit(0);
      })
      .catch((error) => {
        console.error('Rollback failed:', error);
        process.exit(1);
      });
  } else {
    addTheoryLessonIndexes()
      .then((result) => {
        console.log('✅ Migration completed successfully!');
        console.log('Added indexes:', result.indexesAdded);
        process.exit(0);
      })
      .catch((error) => {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
      });
  }
}