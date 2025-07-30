/**
 * Test Script: Teacher-Student Relationship Synchronization
 * 
 * This script tests the new bidirectional synchronization functionality
 * to ensure that when a student's teacherIds is updated, the teacher's
 * studentIds is automatically updated as well.
 * 
 * Usage: node test-teacher-student-sync.js
 */

import { studentService } from './api/student/student.service.js';
import { getCollection } from './services/mongoDB.service.js';
import { relationshipValidationService } from './services/relationshipValidationService.js';
import { ObjectId } from 'mongodb';

async function runTests() {
  console.log('🧪 Starting Teacher-Student Relationship Sync Tests');
  console.log('=====================================================\n');

  let testResults = {
    passed: 0,
    failed: 0,
    errors: []
  };

  try {
    // Test 1: Create test data
    console.log('📝 Test 1: Setting up test data...');
    const { testStudentId, testTeacherId } = await setupTestData();
    console.log(`   ✅ Created test student: ${testStudentId}`);
    console.log(`   ✅ Created test teacher: ${testTeacherId}`);
    testResults.passed++;

    // Test 2: Test adding teacher to student
    console.log('\n📝 Test 2: Adding teacher to student (should sync bidirectionally)...');
    await testAddTeacherToStudent(testStudentId, testTeacherId, testResults);

    // Test 3: Test removing teacher from student
    console.log('\n📝 Test 3: Removing teacher from student (should sync bidirectionally)...');
    await testRemoveTeacherFromStudent(testStudentId, testTeacherId, testResults);

    // Test 4: Test multiple teachers
    console.log('\n📝 Test 4: Testing multiple teacher assignments...');
    const { testTeacherId2 } = await createSecondTestTeacher();
    await testMultipleTeachers(testStudentId, [testTeacherId, testTeacherId2], testResults);

    // Test 5: Test validation service
    console.log('\n📝 Test 5: Testing relationship validation service...');
    await testValidationService(testStudentId, testTeacherId, testResults);

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await cleanupTestData(testStudentId, testTeacherId);
    console.log('   ✅ Test data cleaned up');

    // Results
    console.log('\n📊 Test Results Summary:');
    console.log(`   ✅ Passed: ${testResults.passed}`);
    console.log(`   ❌ Failed: ${testResults.failed}`);
    
    if (testResults.errors.length > 0) {
      console.log('\n❌ Errors encountered:');
      testResults.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error}`);
      });
    }

    if (testResults.failed === 0) {
      console.log('\n🎉 All tests passed! The synchronization is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the errors above.');
    }

  } catch (error) {
    console.error('💥 Test suite failed with fatal error:', error);
    testResults.failed++;
    testResults.errors.push(`Fatal error: ${error.message}`);
  }

  return testResults;
}

async function setupTestData() {
  const studentCollection = await getCollection('student');
  const teacherCollection = await getCollection('teacher');

  // Create test student
  const testStudent = {
    personalInfo: {
      fullName: 'TEST_STUDENT_SYNC_' + Date.now(),
      idNumber: 'TEST' + Date.now(),
      phone: '0501234567',
      email: `test.student.${Date.now()}@test.com`,
      address: 'Test Address',
      birthDate: new Date('2000-01-01'),
      gender: 'אחר'
    },
    academicInfo: {
      class: 'י',
      instrumentProgress: [{
        instrumentName: 'פסנתר',
        currentStage: 1,
        isPrimary: true,
        tests: {}
      }]
    },
    enrollments: {
      schoolYears: [{
        schoolYearId: '507f1f77bcf86cd799439011', // Mock school year ID
        isActive: true
      }]
    },
    teacherIds: [],
    teacherAssignments: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  // Create test teacher
  const testTeacher = {
    personalInfo: {
      fullName: 'TEST_TEACHER_SYNC_' + Date.now(),
      idNumber: 'TTEACH' + Date.now(),
      phone: '0507654321',
      email: `test.teacher.${Date.now()}@test.com`,
      address: 'Test Address',
      birthDate: new Date('1980-01-01'),
      gender: 'אחר'
    },
    professionalInfo: {
      instrument: 'פסנתר',
      experience: 5,
      education: 'בוגר מכללה'
    },
    teaching: {
      studentIds: [],
      schedule: [],
      timeBlocks: []
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const studentResult = await studentCollection.insertOne(testStudent);
  const teacherResult = await teacherCollection.insertOne(testTeacher);

  return {
    testStudentId: studentResult.insertedId.toString(),
    testTeacherId: teacherResult.insertedId.toString()
  };
}

async function createSecondTestTeacher() {
  const teacherCollection = await getCollection('teacher');

  const testTeacher2 = {
    personalInfo: {
      fullName: 'TEST_TEACHER2_SYNC_' + Date.now(),
      idNumber: 'TTEACH2' + Date.now(),
      phone: '0507654322',
      email: `test.teacher2.${Date.now()}@test.com`,
      address: 'Test Address',
      birthDate: new Date('1980-01-01'),
      gender: 'אחר'
    },
    professionalInfo: {
      instrument: 'גיטרה',
      experience: 3,
      education: 'בוגר מכללה'
    },
    teaching: {
      studentIds: [],
      schedule: [],
      timeBlocks: []
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const teacherResult = await teacherCollection.insertOne(testTeacher2);
  return { testTeacherId2: teacherResult.insertedId.toString() };
}

async function testAddTeacherToStudent(studentId, teacherId, testResults) {
  try {
    // Update student with teacher
    await studentService.updateStudent(studentId, {
      teacherIds: [teacherId]
    }, null, true); // isAdmin = true

    // Verify bidirectional sync
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    const updatedStudent = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    const updatedTeacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    // Check if student has teacher
    if (!updatedStudent.teacherIds.includes(teacherId)) {
      throw new Error('Student does not have teacher in teacherIds');
    }

    // Check if teacher has student
    const teacherStudentIds = updatedTeacher.teaching?.studentIds || [];
    if (!teacherStudentIds.includes(studentId)) {
      throw new Error('Teacher does not have student in studentIds (sync failed)');
    }

    console.log('   ✅ Student has teacher in teacherIds');
    console.log('   ✅ Teacher has student in studentIds (bidirectional sync working)');
    testResults.passed++;

  } catch (error) {
    console.log('   ❌ Test failed:', error.message);
    testResults.failed++;
    testResults.errors.push(`Add teacher to student test: ${error.message}`);
  }
}

async function testRemoveTeacherFromStudent(studentId, teacherId, testResults) {
  try {
    // Remove teacher from student
    await studentService.updateStudent(studentId, {
      teacherIds: []
    }, null, true); // isAdmin = true

    // Verify bidirectional sync
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    const updatedStudent = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    const updatedTeacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });

    // Check if student no longer has teacher
    if (updatedStudent.teacherIds.includes(teacherId)) {
      throw new Error('Student still has teacher in teacherIds');
    }

    // Check if teacher no longer has student
    const teacherStudentIds = updatedTeacher.teaching?.studentIds || [];
    if (teacherStudentIds.includes(studentId)) {
      throw new Error('Teacher still has student in studentIds (sync failed)');
    }

    console.log('   ✅ Student no longer has teacher in teacherIds');
    console.log('   ✅ Teacher no longer has student in studentIds (bidirectional sync working)');
    testResults.passed++;

  } catch (error) {
    console.log('   ❌ Test failed:', error.message);
    testResults.failed++;
    testResults.errors.push(`Remove teacher from student test: ${error.message}`);
  }
}

async function testMultipleTeachers(studentId, teacherIds, testResults) {
  try {
    // Add multiple teachers to student
    await studentService.updateStudent(studentId, {
      teacherIds: teacherIds
    }, null, true); // isAdmin = true

    // Verify all teachers have the student
    const teacherCollection = await getCollection('teacher');

    for (const teacherId of teacherIds) {
      const teacher = await teacherCollection.findOne({
        _id: ObjectId.createFromHexString(teacherId)
      });

      const teacherStudentIds = teacher.teaching?.studentIds || [];
      if (!teacherStudentIds.includes(studentId)) {
        throw new Error(`Teacher ${teacherId} does not have student in studentIds`);
      }
    }

    console.log(`   ✅ All ${teacherIds.length} teachers have student in their studentIds`);

    // Now remove one teacher
    const remainingTeachers = teacherIds.slice(1);
    await studentService.updateStudent(studentId, {
      teacherIds: remainingTeachers
    }, null, true);

    // Verify first teacher no longer has student
    const firstTeacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherIds[0])
    });

    const firstTeacherStudentIds = firstTeacher.teaching?.studentIds || [];
    if (firstTeacherStudentIds.includes(studentId)) {
      throw new Error('Removed teacher still has student in studentIds');
    }

    // Verify remaining teacher still has student
    const remainingTeacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherIds[1])
    });

    const remainingTeacherStudentIds = remainingTeacher.teaching?.studentIds || [];
    if (!remainingTeacherStudentIds.includes(studentId)) {
      throw new Error('Remaining teacher lost student from studentIds');
    }

    console.log('   ✅ Partial teacher removal working correctly');
    testResults.passed++;

  } catch (error) {
    console.log('   ❌ Test failed:', error.message);
    testResults.failed++;
    testResults.errors.push(`Multiple teachers test: ${error.message}`);
  }
}

async function testValidationService(studentId, teacherId, testResults) {
  try {
    // First, create a relationship
    await studentService.updateStudent(studentId, {
      teacherIds: [teacherId]
    }, null, true);

    // Test validation
    const validationResult = await relationshipValidationService.validateStudentTeacherRelationships(
      studentId, 
      [teacherId]
    );

    if (!validationResult.isValid) {
      throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
    }

    if (validationResult.warnings.length > 0) {
      throw new Error(`Validation warnings: ${validationResult.warnings.map(w => w.message).join(', ')}`);
    }

    console.log('   ✅ Relationship validation passed');

    // Test inconsistency detection
    const inconsistenciesReport = await relationshipValidationService.detectRelationshipInconsistencies();
    console.log(`   📊 Database analysis: ${inconsistenciesReport.summary.inconsistentRelationships} inconsistencies found`);

    testResults.passed++;

  } catch (error) {
    console.log('   ❌ Test failed:', error.message);
    testResults.failed++;
    testResults.errors.push(`Validation service test: ${error.message}`);
  }
}

async function cleanupTestData(studentId, teacherId) {
  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    // Delete test student
    await studentCollection.deleteOne({
      _id: ObjectId.createFromHexString(studentId)
    });

    // Delete test teachers
    await teacherCollection.deleteMany({
      'personalInfo.fullName': { $regex: /^TEST_TEACHER.*_SYNC_/ }
    });

  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Execute tests if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests().catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
}

export { runTests };