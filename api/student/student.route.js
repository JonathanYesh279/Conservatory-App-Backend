import express from 'express'
import { studentController } from './student.controller.js'

const router = express.Router()

router.get('/', studentController.getStudents)
router.get('/:id', studentController.getStudentById)
router.post('/', studentController.addStudent)
router.put('/:id', studentController.updateStudent)
router.delete('/:id', studentController.removeStudent)

export default router