import { theoryService } from './theory.service.js';

export const theoryController = {
  getTheoryLessons,
  getTheoryLessonById,
  getTheoryLessonsByCategory,
  getTheoryLessonsByTeacher,
  addTheoryLesson,
  updateTheoryLesson,
  removeTheoryLesson,
  bulkCreateTheoryLessons,
  updateTheoryAttendance,
  getTheoryAttendance,
  addStudentToTheory,
  removeStudentFromTheory,
  getStudentTheoryAttendanceStats,
};

async function getTheoryLessons(req, res, next) {
  try {
    const filterBy = {
      category: req.query.category,
      teacherId: req.query.teacherId,
      studentId: req.query.studentId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      dayOfWeek: req.query.dayOfWeek,
      location: req.query.location,
      schoolYearId: req.query.schoolYearId,
      isActive: req.query.isActive,
      showInactive: req.query.showInactive === 'true',
    };

    const theoryLessons = await theoryService.getTheoryLessons(filterBy);
    res.json(theoryLessons);
  } catch (err) {
    console.error(`Error in getTheoryLessons controller: ${err.message}`);
    next(err);
  }
}

async function getTheoryLessonById(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Theory lesson ID is required' });
    }

    const theoryLesson = await theoryService.getTheoryLessonById(id);
    res.json(theoryLesson);
  } catch (err) {
    console.error(`Error in getTheoryLessonById controller: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    next(err);
  }
}

async function getTheoryLessonsByCategory(req, res, next) {
  try {
    const { category } = req.params;

    if (!category) {
      return res
        .status(400)
        .json({ error: 'Theory lesson category is required' });
    }

    const filterBy = {
      teacherId: req.query.teacherId,
      studentId: req.query.studentId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      dayOfWeek: req.query.dayOfWeek,
      location: req.query.location,
      schoolYearId: req.query.schoolYearId,
      isActive: req.query.isActive,
      showInactive: req.query.showInactive === 'true',
    };

    const theoryLessons = await theoryService.getTheoryLessonsByCategory(
      category,
      filterBy
    );
    res.json(theoryLessons);
  } catch (err) {
    console.error(
      `Error in getTheoryLessonsByCategory controller: ${err.message}`
    );
    next(err);
  }
}

async function getTheoryLessonsByTeacher(req, res, next) {
  try {
    const { teacherId } = req.params;

    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID is required' });
    }

    const filterBy = {
      category: req.query.category,
      studentId: req.query.studentId,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      dayOfWeek: req.query.dayOfWeek,
      location: req.query.location,
      schoolYearId: req.query.schoolYearId,
      isActive: req.query.isActive,
      showInactive: req.query.showInactive === 'true',
    };

    const theoryLessons = await theoryService.getTheoryLessonsByTeacher(
      teacherId,
      filterBy
    );
    res.json(theoryLessons);
  } catch (err) {
    console.error(
      `Error in getTheoryLessonsByTeacher controller: ${err.message}`
    );
    next(err);
  }
}

async function addTheoryLesson(req, res, next) {
  try {
    const theoryLessonToAdd = req.body;

    if (!theoryLessonToAdd || Object.keys(theoryLessonToAdd).length === 0) {
      return res.status(400).json({ error: 'Theory lesson data is required' });
    }

    // Add schoolYearId from middleware if not provided
    if (
      !theoryLessonToAdd.schoolYearId &&
      req.schoolYear &&
      req.schoolYear._id
    ) {
      theoryLessonToAdd.schoolYearId = req.schoolYear._id.toString();
    }

    const addedTheoryLesson = await theoryService.addTheoryLesson(
      theoryLessonToAdd
    );
    res.status(201).json(addedTheoryLesson);
  } catch (err) {
    console.error(`Error in addTheoryLesson controller: ${err.message}`);

    if (err.message.includes('Validation error')) {
      return res.status(400).json({ error: err.message });
    }

    next(err);
  }
}

async function updateTheoryLesson(req, res, next) {
  try {
    const { id } = req.params;
    const theoryLessonToUpdate = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Theory lesson ID is required' });
    }

    if (
      !theoryLessonToUpdate ||
      Object.keys(theoryLessonToUpdate).length === 0
    ) {
      return res.status(400).json({ error: 'Theory lesson data is required' });
    }

    const updatedTheoryLesson = await theoryService.updateTheoryLesson(
      id,
      theoryLessonToUpdate
    );
    res.json(updatedTheoryLesson);
  } catch (err) {
    console.error(`Error in updateTheoryLesson controller: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    if (err.message.includes('Validation error')) {
      return res.status(400).json({ error: err.message });
    }

    next(err);
  }
}

