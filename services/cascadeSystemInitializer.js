/**
 * Cascade System Initializer
 * Initializes and coordinates all cascade deletion services
 * Sets up job processing, WebSocket connections, and system monitoring
 */

import { cascadeJobProcessor } from './cascadeJobProcessor.js';
import { cascadeWebSocketService } from './cascadeWebSocketService.js';
import { getDB } from './mongoDB.service.js';

class CascadeSystemInitializer {
  constructor() {
    this.isInitialized = false;
    this.services = {
      jobProcessor: cascadeJobProcessor,
      webSocketService: cascadeWebSocketService
    };
  }

  /**
   * Initialize all cascade services
   */
  async initialize(expressServer) {
    try {
      console.log('🚀 Initializing Cascade Deletion System...');

      // Check database connection
      await this.verifyDatabaseConnection();

      // Initialize job processor
      console.log('📋 Initializing Job Processor...');
      await this.services.jobProcessor.initialize();

      // Initialize WebSocket service
      console.log('🔌 Initializing WebSocket Service...');
      this.services.webSocketService.initialize(expressServer);

      // Set up system monitoring
      console.log('📊 Starting System Monitoring...');
      this.setupSystemMonitoring();

      // Set up graceful shutdown
      this.setupGracefulShutdown();

      // Verify system health
      await this.performHealthCheck();

      this.isInitialized = true;
      console.log('✅ Cascade Deletion System initialized successfully');

      // Start periodic health broadcasts
      this.services.webSocketService.startHealthBroadcast();

      return true;

    } catch (error) {
      console.error('❌ Failed to initialize Cascade Deletion System:', error);
      throw error;
    }
  }

