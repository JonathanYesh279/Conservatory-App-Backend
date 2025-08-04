/**
 * Date Monitoring Service
 * Provides monitoring, alerting, and analytics for date operations
 */

import { getCollection } from './mongoDB.service.js';
import { 
  now, 
  formatDateTime, 
  isValidDate,
  createAppDate,
  formatDate 
} from '../utils/dateHelpers.js';

class DateMonitoringService {
  constructor() {
    this.metrics = {
      dateOperations: 0,
      validationFailures: 0,
      timezoneConversions: 0,
      conflictDetections: 0,
      lastActivity: null
    };
    
    this.alerts = [];
    this.performanceData = [];
    this.dailyStats = new Map();
  }

  /**
   * Log a date operation for monitoring
   * @param {string} operation - Type of operation
   * @param {Object} metadata - Additional operation data
   */
  logDateOperation(operation, metadata = {}) {
    this.metrics.dateOperations++;
    this.metrics.lastActivity = now().toISOString();
    
    const logEntry = {
      timestamp: this.metrics.lastActivity,
      operation,
      metadata,
      id: this._generateId()
    };

    // Update daily stats
    const today = formatDate(now(), 'YYYY-MM-DD');
    if (!this.dailyStats.has(today)) {
      this.dailyStats.set(today, {
        date: today,
        operations: 0,
        failures: 0,
        conflicts: 0,
        validations: 0
      });
    }
    
    const dayStats = this.dailyStats.get(today);
    dayStats.operations++;

    // Store recent operations (keep last 1000)
    this.performanceData.push(logEntry);
    if (this.performanceData.length > 1000) {
      this.performanceData = this.performanceData.slice(-1000);
    }

    // Check for alerts
    this._checkAlerts(operation, metadata);
  }

  /**
   * Log a validation failure
   * @param {string} type - Type of validation that failed
   * @param {Object} data - Validation failure data
   */
  logValidationFailure(type, data = {}) {
    this.metrics.validationFailures++;
    
    const today = formatDate(now(), 'YYYY-MM-DD');
    if (this.dailyStats.has(today)) {
      this.dailyStats.get(today).failures++;
    }

    this.logDateOperation('validation_failure', {
      type,
      data,
      severity: 'warning'
    });

    // Create alert for excessive validation failures
    if (this.metrics.validationFailures % 10 === 0) {
      this._createAlert('HIGH_VALIDATION_FAILURES', {
        count: this.metrics.validationFailures,
        type: type,
        data: data
      });
    }
  }

  /**
   * Log a timezone conversion
   * @param {string} fromTimezone - Source timezone
   * @param {string} toTimezone - Target timezone
   * @param {Object} metadata - Additional data
   */
  logTimezoneConversion(fromTimezone, toTimezone, metadata = {}) {
    this.metrics.timezoneConversions++;
    
    this.logDateOperation('timezone_conversion', {
      fromTimezone,
      toTimezone,
      ...metadata
    });
  }

  /**
   * Log a conflict detection
   * @param {string} type - Type of conflict
   * @param {Object} conflictData - Conflict details
   */
  logConflictDetection(type, conflictData = {}) {
    this.metrics.conflictDetections++;
    
    const today = formatDate(now(), 'YYYY-MM-DD');
    if (this.dailyStats.has(today)) {
      this.dailyStats.get(today).conflicts++;
    }

    this.logDateOperation('conflict_detection', {
      type,
      conflictData,
      severity: 'info'
    });
  }

  /**
   * Get current monitoring metrics
   * @returns {Object} Current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: this._calculateUptime(),
      recentActivity: this._getRecentActivity(),
      alertCount: this.alerts.length,
      dailyStatsCount: this.dailyStats.size
    };
  }

  /**
   * Get detailed monitoring report
   * @param {Object} options - Report options
   * @returns {Object} Detailed report
   */
  async getMonitoringReport(options = {}) {
    const { 
      includeDailyStats = true,
      includeAlerts = true,
      includePerformanceData = false,
      includeSystemHealth = true
    } = options;

    const report = {
      timestamp: formatDateTime(now()),
      metrics: this.getMetrics(),
      status: this._getSystemStatus()
    };

    if (includeDailyStats) {
      report.dailyStats = Array.from(this.dailyStats.values())
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30); // Last 30 days
    }

