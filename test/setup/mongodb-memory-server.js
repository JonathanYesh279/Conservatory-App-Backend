import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';

/**
 * MongoDB Memory Server setup for testing
 * Provides isolated in-memory MongoDB instances for tests
 */

let mongoServer = null;
let mongoClient = null;
let db = null;

/**
 * Global setup for MongoDB Memory Server
 * Called once before all tests
 */
export async function setupTestDatabase() {
  try {
    console.log('Setting up MongoDB Memory Server...');
    
    // Start MongoDB Memory Server
    mongoServer = await MongoMemoryServer.create({
      instance: {
        dbName: 'test-cascade-deletion',
        storageEngine: 'wiredTiger',
        port: 0, // Use random available port
      },
      binary: {
        version: '6.0.0',
        downloadDir: './node_modules/.cache/mongodb-memory-server/mongodb-binaries',
        skipMD5: true,
      },
      autoStart: true,
    });

    const mongoUri = mongoServer.getUri();
    console.log(`MongoDB Memory Server URI: ${mongoUri}`);

    // Connect to the test database
    mongoClient = new MongoClient(mongoUri, {
      maxPoolSize: 20,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferMaxEntries: 0,
      connectTimeoutMS: 10000,
    });

    await mongoClient.connect();
    db = mongoClient.db('test-cascade-deletion');
    
    console.log('MongoDB Memory Server setup completed');
    
    // Create test indexes for performance
    await createTestIndexes();
    
    return {
      mongoServer,
      mongoClient,
      db,
      uri: mongoUri
    };
  } catch (error) {
    console.error('Failed to setup MongoDB Memory Server:', error);
    throw error;
  }
}

/**
 * Cleanup and teardown MongoDB Memory Server
 * Called once after all tests
 */
export async function teardownTestDatabase() {
  try {
    console.log('Tearing down MongoDB Memory Server...');
    
    if (mongoClient) {
      await mongoClient.close();
      mongoClient = null;
      db = null;
    }
    
    if (mongoServer) {
      await mongoServer.stop();
      mongoServer = null;
    }
    
    console.log('MongoDB Memory Server teardown completed');
  } catch (error) {
    console.error('Error during teardown:', error);
    // Don't throw here as it might mask test failures
  }
}

/**
 * Get current database connection
 */
export function getTestDb() {
  if (!db) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return db;
}

/**
 * Get current MongoDB client
 */
export function getTestClient() {
  if (!mongoClient) {
    throw new Error('Test client not initialized. Call setupTestDatabase() first.');
  }
  return mongoClient;
}

/**
 * Get MongoDB Memory Server URI
 */
export function getTestUri() {
  if (!mongoServer) {
    throw new Error('MongoDB Memory Server not initialized.');
  }
  return mongoServer.getUri();
}

/**
 * Reset all collections in the test database
 * Useful for cleaning up between tests
 */
export async function resetTestDatabase() {
  if (!db) {
    throw new Error('Test database not initialized.');
  }
  
  const collections = await db.listCollections().toArray();
  const dropPromises = collections.map(collection => 
    db.collection(collection.name).deleteMany({})
  );
  
  await Promise.all(dropPromises);
}

/**
 * Create indexes for test collections to improve performance
 */
