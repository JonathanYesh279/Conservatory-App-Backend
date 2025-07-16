// api/student/student.controller.js
import { studentService } from './student.service.js';

export const studentController = {
  getStudents,
  getStudentById,
  addStudent,
  updateStudent,
  updateStudentTest,
  removeStudent,
};

async function getStudents(req, res, next) {
  try {
    const filterBy = {
      name: req.query.name,
      instrument: req.query.instrument,
      stage: req.query.stage,
      isActive: req.query.isActive,
      showInactive: req.query.showInActive === 'true',
    };
    const students = await studentService.getStudents(filterBy);
    res.json(students);
  } catch (err) {
    next(err);
  }
}

async function getStudentById(req, res, next) {
  try {
    const { id } = req.params;
    console.log(`🔍 Getting student by ID: ${id}`);
    const student = await studentService.getStudentById(id);
    console.log(`✅ Successfully retrieved student: ${student.personalInfo?.fullName || 'Unknown'}`);
    res.json(student);
  } catch (err) {
    console.error(`❌ Error getting student by ID ${req.params.id}:`, err.message);
    console.error('Stack trace:', err.stack);
    next(err);
  }
}

async function addStudent(req, res, next) {
  try {
    const studentToAdd = req.body;
    const teacherId = req.teacher?._id?.toString();
    const isAdmin = req.teacher?.roles?.includes('מנהל') || false;

    const addedStudent = await studentService.addStudent(
      studentToAdd,
      teacherId,
      isAdmin
    );
    res.status(201).json(addedStudent);
  } catch (err) {
    next(err);
  }
}

async function updateStudent(req, res, next) {
  try {
    const { id } = req.params;
    const studentToUpdate = req.body;
    const teacherId = req.teacher?._id?.toString();
    const isAdmin = req.teacher?.roles?.includes('מנהל') || false;

    const updatedStudent = await studentService.updateStudent(
      id,
      studentToUpdate,
      teacherId,
      isAdmin
    );
    res.json(updatedStudent);
  } catch (err) {
    next(err);
  }
}

async function updateStudentTest(req, res) {
  try {
    const { id } = req.params;
    const { instrumentName, testType, status } = req.body;

    console.log(`Received test update request for student ${id}:`, {
      instrumentName,
      testType,
      status,
    });

    // Validate required fields
    if (!instrumentName || !testType || !status) {
      return res.status(400).json({
        error: 'Missing required fields',
        details: { instrumentName, testType, status },
      });
    }

    // Validate test type
    if (!['stageTest', 'technicalTest'].includes(testType)) {
      return res.status(400).json({
        error: 'Invalid test type',
        validOptions: ['stageTest', 'technicalTest'],
        received: testType,
      });
    }

    // Validate test status
    const validStatuses = [
      'לא נבחן',
      'עבר/ה',
      'לא עבר/ה',
      'עבר/ה בהצטיינות',
      'עבר/ה בהצטיינות יתרה',
    ];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: 'Invalid test status',
        validOptions: validStatuses,
        received: status,
      });
    }

    // Extract teacher info from request
    const teacherId = req.teacher?._id?.toString();
    const isAdmin = req.teacher?.roles?.includes('מנהל') || false;

    // Update the test status
    const updatedStudent = await studentService.updateStudentTest(
      id,
      instrumentName,
      testType,
      status,
      teacherId,
      isAdmin
    );

    console.log(`Successfully updated test for student ${id}`);

    // Return the updated student
    res.json(updatedStudent);
  } catch (err) {
    console.error(`Error updating student test: ${err.message}`);
    res.status(500).json({
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}

async function removeStudent(req, res, next) {
  try {
    const { id } = req.params;
    const teacherId = req.teacher?._id?.toString();
    const isAdmin = req.teacher?.roles?.includes('מנהל') || false;

    const result = await studentService.removeStudent(id, teacherId, isAdmin);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
