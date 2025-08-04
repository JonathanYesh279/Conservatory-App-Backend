/**
 * Date Monitoring Routes
 * Admin endpoints for monitoring date operations and system health
 */

import express from 'express';
import { requireAuth } from '../../middleware/auth.middleware.js';
import { dateMonitoringController } from './date-monitoring.controller.js';

const router = express.Router();

// All monitoring endpoints require admin access
const adminAuth = requireAuth(['מנהל']);

// GET /api/admin/date-monitoring/metrics - Get current metrics
router.get('/metrics', adminAuth, dateMonitoringController.getMetrics);

// GET /api/admin/date-monitoring/report - Get detailed monitoring report
router.get('/report', adminAuth, dateMonitoringController.getMonitoringReport);

// GET /api/admin/date-monitoring/database-health - Get database health metrics
router.get('/database-health', adminAuth, dateMonitoringController.getDatabaseHealth);

// GET /api/admin/date-monitoring/status - Get system status overview
router.get('/status', adminAuth, dateMonitoringController.getSystemStatus);

// GET /api/admin/date-monitoring/health-check - Run comprehensive health check
router.get('/health-check', adminAuth, dateMonitoringController.runHealthCheck);

// GET /api/admin/date-monitoring/alerts - Get monitoring alerts
router.get('/alerts', adminAuth, dateMonitoringController.getAlerts);

// PUT /api/admin/date-monitoring/alerts/:alertId/acknowledge - Acknowledge an alert
router.put('/alerts/:alertId/acknowledge', adminAuth, dateMonitoringController.acknowledgeAlert);

// DELETE /api/admin/date-monitoring/cleanup - Clear old monitoring data
router.delete('/cleanup', adminAuth, dateMonitoringController.clearOldData);

// GET /api/admin/date-monitoring/export - Export monitoring data
router.get('/export', adminAuth, dateMonitoringController.exportData);

export default router;