async function createTestIndexes() {
  if (!db) return;
  
  try {
    // Student collection indexes
    await db.collection('student').createIndexes([
      { key: { isActive: 1 }, name: 'idx_student_isActive' },
      { key: { 'personalInfo.email': 1 }, name: 'idx_student_email', unique: true, sparse: true },
      { key: { createdAt: -1 }, name: 'idx_student_createdAt' }
    ]);

    // Teacher collection indexes
    await db.collection('teacher').createIndexes([
      { key: { 'teaching.studentIds': 1 }, name: 'idx_teacher_studentIds' },
      { key: { 'schedules.studentId': 1 }, name: 'idx_teacher_schedules_studentId' },
      { key: { isActive: 1 }, name: 'idx_teacher_isActive' }
    ]);

    // Orchestra collection indexes
    await db.collection('orchestra').createIndexes([
      { key: { memberIds: 1 }, name: 'idx_orchestra_memberIds' },
      { key: { isActive: 1 }, name: 'idx_orchestra_isActive' },
      { key: { name: 1 }, name: 'idx_orchestra_name' }
    ]);

    // Rehearsal collection indexes
    await db.collection('rehearsal').createIndexes([
      { key: { 'attendance.studentId': 1 }, name: 'idx_rehearsal_attendance_studentId' },
      { key: { orchestraId: 1 }, name: 'idx_rehearsal_orchestraId' },
      { key: { date: -1 }, name: 'idx_rehearsal_date' }
    ]);

    // Theory lesson collection indexes
    await db.collection('theory_lesson').createIndexes([
      { key: { studentIds: 1 }, name: 'idx_theory_lesson_studentIds' },
      { key: { isActive: 1 }, name: 'idx_theory_lesson_isActive' }
    ]);

    // Bagrut collection indexes
    await db.collection('bagrut').createIndexes([
      { key: { studentId: 1 }, name: 'idx_bagrut_studentId' },
      { key: { isActive: 1 }, name: 'idx_bagrut_isActive' },
      { key: { year: 1 }, name: 'idx_bagrut_year' }
    ]);

    // Activity attendance collection indexes
    await db.collection('activity_attendance').createIndexes([
      { key: { studentId: 1 }, name: 'idx_activity_attendance_studentId' },
      { key: { date: -1 }, name: 'idx_activity_attendance_date' }
    ]);

    // Audit and snapshot collection indexes
    await db.collection('deletion_snapshots').createIndexes([
      { key: { studentId: 1 }, name: 'idx_snapshots_studentId' },
      { key: { used: 1 }, name: 'idx_snapshots_used' },
      { key: { expiresAt: 1 }, name: 'idx_snapshots_expires', expireAfterSeconds: 0 }
    ]);

    await db.collection('deletionAuditLog').createIndexes([
      { key: { timestamp: -1 }, name: 'idx_audit_timestamp' },
      { key: { action: 1 }, name: 'idx_audit_action' },
      { key: { entityId: 1 }, name: 'idx_audit_entityId' }
    ]);

    console.log('Test database indexes created successfully');
  } catch (error) {
    console.error('Error creating test indexes:', error);
    // Don't throw here as tests can still run without indexes
  }
}

/**
 * Seed test database with basic data
 */
export async function seedTestDatabase(seedData) {
  if (!db) {
    throw new Error('Test database not initialized.');
  }

  try {
    if (seedData.students) {
      await db.collection('student').insertMany(seedData.students);
    }
    if (seedData.teachers) {
      await db.collection('teacher').insertMany(seedData.teachers);
    }
    if (seedData.orchestras) {
      await db.collection('orchestra').insertMany(seedData.orchestras);
    }
    if (seedData.rehearsals) {
      await db.collection('rehearsal').insertMany(seedData.rehearsals);
    }
    if (seedData.theoryLessons) {
      await db.collection('theory_lesson').insertMany(seedData.theoryLessons);
    }
    if (seedData.bagrut) {
      await db.collection('bagrut').insertMany(seedData.bagrut);
    }
    if (seedData.activityAttendance) {
      await db.collection('activity_attendance').insertMany(seedData.activityAttendance);
    }
    
    console.log('Test database seeded successfully');
  } catch (error) {
    console.error('Error seeding test database:', error);
    throw error;
  }
}

/**
 * Get collection statistics for debugging
 */
export async function getCollectionStats() {
  if (!db) return {};

  const collections = ['student', 'teacher', 'orchestra', 'rehearsal', 'theory_lesson', 'bagrut', 'activity_attendance'];
  const stats = {};

  for (const collectionName of collections) {
    try {
      const count = await db.collection(collectionName).countDocuments();
      stats[collectionName] = count;
    } catch (error) {
      stats[collectionName] = 0;
    }
  }

  return stats;
}

/**
 * Create a transaction session for testing
 */
export async function createTestSession() {
  if (!mongoClient) {
    throw new Error('MongoDB client not initialized.');
  }
  
  return mongoClient.startSession();
}

/**
 * Wait for MongoDB to be ready
 */
export async function waitForDatabase(timeout = 10000) {
  if (!mongoClient) {
    throw new Error('MongoDB client not initialized.');
  }

  const start = Date.now();
  
  while (Date.now() - start < timeout) {
    try {
      await mongoClient.db('admin').admin().ping();
      console.log('MongoDB is ready');
      return true;
    } catch (error) {
      console.log('Waiting for MongoDB...');
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  throw new Error(`MongoDB not ready after ${timeout}ms`);
}

// Global error handlers for test database
process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.message && reason.message.includes('MongoMemoryServer')) {
    console.error('MongoDB Memory Server error:', reason);
  }
});

process.on('uncaughtException', (error) => {
  if (error && error.message && error.message.includes('MongoMemoryServer')) {
    console.error('MongoDB Memory Server uncaught exception:', error);
    process.exit(1);
  }
});

export default {
  setupTestDatabase,
  teardownTestDatabase,
  getTestDb,
  getTestClient,
  getTestUri,
  resetTestDatabase,
  seedTestDatabase,
  getCollectionStats,
  createTestSession,
  waitForDatabase
};