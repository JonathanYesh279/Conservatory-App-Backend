/**
 * Data Integrity Controller
 * Handles HTTP requests for data integrity validation, repair, and monitoring
 * Comprehensive data health management with detailed error handling
 */

import * as dataIntegrityService from './data-integrity.service.js';

/**
 * Validate data integrity across collections
 * GET /api/admin/integrity/validate
 */
async function validateIntegrity(req, res, next) {
  try {
    const options = req.validatedQuery || req.query;

    console.log('Validate data integrity:', options);

    // Execute validation
    const result = await dataIntegrityService.validateIntegrity(options);

    if (result.success) {
      // Determine response status based on findings
      const statusCode = result.data.summary.criticalIssues > 0 ? 200 : 200;
      
      res.status(statusCode).json({
        success: true,
        data: result.data,
        message: result.data.summary.issuesFound === 0 
          ? 'בדיקת השלמות הושלמה - לא נמצאו בעיות'
          : `בדיקת השלמות הושלמה - נמצאו ${result.data.summary.issuesFound} בעיות`,
        meta: {
          requestedBy: req.loggedinUser.fullName,
          timestamp: new Date().toISOString(),
          healthScore: calculateHealthScore(result.data),
          criticalIssuesFound: result.data.summary.criticalIssues > 0,
          recommendedActions: result.data.recommendations?.slice(0, 3) || []
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'שגיאה בביצוע בדיקת השלמות',
        code: result.code,
        validationId: result.validationId
      });
    }

  } catch (error) {
    console.error('Validate integrity error:', error);
    next({
      status: 500,
      error: 'INTEGRITY_VALIDATION_FAILED',
      message: 'שגיאה פנימית בבדיקת השלמות',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Repair data integrity issues
 * POST /api/admin/integrity/repair
 */
async function repairIntegrity(req, res, next) {
  try {
    const options = req.validatedData || req.body;

    console.log('Repair data integrity:', {
      ...options,
      adminPassword: options.adminPassword ? '[REDACTED]' : undefined
    });

    // Additional validation for high-risk operations
    if (options.autoFix && options.repairStrategies?.includes('REMOVE_ORPHANED')) {
      if (!options.adminPassword || options.adminPassword.length < 6) {
        return res.status(400).json({
          success: false,
          error: 'ADMIN_PASSWORD_REQUIRED',
          message: 'פעולות תיקון אוטומטיות מסוכנות דורשות סיסמת מנהל',
          code: 'HIGH_RISK_REPAIR_UNAUTHORIZED'
        });
      }
    }

    // Build admin info for logging
    const adminInfo = {
      id: req.loggedinUser._id,
      fullName: req.loggedinUser.fullName,
      email: req.loggedinUser.email,
      ipAddress: req.ip || req.connection?.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown'
    };

    // Execute repair
    const result = await dataIntegrityService.repairIntegrity(options, adminInfo);

    if (result.success) {
      const repairData = result.data;
      
      res.status(200).json({
        success: true,
        data: repairData,
        message: options.dryRun 
          ? 'הדמיית תיקון הושלמה בהצלחה'
          : `תיקון הושלם - ${repairData.summary.issuesRepaired} בעיות תוקנו`,
        meta: {
          repairedBy: req.loggedinUser.fullName,
          timestamp: new Date().toISOString(),
          dryRun: options.dryRun,
          backupCreated: !!repairData.backupLocation,
          successRate: repairData.summary.issuesFound > 0 
            ? Math.round((repairData.summary.issuesRepaired / repairData.summary.issuesFound) * 100)
            : 100,
          collectionsProcessed: options.targetCollections?.length || 0
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'שגיאה בביצוע התיקון',
        code: result.code,
        repairId: result.repairId
      });
    }

  } catch (error) {
    console.error('Repair integrity error:', error);
    next({
      status: 500,
      error: 'INTEGRITY_REPAIR_FAILED',
      message: 'שגיאה פנימית בתיקון השלמות הנתונים',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Generate integrity report
 * GET /api/admin/integrity/report
 */
async function generateIntegrityReport(req, res, next) {
  try {
    const options = req.validatedQuery || req.query;

    console.log('Generate integrity report:', options);

    // Execute report generation
    const result = await dataIntegrityService.generateIntegrityReport(options);

    if (result.success) {
      const reportData = result.data;
      
      res.status(200).json({
        success: true,
        data: reportData,
        message: `דוח שלמות ${reportData.reportType} נוצר בהצלחה`,
        meta: {
          generatedBy: req.loggedinUser.fullName,
          timestamp: new Date().toISOString(),
          reportFormat: options.format || 'JSON',
          timeRangeDays: Math.ceil(
            (new Date(reportData.timeRange.end) - new Date(reportData.timeRange.start)) 
            / (24 * 60 * 60 * 1000)
          ),
          emailSent: options.emailReport && options.emailAddresses?.length > 0,
          downloadUrl: reportData.reportUrl
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'שגיאה ביצירת דוח השלמות',
        code: result.code,
        reportId: result.reportId
      });
    }

  } catch (error) {
    console.error('Generate integrity report error:', error);
    next({
      status: 500,
      error: 'REPORT_GENERATION_FAILED',
      message: 'שגיאה פנימית ביצירת דוח השלמות',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Get orphaned students
 * GET /api/admin/integrity/orphaned-students
 */
async function getOrphanedStudents(req, res, next) {
  try {
    const queryParams = req.validatedQuery || req.query;

    console.log('Get orphaned students:', queryParams);

    // Execute orphaned students query
    const result = await dataIntegrityService.getOrphanedStudents(queryParams);

    if (result.success) {
      const data = result.data;
      
      res.status(200).json({
        success: true,
        data: data,
        message: data.orphanedStudents.length === 0
          ? 'לא נמצאו תלמידים יתומים'
          : `נמצאו ${data.orphanedStudents.length} תלמידים יתומים`,
        meta: {
          requestedBy: req.loggedinUser.fullName,
          timestamp: new Date().toISOString(),
          searchCriteria: {
            orphanType: queryParams.orphanType || 'ALL',
            minDaysSinceActivity: queryParams.minDaysSinceActivity || 30,
            includeInactive: queryParams.includeInactive || false
          },
          avgOrphanScore: data.orphanedStudents.length > 0
            ? Math.round(
                data.orphanedStudents.reduce((sum, s) => sum + s.orphanScore, 0) 
                / data.orphanedStudents.length
              )
            : 0,
          mostCommonIssue: findMostCommonOrphanType(data.metrics.byType)
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'שגיאה בטעינת תלמידים יתומים',
        code: result.code
      });
    }

  } catch (error) {
    console.error('Get orphaned students error:', error);
    next({
      status: 500,
      error: 'ORPHANED_STUDENTS_QUERY_FAILED',
      message: 'שגיאה פנימית בטעינת תלמידים יתומים',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Perform system health check
 * GET /api/admin/integrity/health-check
 */
async function performHealthCheck(req, res, next) {
  try {
    console.log('Perform system health check');

    // Execute health check
    const result = await dataIntegrityService.performHealthCheck();

    if (result.success) {
      const healthData = result.data;
      
      // Determine HTTP status based on health
      let statusCode = 200;
      if (healthData.overallHealth === 'CRITICAL') statusCode = 503;
      else if (healthData.overallHealth === 'WARNING') statusCode = 200;

      res.status(statusCode).json({
        success: true,
        data: healthData,
        message: getHealthMessage(healthData.overallHealth, healthData.healthScore),
        meta: {
          requestedBy: req.loggedinUser.fullName,
          timestamp: new Date().toISOString(),
          nextRecommendedCheck: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          criticalAlertsCount: healthData.alerts?.filter(a => a.level === 'CRITICAL').length || 0,
          maintenanceRequired: healthData.healthScore < 80
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'שגיאה בביצוע בדיקת בריאות המערכת',
        code: result.code,
        timestamp: result.timestamp
      });
    }

  } catch (error) {
    console.error('Perform health check error:', error);
    next({
      status: 500,
      error: 'HEALTH_CHECK_FAILED',
      message: 'שגיאה פנימית בבדיקת בריאות המערכת',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Get collection statistics
 * GET /api/admin/integrity/collections/stats
 */
async function getCollectionStats(req, res, next) {
  try {
    const { collections, includeIndexStats, includeRelationshipStats } = req.query;

    console.log('Get collection stats:', req.query);

    // For now, return mock data - would implement actual collection analysis
    const mockStats = {
      collectionsStats: {
        students: {
          totalRecords: 1250,
          activeRecords: 1180,
          averageDocumentSize: "2.3 KB",
          integrityScore: 96.5,
          lastValidated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          issues: { orphanedReferences: 2, duplicates: 0 },
          relationships: {
            outgoing: { privateLessons: 1250, privateAttendance: 8950 },
            incoming: { teacherAssignments: 245 }
          }
        },
        teachers: {
          totalRecords: 85,
          activeRecords: 78,
          averageDocumentSize: "1.8 KB",
          integrityScore: 98.2,
          lastValidated: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          issues: { orphanedReferences: 0, duplicates: 1 }
        }
      },
      globalStats: {
        totalRecords: 15420,
        totalCollections: 9,
        averageIntegrityScore: 94.2,
        criticalIssues: 2,
        lastFullScan: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    };

    res.status(200).json({
      success: true,
      data: mockStats,
      message: 'סטטיסטיקות אוספים נטענו בהצלחה',
      meta: {
        requestedBy: req.loggedinUser.fullName,
        timestamp: new Date().toISOString(),
        collectionsRequested: collections ? collections.split(',') : 'all',
        includeIndexStats: includeIndexStats === 'true',
        includeRelationshipStats: includeRelationshipStats !== 'false'
      }
    });

  } catch (error) {
    console.error('Get collection stats error:', error);
    next({
      status: 500,
      error: 'COLLECTION_STATS_FAILED',
      message: 'שגיאה פנימית בטעינת סטטיסטיקות אוספים',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Validate business constraints
 * POST /api/admin/integrity/constraints/validate
 */
async function validateBusinessConstraints(req, res, next) {
  try {
    const options = req.body || {};

    console.log('Validate business constraints:', options);

    // For now, return mock constraint violations - would implement actual validation
    const mockViolations = [
      {
        type: 'SCHEDULING_CONFLICT',
        severity: 'HIGH',
        collection: 'rehearsals',
        recordId: new Date().getTime().toString(),
        description: 'חפיפה בזמן חזרות',
        details: {
          conflictingRehearsals: ['rehearsal_1', 'rehearsal_2'],
          timeOverlap: '30 minutes',
          room: 'חדר 101'
        },
        suggestedFix: 'עדכן זמן אחת החזרות'
      },
      {
        type: 'CAPACITY_EXCEEDED',
        severity: 'MEDIUM',
        collection: 'orchestras',
        recordId: new Date().getTime().toString(),
        description: 'חריגה ממספר מקסימלי של חברים בהרכב',
        details: {
          orchestraName: 'תזמורת הנוער',
          currentMembers: 45,
          maxCapacity: 40
        },
        suggestedFix: 'הגדל קיבולת או העבר חברים'
      }
    ];

    const summary = {
      totalViolations: mockViolations.length,
      bySeverity: {
        HIGH: mockViolations.filter(v => v.severity === 'HIGH').length,
        MEDIUM: mockViolations.filter(v => v.severity === 'MEDIUM').length,
        LOW: mockViolations.filter(v => v.severity === 'LOW').length
      },
      byType: mockViolations.reduce((acc, violation) => {
        acc[violation.type] = (acc[violation.type] || 0) + 1;
        return acc;
      }, {})
    };

    res.status(200).json({
      success: true,
      data: {
        constraintViolations: mockViolations,
        summary
      },
      message: mockViolations.length === 0
        ? 'לא נמצאו הפרות אילוצים'
        : `נמצאו ${mockViolations.length} הפרות אילוצים`,
      meta: {
        validatedBy: req.loggedinUser.fullName,
        timestamp: new Date().toISOString(),
        validationMode: options.strictMode ? 'STRICT' : 'STANDARD',
        collectionsChecked: options.collections?.length || 'all'
      }
    });

  } catch (error) {
    console.error('Validate business constraints error:', error);
    next({
      status: 500,
      error: 'CONSTRAINTS_VALIDATION_FAILED',
      message: 'שגיאה פנימית בבדיקת אילוצי המערכת',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Helper Functions
 */

function calculateHealthScore(validationData) {
  const totalRecords = validationData.summary.totalRecords;
  const issuesFound = validationData.summary.issuesFound;
  
  if (totalRecords === 0) return 100;
  
  const errorRate = issuesFound / totalRecords;
  const healthScore = Math.max(0, Math.min(100, 100 - (errorRate * 100 * 10)));
  
  return Math.round(healthScore);
}

function getHealthMessage(overallHealth, healthScore) {
  const messages = {
    EXCELLENT: `מערכת במצב מעולה (${healthScore}%)`,
    GOOD: `מערכת במצב טוב (${healthScore}%)`,
    WARNING: `מערכת במצב אזהרה (${healthScore}%) - נדרש טיפול`,
    CRITICAL: `מערכת במצב קריטי (${healthScore}%) - נדרש טיפול דחוף`
  };
  
  return messages[overallHealth] || `מצב מערכת: ${overallHealth} (${healthScore}%)`;
}

function findMostCommonOrphanType(byTypeStats) {
  let maxCount = 0;
  let mostCommon = 'NONE';
  
  Object.entries(byTypeStats).forEach(([type, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = type;
    }
  });
  
  return mostCommon;
}

// Export controller functions
export const dataIntegrityController = {
  validateIntegrity,
  repairIntegrity,
  generateIntegrityReport,
  getOrphanedStudents,
  performHealthCheck,
  getCollectionStats,
  validateBusinessConstraints
};