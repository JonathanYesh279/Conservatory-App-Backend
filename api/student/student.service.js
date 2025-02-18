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

    value.createdAt = new Date()
    value.updatedAt = new Date()

    const collection = await getCollection('student')
    const result = await collection.insertOne(value)
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

    value.updatedAt = new Date()

    const collection = await getCollection('student')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(studentId) },
      { $set: value },
      { returnDocument: 'after' }
    )

    if (!result.value) throw new Error(`Student with id ${studentId} not found`)
    return result.value
  } catch (err) {
    console.error(`Error updating student: ${err.message}`)
    throw new Error(`Error updating student: ${err.message}`)
  }
}

async function removeStudent(studentId) {
  try {
    const collection = await getCollection('student')
    const result = await collection.findOneandUpdate(
      { _id: ObjectId.createFromHexString(studentId) },
      {
        $set: {
         isActive: false,
        }
      },
      { returnDocument: 'after' }
    )

    if (!result.value) throw new Error(`Student with id ${studentId} not found`)
    return result.value
  } catch (err) {
    console.error(`Error removing student ${studentId}: ${err.message}`)
    throw err
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

  if (filterBy.showInactive) {
     if (filterBy.isActive !== undefined) {
       criteria.isActive = filterBy.isActive;
     }
  } else {
    criteria.isActive = true;
  }

  return criteria
}