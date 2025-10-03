import express from 'express'
import { teacherController } from './teacher.controller.js'
import { invitationController } from './invitation.controller.js'
import { attendanceController } from '../schedule/attendance.controller.js'
import { requireAuth } from '../../middleware/auth.middleware.js'

const router = express.Router()

router.get('/', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.getTeachers)
router.get('/profile/me', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.getMyProfile)
router.put('/profile/me', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.updateMyProfile)
router.get('/debug/ids', requireAuth(['מנהל']), teacherController.getTeacherIds)

// New lesson endpoints (single source of truth approach)
router.get('/:teacherId/lessons', requireAuth(['מורה', 'מנהל']), teacherController.getTeacherLessons)
router.get('/:teacherId/weekly-schedule', requireAuth(['מורה', 'מנהל']), teacherController.getTeacherWeeklySchedule)
router.get('/:teacherId/day-schedule/:day', requireAuth(['מורה', 'מנהל']), teacherController.getTeacherDaySchedule)
router.get('/:teacherId/lesson-stats', requireAuth(['מורה', 'מנהל']), teacherController.getTeacherLessonStats)
router.get('/:teacherId/students-with-lessons', requireAuth(['מורה', 'מנהל']), teacherController.getTeacherStudentsWithLessons)
router.get('/:teacherId/validate-lessons', requireAuth(['מורה', 'מנהל']), teacherController.validateTeacherLessonData)
router.get('/:teacherId/lesson-attendance-summary', requireAuth(['מורה', 'מנהל']), attendanceController.getTeacherAttendanceOverview)

router.get('/:id', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.getTeacherById)
router.get('/role/:role', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), teacherController.getTeacherByRole)

router.post('/', requireAuth(['מנהל']), teacherController.addTeacher)
router.post('/:id/schedule', requireAuth(['מנהל, מורה']), teacherController.updateTeacherSchedule)
router.put('/:id', requireAuth(['מנהל']), teacherController.updateTeacher)
router.delete('/:id', requireAuth(['מנהל']), teacherController.removeTeacher)

// Student management routes
router.post('/:teacherId/student/:studentId', requireAuth(['מנהל']), teacherController.addStudentToTeacher)
router.delete('/:teacherId/student/:studentId', requireAuth(['מנהל']), teacherController.removeStudentFromTeacher)

// Time block management routes
router.get('/:teacherId/time-blocks', requireAuth(['מורה', 'מנהל']), teacherController.getTimeBlocks)
router.post('/:teacherId/time-block', requireAuth(['מורה', 'מנהל']), teacherController.createTimeBlock)
router.put('/:teacherId/time-block/:timeBlockId', requireAuth(['מורה', 'מנהל']), teacherController.updateTimeBlock)
router.delete('/:teacherId/time-block/:timeBlockId', requireAuth(['מורה', 'מנהל']), teacherController.deleteTimeBlock)

// Invitation routes
router.get('/invitation/validate/:token', invitationController.validateInvitation)
router.post('/invitation/accept/:token', invitationController.acceptInvitation)
router.post('/invitation/resend/:teacherId', requireAuth(['מנהל']), invitationController.resendInvitation)

export default router