  /**
   * Verify database connection and required collections
   */
  async verifyDatabaseConnection() {
    try {
      const db = getDB();
      
      // Test basic connection
      await db.admin().ping();

      // Verify required collections exist
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);

      const requiredCollections = [
        'student',
        'teacher',
        'orchestra',
        'rehearsal',
        'theory_lesson',
        'bagrut',
        'activity_attendance',
        'deletion_audit'
      ];

      const missingCollections = requiredCollections.filter(
        name => !collectionNames.includes(name)
      );

      if (missingCollections.length > 0) {
        console.warn('⚠️  Missing collections will be created on first use:', missingCollections);
        
        // Create deletion_audit collection with indexes
        await this.createAuditCollection();
      }

      console.log('✅ Database connection verified');

    } catch (error) {
      console.error('❌ Database verification failed:', error);
      throw new Error('Database connection required for cascade system');
    }
  }

  /**
   * Create and configure the deletion audit collection
   */
  async createAuditCollection() {
    try {
      const db = getDB();
      
      // Create collection if it doesn't exist
      const auditCollection = db.collection('deletion_audit');
      
      // Create indexes for performance
      await auditCollection.createIndexes([
        { key: { entityId: 1, timestamp: -1 } },
        { key: { entityType: 1, timestamp: -1 } },
        { key: { userId: 1, timestamp: -1 } },
        { key: { deletionType: 1 } },
        { key: { timestamp: -1 } },
        { key: { archived: 1, archivedAt: -1 } }
      ]);

      console.log('✅ Deletion audit collection configured');

    } catch (error) {
      console.error('❌ Failed to configure audit collection:', error);
      // Don't throw - this is not critical for system operation
    }
  }

  /**
   * Set up system monitoring and alerts
   */
  setupSystemMonitoring() {
    // Monitor job processor health
    setInterval(() => {
      const status = this.services.jobProcessor.getQueueStatus();
      
      // Check for concerning conditions
      if (status.circuitBreakerOpen) {
        this.services.webSocketService.emitCriticalAlert('circuit_breaker_open', {
          severity: 'high',
          message: 'Job processor circuit breaker is open - system may be experiencing issues',
          queueLength: status.queueLength,
          activeJobs: status.activeJobs,
          requiresAttention: true
        });
      }

      if (status.queueLength > 100) {
        this.services.webSocketService.emitCriticalAlert('high_queue_length', {
          severity: 'medium',
          message: `Job queue is backing up - ${status.queueLength} jobs pending`,
          queueLength: status.queueLength,
          recommendation: 'Consider scaling processing capacity',
          requiresAttention: false
        });
      }

      if (status.metrics.jobsFailed > status.metrics.jobsProcessed * 0.1) {
        this.services.webSocketService.emitCriticalAlert('high_failure_rate', {
          severity: 'high',
          message: 'High job failure rate detected',
          failureRate: (status.metrics.jobsFailed / status.metrics.jobsProcessed * 100).toFixed(2),
          totalFailed: status.metrics.jobsFailed,
          totalProcessed: status.metrics.jobsProcessed,
          requiresAttention: true
        });
      }

    }, 60000); // Check every minute

    console.log('✅ System monitoring started');
  }

  /**
   * Set up graceful shutdown handling
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\n🔄 Received ${signal}, gracefully shutting down cascade system...`);
      
      try {
        // Stop accepting new jobs
        console.log('📋 Stopping job processor...');
        this.services.jobProcessor.stopProcessing();

        // Wait for active jobs to complete (with timeout)
        await this.waitForJobsToComplete(30000); // 30 second timeout

        // Close WebSocket connections
        console.log('🔌 Closing WebSocket connections...');
        this.services.webSocketService.shutdown();

        console.log('✅ Cascade system shut down gracefully');
        process.exit(0);

      } catch (error) {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    // Handle different shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('❌ Uncaught Exception in cascade system:', error);
      this.services.webSocketService.emitCriticalAlert('system_error', {
        severity: 'critical',
        message: 'System encountered an uncaught exception',
        error: error.message,
        stack: error.stack,
        requiresAttention: true
      });
      
      // Don't exit immediately - let the system try to recover
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Unhandled Promise Rejection in cascade system:', reason);
      this.services.webSocketService.emitCriticalAlert('promise_rejection', {
        severity: 'high',
        message: 'System encountered an unhandled promise rejection',
        reason: reason?.toString() || 'Unknown reason',
        requiresAttention: true
      });
    });

    console.log('✅ Graceful shutdown handlers configured');
  }

  /**
   * Wait for active jobs to complete
   */
  async waitForJobsToComplete(timeoutMs) {
    const startTime = Date.now();
    
    while (this.services.jobProcessor.activeJobs.size > 0) {
      if (Date.now() - startTime > timeoutMs) {
        console.warn(`⚠️  Timeout waiting for jobs to complete. ${this.services.jobProcessor.activeJobs.size} jobs still active`);
        break;
      }
      
      console.log(`⏳ Waiting for ${this.services.jobProcessor.activeJobs.size} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Perform system health check
   */
  async performHealthCheck() {
    try {
      const health = {
        timestamp: new Date(),
        services: {},
        overall: 'healthy'
      };

      // Check job processor
      const queueStatus = this.services.jobProcessor.getQueueStatus();
      health.services.jobProcessor = {
        status: queueStatus.isProcessing ? 'active' : 'stopped',
        queueLength: queueStatus.queueLength,
        activeJobs: queueStatus.activeJobs,
        circuitBreaker: queueStatus.circuitBreakerOpen ? 'open' : 'closed'
      };

      if (queueStatus.circuitBreakerOpen || !queueStatus.isProcessing) {
        health.overall = 'degraded';
      }

      // Check WebSocket service
      const wsStatus = this.services.webSocketService.getSystemStatus();
      health.services.webSocket = {
        status: 'active',
        connectedUsers: wsStatus.connected_users,
        connectedAdmins: wsStatus.connected_admins
      };

      // Check database
      try {
        const db = getDB();
        await db.admin().ping();
        health.services.database = { status: 'connected' };
      } catch (error) {
        health.services.database = { 
          status: 'error', 
          error: error.message 
        };
        health.overall = 'unhealthy';
      }

      if (health.overall !== 'healthy') {
        console.warn('⚠️  System health check shows issues:', health);
      } else {
        console.log('✅ System health check passed');
      }

      return health;

    } catch (error) {
      console.error('❌ Health check failed:', error);
      throw error;
    }
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    if (!this.isInitialized) {
      return { status: 'not_initialized' };
    }

    return {
      initialized: this.isInitialized,
      jobProcessor: this.services.jobProcessor.getQueueStatus(),
      webSocket: this.services.webSocketService.getSystemStatus(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date()
    };
  }

  /**
   * Restart system components
   */
  async restart() {
    try {
      console.log('🔄 Restarting cascade system...');

      // Stop services
      this.services.jobProcessor.stopProcessing();
      
      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Restart services
      await this.services.jobProcessor.initialize();
      
      console.log('✅ Cascade system restarted');
      
      return true;

    } catch (error) {
      console.error('❌ Failed to restart cascade system:', error);
      throw error;
    }
  }

  /**
   * Emergency stop all operations
   */
  emergencyStop(reason = 'Emergency stop requested') {
    console.log(`🛑 Emergency stop: ${reason}`);
    
    this.services.jobProcessor.stopProcessing();
    
    this.services.webSocketService.emitCriticalAlert('emergency_stop', {
      severity: 'critical',
      message: `System emergency stop: ${reason}`,
      timestamp: new Date(),
      requiresAttention: true
    });

    console.log('🛑 All operations stopped');
  }
}

// Create and export singleton instance
export const cascadeSystemInitializer = new CascadeSystemInitializer();