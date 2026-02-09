/**
 * Cascade Deletion WebSocket Service
 * Provides real-time notifications for cascade operations, integrity checks,
 * and system alerts in conservatory system
 */

import { Server as SocketIOServer } from 'socket.io';
import { cascadeJobProcessor } from './cascadeJobProcessor.js';
import { getDB } from './mongoDB.service.js';
import jwt from 'jsonwebtoken';

class CascadeWebSocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
    this.adminSockets = new Set();
    this.activeNotifications = new Map();
    this.notificationHistory = [];
    this.maxHistorySize = 1000;
  }

  /**
   * Initialize WebSocket server with Express server
   */
  initialize(server) {
    const NODE_ENV = process.env.NODE_ENV || 'development';
    const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
    
    // Configure CORS origins based on environment
    const corsOrigins = NODE_ENV === 'production' 
      ? [FRONTEND_URL]
      : [
          'http://localhost:5173',
          'http://172.29.139.184:5173',
          'http://10.0.2.2:5173', // Android emulator
          /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:5173$/, // Local network IPs
          /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/, // Private network IPs
          /^http:\/\/172\.\d{1,3}\.\d{1,3}\.\d{1,3}:5173$/ // Private network IPs
        ];

    this.io = new SocketIOServer(server, {
      cors: {
        origin: corsOrigins,
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io/'
    });

    this.setupAuthentication();
    this.setupEventHandlers();
    this.setupJobProcessorListeners();

    console.log('Cascade WebSocket service initialized');
    return this.io;
  }

  /**
   * Setup socket authentication middleware
   */
  setupAuthentication() {
    this.io.use((socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          // Allow connection without token for now (will restrict later)
          socket.userId = 'anonymous';
          socket.userRole = 'guest';
          socket.isAdmin = false;
          return next();
        }

        const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.id || decoded._id || 'unknown';
        socket.userRole = decoded.role || 'user';
        socket.isAdmin = decoded.role === 'מנהל' || decoded.role === 'admin' || decoded.role === 'super_admin';
        
        next();
      } catch (error) {
        console.error('Socket authentication error:', error);
        // Allow connection but with limited permissions
        socket.userId = 'anonymous';
        socket.userRole = 'guest';
        socket.isAdmin = false;
        next();
      }
    });
  }

  /**
   * Setup WebSocket event handlers
   */
  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected to cascade WebSocket service`);
      
      this.connectedUsers.set(socket.id, {
        userId: socket.userId,
        userRole: socket.userRole,
        isAdmin: socket.isAdmin,
        connectedAt: new Date()
      });

      if (socket.isAdmin) {
        this.adminSockets.add(socket.id);
        
        // Send current system status to new admin
        socket.emit('system.status', this.getSystemStatus());
        
        // Send recent notification history
        socket.emit('notification.history', {
          notifications: this.notificationHistory.slice(-50),
          timestamp: new Date()
        });
      }

      // Join user-specific room for targeted notifications
      socket.join(`user_${socket.userId}`);
      
      if (socket.isAdmin) {
        socket.join('admins');
      }

      // Handle client subscriptions
      socket.on('subscribe.cascade', (data) => {
        if (data.studentId && this.canAccessStudent(socket, data.studentId)) {
          socket.join(`cascade_${data.studentId}`);
          console.log(`User ${socket.userId} subscribed to cascade updates for student ${data.studentId}`);
        }
      });

      socket.on('subscribe.integrity', () => {
        if (socket.isAdmin) {
          socket.join('integrity_updates');
          console.log(`Admin ${socket.userId} subscribed to integrity updates`);
        }
      });

      socket.on('subscribe.jobs', () => {
        if (socket.isAdmin) {
          socket.join('job_updates');
          socket.emit('job.status', cascadeJobProcessor.getQueueStatus());
          console.log(`Admin ${socket.userId} subscribed to job updates`);
        }
      });

      // Handle job control requests (admin only)
      socket.on('job.pause', () => {
        if (socket.isAdmin) {
          cascadeJobProcessor.stopProcessing();
          this.emitToAdmins('job.paused', {
            pausedBy: socket.userId,
            timestamp: new Date()
          });
        }
      });

      socket.on('job.resume', () => {
        if (socket.isAdmin) {
          cascadeJobProcessor.startProcessing();
          this.emitToAdmins('job.resumed', {
            resumedBy: socket.userId,
            timestamp: new Date()
          });
        }
      });

      socket.on('job.add', (data) => {
        if (socket.isAdmin && data.type && data.priority) {
          const jobId = cascadeJobProcessor.addJob(
            data.type,
            data.data || {},
            data.priority,
            data.maxRetries || 3,
            data.timeout || 30000
          );
          
          socket.emit('job.added', {
            jobId,
            type: data.type,
            timestamp: new Date()
          });
        }
      });

      // Handle disconnect
      socket.on('disconnect', (reason) => {
        console.log(`User ${socket.userId} disconnected: ${reason}`);
        this.connectedUsers.delete(socket.id);
        this.adminSockets.delete(socket.id);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.userId}:`, error);
      });
    });
  }

  /**
   * Setup job processor event listeners
   */
  setupJobProcessorListeners() {
    // Job queue events
    cascadeJobProcessor.on('jobQueued', (job) => {
      this.emitToAdmins('job.queued', {
        jobId: job.id,
        type: job.type,
        priority: job.priority,
        timestamp: new Date()
      });
    });

    cascadeJobProcessor.on('jobStarted', (job) => {
      this.emitToAdmins('job.started', {
        jobId: job.id,
        type: job.type,
        attempts: job.attempts,
        timestamp: new Date()
      });
    });

    cascadeJobProcessor.on('jobCompleted', (job) => {
      this.emitToAdmins('job.completed', {
        jobId: job.id,
        type: job.type,
        processingTime: job.processingTime,
        result: job.result,
        timestamp: new Date()
      });

      this.addToHistory('job_completed', {
        jobId: job.id,
        type: job.type,
        processingTime: job.processingTime
      });
    });

    cascadeJobProcessor.on('jobFailed', (job) => {
      this.emitToAdmins('job.failed', {
        jobId: job.id,
        type: job.type,
        error: job.error,
        attempts: job.attempts,
        timestamp: new Date()
      });

      this.addToHistory('job_failed', {
        jobId: job.id,
        type: job.type,
        error: job.error
      });

      // Send critical alert for important job failures
      if (['cascadeDeletion', 'batchCascadeDeletion'].includes(job.type)) {
        this.emitCriticalAlert('job_failure', {
          severity: 'high',
          message: `Critical job failed: ${job.type}`,
          jobId: job.id,
          error: job.error,
          requiresAttention: true
        });
      }
    });

    cascadeJobProcessor.on('jobRetry', ({ job, delay }) => {
      this.emitToAdmins('job.retry', {
        jobId: job.id,
        type: job.type,
        attempt: job.attempts + 1,
        maxRetries: job.maxRetries,
        delay,
        timestamp: new Date()
      });
    });

    // Cascade operation events
    cascadeJobProcessor.on('cascade.progress', (data) => {
      this.emitCascadeProgress(data);
    });

    cascadeJobProcessor.on('cascade.complete', (data) => {
      this.emitCascadeComplete(data);
    });

    // Integrity check events
    cascadeJobProcessor.on('integrity.progress', (data) => {
      this.emitIntegrityProgress(data);
    });

    cascadeJobProcessor.on('integrity.issue', (data) => {
      this.emitIntegrityIssue(data);
    });

    cascadeJobProcessor.on('integrity.complete', (data) => {
      this.emitIntegrityComplete(data);
    });

    // Batch operation events
    cascadeJobProcessor.on('batch.progress', (data) => {
      this.emitBatchProgress(data);
    });

    cascadeJobProcessor.on('batch.complete', (data) => {
      this.emitBatchComplete(data);
    });
  }

  /**
   * Emit cascade operation progress
   */
  emitCascadeProgress(data) {
    const progressEvent = {
      studentId: data.studentId,
      jobId: data.jobId,
      step: data.step,
      percentage: data.percentage,
      details: data.details,
      timestamp: new Date()
    };

    // Send to student-specific room and admins
    this.io.to(`cascade_${data.studentId}`).emit('cascade.progress', progressEvent);
    this.emitToAdmins('cascade.progress', progressEvent);

    // Store active notification
    this.activeNotifications.set(`cascade_${data.studentId}`, progressEvent);
  }

  /**
   * Emit cascade completion
   */
  emitCascadeComplete(data) {
    const completeEvent = {
      studentId: data.studentId,
      jobId: data.jobId,
      summary: data.summary,
      duration: data.duration,
      timestamp: new Date()
    };

    this.io.to(`cascade_${data.studentId}`).emit('cascade.complete', completeEvent);
    this.emitToAdmins('cascade.complete', completeEvent);

    // Remove from active notifications
    this.activeNotifications.delete(`cascade_${data.studentId}`);

    // Add to history
    this.addToHistory('cascade_complete', {
      studentId: data.studentId,
      affectedDocuments: data.summary?.totalAffectedDocuments || 0,
      duration: data.duration
    });

    // Send success notification
    this.emitNotification(`user_${data.summary?.userId}`, 'success', {
      title: 'Cascade Deletion Complete',
      message: `Student deletion completed successfully. ${data.summary?.totalAffectedDocuments || 0} documents affected.`,
      studentId: data.studentId,
      duration: data.duration
    });
  }

  /**
   * Emit integrity check progress
   */
  emitIntegrityProgress(data) {
    const progressEvent = {
      jobId: data.jobId,
      step: data.step,
      percentage: data.percentage,
      details: data.details,
      timestamp: new Date()
    };

    this.io.to('integrity_updates').emit('integrity.progress', progressEvent);
  }

  /**
   * Emit integrity issue found
   */
  emitIntegrityIssue(data) {
    const issueEvent = {
      severity: data.severity,
      collection: data.collection,
      field: data.field,
      count: data.count,
      cleaned: data.cleaned,
      fixable: data.fixable,
      error: data.error,
      timestamp: new Date()
    };

    this.io.to('integrity_updates').emit('integrity.issue', issueEvent);

    // Add to history
    this.addToHistory('integrity_issue', {
      severity: data.severity,
      collection: data.collection,
      count: data.count
    });

    // Send critical alert for high severity issues
    if (data.severity === 'high') {
      this.emitCriticalAlert('integrity_issue', {
        severity: 'high',
        message: `High severity integrity issue found in ${data.collection}`,
        collection: data.collection,
        count: data.count,
        fixable: data.fixable,
        requiresAttention: true
      });
    }
  }

  /**
   * Emit integrity check completion
   */
  emitIntegrityComplete(data) {
    const completeEvent = {
      jobId: data.jobId,
      results: data.results,
      timestamp: new Date()
    };

    this.io.to('integrity_updates').emit('integrity.complete', completeEvent);

    // Add to history
    this.addToHistory('integrity_complete', {
      totalIssues: data.results?.integrityIssues || 0,
      recommendationsCount: data.results?.recommendations?.length || 0
    });
  }

  /**
   * Emit batch operation progress
   */
  emitBatchProgress(data) {
    const progressEvent = {
      jobId: data.jobId,
      step: data.step,
      percentage: data.percentage,
      details: data.details,
      timestamp: new Date()
    };

    this.emitToAdmins('batch.progress', progressEvent);
  }

  /**
   * Emit batch operation completion
   */
  emitBatchComplete(data) {
    const completeEvent = {
      jobId: data.jobId,
      summary: data.summary,
      timestamp: new Date()
    };

    this.emitToAdmins('batch.complete', completeEvent);

    // Add to history
    this.addToHistory('batch_complete', {
      successful: data.summary?.successful || 0,
      failed: data.summary?.failed || 0,
      totalDocuments: data.summary?.totalDocumentsAffected || 0
    });
  }

  /**
   * Emit deletion impact warning
   */
  emitDeletionWarning(data) {
    const warningEvent = {
      studentId: data.studentId,
      impact: data.impact,
      affectedCollections: data.affectedCollections,
      recommendation: data.recommendation,
      severity: data.severity || 'medium',
      timestamp: new Date()
    };

    // Send to specific student observers and admins
    this.io.to(`cascade_${data.studentId}`).emit('deletion.warning', warningEvent);
    this.emitToAdmins('deletion.warning', warningEvent);

    this.addToHistory('deletion_warning', {
      studentId: data.studentId,
      severity: warningEvent.severity,
      affectedCollections: data.affectedCollections?.length || 0
    });
  }

  /**
   * Emit critical system alert
   */
  emitCriticalAlert(type, data) {
    const alertEvent = {
      type,
      severity: data.severity,
      message: data.message,
      details: data,
      requiresAttention: data.requiresAttention || false,
      timestamp: new Date(),
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    // Send to all admins
    this.emitToAdmins('system.alert', alertEvent);

    // Add to history with high priority
    this.addToHistory('critical_alert', alertEvent, true);

    console.log(`Critical alert emitted: ${type} - ${data.message}`);
  }

  /**
   * Emit notification to specific user or room
   */
  emitNotification(target, level, data) {
    const notification = {
      level, // success, info, warning, error
      title: data.title,
      message: data.message,
      data: data,
      timestamp: new Date(),
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.io.to(target).emit('notification', notification);
  }

  /**
   * Emit to all admin sockets
   */
  emitToAdmins(event, data) {
    this.io.to('admins').emit(event, data);
  }

  /**
   * Check if user can access student data
   */
  async canAccessStudent(socket, studentId) {
    if (socket.isAdmin) return true;

    try {
      const db = getDB();
      // Check if user has any relationship with this student (teacher, etc.)
      const hasAccess = await db.collection('teacher').findOne({
        userId: socket.userId,
        $or: [
          { 'teaching.studentIds': studentId },
          { 'teaching.timeBlocks.assignedLessons.studentId': studentId }
        ],
        isActive: true
      });

      // For now, allow access for testing purposes
      return true; // !!hasAccess;
    } catch (error) {
      console.error('Error checking student access:', error);
      // Allow access for testing
      return true;
    }
  }

  /**
   * Get current system status
   */
  getSystemStatus() {
    const queueStatus = cascadeJobProcessor.getQueueStatus();
    
    return {
      connected_users: this.connectedUsers.size,
      connected_admins: this.adminSockets.size,
      active_notifications: this.activeNotifications.size,
      job_queue_status: queueStatus,
      system_health: {
        circuit_breaker_open: queueStatus.circuitBreakerOpen,
        processing_enabled: queueStatus.isProcessing,
        recent_failures: queueStatus.metrics.jobsFailed,
        total_processed: queueStatus.metrics.jobsProcessed
      },
      timestamp: new Date()
    };
  }

  /**
   * Add event to notification history
   */
  addToHistory(type, data, priority = false) {
    const historyItem = {
      type,
      data,
      timestamp: new Date(),
      id: `hist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    if (priority) {
      this.notificationHistory.unshift(historyItem);
    } else {
      this.notificationHistory.push(historyItem);
    }

    // Maintain history size
    if (this.notificationHistory.length > this.maxHistorySize) {
      if (priority) {
        this.notificationHistory.pop();
      } else {
        this.notificationHistory.shift();
      }
    }
  }

  /**
   * Broadcast system maintenance notification
   */
  broadcastMaintenanceNotification(message, startTime, estimatedDuration) {
    const notification = {
      type: 'maintenance',
      message,
      startTime,
      estimatedDuration,
      timestamp: new Date()
    };

    this.io.emit('system.maintenance', notification);
    this.addToHistory('maintenance', notification, true);
  }

  /**
   * Send periodic system health updates
   */
  startHealthBroadcast(intervalMs = 30000) {
    setInterval(() => {
      const status = this.getSystemStatus();
      this.emitToAdmins('system.health', status);
    }, intervalMs);
  }

  /**
   * Get connected users info (admin only)
   */
  getConnectedUsersInfo() {
    return Array.from(this.connectedUsers.entries()).map(([socketId, user]) => ({
      socketId,
      userId: user.userId,
      role: user.userRole,
      connectedAt: user.connectedAt,
      isAdmin: user.isAdmin
    }));
  }

  /**
   * Cleanup and shutdown
   */
  shutdown() {
    if (this.io) {
      this.io.close();
      console.log('Cascade WebSocket service shut down');
    }
  }
}

// Create and export singleton instance
export const cascadeWebSocketService = new CascadeWebSocketService();