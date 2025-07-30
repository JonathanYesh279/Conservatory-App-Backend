/**
 * Admin Consistency Validation Controller
 * 
 * This controller provides admin endpoints for validating and maintaining
 * teacher-student lesson data consistency as outlined in the backend
 * synchronization guide.
 */

import { getCollection } from '../../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { teacherLessonsService } from '../teacher/teacher-lessons.service.js';
import { relationshipValidationService } from '../../services/relationshipValidationService.js';

export const consistencyValidationController = {
  validateTeacherStudentSync,
  getSystemConsistencyReport,
  repairDataInconsistencies,
  validateAllTeacherLessons,
  getDataIntegrityStats,
  performHealthCheck,
};

/**
 * Validate teacher-student synchronization across the system
 * @route POST /api/admin/validate-teacher-student-sync
 */
async function validateTeacherStudentSync(req, res) {
  try {
    console.log('🔍 Admin validation: Starting comprehensive teacher-student sync validation');

    const validation = {
      timestamp: new Date(),
      isValid: true,
      summary: {
        teachersAnalyzed: 0,
        studentsAnalyzed: 0,
        totalIssues: 0,
        criticalIssues: 0,
        warnings: 0
      },
      issues: [],
      recommendations: []
    };

    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    // Phase 1: Find students with teacherAssignments but missing from teacher.studentIds
    console.log('   📊 Phase 1: Analyzing student teacherAssignments...');
    
    const studentsWithAssignments = await studentCollection.aggregate([
      { 
        $match: { 
          teacherAssignments: { $exists: true, $ne: [] },
          isActive: { $ne: false }
        } 
      },
      { $unwind: '$teacherAssignments' },
      {
        $match: {
          'teacherAssignments.isActive': { $ne: false }
        }
      },
      { 
        $group: { 
          _id: '$teacherAssignments.teacherId',
          studentIds: { $addToSet: '$_id' },
          assignmentCount: { $sum: 1 }
        }
      }
    ]).toArray();

    validation.summary.studentsAnalyzed = studentsWithAssignments.length;

    for (const group of studentsWithAssignments) {
      const teacherId = group._id;
      
      if (!ObjectId.isValid(teacherId)) {
        validation.issues.push({
          type: 'INVALID_TEACHER_ID',
          severity: 'CRITICAL',
          teacherId,
          studentIds: group.studentIds.map(id => id.toString()),
          message: `Invalid teacher ID format: ${teacherId}`,
          impact: `${group.studentIds.length} students affected`
        });
        validation.summary.criticalIssues++;
        continue;
      }

      const teacher = await teacherCollection.findOne({
        _id: ObjectId.createFromHexString(teacherId)
      });

      if (!teacher) {
        validation.issues.push({
          type: 'TEACHER_NOT_FOUND',
          severity: 'CRITICAL',
          teacherId,
          studentIds: group.studentIds.map(id => id.toString()),
          message: `Teacher ${teacherId} not found in database`,
          impact: `${group.studentIds.length} students have orphaned assignments`
        });
        validation.summary.criticalIssues++;
        continue;
      }

      // Check bidirectional references
      const teacherStudentIds = teacher.teaching?.studentIds || [];
      const missingStudents = group.studentIds.filter(studentId => 
        !teacherStudentIds.includes(studentId.toString())
      );

      if (missingStudents.length > 0) {
        validation.issues.push({
          type: 'MISSING_BIDIRECTIONAL_REFERENCE',
          severity: 'HIGH',
          teacherId,
          teacherName: teacher.personalInfo?.fullName,
          missingStudents: missingStudents.map(id => id.toString()),
          message: `Teacher ${teacherId} missing ${missingStudents.length} student references in studentIds`,
          impact: 'Teacher lesson queries may not return complete results',
          fixable: true
        });
        validation.summary.totalIssues++;
      }
    }

    // Phase 2: Find teachers with studentIds but no corresponding student assignments
    console.log('   👨‍🏫 Phase 2: Analyzing teacher studentIds...');
    
    const teachersWithStudents = await teacherCollection.find({
      'teaching.studentIds': { $exists: true, $ne: [] },
      isActive: { $ne: false }
    }).toArray();

    validation.summary.teachersAnalyzed = teachersWithStudents.length;

    for (const teacher of teachersWithStudents) {
      const teacherId = teacher._id.toString();
      const teacherStudentIds = teacher.teaching?.studentIds || [];

      for (const studentId of teacherStudentIds) {
        if (!ObjectId.isValid(studentId)) {
          validation.issues.push({
            type: 'INVALID_STUDENT_ID',
            severity: 'HIGH',
            teacherId,
            teacherName: teacher.personalInfo?.fullName,
            studentId,
            message: `Teacher has invalid student ID: ${studentId}`,
            fixable: true
          });
          validation.summary.totalIssues++;
          continue;
        }

        const student = await studentCollection.findOne({
          _id: ObjectId.createFromHexString(studentId)
        });

        if (!student) {
          validation.issues.push({
            type: 'STUDENT_NOT_FOUND',
            severity: 'HIGH',
            teacherId,
            teacherName: teacher.personalInfo?.fullName,
            studentId,
            message: `Teacher references non-existent student: ${studentId}`,
            impact: 'Orphaned reference in teacher record',
            fixable: true
          });
          validation.summary.totalIssues++;
          continue;
        }

        // Check if student has corresponding assignment
        const hasAssignment = student.teacherAssignments?.some(assignment => 
          assignment.teacherId === teacherId && assignment.isActive !== false
        );

        if (!hasAssignment) {
          validation.issues.push({
            type: 'MISSING_STUDENT_ASSIGNMENT',
            severity: 'MEDIUM',
            teacherId,
            teacherName: teacher.personalInfo?.fullName,
            studentId,
            studentName: student.personalInfo?.fullName,
            message: `Teacher has student in studentIds but student has no active assignment`,
            impact: 'Data inconsistency, teacher may show in lists without actual lessons',
            fixable: true
          });
          validation.summary.warnings++;
        }
      }
    }

    // Phase 3: Check for incomplete assignment data
    console.log('   📋 Phase 3: Analyzing assignment completeness...');
    
    const incompleteAssignments = await studentCollection.aggregate([
      { 
        $match: { 
          teacherAssignments: { $exists: true, $ne: [] },
          isActive: { $ne: false }
        }
      },
      { $unwind: '$teacherAssignments' },
      {
        $match: {
          $or: [
            { 'teacherAssignments.day': { $exists: false } },
            { 'teacherAssignments.time': { $exists: false } },
            { 'teacherAssignments.duration': { $exists: false } },
            { 'teacherAssignments.day': null },
            { 'teacherAssignments.time': null },
            { 'teacherAssignments.duration': null }
          ]
        }
      },
      {
        $project: {
          studentId: '$_id',
          studentName: '$personalInfo.fullName',
          teacherId: '$teacherAssignments.teacherId',
          assignment: '$teacherAssignments'
        }
      }
    ]).toArray();

    if (incompleteAssignments.length > 0) {
      validation.issues.push({
        type: 'INCOMPLETE_ASSIGNMENTS',
        severity: 'HIGH',
        count: incompleteAssignments.length,
        message: `Found ${incompleteAssignments.length} incomplete teacher assignments`,
        impact: 'These assignments cannot be displayed properly in teacher schedules',
        details: incompleteAssignments.slice(0, 10), // Limit details for performance
        fixable: true
      });
      validation.summary.totalIssues++;
    }

    // Generate recommendations
    if (validation.summary.criticalIssues > 0) {
      validation.recommendations.push({
        priority: 'URGENT',
        action: 'RUN_DATA_REPAIR',
        message: `${validation.summary.criticalIssues} critical issues found. Run data repair immediately.`
      });
    }

    if (validation.summary.totalIssues > validation.summary.criticalIssues) {
      validation.recommendations.push({
        priority: 'HIGH',
        action: 'SCHEDULE_MAINTENANCE',
        message: `${validation.summary.totalIssues - validation.summary.criticalIssues} fixable issues found. Schedule maintenance window.`
      });
    }

    if (validation.summary.warnings > 10) {
      validation.recommendations.push({
        priority: 'MEDIUM',
        action: 'REVIEW_DATA_ENTRY',
        message: 'High number of warnings suggests data entry process improvements needed.'
      });
    }

    // Set overall validation result
    validation.isValid = validation.summary.criticalIssues === 0 && validation.summary.totalIssues < 5;

    const statusCode = validation.isValid ? 200 : (validation.summary.criticalIssues > 0 ? 500 : 400);

    res.status(statusCode).json({
      success: validation.isValid,
      data: validation,
      message: validation.isValid ? 
        'All teacher-student relationships are synchronized' : 
        `Found ${validation.summary.totalIssues + validation.summary.criticalIssues} consistency issues`
    });

  } catch (error) {
    console.error('❌ Admin validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate teacher-student synchronization',
      details: error.message
    });
  }
}

