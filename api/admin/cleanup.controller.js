import { dataCleanupService } from '../../services/dataCleanupService.js';
import { studentDeletionPreviewService } from './student-deletion-preview.service.js';
import { ObjectId } from 'mongodb';

export const cleanupController = {
  detectInconsistencies,
  generateReport,
  fixAllInconsistencies,
  fixRelationship,
  fixOrphanedAssignments,
  fixOrphanedSchedule,
  getStudentDeletionPreview
};

/**
 * Detect all data inconsistencies
 * @route GET /api/admin/cleanup/detect-inconsistencies
 */
async function detectInconsistencies(req, res, next) {
  try {
    console.log('🔍 ADMIN REQUEST: Detecting data inconsistencies...');
    
    const issues = await dataCleanupService.detectInconsistencies();
    
    const statusCode = issues.summary.totalIssues > 0 ? 200 : 200;
    
    res.status(statusCode).json({
      success: true,
      data: issues,
      message: issues.summary.totalIssues > 0 
        ? `Found ${issues.summary.totalIssues} data inconsistencies (${issues.summary.criticalIssues} critical)`
        : 'No data inconsistencies found - database is clean',
      timestamp: new Date()
    });
    
  } catch (err) {
    console.error(`❌ Error detecting inconsistencies: ${err.message}`);
    next(err);
  }
}

/**
 * Generate comprehensive cleanup report
 * @route GET /api/admin/cleanup/report
 */
async function generateReport(req, res, next) {
  try {
    console.log('📊 ADMIN REQUEST: Generating cleanup report...');
    
    const report = await dataCleanupService.generateCleanupReport();
    
    const statusCode = report.priority === 'HIGH' ? 200 : 200;
    
    res.status(statusCode).json({
      success: true,
      data: report,
      message: `Cleanup report generated - Priority: ${report.priority}`,
      timestamp: new Date()
    });
    
  } catch (err) {
    console.error(`❌ Error generating cleanup report: ${err.message}`);
    next(err);
  }
}

/**
 * Fix all data inconsistencies
 * @route POST /api/admin/cleanup/fix-all
 */
async function fixAllInconsistencies(req, res, next) {
  try {
    const { dryRun = true, confirm = false } = req.body;
    
    console.log(`🔧 ADMIN REQUEST: Fix all inconsistencies (dryRun: ${dryRun}, confirm: ${confirm})...`);
    
    // Safety check - require explicit confirmation for actual fixes
    if (!dryRun && !confirm) {
      return res.status(400).json({
        success: false,
        error: 'Actual fixes require explicit confirmation',
        message: 'To perform actual fixes, send: { "dryRun": false, "confirm": true }',
        code: 'CONFIRMATION_REQUIRED'
      });
    }
    
    const result = await dataCleanupService.fixAllInconsistencies(dryRun);
    
    const statusCode = result.success ? 200 : 500;
    
    res.status(statusCode).json({
      success: result.success,
      data: result,
      message: dryRun 
        ? `Dry run completed - ${result.fixPlan?.length || 0} fixes planned`
        : `Cleanup completed - ${result.summary?.totalFixes || 0} issues fixed`,
      timestamp: new Date()
    });
    
  } catch (err) {
    console.error(`❌ Error fixing inconsistencies: ${err.message}`);
    
    if (err.message.includes('Transaction')) {
      return res.status(500).json({
        success: false,
        error: 'Database transaction failed - all changes have been rolled back',
        message: err.message,
        code: 'TRANSACTION_FAILED'
      });
    }
    
    next(err);
  }
}

/**
 * Fix specific teacher-student relationship
 * @route POST /api/admin/cleanup/fix-relationship/:teacherId/:studentId
 */
