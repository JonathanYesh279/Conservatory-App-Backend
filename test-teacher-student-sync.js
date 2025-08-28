#!/usr/bin/env node

/**
 * Teacher-Student Assignment Synchronization Testing Script
 * 
 * Tests bidirectional sync between:
 * - student.teacherAssignments (primary source)
 * - teacher.teaching.studentIds (secondary reference)
 * 
 * Verifies the system maintains consistency and teacher lesson endpoints work correctly.
 */

import fetch from 'node-fetch';
import { ObjectId } from 'mongodb';

const API_BASE_URL = 'http://localhost:3001/api';
const TEST_CREDENTIALS = {
  email: 'admin@example.com',
  password: '123456'
};

let authToken = null;
let testResults = {
  passed: 0,
  failed: 0,
  tests: []
};

/**
 * Test result logging
 */
function logTest(name, passed, details = '') {
  const status = passed ? '✅ PASSED' : '❌ FAILED';
  const result = { name, passed, details, timestamp: new Date().toISOString() };
  testResults.tests.push(result);
  
  if (passed) {
    testResults.passed++;
    console.log(`${status}: ${name}`);
  } else {
    testResults.failed++;
    console.log(`${status}: ${name}`);
    console.log(`   Details: ${details}`);
  }
  
  if (details && passed) {
    console.log(`   ${details}`);
  }
}

/**
 * API Client
 */
async function apiRequest(method, endpoint, body = null) {
  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`API Error ${response.status}: ${data.error || data.message || response.statusText}`);
    }

    return data;
  } catch (error) {
    console.error(`API Request failed: ${method} ${endpoint}`, error.message);
    throw error;
  }
}

/**
 * Authentication
 */
