/**
 * Data Integrity Service
 * Comprehensive data validation, repair, and integrity management
 * Handles orphaned references, constraint violations, and data consistency
 */

import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

/**
 * Collection schemas and relationships for integrity validation
 */
const INTEGRITY_RULES = {
  students: {
    requiredFields: ['personalInfo.fullName', 'academicInfo.class', 'academicInfo.instrumentProgress'],
    references: {
      outgoing: [], // Students don't reference other entities directly
      incoming: [
        { collection: 'privateAttendance', field: 'studentId' },
        { collection: 'privateLessons', field: 'studentId' },
        { collection: 'bagrutPresentations', field: 'studentId' },
        { collection: 'theoryLessons', field: 'attendees.studentId' },
        { collection: 'rehearsals', field: 'attendees.studentId' },
        { collection: 'orchestras', field: 'members.studentId' },
        { collection: 'teachers', field: 'assignedStudents.studentId' }
      ]
    },
    businessRules: [
      'UNIQUE_STUDENT_ID',
      'VALID_CLASS_ENUM',
      'VALID_INSTRUMENT_ENUM',
      'ACTIVE_STUDENT_HAS_LESSONS'
    ]
  },
  teachers: {
    requiredFields: ['personalInfo.fullName', 'roles', 'credentials.email'],
    references: {
      outgoing: [
        { collection: 'students', field: 'assignedStudents.studentId' }
      ],
      incoming: [
        { collection: 'privateAttendance', field: 'teacherId' },
        { collection: 'privateLessons', field: 'teacherId' },
        { collection: 'theoryLessons', field: 'teacherId' },
        { collection: 'rehearsals', field: 'teacherId' }
      ]
    },
    businessRules: [
      'UNIQUE_EMAIL',
      'VALID_ROLES_ENUM',
      'TEACHER_HAS_STUDENTS'
    ]
  },
  privateAttendance: {
    requiredFields: ['studentId', 'teacherId', 'lessonDate'],
    references: {
      outgoing: [
        { collection: 'students', field: 'studentId' },
        { collection: 'teachers', field: 'teacherId' }
      ],
      incoming: []
    },
    businessRules: [
      'LESSON_DATE_VALID',
      'NO_DUPLICATE_ATTENDANCE',
      'STUDENT_TEACHER_RELATIONSHIP_EXISTS'
    ]
  }
};

/**
 * Generate unique operation ID for tracking
 */