async function fixRelationship(req, res, next) {
  try {
    const { teacherId, studentId } = req.params;
    
    console.log(`🔧 ADMIN REQUEST: Fixing relationship between teacher ${teacherId} and student ${studentId}...`);
    
    // Validate IDs
    if (!teacherId || !studentId) {
      return res.status(400).json({
        success: false,
        error: 'Both teacherId and studentId are required',
        code: 'MISSING_PARAMETERS'
      });
    }
    
    const result = await dataCleanupService.fixTeacherStudentRelationships(teacherId, studentId);
    
    res.status(200).json({
      success: result.success,
      data: result,
      message: `Relationship fix completed - ${result.fixes?.length || 0} changes made`,
      timestamp: new Date()
    });
    
  } catch (err) {
    console.error(`❌ Error fixing relationship: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: err.message,
        code: 'RESOURCE_NOT_FOUND'
      });
    }
    
    next(err);
  }
}

/**
 * Fix orphaned teacher assignments for a student
 * @route POST /api/admin/cleanup/fix-assignments/:studentId
 */
async function fixOrphanedAssignments(req, res, next) {
  try {
    const { studentId } = req.params;
    
    console.log(`🔧 ADMIN REQUEST: Fixing orphaned assignments for student ${studentId}...`);
    
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
        code: 'MISSING_STUDENT_ID'
      });
    }
    
    const result = await dataCleanupService.fixOrphanedTeacherAssignments(studentId);
    
    res.status(200).json({
      success: result.success,
      data: result,
      message: `Assignment cleanup completed - ${result.fixes?.length || 0} assignments fixed`,
      timestamp: new Date()
    });
    
  } catch (err) {
    console.error(`❌ Error fixing orphaned assignments: ${err.message}`);
    
    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: err.message,
        code: 'STUDENT_NOT_FOUND'
      });
    }
    
    next(err);
  }
}

/**
 * Fix orphaned schedule information for a student
 * @route POST /api/admin/cleanup/fix-schedule/:studentId
 */
async function fixOrphanedSchedule(req, res, next) {
  try {
    const { studentId } = req.params;
    
    console.log(`🔧 ADMIN REQUEST: Fixing orphaned schedule info for student ${studentId}...`);
    
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
        code: 'MISSING_STUDENT_ID'
      });
    }
    
    const result = await dataCleanupService.fixOrphanedScheduleInfo(studentId);
    
    res.status(200).json({
      success: result.success,
      data: result,
      message: `Schedule cleanup completed - ${result.fixes?.length || 0} schedule items fixed`,
      timestamp: new Date()
    });
    
  } catch (err) {
    console.error(`❌ Error fixing orphaned schedule: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: err.message,
        code: 'STUDENT_NOT_FOUND'
      });
    }

    next(err);
  }
}

/**
 * Get comprehensive deletion preview for a student
 * @route GET /api/admin/cleanup/student/:studentId/deletion-preview
 */
async function getStudentDeletionPreview(req, res, next) {
  try {
    const { studentId } = req.params;

    console.log(`🔍 ADMIN REQUEST: Generating deletion preview for student ${studentId}...`);

    // Validate student ID format
    if (!studentId) {
      return res.status(400).json({
        success: false,
        error: 'Student ID is required',
        code: 'MISSING_STUDENT_ID'
      });
    }

    if (!ObjectId.isValid(studentId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid student ID format',
        code: 'INVALID_STUDENT_ID',
        details: 'Student ID must be a valid MongoDB ObjectId'
      });
    }

    // Generate the deletion preview
    const result = await studentDeletionPreviewService.generateDeletionPreview(studentId);

    if (!result.success) {
      if (result.error?.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: result.error,
          code: 'STUDENT_NOT_FOUND'
        });
      }

      return res.status(500).json({
        success: false,
        error: result.error,
        code: result.code || 'PREVIEW_FAILED'
      });
    }

    // Determine response based on impact level
    const statusCode = result.data.estimatedImpact === 'high' ? 200 : 200;

    res.status(statusCode).json({
      success: true,
      data: result.data,
      message: `Deletion preview generated - Impact level: ${result.data.estimatedImpact}`,
      timestamp: new Date()
    });

  } catch (err) {
    console.error(`❌ Error generating student deletion preview: ${err.message}`);

    if (err.message.includes('ObjectId')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid student ID format',
        code: 'INVALID_STUDENT_ID',
        details: err.message
      });
    }

    next(err);
  }
}