async function authenticate() {
  console.log('🔐 Authenticating...');
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREDENTIALS)
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.status}`);
    }

    const data = await response.json();
    authToken = data.accessToken || data.data?.accessToken;
    
    if (!authToken) {
      throw new Error('No authentication token received');
    }
    
    console.log('✅ Authentication successful');
    return true;
  } catch (error) {
    console.error('❌ Authentication failed:', error.message);
    return false;
  }
}

/**
 * Get a real teacher ID for testing
 */
async function getRealTeacherId() {
  try {
    const teachers = await apiRequest('GET', '/teacher');
    if (!Array.isArray(teachers) || teachers.length === 0) {
      throw new Error('No teachers found');
    }
    
    // Find an active teacher
    const activeTeacher = teachers.find(t => t.isActive && t._id);
    if (!activeTeacher) {
      throw new Error('No active teachers found');
    }
    
    console.log(`📝 Using teacher: ${activeTeacher.personalInfo?.fullName} (${activeTeacher._id})`);
    return activeTeacher._id;
  } catch (error) {
    throw new Error(`Failed to get teacher ID: ${error.message}`);
  }
}

/**
 * Create test student with teacher assignments
 */
async function createTestStudent(teacherId) {
  const testStudentData = {
    personalInfo: {
      fullName: "תלמיד טסט סינכרון",
      phone: "0501234567",
      age: 15,
      address: "כתובת טסט",
      parentName: "הורה טסט",
      parentPhone: "0507654321",
      parentEmail: "parent.test@example.com",
      studentEmail: "student.test@example.com"
    },
    academicInfo: {
      instrumentProgress: [
        {
          instrumentName: "פסנתר",
          isPrimary: true,
          currentStage: 3,
          tests: {
            stageTest: {
              status: "לא נבחן",
              lastTestDate: null,
              nextTestDate: null,
              notes: ""
            },
            technicalTest: {
              status: "לא נבחן",
              lastTestDate: null,
              nextTestDate: null,
              notes: ""
            }
          }
        }
      ],
      class: "ט"
    },
    enrollments: {
      orchestraIds: [],
      ensembleIds: [],
      theoryLessonIds: [],
      schoolYears: []
    },
    teacherIds: [], // Will be updated automatically
    teacherAssignments: [
      {
        teacherId: teacherId,
        scheduleSlotId: new ObjectId().toString(),
        day: "ראשון",
        time: "14:00",
        duration: 45,
        startDate: new Date().toISOString(),
        endDate: null,
        isActive: true,
        isRecurring: true,
        notes: "שיעור טסט",
        scheduleInfo: {
          day: "ראשון",
          startTime: "14:00",
          endTime: "14:45",
          duration: 45,
          location: "חדר טסט",
          notes: "שיעור טסט"
        }
      }
    ],
    isActive: true
  };

  try {
    const student = await apiRequest('POST', '/student', testStudentData);
    console.log(`👤 Created test student: ${student.personalInfo?.fullName} (${student._id})`);
    return student;
  } catch (error) {
    throw new Error(`Failed to create test student: ${error.message}`);
  }
}

/**
 * Test 1: Create student and verify teacher sync
 */
async function testCreateStudentSync() {
  console.log('\n🧪 Test 1: Create Student with TeacherAssignment');
  
  try {
    const teacherId = await getRealTeacherId();
    
    // Get teacher before creating student
    const teacherBefore = await apiRequest('GET', `/teacher/${teacherId}`);
    const studentIdsBefore = teacherBefore.teaching?.studentIds || [];
    
    // Create student with teacher assignment
    const student = await createTestStudent(teacherId);
    
    // Wait a moment for potential async operations
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get teacher after creating student
    const teacherAfter = await apiRequest('GET', `/teacher/${teacherId}`);
    const studentIdsAfter = teacherAfter.teaching?.studentIds || [];
    
    // Verify sync
    const hasStudentId = studentIdsAfter.includes(student._id);
    const wasAdded = !studentIdsBefore.includes(student._id) && studentIdsAfter.includes(student._id);
    
    logTest(
      'Student creation syncs to teacher.teaching.studentIds',
      hasStudentId,
      hasStudentId ? 
        `Student ID ${student._id} found in teacher.teaching.studentIds` :
        `Student ID ${student._id} NOT found in teacher.teaching.studentIds (Before: ${studentIdsBefore.length}, After: ${studentIdsAfter.length})`
    );
    
    return { student, teacherId };
    
  } catch (error) {
    logTest('Student creation sync', false, error.message);
    throw error;
  }
}

/**
 * Test 2: Verify teacher lessons endpoint shows the new lesson
 */
async function testTeacherLessonsEndpoint(teacherId, studentId) {
  console.log('\n🧪 Test 2: Teacher Lessons Endpoint After Sync');
  
  try {
    const response = await apiRequest('GET', `/teacher/${teacherId}/lessons`);
    const lessons = response.lessons || response.data?.lessons || response;
    
    if (!Array.isArray(lessons)) {
      throw new Error(`Teacher lessons response is not an array: ${typeof lessons}`);
    }
    
    const studentLesson = lessons.find(lesson => 
      lesson.studentId === studentId || lesson.studentId?.toString() === studentId
    );
    
    logTest(
      'Teacher lessons endpoint shows new lesson',
      !!studentLesson,
      studentLesson ? 
        `Found lesson for student ${studentId} in teacher ${teacherId} lessons` :
        `No lesson found for student ${studentId} in teacher ${teacherId} lessons (${lessons.length} total lessons)`
    );
    
    return lessons;
    
  } catch (error) {
    logTest('Teacher lessons endpoint', false, error.message);
    return [];
  }
}

/**
 * Test 3: Update student teacherAssignments
 */
async function testUpdateTeacherAssignments(studentId, teacherId) {
  console.log('\n🧪 Test 3: Update Student TeacherAssignments');
  
  try {
    // Get current student
    const student = await apiRequest('GET', `/student/${studentId}`);
    
    // Update teacher assignment with new time
    const updatedAssignments = student.teacherAssignments.map(assignment => {
      if (assignment.teacherId === teacherId) {
        return {
          ...assignment,
          time: "15:00",
          notes: "שיעור טסט מעודכן",
          scheduleInfo: {
            ...assignment.scheduleInfo,
            startTime: "15:00",
            endTime: "15:45",
            notes: "שיעור טסט מעודכן"
          }
        };
      }
      return assignment;
    });
    
    // Update student
    const updatedStudent = await apiRequest('PUT', `/student/${studentId}`, {
      teacherAssignments: updatedAssignments
    });
    
    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify teacher still has student ID
    const teacher = await apiRequest('GET', `/teacher/${teacherId}`);
    const hasStudentId = teacher.teaching?.studentIds?.includes(studentId);
    
    // Verify lessons endpoint reflects update
    const response = await apiRequest('GET', `/teacher/${teacherId}/lessons`);
    const lessons = response.lessons || response.data?.lessons || response;
    const updatedLesson = lessons.find(lesson => 
      (lesson.studentId === studentId || lesson.studentId?.toString() === studentId) &&
      lesson.time === "15:00"
    );
    
    logTest(
      'Updated teacher assignments maintain sync',
      hasStudentId && !!updatedLesson,
      hasStudentId ? 
        (updatedLesson ? 
          `Teacher sync maintained and lesson updated to 15:00` :
          `Teacher sync maintained but lesson time not updated`) :
        `Teacher sync lost after assignment update`
    );
    
    return updatedStudent;
    
  } catch (error) {
    logTest('Update teacher assignments sync', false, error.message);
    throw error;
  }
}

/**
 * Test 4: Remove teacher assignment
 */
async function testRemoveTeacherAssignment(studentId, teacherId) {
  console.log('\n🧪 Test 4: Remove Teacher Assignment');
  
  try {
    // Get current student
    const student = await apiRequest('GET', `/student/${studentId}`);
    
    // Get teacher before removal
    const teacherBefore = await apiRequest('GET', `/teacher/${teacherId}`);
    const hadStudentId = teacherBefore.teaching?.studentIds?.includes(studentId);
    
    // Remove teacher assignment
    const updatedAssignments = student.teacherAssignments.filter(
      assignment => assignment.teacherId !== teacherId
    );
    
    const updatedStudent = await apiRequest('PUT', `/student/${studentId}`, {
      teacherAssignments: updatedAssignments
    });
    
    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get teacher after removal
    const teacherAfter = await apiRequest('GET', `/teacher/${teacherId}`);
    const hasStudentId = teacherAfter.teaching?.studentIds?.includes(studentId);
    
    // Verify lessons endpoint no longer shows lesson
    const response = await apiRequest('GET', `/teacher/${teacherId}/lessons`);
    const lessons = response.lessons || response.data?.lessons || response;
    const remainingLesson = lessons.find(lesson => 
      lesson.studentId === studentId || lesson.studentId?.toString() === studentId
    );
    
    logTest(
      'Removing teacher assignment syncs correctly',
      hadStudentId && !hasStudentId && !remainingLesson,
      hadStudentId ?
        (!hasStudentId ? 
          (!remainingLesson ?
            `Student ${studentId} correctly removed from teacher ${teacherId} studentIds and lessons` :
            `Student removed from studentIds but lesson still appears in lessons endpoint`) :
          `Student ${studentId} still in teacher ${teacherId} studentIds (should be removed)`) :
        `Student ${studentId} was not in teacher ${teacherId} studentIds before removal`
    );
    
    return updatedStudent;
    
  } catch (error) {
    logTest('Remove teacher assignment sync', false, error.message);
    throw error;
  }
}

/**
 * Cleanup test data
 */
async function cleanupTestData(studentId) {
  console.log('\n🧹 Cleaning up test data...');
  
  try {
    await apiRequest('DELETE', `/student/${studentId}`);
    console.log(`✅ Deleted test student: ${studentId}`);
  } catch (error) {
    console.warn(`⚠️ Failed to delete test student: ${error.message}`);
  }
}

/**
 * Verify existing sync status
 */
async function verifyExistingSync() {
  console.log('\n🔍 Verifying Existing Student-Teacher Sync');
  console.log('='.repeat(45));
  
  try {
    const students = await apiRequest('GET', '/student');
    const teachers = await apiRequest('GET', '/teacher');
    
    let syncIssues = 0;
    let checkedPairs = 0;
    let studentsWithAssignments = 0;
    
    console.log(`\n📋 Checking ${students.length} students...`);
    
    for (const student of students.slice(0, 20)) { // Check first 20 students
      if (!student.teacherAssignments || student.teacherAssignments.length === 0) {
        continue;
      }
      
      studentsWithAssignments++;
      
      for (const assignment of student.teacherAssignments) {
        if (!assignment.isActive) continue;
        
        const teacher = teachers.find(t => t._id === assignment.teacherId);
        if (!teacher) {
          console.log(`⚠️ Teacher ${assignment.teacherId} not found for student ${student._id}`);
          syncIssues++;
          continue;
        }
        
        const hasStudentId = teacher.teaching?.studentIds?.includes(student._id);
        checkedPairs++;
        
        if (!hasStudentId) {
          console.log(`❌ Sync issue: Student ${student._id} (${student.personalInfo?.fullName}) assigned to teacher ${teacher._id} (${teacher.personalInfo?.fullName}) but missing from teacher.teaching.studentIds`);
          syncIssues++;
        }
      }
    }
    
    console.log(`\n📊 Existing Sync Status:`);
    console.log(`   Students with assignments: ${studentsWithAssignments}`);
    console.log(`   Checked assignment pairs: ${checkedPairs}`);
    console.log(`   Sync issues found: ${syncIssues}`);
    console.log(`   Success rate: ${checkedPairs > 0 ? ((checkedPairs - syncIssues) / checkedPairs * 100).toFixed(1) : 100}%`);
    
    if (syncIssues === 0) {
      console.log('✅ All existing assignments are properly synced!');
    } else {
      console.log(`⚠️ Found ${syncIssues} sync inconsistencies that may need repair.`);
    }
    
  } catch (error) {
    console.error('❌ Existing sync verification failed:', error.message);
  }
}

/**
 * Main test runner
 */
async function runSyncTests() {
  console.log('🔄 Teacher-Student Assignment Synchronization Tests');
  console.log('='.repeat(60));
  
  let studentId = null;
  let teacherId = null;
  
  try {
    // Authenticate
    const authenticated = await authenticate();
    if (!authenticated) {
      throw new Error('Authentication failed');
    }
    
    // First, verify existing sync status
    await verifyExistingSync();
    
    // Test 1: Create student with teacher assignment
    const { student, teacherId: firstTeacherId } = await testCreateStudentSync();
    studentId = student._id;
    teacherId = firstTeacherId;
    
    // Test 2: Verify teacher lessons endpoint
    await testTeacherLessonsEndpoint(teacherId, studentId);
    
    // Test 3: Update teacher assignments
    await testUpdateTeacherAssignments(studentId, teacherId);
    
    // Test 4: Remove teacher assignment
    await testRemoveTeacherAssignment(studentId, teacherId);
    
  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
  } finally {
    // Cleanup
    if (studentId) {
      await cleanupTestData(studentId);
    }
    
    // Test summary
    console.log('\n📊 Test Summary');
    console.log('='.repeat(30));
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📋 Total: ${testResults.tests.length}`);
    
    if (testResults.failed > 0) {
      console.log('\n❌ Failed Tests:');
      testResults.tests
        .filter(t => !t.passed)
        .forEach(t => console.log(`   • ${t.name}: ${t.details}`));
      
      console.log('\n🔧 Recommendations:');
      console.log('   • Check if backend student/teacher sync middleware is properly implemented');
      console.log('   • Verify database triggers or post-save hooks are working');
      console.log('   • Test with actual schedule slot IDs from the schedule service');
    } else {
      console.log('\n🎉 All tests passed! Student-Teacher sync is working correctly.');
    }
  }
}

// Run tests if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSyncTests().catch(console.error);
}

export { runSyncTests, verifyExistingSync };