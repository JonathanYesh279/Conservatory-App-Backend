import { studentService } from './student.service.js'

export const studentController = {
  getStudents,
  getStudentById,
  addStudent,
  updateStudent,
  removeStudent
}

async function getStudents(req, res, next) { 
  try {
    const filterBy = {
      name: req.query.name,
      instrument: req.query.instrument,
      stage: req.query.stage,
      isActive: req.query.isActive,
      showInActive: req.query.showInActive === 'true'
    }
    const students = await studentService.getStudents(filterBy)
    res.json(students)
  } catch (err) {
    next(err)
  }
}

async function getStudentById(req, res, next) {
  try {
    const { id } = req.params
    const student = await studentService.getStudentById(id)
    res.json(student)
  } catch (err) {
    next(err)
  }
}

async function addStudent(req, res, next) {
  try {
    const studentToAdd = req.body
    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    const addedStudent = await studentService.addStudent(studentToAdd, teacherId, isAdmin)
    res.status(201).json(addedStudent)
  } catch (err) {
    next(err)
  }
}

async function updateStudent(req, res, next) {
  try {
    const { id } = req.params 
    const studentToUpdate = req.body
    const updatedStudent = await studentService.updateStudent(id, studentToUpdate)
    res.json(updatedStudent)
  } catch (err) {
    next(err)
  }
}

async function removeStudent(req, res, next) {
  try {
    const { id } = req.params
    const teacherId = req.teacher._id.toString()
    const isAdmin = req.teacher.roles.includes('מנהל')

    const result = await studentService.removeStudent(id, teacherId, isAdmin)
    res.json(result)
  } catch (err) {
    next(err)
  }
}