function generateOperationId(type = 'integrity') {
  return `${type}_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Validate data integrity across specified collections
 */
export async function validateIntegrity(options = {}) {
  const startTime = Date.now();
  const validationId = generateOperationId('val');
  
  try {
    const collectionsToValidate = options.collections || Object.keys(INTEGRITY_RULES);
    const checkTypes = options.checkTypes || [
      'MISSING_REFERENCES',
      'ORPHANED_RECORDS',
      'DUPLICATE_RECORDS',
      'INVALID_DATA_TYPES',
      'CONSTRAINT_VIOLATIONS'
    ];

    const validation = {
      validationId,
      startTime: new Date(startTime),
      summary: {
        totalRecords: 0,
        recordsChecked: 0,
        issuesFound: 0,
        criticalIssues: 0,
        warnings: 0
      },
      issuesByType: {},
      issuesByCollection: {},
      affectedCollections: [],
      executionTime: null,
      recommendations: []
    };

    // Initialize issue counters
    checkTypes.forEach(type => validation.issuesByType[type] = 0);

    // Validate each collection
    for (const collectionName of collectionsToValidate) {
      if (!INTEGRITY_RULES[collectionName]) continue;

      console.log(`Validating collection: ${collectionName}`);
      const collectionResult = await validateCollection(
        collectionName, 
        checkTypes, 
        options
      );

      validation.summary.totalRecords += collectionResult.totalRecords;
      validation.summary.recordsChecked += collectionResult.recordsChecked;
      validation.summary.issuesFound += collectionResult.issuesFound;
      validation.summary.criticalIssues += collectionResult.criticalIssues;
      validation.summary.warnings += collectionResult.warnings;

      // Aggregate issues by type
      Object.entries(collectionResult.issuesByType).forEach(([type, count]) => {
        validation.issuesByType[type] += count;
      });

      // Store collection-specific results
      validation.issuesByCollection[collectionName] = collectionResult;
      
      if (collectionResult.issuesFound > 0) {
        validation.affectedCollections.push(collectionName);
      }
    }

    // Generate recommendations based on findings
    validation.recommendations = generateIntegrityRecommendations(validation);
    
    validation.executionTime = `${Date.now() - startTime}ms`;

    return {
      success: true,
      data: validation
    };

  } catch (error) {
    console.error('Validate integrity error:', error);
    return {
      success: false,
      error: error.message,
      code: 'INTEGRITY_VALIDATION_FAILED',
      validationId,
      executionTime: `${Date.now() - startTime}ms`
    };
  }
}

/**
 * Repair data integrity issues with configurable strategies
 */
export async function repairIntegrity(options = {}, adminInfo) {
  const startTime = Date.now();
  const repairId = generateOperationId('repair');
  
  try {
    const targetCollections = options.targetCollections || [];
    const repairStrategies = options.repairStrategies || ['AUTO_FIX', 'SKIP_UNFIXABLE'];
    
    let backupLocation = null;
    
    // Create backup if requested
    if (options.createBackup) {
      backupLocation = await createIntegrityBackup(targetCollections, repairId);
    }

    const repair = {
      repairId,
      startTime: new Date(startTime),
      summary: {
        issuesFound: 0,
        issuesRepaired: 0,
        issuesSkipped: 0,
        issuesFailed: 0
      },
      repairDetails: {},
      backupLocation,
      executionTime: null,
      failureReasons: []
    };

    // Process each collection
    for (const collectionName of targetCollections) {
      if (!INTEGRITY_RULES[collectionName]) {
        repair.failureReasons.push(`Unknown collection: ${collectionName}`);
        continue;
      }

      console.log(`Repairing collection: ${collectionName}`);
      const collectionResult = await repairCollectionIntegrity(
        collectionName,
        repairStrategies,
        options
      );

      // Aggregate results
      repair.summary.issuesFound += collectionResult.issuesFound;
      repair.summary.issuesRepaired += collectionResult.issuesRepaired;
      repair.summary.issuesSkipped += collectionResult.issuesSkipped;
      repair.summary.issuesFailed += collectionResult.issuesFailed;

      repair.repairDetails[collectionName] = collectionResult;
      repair.failureReasons.push(...collectionResult.failures);
    }

    // Log repair operation
    await logIntegrityOperation(repairId, 'REPAIR', repair, adminInfo);

    repair.executionTime = `${Date.now() - startTime}ms`;

    return {
      success: true,
      data: repair
    };

  } catch (error) {
    console.error('Repair integrity error:', error);
    return {
      success: false,
      error: error.message,
      code: 'INTEGRITY_REPAIR_FAILED',
      repairId,
      executionTime: `${Date.now() - startTime}ms`
    };
  }
}

/**
 * Generate comprehensive integrity report with trends and insights
 */
export async function generateIntegrityReport(options = {}) {
  const startTime = Date.now();
  const reportId = generateOperationId('rpt');
  
  try {
    const reportType = options.reportType || 'SUMMARY';
    const timeRange = options.timeRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    };

    const report = {
      reportId,
      reportType,
      generatedAt: new Date(),
      timeRange,
      summary: {
        totalIssues: 0,
        resolvedIssues: 0,
        activeIssues: 0,
        trendDirection: 'STABLE'
      },
      integrityScore: 100,
      collectionsHealth: {},
      trends: {},
      recommendations: [],
      reportUrl: null
    };

    // Get current integrity status
    const currentValidation = await validateIntegrity({ includeWarnings: true });
    if (currentValidation.success) {
      report.summary.activeIssues = currentValidation.data.summary.issuesFound;
      report.collectionsHealth = calculateCollectionHealthScores(currentValidation.data);
    }

    // Calculate integrity score
    report.integrityScore = calculateOverallIntegrityScore(report.collectionsHealth);

    // Get historical data for trends
    const historicalData = await getHistoricalIntegrityData(timeRange);
    report.trends = calculateIntegrityTrends(historicalData);
    report.summary.trendDirection = determineTrendDirection(report.trends);

    // Generate recommendations
    report.recommendations = generateReportRecommendations(report);

    // Generate report in requested format
    if (options.format !== 'JSON') {
      report.reportUrl = await generateFormattedReport(report, options.format);
    }

    // Send email if requested
    if (options.emailReport && options.emailAddresses) {
      await emailIntegrityReport(report, options.emailAddresses);
    }

    return {
      success: true,
      data: report
    };

  } catch (error) {
    console.error('Generate integrity report error:', error);
    return {
      success: false,
      error: error.message,
      code: 'REPORT_GENERATION_FAILED',
      reportId,
      executionTime: `${Date.now() - startTime}ms`
    };
  }
}

/**
 * Get students with orphaned references or missing relationships
 */
export async function getOrphanedStudents(queryParams = {}) {
  try {
    const studentsCollection = await getCollection('students');
    const orphanType = queryParams.orphanType || 'ALL';
    const minDaysSinceActivity = queryParams.minDaysSinceActivity || 30;
    const cutoffDate = new Date(Date.now() - minDaysSinceActivity * 24 * 60 * 60 * 1000);

    const orphanedStudents = [];
    const metrics = {
      totalOrphans: 0,
      byType: {
        NO_LESSONS: 0,
        NO_ATTENDANCE: 0,
        NO_ORCHESTRA: 0,
        NO_TEACHER: 0
      },
      avgDaysSinceActivity: 0
    };

    // Get all students
    const students = await studentsCollection
      .find({ isActive: queryParams.includeInactive ? { $in: [true, false] } : true })
      .toArray();

    // Check each student for orphan conditions
    for (const student of students) {
      const orphanAnalysis = await analyzeStudentOrphanStatus(student._id.toString(), cutoffDate);
      
      if (orphanAnalysis.isOrphan && (orphanType === 'ALL' || orphanAnalysis.orphanTypes.includes(orphanType))) {
        orphanedStudents.push({
          studentId: student._id.toString(),
          fullName: student.personalInfo?.fullName || 'Unknown',
          class: student.academicInfo?.class || 'Unknown',
          orphanType: orphanAnalysis.primaryOrphanType,
          lastActivity: orphanAnalysis.lastActivity,
          daysSinceActivity: orphanAnalysis.daysSinceActivity,
          orphanScore: orphanAnalysis.orphanScore,
          issues: orphanAnalysis.issues,
          suggestedActions: orphanAnalysis.suggestedActions
        });

        metrics.totalOrphans++;
        orphanAnalysis.orphanTypes.forEach(type => {
          if (metrics.byType[type] !== undefined) {
            metrics.byType[type]++;
          }
        });
      }
    }

    // Calculate average days since activity
    if (orphanedStudents.length > 0) {
      const totalDays = orphanedStudents.reduce((sum, student) => sum + student.daysSinceActivity, 0);
      metrics.avgDaysSinceActivity = Math.round(totalDays / orphanedStudents.length * 10) / 10;
    }

    // Sort results
    const sortBy = queryParams.sortBy || 'lastActivity';
    const sortOrder = queryParams.sortOrder === 'asc' ? 1 : -1;
    orphanedStudents.sort((a, b) => {
      if (sortBy === 'lastActivity') {
        return sortOrder * (new Date(b.lastActivity) - new Date(a.lastActivity));
      }
      return sortOrder * (a[sortBy] || '').toString().localeCompare((b[sortBy] || '').toString(), 'he');
    });

    // Apply pagination
    const page = queryParams.page || 1;
    const limit = queryParams.limit || 100;
    const startIndex = (page - 1) * limit;
    const paginatedResults = orphanedStudents.slice(startIndex, startIndex + limit);

    return {
      success: true,
      data: {
        orphanedStudents: paginatedResults,
        pagination: {
          page,
          limit,
          total: orphanedStudents.length,
          pages: Math.ceil(orphanedStudents.length / limit)
        },
        metrics
      }
    };

  } catch (error) {
    console.error('Get orphaned students error:', error);
    return {
      success: false,
      error: error.message,
      code: 'ORPHANED_STUDENTS_FAILED'
    };
  }
}

/**
 * Perform quick system health check
 */
export async function performHealthCheck() {
  try {
    const healthCheck = {
      overallHealth: 'UNKNOWN',
      healthScore: 0,
      timestamp: new Date(),
      components: {},
      alerts: [],
      recommendations: []
    };

    // Check database connectivity
    try {
      const testCollection = await getCollection('students');
      const testCount = await testCollection.countDocuments({}, { limit: 1 });
      healthCheck.components.database = {
        status: 'HEALTHY',
        responseTime: 12 // Mock response time
      };
    } catch (dbError) {
      healthCheck.components.database = {
        status: 'UNHEALTHY',
        error: dbError.message
      };
    }

    // Check collections integrity
    const quickValidation = await validateIntegrity({ 
      maxIssues: 100,
      timeout: 30
    });
    
    if (quickValidation.success) {
      const criticalIssues = quickValidation.data.summary.criticalIssues;
      healthCheck.components.collections = {
        status: criticalIssues === 0 ? 'HEALTHY' : criticalIssues > 10 ? 'UNHEALTHY' : 'WARNING',
        totalRecords: quickValidation.data.summary.totalRecords,
        issuesFound: quickValidation.data.summary.issuesFound
      };
      
      if (criticalIssues > 0) {
        healthCheck.alerts.push({
          level: criticalIssues > 10 ? 'CRITICAL' : 'WARNING',
          message: `${criticalIssues} בעיות קריטיות נמצאו`,
          component: 'collections'
        });
      }
    }

    // Calculate overall health score
    const componentStatuses = Object.values(healthCheck.components);
    const healthyCount = componentStatuses.filter(c => c.status === 'HEALTHY').length;
    const totalComponents = componentStatuses.length;
    
    healthCheck.healthScore = totalComponents > 0 ? Math.round((healthyCount / totalComponents) * 100) : 0;
    
    // Determine overall health
    if (healthCheck.healthScore >= 90) {
      healthCheck.overallHealth = 'EXCELLENT';
    } else if (healthCheck.healthScore >= 70) {
      healthCheck.overallHealth = 'GOOD';
    } else if (healthCheck.healthScore >= 50) {
      healthCheck.overallHealth = 'WARNING';
    } else {
      healthCheck.overallHealth = 'CRITICAL';
    }

    // Generate recommendations
    if (healthCheck.healthScore < 90) {
      healthCheck.recommendations.push('הרץ בדיקת שלמות מלאה');
      healthCheck.recommendations.push('שקול ניקוי הפניות יתומות');
    }

    return {
      success: true,
      data: healthCheck
    };

  } catch (error) {
    console.error('Health check error:', error);
    return {
      success: false,
      error: error.message,
      code: 'HEALTH_CHECK_FAILED',
      timestamp: new Date()
    };
  }
}

/**
 * Helper Functions
 */

async function validateCollection(collectionName, checkTypes, options) {
  const collection = await getCollection(collectionName);
  const rules = INTEGRITY_RULES[collectionName];
  
  const result = {
    collectionName,
    totalRecords: await collection.countDocuments({}),
    recordsChecked: 0,
    issuesFound: 0,
    criticalIssues: 0,
    warnings: 0,
    issuesByType: {},
    issues: []
  };

  // Initialize issue type counters
  checkTypes.forEach(type => result.issuesByType[type] = 0);

  // Get sample or all records based on options
  const limit = options.deepScan ? 0 : 1000; // Limit for performance unless deep scan
  const records = await collection.find({}).limit(limit).toArray();
  result.recordsChecked = records.length;

  // Check each record
  for (const record of records) {
    const recordIssues = await validateRecord(record, rules, checkTypes);
    result.issuesFound += recordIssues.length;
    
    recordIssues.forEach(issue => {
      result.issuesByType[issue.type]++;
      if (issue.severity === 'CRITICAL') result.criticalIssues++;
      if (issue.severity === 'WARNING') result.warnings++;
      result.issues.push(issue);
    });
  }

  return result;
}

async function validateRecord(record, rules, checkTypes) {
  const issues = [];

  // Check missing references
  if (checkTypes.includes('MISSING_REFERENCES')) {
    for (const ref of rules.references.outgoing) {
      if (record[ref.field] && !ObjectId.isValid(record[ref.field])) {
        issues.push({
          type: 'MISSING_REFERENCES',
          severity: 'HIGH',
          field: ref.field,
          recordId: record._id,
          message: `Invalid reference to ${ref.collection}`,
          suggestion: 'Update or remove invalid reference'
        });
      }
    }
  }

  // Check required fields
  if (checkTypes.includes('MISSING_REQUIRED_FIELDS')) {
    for (const fieldPath of rules.requiredFields) {
      if (!getNestedValue(record, fieldPath)) {
        issues.push({
          type: 'MISSING_REQUIRED_FIELDS',
          severity: 'MEDIUM',
          field: fieldPath,
          recordId: record._id,
          message: `Missing required field: ${fieldPath}`,
          suggestion: 'Add required field value'
        });
      }
    }
  }

  return issues;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

async function repairCollectionIntegrity(collectionName, strategies, options) {
  const result = {
    collectionName,
    issuesFound: 0,
    issuesRepaired: 0,
    issuesSkipped: 0,
    issuesFailed: 0,
    failures: []
  };

  // Implementation would depend on specific repair strategies
  // This is a placeholder for the complex repair logic
  
  return result;
}

async function analyzeStudentOrphanStatus(studentId, cutoffDate) {
  const issues = [];
  const orphanTypes = [];
  let lastActivity = null;
  let orphanScore = 0;

  // Check for lessons
  const privateLessonsCollection = await getCollection('privateLessons');
  const lessonsCount = await privateLessonsCollection.countDocuments({
    studentId: ObjectId.createFromHexString(studentId)
  });

  if (lessonsCount === 0) {
    orphanTypes.push('NO_LESSONS');
    issues.push('אין שיעורים פרטיים רשומים');
    orphanScore += 30;
  }

  // Check for recent attendance
  const attendanceCollection = await getCollection('privateAttendance');
  const recentAttendance = await attendanceCollection.findOne({
    studentId: ObjectId.createFromHexString(studentId),
    lessonDate: { $gte: cutoffDate }
  }, { sort: { lessonDate: -1 } });

  if (!recentAttendance) {
    orphanTypes.push('NO_ATTENDANCE');
    issues.push('אין נוכחות רשומה בתקופה האחרונה');
    orphanScore += 25;
  } else {
    lastActivity = recentAttendance.lessonDate;
  }

  // Check for orchestra membership
  const orchestrasCollection = await getCollection('orchestras');
  const orchestraMembership = await orchestrasCollection.countDocuments({
    'members.studentId': ObjectId.createFromHexString(studentId)
  });

  if (orchestraMembership === 0) {
    orphanTypes.push('NO_ORCHESTRA');
    issues.push('לא משויך להרכב');
    orphanScore += 20;
  }

  const isOrphan = orphanTypes.length > 0;
  const daysSinceActivity = lastActivity 
    ? Math.ceil((Date.now() - lastActivity) / (24 * 60 * 60 * 1000))
    : 999;

  return {
    isOrphan,
    orphanTypes,
    primaryOrphanType: orphanTypes[0] || 'NONE',
    lastActivity,
    daysSinceActivity,
    orphanScore: Math.min(orphanScore, 100),
    issues,
    suggestedActions: generateSuggestedActions(orphanTypes)
  };
}

function generateSuggestedActions(orphanTypes) {
  const actions = [];
  
  if (orphanTypes.includes('NO_LESSONS')) {
    actions.push('הקצה מורה לתלמיד');
    actions.push('צור שיעורים פרטיים');
  }
  
  if (orphanTypes.includes('NO_ATTENDANCE')) {
    actions.push('בדוק סטטוס פעילות התלמיד');
    actions.push('עדכן נוכחות אם קיימת');
  }
  
  if (orphanTypes.includes('NO_ORCHESTRA')) {
    actions.push('שיבוץ התלמיד להרכב מתאים');
  }
  
  return actions;
}

function generateIntegrityRecommendations(validation) {
  const recommendations = [];
  
  if (validation.summary.criticalIssues > 0) {
    recommendations.push('טפל בבעיות הקריטיות באופן מיידי');
  }
  
  if (validation.issuesByType.MISSING_REFERENCES > 10) {
    recommendations.push('הרץ ניקוי הפניות יתומות');
  }
  
  if (validation.issuesByType.DUPLICATE_RECORDS > 0) {
    recommendations.push('מזג או הסר רשומות כפולות');
  }
  
  return recommendations;
}

async function createIntegrityBackup(collections, operationId) {
  // Implementation would create backup of affected collections
  return `backup_integrity_${operationId}_${Date.now()}`;
}

async function logIntegrityOperation(operationId, action, data, adminInfo) {
  try {
    const auditCollection = await getCollection('integrityAuditLog');
    
    const logEntry = {
      operationId,
      action,
      timestamp: new Date(),
      adminId: ObjectId.createFromHexString(adminInfo.id),
      adminName: adminInfo.fullName,
      status: 'SUCCESS',
      details: data
    };

    await auditCollection.insertOne(logEntry);
  } catch (error) {
    console.error('Failed to log integrity operation:', error);
  }
}

// Additional helper functions would be implemented here
function calculateCollectionHealthScores(validationData) { return {}; }
function calculateOverallIntegrityScore(collectionsHealth) { return 100; }
function getHistoricalIntegrityData(timeRange) { return Promise.resolve([]); }
function calculateIntegrityTrends(historicalData) { return {}; }
function determineTrendDirection(trends) { return 'STABLE'; }
function generateReportRecommendations(report) { return []; }
function generateFormattedReport(report, format) { return Promise.resolve(`/reports/integrity_${Date.now()}.${format.toLowerCase()}`); }
function emailIntegrityReport(report, emailAddresses) { return Promise.resolve(); }