/**
 * MongoDB Migration Script for Cascade Deletion System Cleanup
 * Cleans up orphaned references and adds cascade deletion metadata fields
 */

import { getDB } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

export const cascadeDeletionCleanup = {
  
  /**
   * Clean up all orphaned student references across collections
   */
  async cleanupOrphanedReferences() {
    const db = getDB();
    const session = db.startSession();
    
    try {
      await session.withTransaction(async () => {
        console.log('Starting orphaned references cleanup...');
        
        // Get all active student IDs
        const activeStudents = await db.collection('student').find(
          { isActive: true },
          { projection: { _id: 1 } }
        ).toArray();
        
        const activeStudentIds = activeStudents.map(s => s._id);
        console.log(`Found ${activeStudentIds.length} active students`);
        
        // Clean up teacher collection
        const teacherCleanup = await db.collection('teacher').updateMany(
          { isActive: true },
          {
            $pull: {
              'teaching.studentIds': { $nin: activeStudentIds }
            }
          },
          { session }
        );
        
        // Clean up teacher schedules
        const teacherScheduleCleanup = await db.collection('teacher').updateMany(
          { 
            isActive: true,
            'teaching.schedule.studentId': { $nin: activeStudentIds }
          },
          {
            $pull: {
              'teaching.schedule': { studentId: { $nin: activeStudentIds } }
            }
          },
          { session }
        );
        
        // Clean up orchestra collection
        const orchestraCleanup = await db.collection('orchestra').updateMany(
          { isActive: true },
          {
            $pull: {
              memberIds: { $nin: activeStudentIds }
            }
          },
          { session }
        );
        
        // Archive orphaned rehearsal attendance (don't delete historical data)
        const rehearsalCleanup = await db.collection('rehearsal').updateMany(
          {},
          {
            $pull: {
              attendance: { studentId: { $nin: activeStudentIds } }
            }
          },
          { session }
        );
        
        // Clean up theory lessons
        const theoryCleanup = await db.collection('theory_lesson').updateMany(
          {},
          {
            $pull: {
              studentIds: { $nin: activeStudentIds }
            }
          },
          { session }
        );
        
        // Archive orphaned bagrut records (preserve academic data)
        const bagrutCleanup = await db.collection('bagrut').updateMany(
          { 
            studentId: { $nin: activeStudentIds },
            isActive: true
          },
          {
            $set: { 
              isActive: false,
              archivedReason: 'student_no_longer_active',
              archivedAt: new Date()
            }
          },
          { session }
        );
        
        // Archive orphaned activity attendance
        const attendanceCleanup = await db.collection('activity_attendance').updateMany(
          { studentId: { $nin: activeStudentIds } },
          {
            $set: { 
              archived: true,
              archivedReason: 'student_no_longer_active',
              archivedAt: new Date()
            }
          },
          { session }
        );
        
        const summary = {
          teachersUpdated: teacherCleanup.modifiedCount,
          teacherSchedulesUpdated: teacherScheduleCleanup.modifiedCount,
          orchestrasUpdated: orchestraCleanup.modifiedCount,
          rehearsalsUpdated: rehearsalCleanup.modifiedCount,
          theoryLessonsUpdated: theoryCleanup.modifiedCount,
          bagrutRecordsArchived: bagrutCleanup.modifiedCount,
          attendanceRecordsArchived: attendanceCleanup.modifiedCount
        };
        
        console.log('Orphaned references cleanup completed:', summary);
        return summary;
      });
      
    } catch (error) {
      console.error('Error during orphaned references cleanup:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  },

  /**
   * Add cascade deletion metadata fields to all collections
   */
  async addCascadeDeletionMetadata() {
    const db = getDB();
    const session = db.startSession();
    
    try {
      await session.withTransaction(async () => {
        console.log('Adding cascade deletion metadata fields...');
        
        // Add metadata to student collection
        await db.collection('student').updateMany(
          { cascadeMetadata: { $exists: false } },
          {
            $set: {
              cascadeMetadata: {
                lastIntegrityCheck: null,
                referenceCount: {
                  teachers: 0,
                  orchestras: 0,
                  bagrut: 0,
                  theories: 0,
                  rehearsals: 0,
                  attendance: 0
                },
                lastUpdated: new Date()
              }
            }
          },
          { session }
        );
        
        // Add metadata to teacher collection
        await db.collection('teacher').updateMany(
          { cascadeMetadata: { $exists: false } },
          {
            $set: {
              cascadeMetadata: {
                lastIntegrityCheck: null,
                studentReferenceCount: 0,
                scheduleSlotCount: 0,
                lastUpdated: new Date()
              }
            }
          },
          { session }
        );
        
        // Add metadata to orchestra collection
        await db.collection('orchestra').updateMany(
          { cascadeMetadata: { $exists: false } },
          {
            $set: {
              cascadeMetadata: {
                lastIntegrityCheck: null,
                memberCount: 0,
                rehearsalCount: 0,
                lastUpdated: new Date()
              }
            }
          },
          { session }
        );
        
        // Add metadata to other collections
        const collections = ['rehearsal', 'theory_lesson', 'bagrut', 'activity_attendance'];
        
        for (const collectionName of collections) {
          await db.collection(collectionName).updateMany(
            { cascadeMetadata: { $exists: false } },
            {
              $set: {
                cascadeMetadata: {
                  lastIntegrityCheck: null,
                  lastUpdated: new Date()
                }
              }
            },
            { session }
          );
        }
        
        console.log('Cascade deletion metadata fields added successfully');
        return { success: true, message: 'Metadata fields added to all collections' };
      });
      
    } catch (error) {
      console.error('Error adding cascade deletion metadata:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  },

  /**
   * Create deletion audit collection and indexes
   */
  async createDeletionAuditCollection() {
    const db = getDB();
    
    try {
      console.log('Creating deletion audit collection...');
      
      // Create the collection if it doesn't exist
      const collections = await db.listCollections({ name: 'deletion_audit' }).toArray();
      
      if (collections.length === 0) {
        await db.createCollection('deletion_audit', {
          validator: {
            $jsonSchema: {
              bsonType: 'object',
              required: ['entityType', 'entityId', 'deletionType', 'timestamp', 'userId'],
              properties: {
                entityType: {
                  bsonType: 'string',
                  enum: ['student', 'teacher', 'orchestra', 'rehearsal', 'theory_lesson', 'bagrut']
                },
                entityId: {
                  bsonType: 'objectId'
                },
                deletionType: {
                  bsonType: 'string',
                  enum: ['soft_delete', 'cascade_cleanup', 'archive', 'hard_delete']
                },
                cascadeOperations: {
                  bsonType: 'array',
                  items: {
                    bsonType: 'object',
                    required: ['collection', 'operation', 'affectedDocuments'],
                    properties: {
                      collection: { bsonType: 'string' },
                      operation: { bsonType: 'string' },
                      affectedDocuments: { bsonType: 'int' },
                      details: { bsonType: 'object' }
                    }
                  }
                },
                snapshot: {
                  bsonType: 'object'
                },
                timestamp: {
                  bsonType: 'date'
                },
                userId: {
                  bsonType: 'objectId'
                },
                reason: {
                  bsonType: 'string'
                }
              }
            }
          }
        });
        
        console.log('Deletion audit collection created');
      }
      
      // Create indexes for the audit collection
      const auditCollection = db.collection('deletion_audit');
      
      await Promise.all([
        auditCollection.createIndex(
          { entityType: 1, entityId: 1, timestamp: -1 },
          { name: 'audit_entity_lookup' }
        ),
        auditCollection.createIndex(
          { timestamp: -1 },
          { name: 'audit_timestamp' }
        ),
        auditCollection.createIndex(
          { userId: 1, timestamp: -1 },
          { name: 'audit_user_activity' }
        ),
        auditCollection.createIndex(
          { deletionType: 1, timestamp: -1 },
          { name: 'audit_deletion_type' }
        ),
        auditCollection.createIndex(
          { 'cascadeOperations.collection': 1, timestamp: -1 },
          { name: 'audit_cascade_operations' }
        )
      ]);
      
      console.log('Deletion audit indexes created');
      return { success: true, message: 'Deletion audit collection and indexes created' };
      
    } catch (error) {
      console.error('Error creating deletion audit collection:', error);
      throw error;
    }
  },

  /**
   * Update reference counts in cascade metadata
   */
  async updateReferenceCountsMetadata() {
    const db = getDB();
    
    try {
      console.log('Updating reference counts in cascade metadata...');
      
      // Update student reference counts
      const students = await db.collection('student').find({ isActive: true }).toArray();
      
      for (const student of students) {
        const counts = await this.calculateStudentReferenceCounts(student._id);
        
        await db.collection('student').updateOne(
          { _id: student._id },
          {
            $set: {
              'cascadeMetadata.referenceCount': counts,
              'cascadeMetadata.lastUpdated': new Date()
            }
          }
        );
      }
      
      // Update teacher reference counts
      const teachers = await db.collection('teacher').find({ isActive: true }).toArray();
      
      for (const teacher of teachers) {
        const studentCount = teacher.teaching?.studentIds?.length || 0;
        const scheduleCount = teacher.teaching?.schedule?.length || 0;
        
        await db.collection('teacher').updateOne(
          { _id: teacher._id },
          {
            $set: {
              'cascadeMetadata.studentReferenceCount': studentCount,
              'cascadeMetadata.scheduleSlotCount': scheduleCount,
              'cascadeMetadata.lastUpdated': new Date()
            }
          }
        );
      }
      
      // Update orchestra reference counts
      const orchestras = await db.collection('orchestra').find({ isActive: true }).toArray();
      
      for (const orchestra of orchestras) {
        const memberCount = orchestra.memberIds?.length || 0;
        const rehearsalCount = orchestra.rehearsalIds?.length || 0;
        
        await db.collection('orchestra').updateOne(
          { _id: orchestra._id },
          {
            $set: {
              'cascadeMetadata.memberCount': memberCount,
              'cascadeMetadata.rehearsalCount': rehearsalCount,
              'cascadeMetadata.lastUpdated': new Date()
            }
          }
        );
      }
      
      console.log('Reference counts updated successfully');
      return { 
        success: true, 
        processed: {
          students: students.length,
          teachers: teachers.length,
          orchestras: orchestras.length
        }
      };
      
    } catch (error) {
      console.error('Error updating reference counts:', error);
      throw error;
    }
  },

  /**
   * Calculate reference counts for a specific student
   */
  async calculateStudentReferenceCounts(studentId) {
    const db = getDB();
    
    try {
      const [
        teacherCount,
        orchestraCount,
        bagrutCount,
        theoryCount,
        rehearsalCount,
        attendanceCount
      ] = await Promise.all([
        db.collection('teacher').countDocuments({ 
          'teaching.studentIds': studentId,
          isActive: true 
        }),
        db.collection('orchestra').countDocuments({ 
          memberIds: studentId,
          isActive: true 
        }),
        db.collection('bagrut').countDocuments({ 
          studentId: studentId,
          isActive: true 
        }),
        db.collection('theory_lesson').countDocuments({ 
          studentIds: studentId 
        }),
        db.collection('rehearsal').countDocuments({ 
          'attendance.studentId': studentId 
        }),
        db.collection('activity_attendance').countDocuments({ 
          studentId: studentId 
        })
      ]);
      
      return {
        teachers: teacherCount,
        orchestras: orchestraCount,
        bagrut: bagrutCount,
        theories: theoryCount,
        rehearsals: rehearsalCount,
        attendance: attendanceCount
      };
      
    } catch (error) {
      console.error('Error calculating student reference counts:', error);
      throw error;
    }
  },

  /**
   * Run complete migration setup
   */
  async runCompleteMigration() {
    try {
      console.log('Starting complete cascade deletion migration...');
      
      const results = {};
      
      // Step 1: Create deletion audit collection
      results.auditSetup = await this.createDeletionAuditCollection();
      
      // Step 2: Add metadata fields
      results.metadataSetup = await this.addCascadeDeletionMetadata();
      
      // Step 3: Clean up orphaned references
      results.cleanup = await this.cleanupOrphanedReferences();
      
      // Step 4: Update reference counts
      results.referenceCounts = await this.updateReferenceCountsMetadata();
      
      console.log('Complete cascade deletion migration finished successfully');
      return {
        success: true,
        timestamp: new Date(),
        results
      };
      
    } catch (error) {
      console.error('Error during complete migration:', error);
      throw error;
    }
  },

  /**
   * Rollback migration (remove added fields and collections)
   */
  async rollbackMigration() {
    const db = getDB();
    
    try {
      console.log('Rolling back cascade deletion migration...');
      
      // Remove cascade metadata fields
      const collections = ['student', 'teacher', 'orchestra', 'rehearsal', 'theory_lesson', 'bagrut', 'activity_attendance'];
      
      for (const collectionName of collections) {
        await db.collection(collectionName).updateMany(
          {},
          { $unset: { cascadeMetadata: '' } }
        );
      }
      
      // Remove archived flags from activity_attendance
      await db.collection('activity_attendance').updateMany(
        {},
        { 
          $unset: { 
            archived: '', 
            archivedReason: '', 
            archivedAt: '' 
          } 
        }
      );
      
      // Remove archived flags from bagrut
      await db.collection('bagrut').updateMany(
        { archivedReason: 'student_no_longer_active' },
        { 
          $set: { isActive: true },
          $unset: { 
            archivedReason: '', 
            archivedAt: '' 
          } 
        }
      );
      
      // Optionally drop the deletion_audit collection
      // await db.collection('deletion_audit').drop();
      
      console.log('Migration rollback completed');
      return { success: true, message: 'Migration rolled back successfully' };
      
    } catch (error) {
      console.error('Error during migration rollback:', error);
      throw error;
    }
  }
};