    if (includeAlerts) {
      report.alerts = this.alerts
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 50); // Last 50 alerts
    }

    if (includePerformanceData) {
      report.performanceData = this.performanceData.slice(-100); // Last 100 operations
    }

    if (includeSystemHealth) {
      report.systemHealth = await this._getSystemHealth();
    }

    return report;
  }

  /**
   * Get database health metrics related to dates
   * @returns {Object} Database health metrics
   */
  async getDatabaseHealthMetrics() {
    const health = {
      timestamp: formatDateTime(now()),
      collections: {}
    };

    try {
      // Check theory lessons
      const theoryCollection = await getCollection('theory_lesson');
      const theoryCount = await theoryCollection.countDocuments();
      const theoryWithInvalidDates = await theoryCollection.countDocuments({
        $or: [
          { date: null },
          { date: { $exists: false } },
          { createdAt: null },
          { createdAt: { $exists: false } }
        ]
      });

      health.collections.theoryLessons = {
        total: theoryCount,
        withInvalidDates: theoryWithInvalidDates,
        healthScore: theoryCount > 0 ? ((theoryCount - theoryWithInvalidDates) / theoryCount * 100).toFixed(2) : 100
      };

      // Check rehearsals
      const rehearsalCollection = await getCollection('rehearsal');
      const rehearsalCount = await rehearsalCollection.countDocuments();
      const rehearsalWithInvalidDates = await rehearsalCollection.countDocuments({
        $or: [
          { date: null },
          { date: { $exists: false } },
          { createdAt: null },
          { createdAt: { $exists: false } }
        ]
      });

      health.collections.rehearsals = {
        total: rehearsalCount,
        withInvalidDates: rehearsalWithInvalidDates,
        healthScore: rehearsalCount > 0 ? ((rehearsalCount - rehearsalWithInvalidDates) / rehearsalCount * 100).toFixed(2) : 100
      };

      // Check attendance
      const attendanceCollection = await getCollection('activity_attendance');
      const attendanceCount = await attendanceCollection.countDocuments();
      const attendanceWithInvalidDates = await attendanceCollection.countDocuments({
        $or: [
          { date: null },
          { date: { $exists: false } },
          { createdAt: null },
          { createdAt: { $exists: false } }
        ]
      });

      health.collections.attendance = {
        total: attendanceCount,
        withInvalidDates: attendanceWithInvalidDates,
        healthScore: attendanceCount > 0 ? ((attendanceCount - attendanceWithInvalidDates) / attendanceCount * 100).toFixed(2) : 100
      };

      // Calculate overall health score
      const collections = Object.values(health.collections);
      const totalRecords = collections.reduce((sum, col) => sum + col.total, 0);
      const totalInvalid = collections.reduce((sum, col) => sum + col.withInvalidDates, 0);
      
      health.overall = {
        totalRecords,
        totalInvalid,
        healthScore: totalRecords > 0 ? ((totalRecords - totalInvalid) / totalRecords * 100).toFixed(2) : 100
      };

    } catch (error) {
      health.error = error.message;
    }

    return health;
  }

  /**
   * Clear old monitoring data
   * @param {Object} options - Cleanup options
   */
  clearOldData(options = {}) {
    const { 
      keepDays = 30,
      keepAlerts = 100,
      keepPerformanceData = 1000 
    } = options;

    // Clear old daily stats
    const cutoffDate = now().subtract(keepDays, 'days').format('YYYY-MM-DD');
    for (const [date] of this.dailyStats) {
      if (date < cutoffDate) {
        this.dailyStats.delete(date);
      }
    }

    // Clear old alerts
    this.alerts = this.alerts
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, keepAlerts);

    // Clear old performance data
    this.performanceData = this.performanceData.slice(-keepPerformanceData);

    this.logDateOperation('cleanup', {
      keepDays,
      keepAlerts,
      keepPerformanceData,
      remainingDailyStats: this.dailyStats.size,
      remainingAlerts: this.alerts.length,
      remainingPerformanceData: this.performanceData.length
    });
  }

  /**
   * Export monitoring data
   * @param {string} format - Export format (json, csv)
   * @returns {string} Exported data
   */
  exportData(format = 'json') {
    const data = {
      exportTimestamp: formatDateTime(now()),
      metrics: this.getMetrics(),
      dailyStats: Array.from(this.dailyStats.values()),
      alerts: this.alerts,
      performanceData: this.performanceData
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    if (format === 'csv') {
      // Convert daily stats to CSV
      const csvLines = ['Date,Operations,Failures,Conflicts,Validations'];
      data.dailyStats.forEach(stat => {
        csvLines.push(`${stat.date},${stat.operations},${stat.failures},${stat.conflicts},${stat.validations}`);
      });
      return csvLines.join('\n');
    }

    throw new Error(`Unsupported export format: ${format}`);
  }

  /**
   * Private helper methods
   */
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  _checkAlerts(operation, metadata) {
    // Check for patterns that might indicate issues
    if (metadata.severity === 'error') {
      this._createAlert('DATE_OPERATION_ERROR', {
        operation,
        metadata
      });
    }

    // Check for unusual activity patterns
    const recentOps = this.performanceData.slice(-10);
    const failureRate = recentOps.filter(op => op.metadata.severity === 'error').length / recentOps.length;
    
    if (failureRate > 0.3) { // More than 30% failure rate
      this._createAlert('HIGH_FAILURE_RATE', {
        failureRate: (failureRate * 100).toFixed(2),
        recentOperations: recentOps.length
      });
    }
  }

  _createAlert(type, data) {
    const alert = {
      id: this._generateId(),
      type,
      timestamp: now().toISOString(),
      data,
      acknowledged: false
    };

    this.alerts.push(alert);
    
    // Keep only last 200 alerts
    if (this.alerts.length > 200) {
      this.alerts = this.alerts.slice(-200);
    }
  }

  _calculateUptime() {
    // This is a simplified uptime calculation
    // In a real system, you'd track actual service start time
    return this.metrics.lastActivity 
      ? now().diff(createAppDate(this.metrics.lastActivity), 'hours')
      : 0;
  }

  _getRecentActivity() {
    const recent = this.performanceData.slice(-10);
    return recent.map(op => ({
      operation: op.operation,
      timestamp: op.timestamp,
      success: !op.metadata.severity || op.metadata.severity !== 'error'
    }));
  }

  _getSystemStatus() {
    const recent = this.performanceData.slice(-20);
    const errors = recent.filter(op => op.metadata.severity === 'error').length;
    const warnings = recent.filter(op => op.metadata.severity === 'warning').length;

    if (errors > 5) return 'critical';
    if (errors > 2 || warnings > 10) return 'warning';
    if (recent.length > 0) return 'healthy';
    return 'idle';
  }

  async _getSystemHealth() {
    try {
      const dbHealth = await this.getDatabaseHealthMetrics();
      const overallHealthScore = parseFloat(dbHealth.overall.healthScore);
      
      return {
        database: {
          status: overallHealthScore > 95 ? 'excellent' : 
                  overallHealthScore > 85 ? 'good' :
                  overallHealthScore > 70 ? 'fair' : 'poor',
          score: overallHealthScore,
          details: dbHealth
        },
        monitoring: {
          status: this._getSystemStatus(),
          metricsCollected: this.metrics.dateOperations,
          alertsActive: this.alerts.filter(a => !a.acknowledged).length
        }
      };
    } catch (error) {
      return {
        error: error.message,
        status: 'error'
      };
    }
  }
}

export default new DateMonitoringService();