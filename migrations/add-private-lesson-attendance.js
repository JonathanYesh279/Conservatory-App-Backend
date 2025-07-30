import { getCollection, getDB, initializeMongoDB } from '../services/mongoDB.service.js';

/**
 * Migration to add attendance tracking fields to existing lesson schedule slots
 * This migration is SAFE and NON-BREAKING:
 * - Adds optional attendance fields to existing schedule slots
 * - Creates activity_attendance collection with proper indexes
 * - Does not modify existing data structure
 * - All new fields have safe defaults
 */

export async function migratePrivateLessonAttendance(options = {}) {
  const { dryRun = false } = options;
  const results = {
    timestamp: new Date(),
    dryRun,
    operations: [],
    errors: [],
    summary: {
      teachersProcessed: 0,
      slotsUpdated: 0,
      indexesCreated: 0,
      collectionsCreated: 0
    }
  };

  try {
    console.log(`🚀 Starting private lesson attendance migration ${dryRun ? '(DRY RUN)' : ''}`);
    
    // Initialize MongoDB connection
    await initializeMongoDB();
    
    // Step 1: Ensure activity_attendance collection exists
    await ensureActivityAttendanceCollection(dryRun, results);
    
    // Step 2: Add attendance fields to existing schedule slots
    await addAttendanceFieldsToScheduleSlots(dryRun, results);
    
    // Step 3: Create necessary indexes
    await createAttendanceIndexes(dryRun, results);
    
    console.log('✅ Migration completed successfully');
    return results;
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    results.errors.push({
      operation: 'migration',
      error: error.message,
      timestamp: new Date()
    });
    throw error;
  }
}

/**
 * Ensure activity_attendance collection exists with proper structure
 */
async function ensureActivityAttendanceCollection(dryRun, results) {
  try {
    const db = getDB();
    const collections = await db.listCollections({ name: 'activity_attendance' }).toArray();
    
    if (collections.length === 0) {
      console.log('📝 Creating activity_attendance collection...');
      
      if (!dryRun) {
        await db.createCollection('activity_attendance', {
          validator: {
            $jsonSchema: {
              bsonType: 'object',
              required: ['studentId', 'teacherId', 'activityType', 'date', 'status'],
              properties: {
                studentId: {
                  bsonType: 'string',
                  description: 'Student ID is required'
                },
                teacherId: {
                  bsonType: 'string',
                  description: 'Teacher ID is required'
                },
                activityType: {
                  bsonType: 'string',
                  enum: ['שיעור פרטי', 'תאוריה', 'חזרות', 'תזמורת'],
                  description: 'Activity type must be one of the allowed types'
                },
                groupId: {
                  bsonType: 'string',
                  description: 'Group identifier (teacher ID for private lessons)'
                },
                sessionId: {
                  bsonType: 'string',
                  description: 'Unique session identifier (schedule slot ID for private lessons)'
                },
                date: {
                  bsonType: 'date',
                  description: 'Lesson date is required'
                },
                status: {
                  bsonType: 'string',
                  enum: ['pending', 'הגיע/ה', 'לא הגיע/ה', 'cancelled'],
                  description: 'Attendance status is required'
                },
                notes: {
                  bsonType: ['string', 'null'],
                  description: 'Optional notes'
                },
                markedBy: {
                  bsonType: 'string',
                  description: 'User who marked the attendance'
                },
                markedAt: {
                  bsonType: 'date',
                  description: 'When attendance was marked'
                },
                metadata: {
                  bsonType: 'object',
                  description: 'Additional lesson metadata'
                },
                createdAt: {
                  bsonType: 'date',
                  description: 'Record creation timestamp'
                },
                updatedAt: {
                  bsonType: 'date',
                  description: 'Record update timestamp'
                }
              }
            }
          }
        });
      }
      
      results.operations.push({
        operation: 'create_collection',
        collection: 'activity_attendance',
        timestamp: new Date()
      });
      results.summary.collectionsCreated++;
      
      console.log('✅ activity_attendance collection created');
    } else {
      console.log('ℹ️ activity_attendance collection already exists');
    }
    
  } catch (error) {
    results.errors.push({
      operation: 'ensure_collection',
      error: error.message,
      timestamp: new Date()
    });
    throw error;
  }
}

/**
 * Add attendance fields to existing schedule slots
 */