async function removeTheoryLesson(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Theory lesson ID is required' });
    }

    const removedTheoryLesson = await theoryService.removeTheoryLesson(id);
    res.json(removedTheoryLesson);
  } catch (err) {
    console.error(`Error in removeTheoryLesson controller: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    next(err);
  }
}

async function bulkCreateTheoryLessons(req, res, next) {
  try {
    const bulkData = req.body;

    if (!bulkData || Object.keys(bulkData).length === 0) {
      return res.status(400).json({ error: 'Bulk creation data is required' });
    }

    // Add schoolYearId from request if not in body
    if (!bulkData.schoolYearId && req.schoolYear && req.schoolYear._id) {
      bulkData.schoolYearId = req.schoolYear._id.toString();
      console.log(
        'Setting schoolYearId in bulk data from middleware:',
        bulkData.schoolYearId
      );
    }

    console.log(
      'Bulk create theory lessons data received:',
      JSON.stringify(bulkData, null, 2)
    );

    // Validate that we have schoolYearId
    if (!bulkData.schoolYearId) {
      console.error('Missing schoolYearId in bulk theory lesson data');
      return res.status(400).json({
        error: 'Missing schoolYearId in bulk theory lesson data',
        bulkData,
        schoolYear: req.schoolYear || null,
      });
    }

    // Ensure all required fields are present
    const requiredFields = [
      'category',
      'teacherId',
      'startDate',
      'endDate',
      'dayOfWeek',
      'startTime',
      'endTime',
      'location',
    ];

    for (const field of requiredFields) {
      if (!bulkData[field] && bulkData[field] !== 0) {
        // Allow 0 for dayOfWeek
        console.error(
          `Missing required field: ${field} in bulk theory lesson data`
        );
        return res.status(400).json({
          error: `Missing required field: ${field} in bulk theory lesson data`,
        });
      }
    }

    const result = await theoryService.bulkCreateTheoryLessons(bulkData);
    res.status(201).json(result);
  } catch (err) {
    console.error(`Error in bulk create theory lessons: ${err.message}`);

    if (err.message.includes('Validation error')) {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({
      error: err.message || 'Failed to create theory lessons in bulk',
    });
  }
}

async function updateTheoryAttendance(req, res, next) {
  try {
    const { id } = req.params;
    const attendanceData = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Theory lesson ID is required' });
    }

    if (!attendanceData || Object.keys(attendanceData).length === 0) {
      return res.status(400).json({ error: 'Attendance data is required' });
    }

    const updatedTheoryLesson = await theoryService.updateTheoryAttendance(
      id,
      attendanceData
    );
    res.json(updatedTheoryLesson);
  } catch (err) {
    console.error(`Error in updateTheoryAttendance controller: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    if (err.message.includes('Validation error')) {
      return res.status(400).json({ error: err.message });
    }

    next(err);
  }
}

async function getTheoryAttendance(req, res, next) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Theory lesson ID is required' });
    }

    const attendance = await theoryService.getTheoryAttendance(id);
    res.json(attendance);
  } catch (err) {
    console.error(`Error in getTheoryAttendance controller: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    next(err);
  }
}

async function addStudentToTheory(req, res, next) {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Theory lesson ID is required' });
    }

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    const updatedTheoryLesson = await theoryService.addStudentToTheory(
      id,
      studentId
    );
    res.json(updatedTheoryLesson);
  } catch (err) {
    console.error(`Error in addStudentToTheory controller: ${err.message}`);

    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    next(err);
  }
}

async function removeStudentFromTheory(req, res, next) {
  try {
    const { id, studentId } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'Theory lesson ID is required' });
    }

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    const updatedTheoryLesson = await theoryService.removeStudentFromTheory(
      id,
      studentId
    );
    res.json(updatedTheoryLesson);
  } catch (err) {
    console.error(
      `Error in removeStudentFromTheory controller: ${err.message}`
    );

    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message });
    }

    next(err);
  }
}

async function getStudentTheoryAttendanceStats(req, res, next) {
  try {
    const { studentId } = req.params;
    const { category } = req.query;

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    const stats = await theoryService.getStudentTheoryAttendanceStats(
      studentId,
      category
    );
    res.json(stats);
  } catch (err) {
    console.error(
      `Error in getStudentTheoryAttendanceStats controller: ${err.message}`
    );
    next(err);
  }
}
