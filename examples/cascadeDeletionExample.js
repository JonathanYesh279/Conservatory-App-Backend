/**
 * Cascade Deletion Service Usage Examples
 * Demonstrates how to use the cascadeDeletionService for student records
 */

import { cascadeDeletionService } from '../services/cascadeDeletionService.js';

/**
 * Example 1: Standard soft delete with academic record preservation
 */
async function standardStudentDeletion() {
  console.log('=== Standard Student Deletion Example ===');
  
  const studentId = '507f1f77bcf86cd799439011'; // Example student ID
  
  try {
    // First, validate the deletion impact
    const validation = await cascadeDeletionService.validateDeletionImpact(studentId);
    
    if (!validation.success) {
      console.error('Validation failed:', validation.error);
      return;
    }
    
    console.log('Deletion Impact Analysis:');
    console.log(`- Student exists: ${validation.impact.studentExists}`);
    console.log(`- Student active: ${validation.impact.studentActive}`);
    console.log(`- Total references: ${validation.impact.totalReferences}`);
    console.log('- Related records:');
    Object.entries(validation.impact.relatedRecords).forEach(([collection, count]) => {
      console.log(`  * ${collection}: ${count} records`);
    });
    
    if (validation.impact.warnings.length > 0) {
      console.log('- Warnings:');
      validation.impact.warnings.forEach(warning => console.log(`  * ${warning}`));
    }
    
    // Proceed with deletion
    const result = await cascadeDeletionService.cascadeDeleteStudent(studentId, {
      hardDelete: false,        // Soft delete (default)
      preserveAcademic: true,   // Keep bagrut records (default)
      createSnapshot: true      // Create rollback snapshot (default)
    });
    
    if (result.success) {
      console.log('\n✅ Deletion completed successfully');
      console.log(`- Execution time: ${result.executionTime}ms`);
      console.log(`- Snapshot ID: ${result.snapshotId}`);
      console.log('- Operation counts:');
      Object.entries(result.operationCounts).forEach(([key, count]) => {
        console.log(`  * ${key}: ${count}`);
      });
      console.log(`- Affected collections: ${result.affectedCollections.join(', ')}`);
    } else {
      console.error('❌ Deletion failed:', result.error);
      if (result.snapshotId) {
        console.log(`Rollback available with snapshot: ${result.snapshotId}`);
      }
    }
    
  } catch (error) {
    console.error('Unexpected error:', error.message);
  }
}

/**
 * Example 2: Hard deletion without academic record preservation
 */
async function hardStudentDeletion() {
  console.log('\n=== Hard Student Deletion Example ===');
  
  const studentId = '507f1f77bcf86cd799439012'; // Example student ID
  
  try {
    const result = await cascadeDeletionService.cascadeDeleteStudent(studentId, {
      hardDelete: true,         // Permanently delete student record
      preserveAcademic: false,  // Delete bagrut records too
      createSnapshot: true      // Still create snapshot for safety
    });
    
    if (result.success) {
      console.log('✅ Hard deletion completed');
      console.log(`- Student record permanently deleted`);
      console.log(`- Academic records also removed`);
      console.log(`- Backup snapshot: ${result.snapshotId}`);
    } else {
      console.error('❌ Hard deletion failed:', result.error);
    }
    
  } catch (error) {
    console.error('Hard deletion error:', error.message);
  }
}

/**
 * Example 3: Rollback deletion using snapshot
 */
async function rollbackDeletionExample() {
  console.log('\n=== Rollback Deletion Example ===');
  
  const snapshotId = 'snapshot_507f1f77bcf86cd799439011_1703876400000'; // Example snapshot ID
  
  try {
    const rollbackResult = await cascadeDeletionService.rollbackDeletion(snapshotId);
    
    if (rollbackResult.success) {
      console.log('✅ Rollback completed successfully');
      console.log(`- Student ID: ${rollbackResult.studentId}`);
      console.log(`- Restored at: ${rollbackResult.restoredAt}`);
      console.log('- Restored records:');
      Object.entries(rollbackResult.rollbackResults).forEach(([key, count]) => {
        console.log(`  * ${key}: ${count}`);
      });
    } else {
      console.error('❌ Rollback failed:', rollbackResult.error);
    }
    
  } catch (error) {
    console.error('Rollback error:', error.message);
  }
}

/**
 * Example 4: Cleanup orphaned references
 */
