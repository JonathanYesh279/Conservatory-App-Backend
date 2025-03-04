import { getCollection } from '../../services/mongoDB.service.js'
import { validateBagrut } from './bagrut.validation.js'
import { ObjectId } from 'mongodb'

export const bagrutService = {
  getBagruts,
  getBagrutById,
  getBagrutByStudentId,
  addBagrut,
  updateBagrut,
  updatePresentation,
  updateMagenBagrut,
  addDocument,
  removeDocument,
  addProgramPiece,
  removeProgramPiece, 
  addAccompanist,
  removeAccompanist
}

async function getBagruts(filterBy = {}) {
  try {
    const collection = await getCollection('bagrut')
    const criteria = _buildCriteria(filterBy)

    const bagrut = await collection.find(criteria).toArray()

    return bagrut
  } catch (err) {
    console.error(`Error in bagrutService.getBagruts: ${err}`)
    throw new Error(`Error in bagrutService.getBagruts: ${err}`)
  }
}

async function getBagrutById(bagrutId) {
  try {
    const collection = await getCollection('bagrut')
    const bagrut = await collection.findOne({
      _id: ObjectId.createFromHexString(bagrutId)
    })

    if (!bagrut) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return bagrut
  } catch (err) {
    console.error(`Error in bagrutService.getBagrutById: ${err}`)
    throw new Error(`Error in bagrutService.getBagrutById: ${err}`)
  }
}

async function getBagrutByStudentId(studentId) {
  try {
    const collection = await getCollection('bagrut')
    const bagrut = await collection.findOne({
      studentId,
      isActive: true
    })

    return bagrut
  } catch (err) {
    console.error(`Error in bagrutService.getBagrutByStudentId: ${err}`)
    throw new Error(`Error in bagrutService.getBagrutByStudentId: ${err}`)
  }
}

async function addBagrut(bagrutToAdd) {
  try {
    const { error, value } = validateBagrut(bagrutToAdd)
    if (error) throw new Error(error)
    
    value.createdAt = new Date()
    value.updatedAt = new Date()

    const collection = await getCollection('bagrut')

    const existingBagrut = await collection.findOne({
      studentId: value.studentId,
      isActive: true
    })

    if (existingBagrut) throw new Error(`Bagrut for student ${value.studentId} already exists`)
    
    const result = await collection.insertOne(value)

    await getCollection('student').updateOne(
      { _id: ObjectId.createFromHexString(value.studentId) },
      { $set: { 'academicInfo.tests.bagrutId': result.insertedId } }
    )

    return { _id: result.insertedId, ...value }
  } catch (err) {
    console.error(`Error in bagrutService.addBagrut: ${err}`)
    throw new Error(`Error in bagrutService.addBagrut: ${err}`)
  }
}

async function updateBagrut(bagrutId, bagrutToUpdate) {
  try {
    const { error, value } = validateBagrut(bagrutToUpdate)
    if (error) throw new Error(`Validation error: ${error.message}`)
    
    value.updatedAt = new Date()

    const collection = await getCollection('bagrut')
    const result = await collection.updateOne(
      { _id: ObjectId.createFromHexString(bagrutId) },
      { $set: value },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.updateBagrut: ${err}`)
    throw new Error(`Error in bagrutService.updateBagrut: ${err}`)
  }
}

async function updatePresentation(bagrutId, presentationIndex, presentationData, teacherId) {
  try {
    if (presentationIndex < 0 || presentationIndex > 2) {
      throw new Error(`Invalid presentation index: ${presentationIndex}`)
    }

    presentationData.date = new Date()
    presentationData.reviewedBy = teacherId

    const collection = await getCollection('bagrut')
    const updateField = `presentations.${presentationIndex}`

    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(bagrutId) },
      {
        $set: {
          [updateField]: presentationData,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.updatePresentation: ${err}`)
    throw new Error(`Error in bagrutService.updatePresentation: ${err}`)
  }
}

async function updateMagenBagrut(bagrutId, magenBagrutData, teacherId) {
  try {
    magenBagrutData.date = new Date()
    magenBagrutData.reviewedBy = teacherId

    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(bagrutId) },
      {
        $set: {
          magenBagrut: magenBagrutData,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.updateMagenBagrut: ${err}`)
    throw new Error(`Error in bagrutService.updateMagenBagrut: ${err}`)
  }
}

async function addDocument(bagrutId, documentData, teacherId) {
  try {
    documentData.uploadDate = new Date()
    documentData.uploadedBy = teacherId

    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(bagrutId) },
      {
        $push: { documents: documentData },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.addDocument: ${err}`)
    throw new Error(`Error in bagrutService.addDocument: ${err}`)
  }
}

async function removeDocument(bagrutId, documentId) {
  try {
    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(bagrutId) },
      {
        $pull: { documents: { _id: ObjectId.createFromHexString(documentId) } },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.removeDocument: ${err}`)
    throw new Error(`Error in bagrutService.removeDocument: ${err}`)
  }
}

async function addProgramPiece(bagrutId, pieceData) {
  try {
    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(bagrutId) },
      {
        $push: { program: pieceData },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.addProgramPiece: ${err}`)
    throw new Error(`Error in bagrutService.addProgramPiece: ${err}`)
  }
}

async function removeProgramPiece(bagrutId, pieceId) {
  try {
    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(bagrutId) },
      {
        $pull: { program: { _id: ObjectId.createFromHexString(pieceId) } },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.removeProgramPiece: ${err}`)
    throw new Error(`Error in bagrutService.removeProgramPiece: ${err}`)
  }
}

async function addAccompanist(bagrutId, accompanistData) {
  try {
    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(bagrutId) },
      {
        $push: { 'accompaniment.accompanists': accompanistData },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.addAccompanist: ${err}`)
    throw new Error(`Error in bagrutService.addAccompanist: ${err}`)
  }
}

async function removeAccompanist(bagrutId, accompanistId) {
  try {
    const collection = await getCollection('bagrut')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(bagrutId) },
      {
        $pull: { 'accompaniment.accompanists': { _id: ObjectId.createFromHexString(accompanistId) } },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Bagrut with id ${bagrutId} not found`)
    return result
  } catch (err) {
    console.error(`Error in bagrutService.removeAccompanist: ${err}`)
    throw new Error(`Error in bagrutService.removeAccompanist: ${err}`)
  }
}

function _buildCriteria(filterBy) {
  const criteria = {}

  if (filterBy.studentId) {
    criteria.studentId = filterBy.studentId
  }

  if (filterBy.teacherId) {
    criteria.teacherId = filterBy.teacherId
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