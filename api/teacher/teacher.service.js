import { getCollection } from '../../services/mongoDB.service.js'
import { validateTeacher } from './teacher.validation.js'
import { ObjectId } from 'mongodb'
import { authService } from '../auth/auth.service.js'

export const teacherService = {
  getTeachers,
  getTeacherById,
  addTeacher,
  updateTeacher,
  removeTeacher,
  getTeacherByRole
}

async function getTeachers(filterBy) {
  try {
    const collection = await getCollection('teacher')
    const criteria = _buildCriteria(filterBy)

    const teachers = await collection
      .find(criteria)
      .toArray()
    return teachers
  } catch (err) {
    console.error(`Error getting teachers: ${err.message}`)
    throw new Error(`Error getting teachers: ${err.message}`) 
  }
}

async function getTeacherById(teacherId) {
  try { 
    const collection = await getCollection('teacher')
    const teacher = await collection.findOne({ _id: ObjectId.createFromHexString(teacherId) })

    if (!teacher) throw new Error(`Teacher with id ${teacherId} not found`)
    return teacher
  } catch (err) {
    console.error(`Error getting teacher by id: ${err.message}`)
    throw new Error(`Error getting teacher by id: ${err.message}`) 
  }
}

async function addTeacher(teacherToAdd) {
  try {
    const { error, value } = validateTeacher(teacherToAdd)
    if (error) throw new Error(`Invalid teacher data: ${error.message}`)
    
    value.credentials.password = await authService.encryptPassword(value.credentials.password)
    
    value.createdAt = new Date()
    value.updatedAt = new Date()

    const collection = await getCollection('teacher')
    const result = await collection.insertOne(value)
    return { _id: result.insertedId, ...value }
  } catch (err) {
    console.error(`Error adding teacher: ${err.message}`)
    throw new Error(`Error adding teacher: ${err.message}`)
  }
}

async function updateTeacher(teacherId, teacherToUpdate) {
  try {
    const { error, value } = validateTeacher(teacherToUpdate)
    if (error) throw new Error(`Invalid teacher data: ${error.message}`)
    
    value.updatedAt = new Date()

    const collection = await getCollection('teacher')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(teacherId) },
      { $set: value },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Teacher with id ${teacherId} not found`)
    return result
  } catch (err) {
    console.error(`Error updating teacher: ${err.message}`)
    throw new Error(`Error updating teacher: ${err.message}`)
  }
}

async function removeTeacher(teacherId) {
  try {
    const collection = await getCollection('teacher')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(teacherId) },
      {
        $set: {
          isActive: false,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Teacher with id ${teacherId} not found`)
    return result
  } catch (err) {
    console.error(`Error removing teacher: ${err.message}`)
    throw new Error(`Error removing teacher: ${err.message}`)
  }
}

async function getTeacherByRole(role) {
  try {
    const collection = await getCollection('teacher')
    return await collection.find({
      roles: role,
      isActive: true
    }).toArray()
  } catch (err) {
    console.error(`Error getting teacher by role: ${err.message}`)
    throw new Error(`Error getting teacher by role: ${err.message}`)
  }
}

function _buildCriteria(filterBy) {
  const criteria = {}

  if (filterBy.name) {
    criteria['personalInfo.fullName'] = { $regex: filterBy.name, $options: 'i' }
  }

  if (filterBy.instrument) {
    criteria['personalInfo.instrument'] = filterBy.instrument
  }

  if (filterBy.studentId) {
    criteria['teaching.studentIds'] = filterBy.studentId
  }

  if (filterBy.orchestraId) {
    criteria['conducting.orchestraIds'] = filterBy.orchestraId
  }

  if (filterBy.ensembleId) {
    criteria['ensembleIds'] = filterBy.ensembleId
  }

  if (filterBy.showInactive) {
    if (filterBy.isActive !== undefined) {
      criteria.isActive = filterBy.isActive
    }
  } else {
    criteria.isActive = true
  }

  return criteria
}