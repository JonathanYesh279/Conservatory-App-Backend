/**
 * Cascade Management Controller
 * Handles API endpoints for cascade deletion operations, job management,
 * and real-time monitoring in conservatory system
 */

import { cascadeJobProcessor } from '../services/cascadeJobProcessor.js';
import { cascadeWebSocketService } from '../services/cascadeWebSocketService.js';
import { cascadeDeletionService } from '../services/cascadeDeletion.service.js';
import { getDB } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

export const cascadeManagementController = {

  /**
   * Queue cascade deletion job
   * POST /api/cascade/delete/:studentId
   */
  async queueCascadeDeletion(req, res) {
    try {
      const { studentId } = req.params;
      const { reason, priority = 'high' } = req.body;
      const userId = req.user.id;

      // Validate student exists
      const db = getDB();
      const student = await db.collection('student').findOne({
        _id: new ObjectId(studentId),
        isActive: true
      });

      if (!student) {
        return res.status(404).json({
          error: 'Student not found or already deleted'
        });
      }

      // Check for existing deletion job
      const existingJob = Array.from(cascadeJobProcessor.activeJobs.values())
        .find(job => job.type === 'cascadeDeletion' && job.data.studentId === studentId);

      if (existingJob) {
        return res.status(409).json({
          error: 'Cascade deletion already in progress for this student',
          existingJobId: existingJob.id
        });
      }

      // Queue the deletion job
      const jobId = cascadeJobProcessor.addJob('cascadeDeletion', {
        studentId,
        userId,
        reason: reason || 'API deletion request'
      }, priority);

      // Emit warning about deletion impact
      const impactAnalysis = await this.analyzeDeletionImpact(studentId);
      cascadeWebSocketService.emitDeletionWarning({
        studentId,
        impact: impactAnalysis,
        affectedCollections: impactAnalysis.affectedCollections,
        recommendation: impactAnalysis.recommendation,
        severity: impactAnalysis.severity
      });

      res.status(202).json({
        success: true,
        message: 'Cascade deletion queued successfully',
        jobId,
        studentId,
        impactAnalysis,
        estimatedProcessingTime: '30-60 seconds'
      });

    } catch (error) {
      console.error('Error queueing cascade deletion:', error);
      res.status(500).json({
        error: 'Failed to queue cascade deletion',
        details: error.message
      });
    }
  },

  /**
   * Queue batch cascade deletion
   * POST /api/cascade/delete/batch
   */
  async queueBatchCascadeDeletion(req, res) {
    try {
      const { studentIds, reason, priority = 'medium' } = req.body;
      const userId = req.user.id;

      if (!Array.isArray(studentIds) || studentIds.length === 0) {
        return res.status(400).json({
          error: 'Student IDs array is required'
        });
      }

      if (studentIds.length > 50) {
        return res.status(400).json({
          error: 'Batch size limited to 50 students'
        });
      }

      // Validate all students exist
      const db = getDB();
      const validStudents = await db.collection('student').find({
        _id: { $in: studentIds.map(id => new ObjectId(id)) },
        isActive: true
      }).toArray();

      const invalidStudents = studentIds.filter(id => 
        !validStudents.find(s => s._id.toString() === id)
      );

      if (invalidStudents.length > 0) {
        return res.status(400).json({
          error: 'Some students not found or already deleted',
          invalidStudents,
          validStudents: validStudents.length
        });
      }

      // Queue the batch deletion job
      const jobId = cascadeJobProcessor.addJob('batchCascadeDeletion', {
        studentIds,
        userId,
        reason: reason || 'Batch API deletion request'
      }, priority);

      // Analyze combined impact
      const batchImpact = await this.analyzeBatchDeletionImpact(studentIds);

      res.status(202).json({
        success: true,
        message: 'Batch cascade deletion queued successfully',
        jobId,
        studentsCount: studentIds.length,
        batchImpact,
        estimatedProcessingTime: `${Math.ceil(studentIds.length * 0.5)}-${Math.ceil(studentIds.length * 1.5)} minutes`
      });

    } catch (error) {
      console.error('Error queueing batch cascade deletion:', error);
      res.status(500).json({
        error: 'Failed to queue batch cascade deletion',
        details: error.message
      });
    }
  },

  /**
   * Get job status
   * GET /api/cascade/job/:jobId
   */
  async getJobStatus(req, res) {
    try {
      const { jobId } = req.params;
      
      // Check active jobs
      const activeJob = cascadeJobProcessor.activeJobs.get(jobId);
      if (activeJob) {
        return res.json({
          job: activeJob,
          status: 'active'
        });
      }

      // Check queue
      const queuedJob = cascadeJobProcessor.jobQueue.find(job => job.id === jobId);
      if (queuedJob) {
        return res.json({
          job: queuedJob,
          status: 'queued',
          position: cascadeJobProcessor.jobQueue.indexOf(queuedJob) + 1
        });
      }

      // Check database for completed/failed jobs
      const db = getDB();
      const auditRecord = await db.collection('deletion_audit').findOne({
        'cascadeOperations.jobId': jobId
      }, { sort: { timestamp: -1 } });

      if (auditRecord) {
        return res.json({
          job: {
            id: jobId,
            status: 'completed',
            completedAt: auditRecord.timestamp
          },
          result: auditRecord,
          status: 'completed'
        });
      }

      res.status(404).json({
        error: 'Job not found'
      });

    } catch (error) {
      console.error('Error getting job status:', error);
      res.status(500).json({
        error: 'Failed to get job status',
        details: error.message
      });
    }
  },

  /**
   * Get queue status (admin only)
   * GET /api/cascade/queue/status
   */
  async getQueueStatus(req, res) {
    try {
      if (!req.user.isAdmin) {
        return res.status(403).json({
          error: 'Admin access required'
        });
      }

      const status = cascadeJobProcessor.getQueueStatus();
      const wsStatus = cascadeWebSocketService.getSystemStatus();

      res.json({
        queue: status,
        websocket: {
          connectedUsers: wsStatus.connected_users,
          connectedAdmins: wsStatus.connected_admins,
          activeNotifications: wsStatus.active_notifications
        },
        systemHealth: wsStatus.system_health,
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error getting queue status:', error);
      res.status(500).json({
        error: 'Failed to get queue status',
        details: error.message
      });
    }
  },

  /**
   * Trigger manual cleanup job (admin only)
   * POST /api/cascade/cleanup/orphans
   */
  async triggerOrphanCleanup(req, res) {
    try {
      if (!req.user.isAdmin) {
        return res.status(403).json({
          error: 'Admin access required'
        });
      }

      const { priority = 'high' } = req.body;

      const jobId = cascadeJobProcessor.addJob('orphanedReferenceCleanup', {
        triggeredBy: req.user.id,
        manual: true
      }, priority);

      res.json({
        success: true,
        message: 'Orphaned reference cleanup job queued',
        jobId
      });

    } catch (error) {
      console.error('Error triggering orphan cleanup:', error);
      res.status(500).json({
        error: 'Failed to trigger orphan cleanup',
        details: error.message
      });
    }
  },

  /**
   * Trigger manual integrity validation (admin only)
   * POST /api/cascade/integrity/validate
   */
  async triggerIntegrityValidation(req, res) {
    try {
      if (!req.user.isAdmin) {
        return res.status(403).json({
          error: 'Admin access required'
        });
      }

      const { priority = 'medium' } = req.body;

      const jobId = cascadeJobProcessor.addJob('integrityValidation', {
        triggeredBy: req.user.id,
        manual: true
      }, priority);

      res.json({
        success: true,
        message: 'Integrity validation job queued',
        jobId
      });

    } catch (error) {
      console.error('Error triggering integrity validation:', error);
      res.status(500).json({
        error: 'Failed to trigger integrity validation',
        details: error.message
      });
    }
  },

  /**
   * Get deletion audit history
   * GET /api/cascade/audit/:studentId
   */
  async getDeletionAudit(req, res) {
    try {
      const { studentId } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      const auditHistory = await cascadeDeletionService.getStudentDeletionAuditHistory(studentId);
      
      const paginatedHistory = auditHistory
        .slice(offset, offset + limit)
        .map(record => ({
          ...record,
          // Remove sensitive snapshot data from API response
          snapshot: record.snapshot ? {
            studentName: record.snapshot.student?.personalInfo?.firstName + ' ' + 
                       record.snapshot.student?.personalInfo?.lastName,
            snapshotTimestamp: record.snapshot.snapshotTimestamp,
            relatedDataCounts: {
              teachers: record.snapshot.relatedData?.teachers?.length || 0,
              orchestras: record.snapshot.relatedData?.orchestras?.length || 0,
              rehearsals: record.snapshot.relatedData?.rehearsals?.length || 0,
              theoryLessons: record.snapshot.relatedData?.theoryLessons?.length || 0,
              bagrut: record.snapshot.relatedData?.bagrut?.length || 0,
              attendance: record.snapshot.relatedData?.attendance?.length || 0
            }
          } : null
        }));

      res.json({
        auditHistory: paginatedHistory,
        total: auditHistory.length,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (offset + limit) < auditHistory.length
      });

    } catch (error) {
      console.error('Error getting deletion audit:', error);
      res.status(500).json({
        error: 'Failed to get deletion audit',
        details: error.message
      });
    }
  },

  /**
   * Restore deleted student (admin only)
   * POST /api/cascade/restore/:studentId
   */
  async restoreStudent(req, res) {
    try {
      if (!req.user.isAdmin) {
        return res.status(403).json({
          error: 'Admin access required'
        });
      }

      const { studentId } = req.params;
      const { auditId, reason = 'Administrative restoration' } = req.body;
      const userId = req.user.id;

      if (!auditId) {
        return res.status(400).json({
          error: 'Audit ID is required for restoration'
        });
      }

      const result = await cascadeDeletionService.restoreStudent(studentId, userId, auditId);

      res.json({
        success: true,
        message: 'Student restored successfully',
        restoration: result
      });

    } catch (error) {
      console.error('Error restoring student:', error);
      res.status(500).json({
        error: 'Failed to restore student',
        details: error.message
      });
    }
  },

  /**
   * Get system metrics (admin only)
   * GET /api/cascade/metrics
   */
  async getSystemMetrics(req, res) {
    try {
      if (!req.user.isAdmin) {
        return res.status(403).json({
          error: 'Admin access required'
        });
      }

      const db = getDB();
      
      // Get basic metrics
      const queueMetrics = cascadeJobProcessor.metrics;
      
      // Get database statistics
      const [
        totalAuditRecords,
        recentDeletions,
        integrityIssues,
        orphanedReferences
      ] = await Promise.all([
        db.collection('deletion_audit').countDocuments(),
        
        db.collection('deletion_audit').countDocuments({
          timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }),
        
        db.collection('deletion_audit').countDocuments({
          deletionType: 'cascade_cleanup',
          'cascadeOperations.0': { $exists: true }
        }),

        // Estimate orphaned references (simplified)
        this.getOrphanedReferenceCount()
      ]);

      res.json({
        processing: {
          jobsProcessed: queueMetrics.jobsProcessed,
          jobsFailed: queueMetrics.jobsFailed,
          averageProcessingTime: queueMetrics.averageProcessingTime,
          orphansCleanedUp: queueMetrics.orphansCleanedUp,
          integrityIssuesFound: queueMetrics.integrityIssuesFound
        },
        database: {
          totalAuditRecords,
          recentDeletions,
          integrityIssues,
          orphanedReferences: orphanedReferences || 0
        },
        system: cascadeWebSocketService.getSystemStatus(),
        timestamp: new Date()
      });

    } catch (error) {
      console.error('Error getting system metrics:', error);
      res.status(500).json({
        error: 'Failed to get system metrics',
        details: error.message
      });
    }
  },

  /**
   * Helper: Analyze deletion impact
   */
  async analyzeDeletionImpact(studentId) {
    try {
      const snapshot = await cascadeDeletionService.createStudentSnapshot(new ObjectId(studentId));
      
      const impact = {
        affectedCollections: [],
        totalDocuments: 0,
        severity: 'low',
        recommendation: 'Safe to proceed'
      };

      const relatedData = snapshot.relatedData;

      if (relatedData.teachers?.length > 0) {
        impact.affectedCollections.push({
          name: 'teachers',
          count: relatedData.teachers.length,
          type: 'reference_removal'
        });
        impact.totalDocuments += relatedData.teachers.length;
      }

      if (relatedData.orchestras?.length > 0) {
        impact.affectedCollections.push({
          name: 'orchestras',
          count: relatedData.orchestras.length,
          type: 'membership_removal'
        });
        impact.totalDocuments += relatedData.orchestras.length;
      }

      if (relatedData.bagrut?.length > 0) {
        impact.affectedCollections.push({
          name: 'bagrut',
          count: relatedData.bagrut.length,
          type: 'data_archival'
        });
        impact.totalDocuments += relatedData.bagrut.length;
      }

      // Determine severity
      if (impact.totalDocuments > 20) {
        impact.severity = 'high';
        impact.recommendation = 'High impact deletion - review carefully before proceeding';
      } else if (impact.totalDocuments > 5) {
        impact.severity = 'medium';
        impact.recommendation = 'Moderate impact - verify relationships before proceeding';
      }

      return impact;
      
    } catch (error) {
      console.error('Error analyzing deletion impact:', error);
      return {
        affectedCollections: [],
        totalDocuments: 0,
        severity: 'unknown',
        recommendation: 'Impact analysis failed - proceed with caution'
      };
    }
  },

  /**
   * Helper: Analyze batch deletion impact
   */
  async analyzeBatchDeletionImpact(studentIds) {
    try {
      const impacts = await Promise.all(
        studentIds.map(id => this.analyzeDeletionImpact(id))
      );

      const combinedImpact = {
        totalStudents: studentIds.length,
        totalDocuments: impacts.reduce((sum, impact) => sum + impact.totalDocuments, 0),
        affectedCollections: {},
        severity: 'low',
        recommendation: 'Safe to proceed'
      };

      // Aggregate collection impacts
      impacts.forEach(impact => {
        impact.affectedCollections.forEach(collection => {
          if (!combinedImpact.affectedCollections[collection.name]) {
            combinedImpact.affectedCollections[collection.name] = {
              count: 0,
              type: collection.type
            };
          }
          combinedImpact.affectedCollections[collection.name].count += collection.count;
        });
      });

      // Determine overall severity
      if (combinedImpact.totalDocuments > 100) {
        combinedImpact.severity = 'high';
        combinedImpact.recommendation = 'Very high impact batch deletion - consider processing in smaller batches';
      } else if (combinedImpact.totalDocuments > 30) {
        combinedImpact.severity = 'medium';
        combinedImpact.recommendation = 'High impact batch deletion - monitor progress carefully';
      }

      return combinedImpact;
      
    } catch (error) {
      console.error('Error analyzing batch deletion impact:', error);
      return {
        totalStudents: studentIds.length,
        totalDocuments: 0,
        affectedCollections: {},
        severity: 'unknown',
        recommendation: 'Batch impact analysis failed - proceed with caution'
      };
    }
  },

  /**
   * Helper: Get orphaned reference count (simplified estimation)
   */
  async getOrphanedReferenceCount() {
    try {
      const db = getDB();
      
      // Quick check for obvious orphaned references in major collections
      const orphanedTeachers = await db.collection('teacher').countDocuments({
        'teaching.studentIds': {
          $exists: true,
          $not: { $size: 0 }
        },
        isActive: true
      });

      return Math.floor(orphanedTeachers * 0.05); // Rough estimation
      
    } catch (error) {
      console.error('Error getting orphaned reference count:', error);
      return 0;
    }
  }
};