/**
 * Get comprehensive system consistency report
 * @route GET /api/admin/system-consistency-report
 */
async function getSystemConsistencyReport(req, res) {
  try {
    console.log('📊 Generating comprehensive system consistency report');

    const report = {
      timestamp: new Date(),
      systemHealth: 'HEALTHY',
      collections: {},
      dataIntegrity: {},
      performance: {},
      recommendations: []
    };

    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    // Collection statistics
    const [studentStats, teacherStats] = await Promise.all([
      studentCollection.stats(),
      teacherCollection.stats()
    ]);

    report.collections = {
      students: {
        totalDocuments: studentStats.count,
        dataSize: Math.round(studentStats.size / 1024 / 1024 * 100) / 100, // MB
        avgDocumentSize: Math.round(studentStats.avgObjSize),
        indexSize: Math.round(studentStats.totalIndexSize / 1024 / 1024 * 100) / 100, // MB
      },
      teachers: {
        totalDocuments: teacherStats.count,
        dataSize: Math.round(teacherStats.size / 1024 / 1024 * 100) / 100, // MB
        avgDocumentSize: Math.round(teacherStats.avgObjSize),
        indexSize: Math.round(teacherStats.totalIndexSize / 1024 / 1024 * 100) / 100, // MB
      }
    };

    // Data integrity analysis
    const integrityChecks = await Promise.all([
      // Active students with teacher assignments
      studentCollection.countDocuments({
        isActive: { $ne: false },
        teacherAssignments: { $exists: true, $ne: [] }
      }),
      
      // Active teachers with students
      teacherCollection.countDocuments({
        isActive: { $ne: false },
        'teaching.studentIds': { $exists: true, $ne: [] }
      }),
      
      // Students with orphaned teacher references
      studentCollection.aggregate([
        { $match: { teacherAssignments: { $exists: true, $ne: [] } } },
        { $unwind: '$teacherAssignments' },
        {
          $lookup: {
            from: 'teacher',
            localField: 'teacherAssignments.teacherId',
            foreignField: '_id',
            as: 'teacher'
          }
        },
        { $match: { teacher: { $size: 0 } } },
        { $count: 'orphanedAssignments' }
      ]).toArray(),
      
      // Teachers with orphaned student references
      teacherCollection.aggregate([
        { $match: { 'teaching.studentIds': { $exists: true, $ne: [] } } },
        { $unwind: '$teaching.studentIds' },
        {
          $lookup: {
            from: 'student',
            localField: 'teaching.studentIds',
            foreignField: '_id',
            as: 'student'
          }
        },
        { $match: { student: { $size: 0 } } },
        { $count: 'orphanedReferences' }
      ]).toArray()
    ]);

    report.dataIntegrity = {
      studentsWithAssignments: integrityChecks[0],
      teachersWithStudents: integrityChecks[1],
      orphanedAssignments: integrityChecks[2][0]?.orphanedAssignments || 0,
      orphanedReferences: integrityChecks[3][0]?.orphanedReferences || 0,
      integrityScore: calculateIntegrityScore(integrityChecks)
    };

    // Performance metrics
    const performanceStart = Date.now();
    await teacherLessonsService.getTeacherLessons('507f1f77bcf86cd799439011', { limit: 1 });
    const queryTime = Date.now() - performanceStart;

    report.performance = {
      sampleQueryTime: queryTime,
      indexEfficiency: report.collections.students.indexSize / report.collections.students.dataSize,
      recommendedOptimization: queryTime > 1000 ? 'Consider index optimization' : 'Performance is acceptable'
    };

    // System health assessment
    let healthIssues = 0;
    
    if (report.dataIntegrity.orphanedAssignments > 0) healthIssues++;
    if (report.dataIntegrity.orphanedReferences > 0) healthIssues++;
    if (report.dataIntegrity.integrityScore < 0.95) healthIssues++;
    if (queryTime > 2000) healthIssues++;

    if (healthIssues === 0) {
      report.systemHealth = 'HEALTHY';
    } else if (healthIssues <= 2) {
      report.systemHealth = 'WARNING';
    } else {
      report.systemHealth = 'CRITICAL';
    }

    // Generate recommendations
    if (report.dataIntegrity.orphanedAssignments > 0) {
      report.recommendations.push({
        type: 'DATA_CLEANUP',
        priority: 'HIGH',
        message: `Remove ${report.dataIntegrity.orphanedAssignments} orphaned teacher assignments`
      });
    }

    if (report.performance.sampleQueryTime > 1000) {
      report.recommendations.push({
        type: 'PERFORMANCE',
        priority: 'MEDIUM',
        message: 'Consider running index optimization for teacher lesson queries'
      });
    }

    if (report.collections.students.dataSize > 100) {
      report.recommendations.push({
        type: 'MAINTENANCE',
        priority: 'LOW',
        message: 'Large dataset detected - schedule regular maintenance'
      });
    }

    res.json({
      success: true,
      data: report,
      message: `System health: ${report.systemHealth}`
    });

  } catch (error) {
    console.error('❌ Error generating consistency report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate system consistency report',
      details: error.message
    });
  }
}

