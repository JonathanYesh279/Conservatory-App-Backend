import { teacherService } from './teacher.service.js'

export const teacherController = {
  getTeachers,
  getTeacherById,
  addTeacher,
  updateTeacher,
  removeTeacher,
  getTeacherByRole,
  updateTeacherSchedule,
}

async function getTeachers(req, res, next) {
  try {
    const filterBy = {
      name: req.query.name,
      role: req.query.role,
      studentId: req.query.studentId,
      orchestraId: req.query.orchestraId,
      ensembleId: req.query.ensembleId,
      isActive: req.query.isActive,
      showInActive: req.query.showInActive === 'true'
    }
    const teachers = await teacherService.getTeachers(filterBy)
    res.json(teachers)
  } catch (err) {
    next(err)
  }
}

async function getTeacherById(req, res, next) {
  try {
    const { id } = req.params 
    const teacher = await teacherService.getTeacherById(id)
    res.json(teacher)
  } catch (err) {
    next(err)
  }
}

async function addTeacher(req, res, next) { 
  try {
    const teacherToAdd = req.body
    const addedTeacher = await teacherService.addTeacher(teacherToAdd)
    res.json(addedTeacher)
  } catch (err) {
    next(err)
  }
}

async function updateTeacher(req, res, next) {
  try {
    const { id } = req.params
    const teacherToUpdate = req.body
    const updatedTeacher = await teacherService.updateTeacher(id, teacherToUpdate)
    res.json(updatedTeacher)
  } catch (err) {
    next(err) 
  }
}

async function removeTeacher(req, res, next) { 
  try {
    const { id } = req.params
    const removedTeacher = await teacherService.removeTeacher(id)
    res.json(removedTeacher)
  } catch (err) {
    next(err)
  }
}

async function getTeacherByRole(req, res, next) {
  try {
    const { role } = req.params
    const teachers = await teacherService.getTeacherByRole(role)
    res.json(teachers)
  } catch (err) {
    next(err)
  }
}

async function updateTeacherSchedule(req, res, next) {
   try {
    const { id: teacherId } = req.params
    const scheduleData = req.body
    
    const result = await teacherService.updateTeacherSchedule(teacherId, scheduleData)
    res.json(result)
  } catch (err) {
    next(err)
  }
}