async function cleanupOrphanedReferencesExample() {
  console.log('\n=== Cleanup Orphaned References Example ===');
  
  try {
    // First, do a dry run to see what would be cleaned up
    const dryRunResult = await cascadeDeletionService.cleanupOrphanedReferences(true);
    
    console.log('Dry Run Results:');
    console.log(`- Total orphaned references: ${dryRunResult.totalOrphanedReferences}`);
    
    if (dryRunResult.findings.orphanedTeacherReferences.length > 0) {
      console.log('- Orphaned teacher references:');
      dryRunResult.findings.orphanedTeacherReferences.forEach(item => {
        console.log(`  * Teacher ${item.teacherId}: ${item.orphanedStudentIds.length} orphaned student IDs`);
      });
    }
    
    if (dryRunResult.findings.orphanedOrchestraReferences.length > 0) {
      console.log('- Orphaned orchestra references:');
      dryRunResult.findings.orphanedOrchestraReferences.forEach(item => {
        console.log(`  * Orchestra ${item.orchestraId}: ${item.orphanedStudentIds.length} orphaned student IDs`);
      });
    }
    
    // If orphaned references found, execute cleanup
    if (dryRunResult.totalOrphanedReferences > 0) {
      console.log('\nExecuting cleanup...');
      const cleanupResult = await cascadeDeletionService.cleanupOrphanedReferences(false);
      
      if (cleanupResult.success) {
        console.log('✅ Cleanup completed successfully');
      } else {
        console.error('❌ Cleanup failed');
      }
    } else {
      console.log('✅ No orphaned references found - database is clean');
    }
    
  } catch (error) {
    console.error('Cleanup error:', error.message);
  }
}

/**
 * Example 5: Error handling scenarios
 */
async function errorHandlingExample() {
  console.log('\n=== Error Handling Examples ===');
  
  // Test with non-existent student
  try {
    const result = await cascadeDeletionService.cascadeDeleteStudent('000000000000000000000000');
    console.log('Non-existent student result:', result);
  } catch (error) {
    console.log('✅ Correctly handled non-existent student error');
  }
  
  // Test with invalid snapshot ID
  try {
    const rollbackResult = await cascadeDeletionService.rollbackDeletion('invalid_snapshot_id');
    console.log('Invalid snapshot rollback result:', rollbackResult);
  } catch (error) {
    console.log('✅ Correctly handled invalid snapshot error');
  }
  
  // Test validation with invalid student ID
  try {
    const validation = await cascadeDeletionService.validateDeletionImpact('invalid_id');
    console.log('Invalid ID validation result:', validation);
  } catch (error) {
    console.log('✅ Correctly handled invalid ID in validation');
  }
}

/**
 * Example 6: Batch operations with multiple students
 */
async function batchDeletionExample() {
  console.log('\n=== Batch Deletion Example ===');
  
  const studentIds = [
    '507f1f77bcf86cd799439013',
    '507f1f77bcf86cd799439014',
    '507f1f77bcf86cd799439015'
  ];
  
  const results = [];
  
  for (const studentId of studentIds) {
    try {
      console.log(`\nProcessing student ${studentId}...`);
      
      const result = await cascadeDeletionService.cascadeDeleteStudent(studentId, {
        hardDelete: false,
        preserveAcademic: true,
        createSnapshot: true
      });
      
      results.push({
        studentId,
        success: result.success,
        snapshotId: result.snapshotId,
        executionTime: result.executionTime
      });
      
      if (result.success) {
        console.log(`✅ Student ${studentId} deleted successfully`);
      } else {
        console.log(`❌ Student ${studentId} deletion failed: ${result.error}`);
      }
      
    } catch (error) {
      console.error(`Error processing student ${studentId}:`, error.message);
      results.push({
        studentId,
        success: false,
        error: error.message
      });
    }
  }
  
  // Summary
  console.log('\n=== Batch Deletion Summary ===');
  const successful = results.filter(r => r.success).length;
  const failed = results.length - successful;
  
  console.log(`- Total processed: ${results.length}`);
  console.log(`- Successful: ${successful}`);
  console.log(`- Failed: ${failed}`);
  
  if (successful > 0) {
    const totalTime = results.filter(r => r.success).reduce((sum, r) => sum + r.executionTime, 0);
    console.log(`- Total execution time: ${totalTime}ms`);
    console.log(`- Average time per deletion: ${Math.round(totalTime / successful)}ms`);
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await standardStudentDeletion();
    await hardStudentDeletion();
    await rollbackDeletionExample();
    await cleanupOrphanedReferencesExample();
    await errorHandlingExample();
    await batchDeletionExample();
    
    console.log('\n🎉 All examples completed!');
    
  } catch (error) {
    console.error('Example execution failed:', error.message);
  }
}

// Export functions for individual testing
export {
  standardStudentDeletion,
  hardStudentDeletion,
  rollbackDeletionExample,
  cleanupOrphanedReferencesExample,
  errorHandlingExample,
  batchDeletionExample,
  runAllExamples
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}