/**
 * MongoDB Cascade Deletion Performance Indexes
 * Creates compound indexes optimized for efficient cascade deletion queries
 */

import { getDB } from '../services/mongoDB.service.js';

export const createCascadeDeletionIndexes = async () => {
  const db = getDB();
  
  try {
    console.log('Creating cascade deletion performance indexes...');

    // Student collection indexes
    const studentCollection = db.collection('student');
    await Promise.all([
      // Primary student lookup index
      studentCollection.createIndex(
        { _id: 1, isActive: 1 },
        { name: 'student_cascade_primary' }
      ),
      // Teacher assignments index for efficient removal
      studentCollection.createIndex(
        { 'teacherIds': 1, isActive: 1 },
        { name: 'student_teacher_cascade' }
      ),
      // Orchestra membership index
      studentCollection.createIndex(
        { 'orchestraIds': 1, isActive: 1 },
        { name: 'student_orchestra_cascade' }
      ),
      // Bagrut relationship index
      studentCollection.createIndex(
        { 'bagrutId': 1, isActive: 1 },
        { name: 'student_bagrut_cascade', sparse: true }
      ),
      // Teacher assignments nested array index
      studentCollection.createIndex(
        { 'teacherAssignments.teacherId': 1, isActive: 1 },
        { name: 'student_assignments_cascade' }
      )
    ]);

    // Teacher collection indexes
    const teacherCollection = db.collection('teacher');
    await Promise.all([
      // Primary teacher lookup
      teacherCollection.createIndex(
        { _id: 1, isActive: 1 },
        { name: 'teacher_cascade_primary' }
      ),
      // Student relationships index
      teacherCollection.createIndex(
        { 'teaching.studentIds': 1, isActive: 1 },
        { name: 'teacher_students_cascade' }
      ),
      // Schedule optimization for bulk updates
      teacherCollection.createIndex(
        { 'teaching.schedule.studentId': 1, isActive: 1 },
        { name: 'teacher_schedule_cascade', sparse: true }
      )
    ]);

    // Orchestra collection indexes
    const orchestraCollection = db.collection('orchestra');
    await Promise.all([
      // Member lookup index
      orchestraCollection.createIndex(
        { 'memberIds': 1, isActive: 1 },
        { name: 'orchestra_members_cascade' }
      ),
      // Conductor relationship
      orchestraCollection.createIndex(
        { 'conductorId': 1, isActive: 1 },
        { name: 'orchestra_conductor_cascade', sparse: true }
      ),
      // Rehearsal relationship
      orchestraCollection.createIndex(
        { 'rehearsalIds': 1, isActive: 1 },
        { name: 'orchestra_rehearsals_cascade' }
      )
    ]);

    // Rehearsal collection indexes
    const rehearsalCollection = db.collection('rehearsal');
    await Promise.all([
      // Group/Orchestra relationship
      rehearsalCollection.createIndex(
        { 'groupId': 1, 'date': -1 },
        { name: 'rehearsal_group_cascade' }
      ),
      // Attendance lookup
      rehearsalCollection.createIndex(
        { 'attendance.studentId': 1, 'date': -1 },
        { name: 'rehearsal_attendance_cascade' }
      )
    ]);

    // Theory lesson collection indexes
    const theoryCollection = db.collection('theory_lesson');
    await Promise.all([
      // Teacher relationship
      theoryCollection.createIndex(
        { 'teacherId': 1, 'date': -1 },
        { name: 'theory_teacher_cascade' }
      ),
      // Student relationships
      theoryCollection.createIndex(
        { 'studentIds': 1, 'date': -1 },
        { name: 'theory_students_cascade' }
      ),
      // Category and date for cleanup
      theoryCollection.createIndex(
        { 'category': 1, 'teacherId': 1, 'date': -1 },
        { name: 'theory_category_cascade' }
      )
    ]);

    // Bagrut collection indexes
    const bagrutCollection = db.collection('bagrut');
    await Promise.all([
      // Student relationship
      bagrutCollection.createIndex(
        { 'studentId': 1, isActive: 1 },
        { name: 'bagrut_student_cascade' }
      ),
      // Teacher relationship
      bagrutCollection.createIndex(
        { 'teacherId': 1, isActive: 1 },
        { name: 'bagrut_teacher_cascade' }
      ),
      // Combined for referential integrity
      bagrutCollection.createIndex(
        { 'studentId': 1, 'teacherId': 1, isActive: 1 },
        { name: 'bagrut_relationship_cascade' }
      )
    ]);

    // Activity attendance collection indexes
    const attendanceCollection = db.collection('activity_attendance');
    await Promise.all([
      // Student attendance lookup
      attendanceCollection.createIndex(
        { 'studentId': 1, 'activityType': 1, 'status': 1 },
        { name: 'attendance_student_cascade' }
      ),
      // Session and activity type
      attendanceCollection.createIndex(
        { 'sessionId': 1, 'activityType': 1 },
        { name: 'attendance_session_cascade' }
      ),
      // Compound for efficient bulk operations
      attendanceCollection.createIndex(
        { 'studentId': 1, 'sessionId': 1, 'activityType': 1 },
        { name: 'attendance_bulk_cascade' }
      )
    ]);

    // Performance indexes for bulk operations
    await Promise.all([
      // Multi-collection student reference lookup
      studentCollection.createIndex(
        { '_id': 1, 'teacherIds': 1, 'orchestraIds': 1, 'bagrutId': 1 },
        { name: 'student_multi_reference_lookup' }
      ),
      // Teacher bulk update optimization
      teacherCollection.createIndex(
        { 'teaching.studentIds': 1, 'teaching.schedule.studentId': 1 },
        { name: 'teacher_bulk_update_optimization' }
      )
    ]);

    console.log('Cascade deletion indexes created successfully');
    return { success: true, message: 'All cascade deletion indexes created' };

  } catch (error) {
    console.error('Error creating cascade deletion indexes:', error);
    throw error;
  }
};