async function addAttendanceFieldsToScheduleSlots(dryRun, results) {
  try {
    console.log('📝 Adding attendance fields to existing schedule slots...');
    
    const teacherCollection = await getCollection('teacher');
    
    // Find all teachers with schedule data
    const teachers = await teacherCollection
      .find({ 'teaching.schedule': { $exists: true, $ne: [] } })
      .toArray();
    
    console.log(`Found ${teachers.length} teachers with schedules`);
    
    for (const teacher of teachers) {
      let slotsUpdated = 0;
      
      if (!teacher.teaching?.schedule) continue;
      
      // Check each schedule slot and add attendance fields if missing
      const updatedSchedule = teacher.teaching.schedule.map(slot => {
        // Only add attendance field if it doesn't exist
        if (!slot.hasOwnProperty('attendance')) {
          slotsUpdated++;
          return {
            ...slot,
            // Add optional attendance tracking fields
            attendance: null, // Will be populated when attendance is marked
            attendanceEnabled: true // Can be disabled for specific lesson types
          };
        }
        return slot;
      });
      
      if (slotsUpdated > 0 && !dryRun) {
        await teacherCollection.updateOne(
          { _id: teacher._id },
          { 
            $set: { 
              'teaching.schedule': updatedSchedule,
              updatedAt: new Date()
            }
          }
        );
      }
      
      if (slotsUpdated > 0) {
        results.operations.push({
          operation: 'update_teacher_schedule',
          teacherId: teacher._id.toString(),
          slotsUpdated,
          timestamp: new Date()
        });
        
        results.summary.slotsUpdated += slotsUpdated;
        console.log(`📝 Teacher ${teacher.personalInfo?.fullName || teacher._id}: ${slotsUpdated} slots updated`);
      }
      
      results.summary.teachersProcessed++;
    }
    
    console.log(`✅ Processed ${results.summary.teachersProcessed} teachers, updated ${results.summary.slotsUpdated} slots`);
    
  } catch (error) {
    results.errors.push({
      operation: 'add_attendance_fields',
      error: error.message,
      timestamp: new Date()
    });
    throw error;
  }
}

/**
 * Create necessary indexes for efficient attendance queries
 */
async function createAttendanceIndexes(dryRun, results) {
  try {
    console.log('📝 Creating attendance indexes...');
    
    const activityCollection = await getCollection('activity_attendance');
    
    const indexes = [
      // Compound index for student attendance queries
      {
        name: 'student_activity_date',
        keys: { studentId: 1, activityType: 1, date: -1 },
        options: { background: true }
      },
      // Compound index for teacher attendance queries
      {
        name: 'teacher_activity_date',
        keys: { teacherId: 1, activityType: 1, date: -1 },
        options: { background: true }
      },
      // Index for session-specific queries
      {
        name: 'session_lookup',
        keys: { sessionId: 1, studentId: 1, date: 1 },
        options: { background: true, unique: true }
      },
      // Index for group-based queries
      {
        name: 'group_activity_date',
        keys: { groupId: 1, activityType: 1, date: -1 },
        options: { background: true }
      },
      // Index for status-based queries
      {
        name: 'status_date',
        keys: { status: 1, date: -1 },
        options: { background: true }
      },
      // General date index for time-range queries
      {
        name: 'date_desc',
        keys: { date: -1 },
        options: { background: true }
      }
    ];
    
    for (const index of indexes) {
      try {
        if (!dryRun) {
          await activityCollection.createIndex(index.keys, {
            name: index.name,
            ...index.options
          });
        }
        
        results.operations.push({
          operation: 'create_index',
          collection: 'activity_attendance',
          indexName: index.name,
          keys: index.keys,
          timestamp: new Date()
        });
        
        results.summary.indexesCreated++;
        console.log(`✅ Created index: ${index.name}`);
        
      } catch (indexError) {
        // Index might already exist, log but don't fail migration
        if (indexError.code === 85) { // IndexOptionsConflict
          console.log(`ℹ️ Index ${index.name} already exists with different options`);
        } else if (indexError.code === 11000) { // IndexKeySpecsConflict
          console.log(`ℹ️ Index ${index.name} already exists`);
        } else {
          console.warn(`⚠️ Failed to create index ${index.name}:`, indexError.message);
          results.errors.push({
            operation: 'create_index',
            indexName: index.name,
            error: indexError.message,
            timestamp: new Date()
          });
        }
      }
    }
    
    console.log(`✅ Index creation completed`);
    
  } catch (error) {
    results.errors.push({
      operation: 'create_indexes',
      error: error.message,
      timestamp: new Date()
    });
    throw error;
  }
}