/**
 * Repair data inconsistencies
 * @route POST /api/admin/repair-data-inconsistencies
 */
async function repairDataInconsistencies(req, res) {
  try {
    const { dryRun = false, repairTypes = [] } = req.body;
    
    console.log(`🔧 Starting data repair (${dryRun ? 'DRY RUN' : 'LIVE MODE'})`);

    const repairResults = {
      timestamp: new Date(),
      dryRun,
      repaired: {
        bidirectionalReferences: 0,
        orphanedReferences: 0,
        incompleteAssignments: 0,
        invalidIds: 0
      },
      errors: []
    };

    // Use the existing relationship validation service for repairs
    const inconsistenciesReport = await relationshipValidationService.detectRelationshipInconsistencies();
    
    const repairs = await relationshipValidationService.repairRelationshipInconsistencies(
      inconsistenciesReport, 
      dryRun
    );

    repairResults.repaired = {
      bidirectionalReferences: repairs.repaired.studentTeacherLinks + repairs.repaired.teacherStudentLinks,
      orphanedReferences: repairs.repaired.orphanedReferences,
      incompleteAssignments: 0, // TODO: Implement if needed
      invalidIds: 0 // TODO: Implement if needed
    };

    repairResults.errors = repairs.errors;

    const statusCode = repairResults.errors.length === 0 ? 200 : 207; // 207 = Multi-Status

    res.status(statusCode).json({
      success: repairResults.errors.length === 0,
      data: repairResults,
      message: dryRun ? 
        'Dry run completed - no changes made' : 
        `Repair completed with ${repairResults.errors.length} errors`
    });

  } catch (error) {
    console.error('❌ Data repair error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to repair data inconsistencies',
      details: error.message
    });
  }
}

