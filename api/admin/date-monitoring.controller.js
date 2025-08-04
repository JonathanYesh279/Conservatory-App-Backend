/**
 * Date Monitoring Controller
 * Provides endpoints for viewing date monitoring data and health metrics
 */

import dateMonitoringService from '../../services/dateMonitoringService.js';
import dateConsistencyService from '../../services/dateConsistencyService.js';
import { sendErrorResponse, sendSuccessResponse } from '../../utils/errorResponses.js';

export const dateMonitoringController = {
  getMetrics,
  getMonitoringReport,
  getDatabaseHealth,
  getSystemStatus,
  clearOldData,
  exportData,
  runHealthCheck,
  getAlerts,
  acknowledgeAlert
};

/**
 * Get current monitoring metrics
 */
async function getMetrics(req, res, next) {
  try {
    const metrics = dateMonitoringService.getMetrics();
    return sendSuccessResponse(res, 'METRICS_RETRIEVED', metrics);
  } catch (err) {
    console.error(`Error retrieving monitoring metrics: ${err.message}`);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

/**
 * Get detailed monitoring report
 */
async function getMonitoringReport(req, res, next) {
  try {
    const options = {
      includeDailyStats: req.query.includeDailyStats !== 'false',
      includeAlerts: req.query.includeAlerts !== 'false',
      includePerformanceData: req.query.includePerformanceData === 'true',
      includeSystemHealth: req.query.includeSystemHealth !== 'false'
    };

    const report = await dateMonitoringService.getMonitoringReport(options);
    return sendSuccessResponse(res, 'MONITORING_REPORT_GENERATED', report);
  } catch (err) {
    console.error(`Error generating monitoring report: ${err.message}`);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

/**
 * Get database health metrics
 */
async function getDatabaseHealth(req, res, next) {
  try {
    const health = await dateMonitoringService.getDatabaseHealthMetrics();
    return sendSuccessResponse(res, 'DATABASE_HEALTH_RETRIEVED', health);
  } catch (err) {
    console.error(`Error retrieving database health: ${err.message}`);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

/**
 * Get system status overview
 */
async function getSystemStatus(req, res, next) {
  try {
    const metrics = dateMonitoringService.getMetrics();
    const health = await dateMonitoringService.getDatabaseHealthMetrics();
    
    const status = {
      timestamp: new Date().toISOString(),
      system: {
        status: metrics.status || 'unknown',
        uptime: metrics.uptime,
        operations: metrics.dateOperations,
        lastActivity: metrics.lastActivity
      },
      database: {
        overallHealth: health.overall.healthScore,
        totalRecords: health.overall.totalRecords,
        invalidRecords: health.overall.totalInvalid
      },
      alerts: {
        total: metrics.alertCount,
        unacknowledged: 0 // Will be calculated if needed
      }
    };

    return sendSuccessResponse(res, 'SYSTEM_STATUS_RETRIEVED', status);
  } catch (err) {
    console.error(`Error retrieving system status: ${err.message}`);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

/**
 * Clear old monitoring data
 */
async function clearOldData(req, res, next) {
  try {
    const options = {
      keepDays: parseInt(req.query.keepDays) || 30,
      keepAlerts: parseInt(req.query.keepAlerts) || 100,
      keepPerformanceData: parseInt(req.query.keepPerformanceData) || 1000
    };

    dateMonitoringService.clearOldData(options);
    
    const metrics = dateMonitoringService.getMetrics();
    return sendSuccessResponse(res, 'OLD_DATA_CLEARED', {
      clearedWith: options,
      remainingMetrics: metrics
    });
  } catch (err) {
    console.error(`Error clearing old data: ${err.message}`);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

/**
 * Export monitoring data
 */
async function exportData(req, res, next) {
  try {
    const format = req.query.format || 'json';
    
    if (!['json', 'csv'].includes(format)) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{
        message: 'Format must be either "json" or "csv"'
      }]);
    }

    const exportedData = dateMonitoringService.exportData(format);
    
    // Set appropriate headers for download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `date-monitoring-${timestamp}.${format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
    
    res.send(exportedData);
  } catch (err) {
    console.error(`Error exporting monitoring data: ${err.message}`);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

/**
 * Run comprehensive health check
 */
async function runHealthCheck(req, res, next) {
  try {
    const includeConsistencyCheck = req.query.includeConsistencyCheck === 'true';
    
    const healthCheck = {
      timestamp: new Date().toISOString(),
      monitoring: dateMonitoringService.getMetrics(),
      database: await dateMonitoringService.getDatabaseHealthMetrics()
    };

    if (includeConsistencyCheck) {
      console.log('Running date consistency check...');
      healthCheck.consistency = await dateConsistencyService.performConsistencyCheck();
    }

    // Calculate overall health score
    const dbScore = parseFloat(healthCheck.database.overall.healthScore);
    const monitoringStatus = healthCheck.monitoring.status;
    
    let overallStatus = 'healthy';
    if (dbScore < 70 || monitoringStatus === 'critical') {
      overallStatus = 'critical';
    } else if (dbScore < 85 || monitoringStatus === 'warning') {
      overallStatus = 'warning';
    }

    healthCheck.overall = {
      status: overallStatus,
      score: dbScore,
      recommendations: _generateRecommendations(healthCheck)
    };

    return sendSuccessResponse(res, 'HEALTH_CHECK_COMPLETED', healthCheck);
  } catch (err) {
    console.error(`Error running health check: ${err.message}`);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

/**
 * Get monitoring alerts
 */
async function getAlerts(req, res, next) {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const onlyUnacknowledged = req.query.onlyUnacknowledged === 'true';
    
    const report = await dateMonitoringService.getMonitoringReport({
      includeDailyStats: false,
      includeAlerts: true,
      includePerformanceData: false,
      includeSystemHealth: false
    });

    let alerts = report.alerts || [];
    
    if (onlyUnacknowledged) {
      alerts = alerts.filter(alert => !alert.acknowledged);
    }
    
    alerts = alerts.slice(0, limit);

    return sendSuccessResponse(res, 'ALERTS_RETRIEVED', {
      alerts,
      total: alerts.length,
      unacknowledged: alerts.filter(a => !a.acknowledged).length
    });
  } catch (err) {
    console.error(`Error retrieving alerts: ${err.message}`);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

/**
 * Acknowledge an alert
 */
async function acknowledgeAlert(req, res, next) {
  try {
    const { alertId } = req.params;
    
    if (!alertId) {
      return sendErrorResponse(res, 'VALIDATION_ERROR', [{
        message: 'Alert ID is required'
      }]);
    }

    // In a real implementation, you'd update the alert in the monitoring service
    // For now, we'll just log the acknowledgment
    dateMonitoringService.logDateOperation('alert_acknowledged', {
      alertId,
      acknowledgedBy: req.user?.id || 'unknown',
      acknowledgedAt: new Date().toISOString()
    });

    return sendSuccessResponse(res, 'ALERT_ACKNOWLEDGED', {
      alertId,
      acknowledgedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error(`Error acknowledging alert: ${err.message}`);
    return sendErrorResponse(res, 'INTERNAL_SERVER_ERROR', err.message);
  }
}

/**
 * Generate health recommendations based on metrics
 * @private
 */
function _generateRecommendations(healthCheck) {
  const recommendations = [];
  
  const dbScore = parseFloat(healthCheck.database.overall.healthScore);
  const invalidRecords = healthCheck.database.overall.totalInvalid;
  
  if (dbScore < 90) {
    recommendations.push({
      type: 'database_health',
      priority: dbScore < 70 ? 'high' : 'medium',
      message: `Database health score is ${dbScore}%. Consider running data consistency fixes.`,
      action: 'Run consistency check and fix any date inconsistencies'
    });
  }

  if (invalidRecords > 0) {
    recommendations.push({
      type: 'data_integrity',
      priority: invalidRecords > 100 ? 'high' : 'medium',
      message: `Found ${invalidRecords} records with invalid dates.`,
      action: 'Run date consistency service to fix invalid date records'
    });
  }

  const failureRate = healthCheck.monitoring.validationFailures;
  if (failureRate > 50) {
    recommendations.push({
      type: 'validation_failures',
      priority: 'medium',
      message: `High number of validation failures (${failureRate}).`,
      action: 'Review validation logs and strengthen input validation'
    });
  }

  if (healthCheck.consistency && healthCheck.consistency.summary.invalid > 0) {
    recommendations.push({
      type: 'consistency_issues',
      priority: 'high',
      message: `Found ${healthCheck.consistency.summary.invalid} consistency issues.`,
      action: 'Review consistency report and run automated fixes'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'maintenance',
      priority: 'low',
      message: 'System health is good. Continue regular monitoring.',
      action: 'Schedule regular health checks and maintain current practices'
    });
  }

  return recommendations;
}