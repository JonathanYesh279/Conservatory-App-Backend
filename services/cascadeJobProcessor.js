/**
 * Cascade Deletion Background Job Processor
 * Handles background job processing, queue management, and real-time notifications
 * for cascade deletion operations in conservatory system
 */

import { getDB, getClient, withTransaction } from './mongoDB.service.js';
import { cascadeDeletionService } from './cascadeDeletion.service.js';
import { ObjectId } from 'mongodb';
import { EventEmitter } from 'events';

class CascadeJobProcessor extends EventEmitter {
  constructor() {
    super();
    this.isProcessing = false;
    this.jobQueue = [];
    this.scheduledJobs = new Map();
    this.activeJobs = new Map();
    this.retryAttempts = new Map();
    this.circuitBreaker = {
      failures: 0,
      lastFailureTime: null,
      isOpen: false,
      threshold: 5,
      timeout: 30000
    };
    this.metrics = {
      jobsProcessed: 0,
      jobsFailed: 0,
      averageProcessingTime: 0,
      orphansCleanedUp: 0,
      integrityIssuesFound: 0
    };
  }

  /**
   * Initialize job processor and set up scheduled jobs
   */
  async initialize() {
    try {
      await this.setupScheduledJobs();
      this.startProcessing();
      console.log('Cascade Job Processor initialized successfully');
    } catch (error) {
      console.error('Error initializing job processor:', error);
      throw error;
    }
  }

  /**
   * Set up scheduled jobs based on configuration
   */
  async setupScheduledJobs() {
    const jobDefinitions = {
      orphanedReferenceCleanup: {
        schedule: '0 2 * * *', // Daily at 2 AM
        retries: 3,
        priority: 'medium',
        timeout: 600000 // 10 minutes
      },
      integrityValidation: {
        schedule: '0 3 * * 0', // Weekly on Sunday at 3 AM
        priority: 'low',
        retries: 2,
        timeout: 1800000 // 30 minutes
      },
      auditLogArchive: {
        schedule: '0 1 1 * *', // Monthly on 1st at 1 AM
        priority: 'low',
        retries: 1,
        timeout: 3600000 // 1 hour
      }
    };

    for (const [jobType, config] of Object.entries(jobDefinitions)) {
      this.scheduleJob(jobType, config);
    }
  }

  /**
   * Schedule a job with cron-like scheduling
   */
  scheduleJob(jobType, config) {
    const parseSchedule = (schedule) => {
      const [minute, hour, day, month, dayOfWeek] = schedule.split(' ');
      return { minute, hour, day, month, dayOfWeek };
    };

    const checkSchedule = () => {
      const now = new Date();
      const schedule = parseSchedule(config.schedule);
      
      if (schedule.minute !== '*' && now.getMinutes() !== parseInt(schedule.minute)) return false;
      if (schedule.hour !== '*' && now.getHours() !== parseInt(schedule.hour)) return false;
      if (schedule.day !== '*' && now.getDate() !== parseInt(schedule.day)) return false;
      if (schedule.month !== '*' && now.getMonth() + 1 !== parseInt(schedule.month)) return false;
      if (schedule.dayOfWeek !== '*' && now.getDay() !== parseInt(schedule.dayOfWeek)) return false;
      
      return true;
    };

    const scheduleInterval = setInterval(() => {
      if (checkSchedule()) {
        this.addJob(jobType, {}, config.priority, config.retries, config.timeout);
      }
    }, 60000); // Check every minute

    this.scheduledJobs.set(jobType, scheduleInterval);
  }

  /**
   * Add job to queue
   */
  addJob(type, data = {}, priority = 'medium', maxRetries = 3, timeout = 30000) {
    const job = {
      id: new ObjectId().toString(),
      type,
      data,
      priority,
      maxRetries,
      timeout,
      attempts: 0,
      createdAt: new Date(),
      status: 'queued'
    };

    // Insert job in priority order
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const insertIndex = this.jobQueue.findIndex(
      j => priorityOrder[j.priority] > priorityOrder[priority]
    );
    
    if (insertIndex === -1) {
      this.jobQueue.push(job);
    } else {
      this.jobQueue.splice(insertIndex, 0, job);
    }

    this.emit('jobQueued', job);
    console.log(`Job ${job.id} (${type}) added to queue with priority ${priority}`);
    return job.id;
  }