/**
 * Rollback migration (removes added fields)
 * USE WITH EXTREME CAUTION - this will remove attendance data
 */
export async function rollbackPrivateLessonAttendanceMigration(options = {}) {
  const { dryRun = false, confirm = false } = options;
  
  if (!confirm) {
    throw new Error('Rollback requires explicit confirmation. Set confirm: true to proceed.');
  }
  
  const results = {
    timestamp: new Date(),
    dryRun,
    operations: [],
    errors: [],
    summary: {
      teachersProcessed: 0,
      slotsUpdated: 0,
      collectionsDropped: 0
    }
  };

  try {
    console.log(`🚨 Starting attendance migration rollback ${dryRun ? '(DRY RUN)' : ''}`);
    console.log('⚠️ WARNING: This will remove all attendance tracking data!');
    
    // Remove attendance fields from schedule slots
    const teacherCollection = await getCollection('teacher');
    const teachers = await teacherCollection
      .find({ 'teaching.schedule.attendance': { $exists: true } })
      .toArray();
    
    for (const teacher of teachers) {
      let slotsUpdated = 0;
      
      const updatedSchedule = teacher.teaching.schedule.map(slot => {
        if (slot.hasOwnProperty('attendance') || slot.hasOwnProperty('attendanceEnabled')) {
          slotsUpdated++;
          const { attendance, attendanceEnabled, ...cleanSlot } = slot;
          return cleanSlot;
        }
        return slot;
      });
      
      if (slotsUpdated > 0 && !dryRun) {
        await teacherCollection.updateOne(
          { _id: teacher._id },
          { 
            $set: { 
              'teaching.schedule': updatedSchedule,
              updatedAt: new Date()
            }
          }
        );
      }
      
      results.summary.slotsUpdated += slotsUpdated;
      results.summary.teachersProcessed++;
    }
    
    // Optionally drop activity_attendance collection
    if (!dryRun) {
      const db = getDB();
      await db.dropCollection('activity_attendance');
      results.summary.collectionsDropped++;
    }
    
    console.log('✅ Rollback completed');
    return results;
    
  } catch (error) {
    console.error('❌ Rollback failed:', error.message);
    results.errors.push({
      operation: 'rollback',
      error: error.message,
      timestamp: new Date()
    });
    throw error;
  }
}

/**
 * Validate migration state
 */
export async function validateAttendanceMigration() {
  const results = {
    timestamp: new Date(),
    isValid: true,
    issues: [],
    summary: {
      teachersWithSchedules: 0,
      slotsWithAttendanceFields: 0,
      activityCollectionExists: false,
      indexesPresent: 0
    }
  };

  try {
    // Initialize MongoDB connection
    await initializeMongoDB();
    
    // Check if activity_attendance collection exists
    const db = getDB();
    const collections = await db.listCollections({ name: 'activity_attendance' }).toArray();
    results.summary.activityCollectionExists = collections.length > 0;
    
    // Check teacher schedule slots for attendance fields
    const teacherCollection = await getCollection('teacher');
    const teachers = await teacherCollection
      .find({ 'teaching.schedule': { $exists: true, $ne: [] } })
      .toArray();
    
    results.summary.teachersWithSchedules = teachers.length;
    
    let slotsWithAttendance = 0;
    for (const teacher of teachers) {
      if (teacher.teaching?.schedule) {
        slotsWithAttendance += teacher.teaching.schedule.filter(
          slot => slot.hasOwnProperty('attendance')
        ).length;
      }
    }
    
    results.summary.slotsWithAttendanceFields = slotsWithAttendance;
    
    // Check indexes if collection exists
    if (results.summary.activityCollectionExists) {
      const activityCollection = await getCollection('activity_attendance');
      const indexes = await activityCollection.indexes();
      results.summary.indexesPresent = indexes.length;
    }
    
    // Validate consistency
    if (results.summary.teachersWithSchedules > 0 && results.summary.slotsWithAttendanceFields === 0) {
      results.issues.push('Teachers have schedules but no attendance fields found');
      results.isValid = false;
    }
    
    if (!results.summary.activityCollectionExists) {
      results.issues.push('activity_attendance collection does not exist');
      results.isValid = false;
    }
    
    return results;
    
  } catch (error) {
    results.isValid = false;
    results.issues.push(`Validation error: ${error.message}`);
    return results;
  }
}