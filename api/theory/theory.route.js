import express from 'express';
import { theoryController } from './theory.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';

const router = express.Router();

// GET routes - All authenticated users can view theory lessons
router.get('/', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']), theoryController.getTheoryLessons);
router.get('/category/:category', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']), theoryController.getTheoryLessonsByCategory);
router.get('/teacher/:teacherId', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']), theoryController.getTheoryLessonsByTeacher);
router.get('/student/:studentId/stats', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']), theoryController.getStudentTheoryAttendanceStats);
router.get('/:id', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']), theoryController.getTheoryLessonById);
router.get('/:id/attendance', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']), theoryController.getTheoryAttendance);

// POST routes - Only admin and theory instructors can create
router.post('/', requireAuth(['מנהל', 'מורה תאוריה']), theoryController.addTheoryLesson);
router.post('/bulk-create', requireAuth(['מנהל', 'מורה תאוריה']), theoryController.bulkCreateTheoryLessons);
router.post('/:id/student', requireAuth(['מנהל', 'מורה תאוריה']), theoryController.addStudentToTheory);

// PUT routes - Only admin and theory instructors can update
router.put('/:id', requireAuth(['מנהל', 'מורה תאוריה']), theoryController.updateTheoryLesson);
router.put('/:id/attendance', requireAuth(['מנהל', 'מורה תאוריה']), theoryController.updateTheoryAttendance);

// DELETE routes - Only admin and theory instructors can delete
router.delete('/:id', requireAuth(['מנהל', 'מורה תאוריה']), theoryController.removeTheoryLesson);
router.delete('/:id/student/:studentId', requireAuth(['מנהל', 'מורה תאוריה']), theoryController.removeStudentFromTheory);

export default router;