  /**
   * Start processing jobs from queue
   */
  startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    this.processQueue();
  }

  /**
   * Process jobs from queue
   */
  async processQueue() {
    while (this.isProcessing && this.jobQueue.length > 0) {
      if (this.circuitBreaker.isOpen) {
        if (Date.now() - this.circuitBreaker.lastFailureTime > this.circuitBreaker.timeout) {
          this.circuitBreaker.isOpen = false;
          this.circuitBreaker.failures = 0;
          console.log('Circuit breaker reset - resuming job processing');
        } else {
          console.log('Circuit breaker open - waiting before retry');
          await this.sleep(5000);
          continue;
        }
      }

      const job = this.jobQueue.shift();
      await this.processJob(job);
      
      // Small delay between jobs to prevent overwhelming the system
      await this.sleep(100);
    }

    // Check for more jobs periodically
    setTimeout(() => {
      if (this.isProcessing) {
        this.processQueue();
      }
    }, 1000);
  }

  /**
   * Process individual job
   */
  async processJob(job) {
    const startTime = Date.now();
    job.status = 'processing';
    job.attempts++;
    job.startedAt = new Date();

    this.activeJobs.set(job.id, job);
    this.emit('jobStarted', job);

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Job timeout')), job.timeout);
    });

    try {
      console.log(`Processing job ${job.id} (${job.type}) - attempt ${job.attempts}/${job.maxRetries}`);

      const jobPromise = this.executeJob(job);
      const result = await Promise.race([jobPromise, timeoutPromise]);

      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, true);

      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      job.processingTime = processingTime;

      this.activeJobs.delete(job.id);
      this.retryAttempts.delete(job.id);

      this.emit('jobCompleted', job);
      console.log(`Job ${job.id} completed successfully in ${processingTime}ms`);

      // Reset circuit breaker on success
      this.circuitBreaker.failures = 0;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.updateMetrics(processingTime, false);
      this.handleJobError(job, error);
    }
  }

  /**
   * Execute specific job type
   */
  async executeJob(job) {
    const db = getDB();

    switch (job.type) {
      case 'cascadeDeletion':
        return await this.executeCascadeDeletion(job);

      case 'orphanedReferenceCleanup':
        return await this.executeOrphanedReferenceCleanup(job);

      case 'integrityValidation':
        return await this.executeIntegrityValidation(job);

      case 'auditLogArchive':
        return await this.executeAuditLogArchive(job);

      case 'batchCascadeDeletion':
        return await this.executeBatchCascadeDeletion(job);

      default:
        throw new Error(`Unknown job type: ${job.type}`);
    }
  }

  /**
   * Execute cascade deletion job
   */
  async executeCascadeDeletion(job) {
    const { studentId, userId, reason } = job.data;
    
    this.emit('cascade.progress', {
      studentId,
      jobId: job.id,
      step: 'starting',
      percentage: 0,
      details: 'Initiating cascade deletion'
    });

    try {
      const result = await cascadeDeletionService.cascadeDeleteStudent(studentId, userId, reason);

      this.emit('cascade.progress', {
        studentId,
        jobId: job.id,
        step: 'completed',
        percentage: 100,
        details: `Deleted successfully - ${result.totalAffectedDocuments} documents affected`
      });

      this.emit('cascade.complete', {
        studentId,
        jobId: job.id,
        summary: result,
        duration: job.processingTime
      });

      return result;

    } catch (error) {
      this.emit('cascade.progress', {
        studentId,
        jobId: job.id,
        step: 'error',
        percentage: 0,
        details: error.message
      });
      throw error;
    }
  }

  /**
   * Execute orphaned reference cleanup
   */
  async executeOrphanedReferenceCleanup(job) {
    const db = getDB();
    const results = {
      orphansFound: 0,
      orphansRemoved: 0,
      collectionsChecked: 0,
      errors: []
    };

    const collections = [
      { name: 'teacher', studentRefFields: ['teaching.studentIds', 'teaching.timeBlocks.assignedLessons.studentId'] },
      { name: 'orchestra', studentRefFields: ['memberIds'] },
      { name: 'theory_lesson', studentRefFields: ['studentIds'] },
      { name: 'rehearsal', studentRefFields: ['attendance.studentId'] },
      { name: 'bagrut', studentRefFields: ['studentId'] },
      { name: 'activity_attendance', studentRefFields: ['studentId'] }
    ];

    this.emit('integrity.progress', {
      jobId: job.id,
      step: 'scanning',
      percentage: 0,
      details: 'Scanning for orphaned references'
    });

    for (let i = 0; i < collections.length; i++) {
      const collection = collections[i];
      const progress = Math.round(((i + 1) / collections.length) * 100);

      try {
        this.emit('integrity.progress', {
          jobId: job.id,
          step: 'scanning',
          percentage: progress,
          details: `Checking ${collection.name} collection`
        });

        for (const field of collection.studentRefFields) {
          const orphans = await this.findOrphanedReferences(collection.name, field);
          results.orphansFound += orphans.length;

          if (orphans.length > 0) {
            const cleaned = await this.cleanOrphanedReferences(collection.name, field, orphans);
            results.orphansRemoved += cleaned;

            this.emit('integrity.issue', {
              severity: 'medium',
              collection: collection.name,
              field,
              count: orphans.length,
              cleaned,
              fixable: true
            });
          }
        }

        results.collectionsChecked++;

      } catch (error) {
        console.error(`Error checking ${collection.name}:`, error);
        results.errors.push({
          collection: collection.name,
          error: error.message
        });

        this.emit('integrity.issue', {
          severity: 'high',
          collection: collection.name,
          count: 0,
          error: error.message,
          fixable: false
        });
      }
    }

    this.metrics.orphansCleanedUp += results.orphansRemoved;

    this.emit('integrity.complete', {
      jobId: job.id,
      results,
      timestamp: new Date()
    });

    return results;
  }

  /**
   * Find orphaned references in collection
   */
  async findOrphanedReferences(collectionName, fieldPath) {
    const db = getDB();
    const orphans = [];

    try {
      if (fieldPath.includes('.')) {
        const [parentField, childField] = fieldPath.split('.');
        
        // Special case for teaching.studentIds - it's an object with an array property
        if (parentField === 'teaching' && childField === 'studentIds') {
          const docs = await db.collection(collectionName)
            .find({ 'teaching.studentIds': { $exists: true, $ne: [] } })
            .toArray();

          for (const doc of docs) {
            const studentIds = doc.teaching?.studentIds || [];
            // Ensure it's an array before iterating
            if (Array.isArray(studentIds)) {
              for (const studentId of studentIds) {
                if (studentId) {
                  const studentExists = await db.collection('student')
                    .findOne({ _id: new ObjectId(studentId), isActive: true });
                  
                  if (!studentExists) {
                    orphans.push({
                      documentId: doc._id,
                      orphanedId: studentId,
                      fieldPath
                    });
                  }
                }
              }
            }
          }
        } else {
          // Handle nested fields like 'attendance.studentId' where attendance is an array
          const docs = await db.collection(collectionName)
            .find({ [parentField]: { $exists: true, $ne: [] } })
            .toArray();

          for (const doc of docs) {
            const arrayData = doc[parentField] || [];
            // Ensure it's an array before iterating
            if (Array.isArray(arrayData)) {
              for (const item of arrayData) {
                if (item && item[childField]) {
                  const studentExists = await db.collection('student')
                    .findOne({ _id: new ObjectId(item[childField]), isActive: true });
                  
                  if (!studentExists) {
                    orphans.push({
                      documentId: doc._id,
                      orphanedId: item[childField],
                      fieldPath
                    });
                  }
                }
              }
            }
          }
        }
      } else {
        // Handle direct reference fields
        const pipeline = [
          {
            $lookup: {
              from: 'student',
              let: { refIds: `$${fieldPath}` },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $in: ['$_id', { $ifNull: ['$$refIds', []] }] },
                        { $eq: ['$isActive', true] }
                      ]
                    }
                  }
                }
              ],
              as: 'validRefs'
            }
          },
          {
            $project: {
              orphanedRefs: {
                $setDifference: [
                  { $ifNull: [`$${fieldPath}`, []] },
                  '$validRefs._id'
                ]
              }
            }
          },
          {
            $match: { 'orphanedRefs.0': { $exists: true } }
          }
        ];

        const docs = await db.collection(collectionName).aggregate(pipeline).toArray();
        
        for (const doc of docs) {
          for (const orphanedId of doc.orphanedRefs) {
            orphans.push({
              documentId: doc._id,
              orphanedId,
              fieldPath
            });
          }
        }
      }

    } catch (error) {
      console.error(`Error finding orphans in ${collectionName}.${fieldPath}:`, error);
      throw error;
    }

    return orphans;
  }

  /**
   * Clean orphaned references
   */
  async cleanOrphanedReferences(collectionName, fieldPath, orphans) {
    const db = getDB();
    let cleaned = 0;

    try {
      cleaned = await withTransaction(async (session) => {
        let transactionCleaned = 0;
        for (const orphan of orphans) {
          if (fieldPath.includes('.')) {
            const [parentField, childField] = fieldPath.split('.');
            
            // Special case for teaching.studentIds
            if (parentField === 'teaching' && childField === 'studentIds') {
              await db.collection(collectionName).updateOne(
                { _id: orphan.documentId },
                {
                  $pull: { 'teaching.studentIds': orphan.orphanedId },
                  $set: { 'cascadeMetadata.lastOrphanCleanup': new Date() }
                },
                { session }
              );
            } else {
              // Handle nested array fields like attendance.studentId
              await db.collection(collectionName).updateOne(
                { _id: orphan.documentId },
                {
                  $pull: {
                    [parentField]: { [childField]: orphan.orphanedId }
                  },
                  $set: { 'cascadeMetadata.lastOrphanCleanup': new Date() }
                },
                { session }
              );
            }
          } else {
            // Handle direct reference arrays
            await db.collection(collectionName).updateOne(
              { _id: orphan.documentId },
              {
                $pull: { [fieldPath]: orphan.orphanedId },
                $set: { 'cascadeMetadata.lastOrphanCleanup': new Date() }
              },
              { session }
            );
          }
          transactionCleaned++;
        }
        return transactionCleaned;
      });
    } catch (error) {
      console.error(`Error cleaning orphans in ${collectionName}.${fieldPath}:`, error);
      throw error;
    }

    return cleaned;
  }

  /**
   * Execute integrity validation
   */
  async executeIntegrityValidation(job) {
    const db = getDB();
    const results = {
      totalDocuments: 0,
      integrityIssues: 0,
      issuesByType: {},
      recommendations: []
    };

    this.emit('integrity.progress', {
      jobId: job.id,
      step: 'validating',
      percentage: 0,
      details: 'Starting comprehensive integrity validation'
    });

    const validationChecks = [
      { name: 'studentReferences', weight: 30 },
      { name: 'scheduleConsistency', weight: 25 },
      { name: 'membershipIntegrity', weight: 20 },
      { name: 'auditTrailConsistency', weight: 15 },
      { name: 'dataArchivalIntegrity', weight: 10 }
    ];

    let totalProgress = 0;

    for (const check of validationChecks) {
      try {
        const checkResult = await this.executeIntegrityCheck(check.name, db);
        results.integrityIssues += checkResult.issuesFound;
        results.issuesByType[check.name] = checkResult;
        
        if (checkResult.recommendations) {
          results.recommendations.push(...checkResult.recommendations);
        }

        totalProgress += check.weight;
        this.emit('integrity.progress', {
          jobId: job.id,
          step: 'validating',
          percentage: totalProgress,
          details: `Completed ${check.name} validation - ${checkResult.issuesFound} issues found`
        });

      } catch (error) {
        console.error(`Integrity check ${check.name} failed:`, error);
        results.issuesByType[check.name] = {
          issuesFound: 0,
          error: error.message
        };
      }
    }

    this.metrics.integrityIssuesFound += results.integrityIssues;

    if (results.integrityIssues > 0) {
      this.emit('integrity.issue', {
        severity: results.integrityIssues > 100 ? 'high' : 'medium',
        collection: 'system_wide',
        count: results.integrityIssues,
        fixable: results.recommendations.length > 0
      });
    }

    return results;
  }

  /**
   * Execute specific integrity check
   */
  async executeIntegrityCheck(checkType, db) {
    switch (checkType) {
      case 'studentReferences':
        return await this.validateStudentReferences(db);
      case 'scheduleConsistency':
        return await this.validateScheduleConsistency(db);
      case 'membershipIntegrity':
        return await this.validateMembershipIntegrity(db);
      case 'auditTrailConsistency':
        return await this.validateAuditTrailConsistency(db);
      case 'dataArchivalIntegrity':
        return await this.validateDataArchivalIntegrity(db);
      default:
        throw new Error(`Unknown integrity check: ${checkType}`);
    }
  }

  /**
   * Validate student references across collections
   */
  async validateStudentReferences(db) {
    const issues = [];
    let issuesFound = 0;

    // Check for students referenced in teachers but marked as deleted
    const invalidTeacherRefs = await db.collection('teacher').aggregate([
      {
        $lookup: {
          from: 'student',
          localField: 'teaching.studentIds',
          foreignField: '_id',
          as: 'validStudents'
        }
      },
      {
        $project: {
          invalidRefs: {
            $filter: {
              input: '$teaching.studentIds',
              cond: {
                $not: {
                  $in: ['$$this', '$validStudents._id']
                }
              }
            }
          }
        }
      },
      { $match: { 'invalidRefs.0': { $exists: true } } }
    ]).toArray();

    issuesFound += invalidTeacherRefs.length;

    return {
      issuesFound,
      details: {
        invalidTeacherReferences: invalidTeacherRefs.length
      },
      recommendations: invalidTeacherRefs.length > 0 ? 
        ['Run orphaned reference cleanup to fix invalid teacher references'] : []
    };
  }

  /**
   * Validate schedule consistency
   */
  async validateScheduleConsistency(db) {
    let issuesFound = 0;

    // Check for timeBlock lesson conflicts
    const timeBlockConflicts = await db.collection('teacher').aggregate([
      { $unwind: { path: '$teaching.timeBlocks', preserveNullAndEmptyArrays: false } },
      { $unwind: { path: '$teaching.timeBlocks.assignedLessons', preserveNullAndEmptyArrays: false } },
      { $match: { 'teaching.timeBlocks.assignedLessons.isActive': { $ne: false } } },
      {
        $group: {
          _id: {
            day: '$teaching.timeBlocks.day',
            startTime: '$teaching.timeBlocks.assignedLessons.lessonStartTime',
            studentId: '$teaching.timeBlocks.assignedLessons.studentId'
          },
          count: { $sum: 1 },
          teachers: { $push: '$_id' }
        }
      },
      { $match: { count: { $gt: 1 }, '_id.studentId': { $ne: null } } }
    ]).toArray();

    issuesFound += timeBlockConflicts.length;

    return {
      issuesFound,
      details: {
        timeBlockConflicts: timeBlockConflicts.length
      },
      recommendations: issuesFound > 0 ?
        ['Review and resolve schedule conflicts for students with multiple bookings'] : []
    };
  }

  /**
   * Validate membership integrity
   */
  async validateMembershipIntegrity(db) {
    let issuesFound = 0;

    // Check orchestra membership consistency
    const membershipIssues = await db.collection('orchestra').aggregate([
      {
        $lookup: {
          from: 'student',
          localField: 'memberIds',
          foreignField: '_id',
          as: 'validMembers'
        }
      },
      {
        $project: {
          invalidMembers: {
            $setDifference: ['$memberIds', '$validMembers._id']
          }
        }
      },
      { $match: { 'invalidMembers.0': { $exists: true } } }
    ]).toArray();

    issuesFound += membershipIssues.reduce((sum, issue) => sum + issue.invalidMembers.length, 0);

    return {
      issuesFound,
      details: {
        invalidMemberships: membershipIssues.length
      },
      recommendations: issuesFound > 0 ? 
        ['Clean up invalid orchestra memberships'] : []
    };
  }

  /**
   * Validate audit trail consistency
   */
  async validateAuditTrailConsistency(db) {
    let issuesFound = 0;

    // Check for audit records without corresponding entity data
    const orphanedAudits = await db.collection('deletion_audit').aggregate([
      {
        $lookup: {
          from: 'student',
          localField: 'entityId',
          foreignField: '_id',
          as: 'entity'
        }
      },
      {
        $match: {
          entityType: 'student',
          'entity.0': { $exists: false }
        }
      }
    ]).toArray();

    issuesFound += orphanedAudits.length;

    return {
      issuesFound,
      details: {
        orphanedAuditRecords: orphanedAudits.length
      },
      recommendations: issuesFound > 0 ? 
        ['Archive old audit records for permanently deleted entities'] : []
    };
  }

  /**
   * Validate data archival integrity
   */
  async validateDataArchivalIntegrity(db) {
    let issuesFound = 0;

    // Check for archived data that should be active
    const incorrectlyArchived = await db.collection('bagrut').countDocuments({
      archived: true,
      archivedReason: 'student_deleted',
      studentId: {
        $in: await db.collection('student').distinct('_id', { isActive: true })
      }
    });

    issuesFound += incorrectlyArchived;

    return {
      issuesFound,
      details: {
        incorrectlyArchivedRecords: incorrectlyArchived
      },
      recommendations: issuesFound > 0 ? 
        ['Restore incorrectly archived data for active students'] : []
    };
  }

  /**
   * Execute audit log archive job
   */
  async executeAuditLogArchive(job) {
    const db = getDB();
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - 12); // Archive logs older than 12 months

    const archiveResult = await db.collection('deletion_audit').updateMany(
      {
        timestamp: { $lt: cutoffDate },
        archived: { $ne: true }
      },
      {
        $set: {
          archived: true,
          archivedAt: new Date(),
          archivedReason: 'retention_policy'
        }
      }
    );

    return {
      recordsArchived: archiveResult.modifiedCount,
      cutoffDate
    };
  }

  /**
   * Execute batch cascade deletion
   */
  async executeBatchCascadeDeletion(job) {
    const { studentIds, userId, reason } = job.data;
    const results = [];
    const errors = [];

    this.emit('batch.progress', {
      jobId: job.id,
      step: 'starting',
      percentage: 0,
      details: `Starting batch deletion of ${studentIds.length} students`
    });

    for (let i = 0; i < studentIds.length; i++) {
      const studentId = studentIds[i];
      const progress = Math.round(((i + 1) / studentIds.length) * 100);

      try {
        this.emit('cascade.progress', {
          studentId,
          jobId: job.id,
          step: 'processing',
          percentage: progress,
          details: `Processing student ${i + 1} of ${studentIds.length}`
        });

        const result = await cascadeDeletionService.cascadeDeleteStudent(studentId, userId, reason);
        results.push(result);

      } catch (error) {
        console.error(`Error in batch deletion for student ${studentId}:`, error);
        errors.push({
          studentId,
          error: error.message
        });
      }
    }

    const summary = {
      successful: results.length,
      failed: errors.length,
      totalStudents: studentIds.length,
      totalDocumentsAffected: results.reduce((sum, r) => sum + r.totalAffectedDocuments, 0),
      results,
      errors
    };

    this.emit('batch.complete', {
      jobId: job.id,
      summary,
      timestamp: new Date()
    });

    return summary;
  }

  /**
   * Handle job errors and retry logic
   */
  handleJobError(job, error) {
    console.error(`Job ${job.id} (${job.type}) failed:`, error);

    job.status = 'failed';
    job.error = error.message;
    job.failedAt = new Date();

    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailureTime = Date.now();

    if (this.circuitBreaker.failures >= this.circuitBreaker.threshold) {
      this.circuitBreaker.isOpen = true;
      console.log(`Circuit breaker opened after ${this.circuitBreaker.failures} failures`);
    }

    // Retry logic with exponential backoff
    if (job.attempts < job.maxRetries) {
      const delay = Math.min(1000 * Math.pow(2, job.attempts - 1), 30000); // Max 30 seconds
      
      setTimeout(() => {
        job.status = 'queued';
        delete job.error;
        delete job.failedAt;
        this.jobQueue.unshift(job); // Add to front of queue for retry
        console.log(`Retrying job ${job.id} in ${delay}ms (attempt ${job.attempts + 1}/${job.maxRetries})`);
      }, delay);

      this.emit('jobRetry', { job, delay });
    } else {
      this.activeJobs.delete(job.id);
      this.retryAttempts.delete(job.id);
      this.emit('jobFailed', job);
    }
  }

  /**
   * Update processing metrics
   */
  updateMetrics(processingTime, success) {
    this.metrics.jobsProcessed++;
    
    if (success) {
      this.metrics.averageProcessingTime = 
        (this.metrics.averageProcessingTime * (this.metrics.jobsProcessed - 1) + processingTime) / this.metrics.jobsProcessed;
    } else {
      this.metrics.jobsFailed++;
    }
  }

  /**
   * Get job queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.jobQueue.length,
      activeJobs: this.activeJobs.size,
      isProcessing: this.isProcessing,
      circuitBreakerOpen: this.circuitBreaker.isOpen,
      metrics: this.metrics,
      jobsByPriority: {
        high: this.jobQueue.filter(j => j.priority === 'high').length,
        medium: this.jobQueue.filter(j => j.priority === 'medium').length,
        low: this.jobQueue.filter(j => j.priority === 'low').length
      }
    };
  }

  /**
   * Stop processing
   */
  stopProcessing() {
    this.isProcessing = false;
    
    // Clear scheduled jobs
    for (const [jobType, interval] of this.scheduledJobs) {
      clearInterval(interval);
    }
    this.scheduledJobs.clear();
    
    console.log('Job processing stopped');
  }

  /**
   * Utility: Sleep function
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create and export singleton instance
export const cascadeJobProcessor = new CascadeJobProcessor();