// api/student/student.controller.js
import { studentService } from './student.service.js';

export const studentController = {
  getStudents,
  getStudentById,
  addStudent,
  updateStudent,
  updateStudentTest,
  updateStudentStageLevel,
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
      ids: req.query.ids // Add support for batch fetching by IDs
    };

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 0; // 0 means no pagination (return all)

    // Authorization context for IDOR prevention
    const teacherId = req.teacher?._id?.toString();
    const isAdmin = req.teacher?.roles?.includes('מנהל') || false;

    const result = await studentService.getStudents(filterBy, page, limit, { teacherId, isAdmin });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getStudentById(req, res, next) {
  try {
    const { id } = req.params;
    const teacherId = req.teacher?._id?.toString();
    const isAdmin = req.teacher?.roles?.includes('מנהל') || false;

    const student = await studentService.getStudentById(id);

    // IDOR prevention: non-admin teachers can only access their own students
    if (teacherId && !isAdmin) {
      const hasAccess = await studentService.checkTeacherHasAccessToStudent(teacherId, id);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied: student not assigned to you' });
      }
    }

    res.json(student);
  } catch (err) {
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

async function updateStudentStageLevel(req, res, next) {
  try {
    const { id } = req.params;
    const { stageLevel } = req.body;

    console.log(`🎵 Updating stage level for student ${id} to ${stageLevel}`);

    // Validate stage level
    if (!stageLevel || stageLevel < 1 || stageLevel > 8) {
      return res.status(400).json({
        error: 'Invalid stage level',
        details: 'Stage level must be between 1 and 8'
      });
    }

    const teacherId = req.teacher?._id?.toString();
    const isAdmin = req.teacher?.roles?.includes('מנהל') || false;

    const updatedStudent = await studentService.updateStudentStageLevel(
      id,
      parseInt(stageLevel),
      teacherId,
      isAdmin
    );

    console.log(`✅ Successfully updated stage level for student ${id} to ${stageLevel}`);
    res.json(updatedStudent);
  } catch (err) {
    console.error(`❌ Error updating student stage level: ${err.message}`);
    next(err);
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