/**
 * Validate lesson data for all teachers
 * @route POST /api/admin/validate-all-teacher-lessons
 */
async function validateAllTeacherLessons(req, res) {
  try {
    const { limit = 50 } = req.query;
    
    console.log(`🔍 Validating lesson data for all teachers (limit: ${limit})`);

    const teacherCollection = await getCollection('teacher');
    const teachers = await teacherCollection.find(
      { isActive: { $ne: false } },
      { limit: parseInt(limit) }
    ).toArray();

    const validationResults = {
      timestamp: new Date(),
      teachersValidated: teachers.length,
      validTeachers: 0,
      invalidTeachers: 0,
      issues: [],
      summary: {
        totalIssues: 0,
        criticalIssues: 0,
        warnings: 0
      }
    };

    for (const teacher of teachers) {
      try {
        const teacherId = teacher._id.toString();
        const validation = await teacherLessonsService.validateTeacherLessonData(teacherId);
        
        if (validation.isValid) {
          validationResults.validTeachers++;
        } else {
          validationResults.invalidTeachers++;
          validationResults.issues.push({
            teacherId,
            teacherName: teacher.personalInfo?.fullName,
            issues: validation.issues,
            summary: validation.summary
          });
          
          validationResults.summary.totalIssues += validation.issues.length;
          validationResults.summary.criticalIssues += validation.issues.filter(
            issue => issue.type.includes('NOT_FOUND') || issue.type.includes('MISSING')
          ).length;
          validationResults.summary.warnings += validation.issues.filter(
            issue => issue.type.includes('INCOMPLETE')
          ).length;
        }
        
      } catch (error) {
        validationResults.invalidTeachers++;
        validationResults.issues.push({
          teacherId: teacher._id.toString(),
          teacherName: teacher.personalInfo?.fullName,
          error: error.message
        });
        validationResults.summary.criticalIssues++;
      }
    }

    const overallValid = validationResults.invalidTeachers === 0;

    res.status(overallValid ? 200 : 400).json({
      success: overallValid,
      data: validationResults,
      message: overallValid ? 
        'All teacher lesson data is valid' : 
        `Found issues in ${validationResults.invalidTeachers} teachers`
    });

  } catch (error) {
    console.error('❌ Teacher lesson validation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate teacher lessons',
      details: error.message
    });
  }
}

