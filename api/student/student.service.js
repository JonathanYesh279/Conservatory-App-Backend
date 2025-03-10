import { ObjectId } from 'bson'
import { getCollection } from '../../services/mongoDB.service.js'
import { validateStudent } from './student.validation.js'

export const studentService = {
  getStudents,
  getStudentById,
  addStudent,
  updateStudent,
  removeStudent
}

async function getStudents(filterBy = {}) {
  try {
    const collection = await getCollection('student')
    const criteria = _buildCriteria(filterBy)

    const students = await collection
      .find(criteria)
      .toArray()
    return students
  } catch (err) {
    console.error(`Error getting students: ${err.message}`)
    throw new Error(`Error getting students: ${err.message}`)
  }
}

async function getStudentById(studentId) {
  try {
    const collection = await getCollection('student')
    const student = await collection.findOne({ _id: ObjectId.createFromHexString(studentId) })

    if (!student) throw new Error(`Student with id ${studentId} not found`)
    return student
  } catch (err) {
    console.error(`Error getting student by id: ${err.message}`)
    throw new Error(`Error getting student by id: ${err.message}`)
  }
}

async function addStudent(studentToAdd) {
  try {
    const { error, value } = validateStudent(studentToAdd)
    if (error) throw error

    if (!value.enrollments.schoolYears || value.enrollments.schoolYears.length === 0) {
      const schoolYearService = require('../school-year/school-year.service.js').schoolYearService
      const currentSchoolYear = await schoolYearService.getCurrentSchoolYear()

      if (!value.enrollments) {
        value.enrollments = {}
      }

      if (!value.enrollments.schoolYears) {
        value.enrollments.schoolYear = []
      }

      value.enrollments.schoolYears.push({
        schoolYearId: currentSchoolYear._id.toString(),
        isActive: true
      })
    }

    value.createdAt = new Date()
    value.updatedAt = new Date()

    const collection = await getCollection('student')
    const result = await collection.insertOne(value)

    if (teacherId && !isAdmin) {
      await associateStudentWithTeacher(result.insertedId.toString(), teacherId)
    }

    return { _id: result.insertedId, ...value }
  } catch (err) {
    console.error(`Error adding student: ${err.message}`)
    throw new Error(`Error adding student: ${err.message}`)
  }
}

async function updateStudent(studentId, studentToUpdate) {
  try {
    const { error, value } = validateStudent(studentToUpdate)
    if (error) throw new Error(`Invalid student data: ${error.message}`)

    const collection = await getCollection('student')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(studentId) },
      { $set: {...value, updatedAt: new Date()} },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Student with id ${studentId} not found`)
    
    return result
  } catch (err) {
    console.error(`Error updating student: ${err.message}`)
    throw new Error(`Error updating student: ${err.message}`)
  }
}

async function removeStudent(studentId) {
  try {
    if (teacherId && !isAdmin) {
      const hasAccess = await checkTeacherHasAccessToStudent(teacherId, studentId)
      if (!hasAccess) {
        throw new Error('Not authorized to remove student')
      }

      return await removeStudentTeacherAssociation(studentId, teacherId)
    }

    const collection = await getCollection('student')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(studentId) },
      {
        $set: {
          isActive: false,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Student with id ${studentId} not found`)
    return result
  } catch (err) {
    console.error(`Error removing student ${studentId}: ${err.message}`)
    throw err
  }
}

async function checkTeacherHasAccessToStudent(teacherId, studentId) {
  try {
    const teacherCollection = await getCollection('teacher')
    const teacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId),
      'teaching.studentIds': studentId,
      isActive: true
    })

    return !!teacher
  } catch(err) {
    console.error(`Error checking teacher access to student: ${err.message}`)
    throw new Error(`Error checking teacher access to student: ${err.message}`)
  }
}

async function associateStudentWithTeacher(studentId, teacherId) { 
  try {
    const teacherCollection = await getCollection('teacher')
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { $addToSet: { 'teaching.studentIds': studentId } }
    )

    return { success: true }
  } catch (err) {
    console.error(`Error associating student with teacher: ${err.message}`)
    throw new Error(`Error associating student with teacher: ${err.message}`)
  }
}

async function removeStudentTeacherAssociation(studentId, teacherId) { 
  try {
    const teacherCollection = await getCollection('teacher')
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { $pull: { 'teaching.studentIds': studentId } }
    )

    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(teacherId) },
      { $pull: { 'teaching.schedule': { studentId: studentId } } }
    )

    return {
      message: 'Student removed from teacher successfully',
      studentId, 
      teacherId
    }
  } catch (err) {
    console.error(`Error removing student from teacher: ${err.message}`)
    throw new Error(`Error removing student from teacher: ${err.message}`)
  }
}

function _buildCriteria(filterBy) {
  const criteria = {}

  if (filterBy.class) {
    criteria['academicInfo.class'] = filterBy.class 
  }

  if (filterBy.instrument) {
    criteria['academicInfo.instrument'] = filterBy.instrument
  }

  if (filterBy.stage) {
    criteria['academicInfo.currentStage'] = parseInt(filterBy.stage)
  }

  if (filterBy.name) {
    criteria['personalInfo.fullName'] = { $regex: filterBy.name, $options: 'i' }
  }

  if (filterBy.technicalTest) {
    criteria['academicInfo.tests.technicalTest.status'] = filterBy.technicalTest
  }

  if (filterBy.stageTest) {
    criteria['academicInfo.tests.stageTest.status'] = filterBy.stageTest
  }

  if (filterBy.teacherId) {
    criteria['enrollments.teachers'] = {
      $elemMatch: {
        teacherId: filterBy.teacherId,
        isActive: true
      }
    }
  }

  if (filterBy.orchestraId) {
    criteria['enrollments.orchestras'] = {
      $elemMatch: {
        orchestraId: filterBy.orchestraId
      }
    }
  }

  if (filterBy.schoolYearId) {
    criteria['enrollments.schoolYears'] = {
      $elemMatch: {
        schoolYearId: filterBy.schoolYearId,
        isActive: true
      }
    }
  }

  if (filterBy.showInactive) {
     if (filterBy.isActive !== undefined) {
       criteria.isActive = filterBy.isActive;
     }
  } else {
    criteria.isActive = true;
  }

  return criteria
}