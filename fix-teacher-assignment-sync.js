#!/usr/bin/env node

/**
 * Fix for Teacher Assignment Synchronization
 * 
 * The current system syncs teacherIds but doesn't extract teacher IDs from 
 * teacherAssignments to sync to teacher.teaching.studentIds.
 * 
 * This script adds the missing sync logic.
 */

import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const STUDENT_SERVICE_PATH = './api/student/student.service.js';

console.log('🔧 Fixing Teacher Assignment Synchronization...');

try {
  // Read the current student service file
  let content = readFileSync(STUDENT_SERVICE_PATH, 'utf8');
  
  // Find the section where teacherAssignments sync happens (around line 250)
  // Add logic to extract teacher IDs from teacherAssignments and sync them
  
  const syncLogicToInsert = `
    // 🔥 SYNC FIX: Extract teacher IDs from teacherAssignments for bidirectional sync
    if (teacherAssignmentsSyncRequired || (value.teacherAssignments && value.teacherAssignments.length > 0)) {
      const originalTeacherIdsFromAssignments = (originalStudent.teacherAssignments || [])
        .filter(assignment => assignment.isActive)
        .map(assignment => assignment.teacherId)
        .filter(Boolean);
        
      const newTeacherIdsFromAssignments = (value.teacherAssignments || [])
        .filter(assignment => assignment.isActive)
        .map(assignment => assignment.teacherId)
        .filter(Boolean);
      
      const teachersToAddFromAssignments = newTeacherIdsFromAssignments.filter(
        id => !originalTeacherIdsFromAssignments.includes(id)
      );
      const teachersToRemoveFromAssignments = originalTeacherIdsFromAssignments.filter(
        id => !newTeacherIdsFromAssignments.includes(id)
      );
      
      if (teachersToAddFromAssignments.length > 0 || teachersToRemoveFromAssignments.length > 0) {
        console.log(\`🔥 SYNC FIX: TeacherAssignments sync required - Adding \${teachersToAddFromAssignments.length}, Removing \${teachersToRemoveFromAssignments.length} teacher IDs\`);
        await syncTeacherStudentRelationships(studentId, teachersToAddFromAssignments, teachersToRemoveFromAssignments, session);
      }
    }`;
  
  // Insert the new sync logic after the teacher assignments sync
  const insertAfter = '// 🔥 CRITICAL FIX: Sync teacher relationships bidirectionally with transactions';
  const insertIndex = content.indexOf(insertAfter);
  
  if (insertIndex === -1) {
    throw new Error('Could not find insertion point in student service file');
  }
  
  // Find the end of the existing teacherRelationshipSyncRequired block
  let endIndex = content.indexOf('    }', insertIndex);
  endIndex = content.indexOf('\n', endIndex) + 1;
  
  // Insert our new sync logic
  const modifiedContent = content.slice(0, endIndex) + syncLogicToInsert + '\n' + content.slice(endIndex);
  
  // Add the same logic to the addStudent function for new students
  const addStudentSyncLogic = `
    // 🔥 SYNC FIX: Also sync teacher IDs from teacherAssignments for new students
    if (value.teacherAssignments && value.teacherAssignments.length > 0) {
      const teacherIdsFromAssignments = value.teacherAssignments
        .filter(assignment => assignment.isActive)
        .map(assignment => assignment.teacherId)
        .filter(Boolean);
      
      if (teacherIdsFromAssignments.length > 0) {
        console.log(\`🔥 SYNC FIX: New student has \${teacherIdsFromAssignments.length} teacher assignments - syncing to teacher.teaching.studentIds\`);
        await syncTeacherStudentRelationships(result.insertedId.toString(), teacherIdsFromAssignments, []);
      }
    }`;
  
  // Find where to insert in addStudent function
  const addStudentInsertAfter = 'await syncTeacherRecordsForStudentUpdate(';
  const addStudentInsertIndex = modifiedContent.indexOf(addStudentInsertAfter);
  
  if (addStudentInsertIndex !== -1) {
    // Find the end of the syncTeacherRecordsForStudentUpdate call
    let addStudentEndIndex = modifiedContent.indexOf(');', addStudentInsertIndex);
    addStudentEndIndex = modifiedContent.indexOf('\n', addStudentEndIndex) + 1;
    
    // Insert our sync logic
    const finalContent = modifiedContent.slice(0, addStudentEndIndex) + addStudentSyncLogic + '\n' + modifiedContent.slice(addStudentEndIndex);
    
    // Write the modified content back
    writeFileSync(STUDENT_SERVICE_PATH + '.backup', content); // Backup original
    writeFileSync(STUDENT_SERVICE_PATH, finalContent);
    
    console.log('✅ Successfully added teacher assignment sync logic to student service');
    console.log('📄 Original file backed up as student.service.js.backup');
    console.log('🔧 Changes made:');
    console.log('   • Added teacher ID extraction from teacherAssignments');
    console.log('   • Added bidirectional sync to teacher.teaching.studentIds');
    console.log('   • Added sync logic for both new and updated students');
    
  } else {
    throw new Error('Could not find addStudent function insertion point');
  }
  
} catch (error) {
  console.error('❌ Error applying fix:', error.message);
  process.exit(1);
}

console.log('\n🎉 Teacher assignment sync fix applied successfully!');
console.log('🔄 Restart the backend server to apply changes.');
console.log('🧪 Run the sync tests again to verify the fix.');