export const dropCascadeDeletionIndexes = async () => {
  const db = getDB();
  
  try {
    console.log('Dropping cascade deletion indexes...');

    const indexNames = [
      // Student indexes
      'student_cascade_primary',
      'student_teacher_cascade',
      'student_orchestra_cascade',
      'student_bagrut_cascade',
      'student_assignments_cascade',
      'student_multi_reference_lookup',
      
      // Teacher indexes
      'teacher_cascade_primary',
      'teacher_students_cascade',
      'teacher_schedule_cascade',
      'teacher_bulk_update_optimization',
      
      // Orchestra indexes
      'orchestra_members_cascade',
      'orchestra_conductor_cascade',
      'orchestra_rehearsals_cascade',
      
      // Rehearsal indexes
      'rehearsal_group_cascade',
      'rehearsal_attendance_cascade',
      
      // Theory indexes
      'theory_teacher_cascade',
      'theory_students_cascade',
      'theory_category_cascade',
      
      // Bagrut indexes
      'bagrut_student_cascade',
      'bagrut_teacher_cascade',
      'bagrut_relationship_cascade',
      
      // Attendance indexes
      'attendance_student_cascade',
      'attendance_session_cascade',
      'attendance_bulk_cascade'
    ];

    const collections = ['student', 'teacher', 'orchestra', 'rehearsal', 'theory_lesson', 'bagrut', 'activity_attendance'];
    
    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      for (const indexName of indexNames) {
        try {
          await collection.dropIndex(indexName);
        } catch (error) {
          // Index might not exist, continue
          if (!error.message.includes('index not found')) {
            console.warn(`Warning dropping index ${indexName}:`, error.message);
          }
        }
      }
    }

    console.log('Cascade deletion indexes dropped successfully');
    return { success: true, message: 'All cascade deletion indexes dropped' };

  } catch (error) {
    console.error('Error dropping cascade deletion indexes:', error);
    throw error;
  }
};

// Index analysis utility
export const analyzeCascadeDeletionIndexes = async () => {
  const db = getDB();
  
  try {
    const collections = ['student', 'teacher', 'orchestra', 'rehearsal', 'theory_lesson', 'bagrut', 'activity_attendance'];
    const analysis = {};
    
    for (const collectionName of collections) {
      const collection = db.collection(collectionName);
      const indexes = await collection.indexes();
      const stats = await collection.stats();
      
      analysis[collectionName] = {
        totalIndexes: indexes.length,
        cascadeIndexes: indexes.filter(idx => idx.name.includes('cascade')).length,
        documentCount: stats.count,
        avgObjSize: stats.avgObjSize,
        totalIndexSize: stats.totalIndexSize,
        indexes: indexes.map(idx => ({
          name: idx.name,
          key: idx.key,
          isCascade: idx.name.includes('cascade')
        }))
      };
    }
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing cascade deletion indexes:', error);
    throw error;
  }
};