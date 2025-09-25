import express from 'express';
import { theoryController } from './theory.controller.js';
import { requireAuth } from '../../middleware/auth.middleware.js';
import {
  validateBulkCreate,
  validateSingleCreate,
  validateUpdate,
  validateObjectId
} from '../../middleware/theoryValidation.js';
import {
  validateLessonDate,
  validateBulkLessonDates,
  validateAttendanceDate
} from '../../middleware/dateValidation.js';
import {
  formatLessonResponse,
  formatAttendanceResponse
} from '../../middleware/responseFormatterMiddleware.js';
import {
  monitorLessonOperations,
  monitorBulkOperations,
  monitorAttendanceOperations,
  monitorValidationErrors
} from '../../middleware/dateMonitoringMiddleware.js';
import {
  addToastHelpers,
  errorWithToast,
  theoryLessonErrorHandler
} from '../../middleware/toastNotificationMiddleware.js';

const router = express.Router();

// Add toast helpers to all routes
router.use(addToastHelpers);

// GET routes - All authenticated users can view theory lessons
router.get('/', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']), formatLessonResponse(), theoryController.getTheoryLessons);
router.get('/category/:category', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']), formatLessonResponse(), theoryController.getTheoryLessonsByCategory);
router.get('/teacher/:teacherId', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']), formatLessonResponse(), theoryController.getTheoryLessonsByTeacher);
router.get('/student/:studentId/stats', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']), formatAttendanceResponse(), theoryController.getStudentTheoryAttendanceStats);
router.get('/:id', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']), formatLessonResponse(), theoryController.getTheoryLessonById);
router.get('/:id/attendance', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל', 'מורה תאוריה']), formatAttendanceResponse(), theoryController.getTheoryAttendance);

// POST routes - Only admin and theory instructors can create
router.post('/', requireAuth(['מנהל', 'מורה תאוריה']), monitorValidationErrors, validateLessonDate, ...validateSingleCreate, monitorLessonOperations, theoryController.addTheoryLesson);
router.post('/bulk-create', requireAuth(['מנהל', 'מורה תאוריה']), monitorValidationErrors, validateBulkLessonDates, ...validateBulkCreate, monitorBulkOperations, theoryController.bulkCreateTheoryLessons);
router.post('/:id/student', requireAuth(['מנהל', 'מורה תאוריה']), validateObjectId('id'), theoryController.addStudentToTheory);

// PUT routes - Only admin and theory instructors can update
router.put('/:id', requireAuth(['מנהל', 'מורה תאוריה']), monitorValidationErrors, ...validateUpdate, monitorLessonOperations, theoryController.updateTheoryLesson);
router.put('/:id/attendance', requireAuth(['מנהל', 'מורה תאוריה']), monitorValidationErrors, validateObjectId('id'), validateAttendanceDate, monitorAttendanceOperations, theoryController.updateTheoryAttendance);

// DELETE routes - Only admin and theory instructors can delete
router.delete('/bulk-delete-by-date', requireAuth(['מנהל', 'מורה תאוריה']), theoryController.bulkDeleteTheoryLessonsByDate);
router.delete('/bulk-delete-by-category/:category', requireAuth(['מנהל', 'מורה תאוריה']), theoryController.bulkDeleteTheoryLessonsByCategory);
router.delete('/bulk-delete-by-teacher/:teacherId', requireAuth(['מנהל', 'מורה תאוריה', 'מורה']), validateObjectId('teacherId'), theoryController.bulkDeleteTheoryLessonsByTeacher);
router.delete('/:id', requireAuth(['מנהל', 'מורה תאוריה']), validateObjectId('id'), theoryController.removeTheoryLesson);
router.delete('/:id/student/:studentId', requireAuth(['מנהל', 'מורה תאוריה']), validateObjectId('id'), validateObjectId('studentId'), theoryController.removeStudentFromTheory);

// Error handling middleware - must be last
router.use(theoryLessonErrorHandler);
router.use(errorWithToast);

export default router;