/**
 * Get data integrity statistics
 * @route GET /api/admin/data-integrity-stats
 */
async function getDataIntegrityStats(req, res) {
  try {
    const stats = await relationshipValidationService.detectRelationshipInconsistencies();
    
    res.json({
      success: true,
      data: {
        timestamp: new Date(),
        summary: stats.summary,
        inconsistencies: stats.inconsistencies.length,
        orphanedReferences: {
          studentsWithInvalidTeachers: stats.orphanedReferences.studentsWithInvalidTeachers.length,
          teachersWithInvalidStudents: stats.orphanedReferences.teachersWithInvalidStudents.length
        },
        healthScore: calculateHealthScore(stats)
      },
      message: `System integrity: ${stats.summary.inconsistentRelationships === 0 ? 'HEALTHY' : 'NEEDS ATTENTION'}`
    });

  } catch (error) {
    console.error('❌ Data integrity stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get data integrity statistics',
      details: error.message
    });
  }
}

/**
 * Perform comprehensive health check
 * @route GET /api/admin/health-check
 */
async function performHealthCheck(req, res) {
  try {
    const healthCheck = {
      timestamp: new Date(),
      status: 'HEALTHY',
      checks: {
        database: { status: 'UNKNOWN', details: {} },
        dataIntegrity: { status: 'UNKNOWN', details: {} },
        performance: { status: 'UNKNOWN', details: {} },
        indexes: { status: 'UNKNOWN', details: {} }
      },
      overallScore: 0
    };

    // Database connectivity check
    try {
      const studentCollection = await getCollection('student');
      await studentCollection.findOne({});
      healthCheck.checks.database.status = 'HEALTHY';
      healthCheck.checks.database.details = { message: 'Database connection successful' };
    } catch (error) {
      healthCheck.checks.database.status = 'CRITICAL';
      healthCheck.checks.database.details = { error: error.message };
    }

    // Data integrity check
    try {
      const integrityStats = await relationshipValidationService.detectRelationshipInconsistencies();
      const criticalIssues = integrityStats.summary.inconsistentRelationships;
      
      healthCheck.checks.dataIntegrity.status = criticalIssues === 0 ? 'HEALTHY' : 
        (criticalIssues < 10 ? 'WARNING' : 'CRITICAL');
      healthCheck.checks.dataIntegrity.details = {
        inconsistentRelationships: criticalIssues,
        totalStudents: integrityStats.summary.totalStudents,
        totalTeachers: integrityStats.summary.totalTeachers
      };
    } catch (error) {
      healthCheck.checks.dataIntegrity.status = 'CRITICAL';
      healthCheck.checks.dataIntegrity.details = { error: error.message };
    }

    // Performance check
    try {
      const performanceStart = Date.now();
      await teacherLessonsService.getTeacherLessons('507f1f77bcf86cd799439011', { limit: 5 });
      const queryTime = Date.now() - performanceStart;
      
      healthCheck.checks.performance.status = queryTime < 1000 ? 'HEALTHY' : 
        (queryTime < 3000 ? 'WARNING' : 'CRITICAL');
      healthCheck.checks.performance.details = {
        sampleQueryTime: queryTime,
        threshold: 1000
      };
    } catch (error) {
      healthCheck.checks.performance.status = 'WARNING';
      healthCheck.checks.performance.details = { error: error.message };
    }

    // Index health check
    try {
      const studentCollection = await getCollection('student');
      const indexes = await studentCollection.indexes();
      const hasTeacherAssignmentIndex = indexes.some(idx => 
        idx.name.includes('teacherAssignments') || JSON.stringify(idx.key).includes('teacherAssignments')
      );
      
      healthCheck.checks.indexes.status = hasTeacherAssignmentIndex ? 'HEALTHY' : 'WARNING';
      healthCheck.checks.indexes.details = {
        totalIndexes: indexes.length,
        hasOptimalIndexes: hasTeacherAssignmentIndex
      };
    } catch (error) {
      healthCheck.checks.indexes.status = 'WARNING';
      healthCheck.checks.indexes.details = { error: error.message };
    }

    // Calculate overall score and status
    const scores = {
      HEALTHY: 100,
      WARNING: 60,
      CRITICAL: 20,
      UNKNOWN: 0
    };

    const checkValues = Object.values(healthCheck.checks);
    healthCheck.overallScore = Math.round(
      checkValues.reduce((sum, check) => sum + scores[check.status], 0) / checkValues.length
    );

    healthCheck.status = healthCheck.overallScore >= 90 ? 'HEALTHY' :
      (healthCheck.overallScore >= 70 ? 'WARNING' : 'CRITICAL');

    const statusCode = healthCheck.status === 'HEALTHY' ? 200 :
      (healthCheck.status === 'WARNING' ? 200 : 503);

    res.status(statusCode).json({
      success: healthCheck.status !== 'CRITICAL',
      data: healthCheck,
      message: `System health: ${healthCheck.status} (Score: ${healthCheck.overallScore}/100)`
    });

  } catch (error) {
    console.error('❌ Health check error:', error);
    res.status(500).json({
      success: false,
      error: 'Health check failed',
      details: error.message
    });
  }
}

// Helper functions
function calculateIntegrityScore(integrityChecks) {
  const [studentsWithAssignments, teachersWithStudents, orphanedAssignments, orphanedReferences] = integrityChecks;
  
  const totalRelationships = studentsWithAssignments + teachersWithStudents;
  const totalProblems = (orphanedAssignments[0]?.orphanedAssignments || 0) + 
                       (orphanedReferences[0]?.orphanedReferences || 0);
  
  if (totalRelationships === 0) return 1.0;
  
  return Math.max(0, (totalRelationships - totalProblems) / totalRelationships);
}

function calculateHealthScore(stats) {
  const total = stats.summary.totalStudents + stats.summary.totalTeachers;
  const issues = stats.summary.inconsistentRelationships;
  
  if (total === 0) return 100;
  
  return Math.max(0, Math.round(((total - issues) / total) * 100));
}