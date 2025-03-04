import { getCollection } from '../../services/mongoDB.service.js'
import { validateRehearsal, validateBulkCreate, validateAttendance } from './rehearsal.validation.js'
import { ObjectId } from 'mongodb'

export const rehearsalService = {
  getRehearsals,
  getRehearsalById,
  getOrchestraRehearsals,
  addRehearsal,
  updateRehearsal,
  removeRehearsal,
  bulkCreateRehearsals,
  updateAttendance
}

async function getRehearsals(filterBy = {}) {
  try {
    const collection = await getCollection('rehearsal')
    const criteria = _buildCriteria(filterBy) 

    const rehearsal = await collection.find(criteria).sort({ date: 1 }).toArray()

    return rehearsal
  } catch (err) {
    console.error(`Failed to get rehearsals: ${err}`)
    throw new Error(`Failed to get rehearsals: ${err}`)
  }
}

async function getRehearsalById(rehearsalId) {
  try {
    const collection = await getCollection('rehearsal')
    const rehearsal = await collection.findOne({
      _id: ObjectId.createFromHexString(rehearsalId)
    })

    if (!rehearsal) throw new Error(`Rehearsal with id ${rehearsalId} not found`)
    return rehearsal
  } catch (err) {
    console.error(`Failed to get rehearsal by id: ${err}`)
    throw new Error(`Failed to get rehearsal by id: ${err}`)
  }
}

async function getOrchestraRehearsals(orchestraId, filterBy = {}) {
  try {
    filterBy.groupId = orchestraId

    return await getRehearsals(filterBy)
  } catch (err) {
    console.error(`Failed to get orchestra rehearsals: ${err}`)
    throw new Error(`Failed to get orchestra rehearsals: ${err}`)
  }
}

async function addRehearsal(rehearsalToAdd, teacherId, isAdmin = false) {
  try {
    const { error, value } = validateRehearsal(rehearsalToAdd)
    if (error) throw error

    if (!isAdmin) {
      const orchestra = await getCollection('orchestra').findOne({
        _id: ObjectId.createFromHexString(value.groupId),
        conductorId: teacherId.toString()
      })

      if (!orchestra) {
        throw new Error('Not authorized to add rehearsal for this orchestra')  
      }

      if (!value.schoolYearId) {
      const schoolYearService = require('../school-year/school-year.service.js').schoolYearService
      const currentSchoolYear = await schoolYearService.getCurrentSchoolYear()
      value.schoolYearId = currentSchoolYear._id.toString()
      }
    }

    value.createdAt = new Date()
    value.updatedAt = new Date()

    if (value.dayOfWeek === undefined) {
      const rehearsalDate = new Date(value.date)
      value.dayOfWeek = rehearsalDate.getDay()
    }

    const collection = await getCollection('rehearsal')
    const result = await collection.insertOne(value)

    if (value.type === 'תזמורת') {
      await getCollection('orchestra').updateOne(
        { _id: ObjectId.createFromHexString(value.groupId) },
        { $push: { rehearsalIds: result.insertedId.toString() } }
      )
    }

    return { id: result.insertedId, ...value }
  } catch (err) {
    console.error(`Failed to add rehearsal: ${err}`)
    throw new Error(`Failed to add rehearsal: ${err}`)
  }
}

async function updateRehearsal(rehearsalId, rehearsalToUpdate, teacherId, isAdmin = false) {
  try {
    const { error, value } = validateRehearsal(rehearsalToUpdate)

    if (error) throw error

    value.updatedAt = new Date()

    if (!isAdmin) {
      const orchestra = await getCollection('orchestra').findOne({
        _id: ObjectId.createFromHexString(value.groupId)
      })

      if (!orchestra) {
        throw new Error(`Orchestra with id ${value.groupId} not found`)
      }

      if (orchestra.conductorId !== teacherId.toString()) {
        throw new Error(`Teacher with id ${teacherId} is not the conductor of the orchestra`)
      }
    }

    const collection = await getCollection('rehearsal')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(rehearsalId) },
      { $set: value },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Rehearsal with id ${rehearsalId} not found`)
    return result
  } catch (err) {
    console.error(`Failed to update rehearsal: ${err}`)
    throw new Error(`Failed to update rehearsal: ${err}`)
  }
}

async function removeRehearsal(rehearsalId, teacherId, isAdmin = false) {
  try {
    const rehearsal = await getRehearsalById(rehearsalId)

    if (!isAdmin) {
      const orchestra = await getCollection('orchestra').findOne({
        _id: ObjectId.createFromHexString(rehearsal.groupId)
      })

      if (!orchestra) throw new Error(`Orchestra with id ${rehearsal.groupId} not found`)
      
      if (orchestra.conductorId !== teacherId.toString()) throw new Error(`Teacher with id ${teacherId} is not the conductor of the orchestra`)
    }
    
    if (rehearsal.type === 'תזמורת') {
      await getCollection('orchestra').updateOne(
        { _id: ObjectId.createFromHexString(rehearsal.groupId) },
        { $pull: { rehearsalIds: rehearsalId } }
      )
    }

    const collection = await getCollection('rehearsal')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(rehearsalId) },
      {
        $set: {
          isActive: false,
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Rehearsal with id ${rehearsalId} not found`)
    
    return result
  } catch (err) {
    console.error(`Failed to remove rehearsal: ${err}`)
    throw new Error(`Failed to remove rehearsal: ${err}`)
  }
}

async function bulkCreateRehearsals(data, teacherId, isAdmin = false) {
  try {
    const { error, value } = validateBulkCreate(data)
    if (error) throw error

    if (!isAdmin) {
      const orchestra = await getCollection('orchestra').findOne({
        _id: ObjectId.createFromHexString(value.orchestraId),
        conductorId: teacherId.toString()
      })

      if (!orchestra) {
        throw new Error('Not authorized to bulk create rehearsals for this orchestra')
      }
    }

    const {
      orchestraId,
      startDate,
      endDate,
      dayOfWeek,
      startTime,
      endTime,
      location,
      excludesDates = [],
    } = value

    const dates = _generateDatesForDayOfWeek(
      new Date(startDate),
      new Date(endDate),
      dayOfWeek,
      excludesDates.map(day => new Date(day))
    )

    const rehearsals = dates.map(date => ({
      groupId: orchestraId,
      type: 'תזמורת',
      date,
      dayOfWeek,
      startTime,
      endTime,
      location,
      attendance: { present: [], absent: [] },
      notes: "",
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }))

    if (rehearsals.length === 0) {
      return { insertedCount: 0, rehearsalIds: [] }
    }

    const collection = await getCollection('rehearsal')
    const result = { insertedCount: 0, rehearsalIds: [] }

    const batchSize = 100
    for (let i = 0; i < rehearsals.length; i += batchSize) {
      const batch = rehearsals.slice(i, i + batchSize)
      const batchResult = await collection.insertMany(batch)

      result.insertedCount += batchResult.insertedCount
      const batchIds = Object.values(batchResult.insertedIds).map(id => id.toString())
      result.rehearsalIds = [...result.rehearsalIds, ...batchIds]
    }

    if (result.rehearsalIds.length > 0) {
      await getCollection('orchestra').updateOne(
        { _id: ObjectId.createFromHexString(orchestraId) },
        { $push: { rehearsalIds: { $each: result.rehearsalIds } } }
      )
    }
    return result
  } catch (err) {
    console.error(`Failed to bulk create rehearsals: ${err}`)
    throw new Error(`Failed to bulk create rehearsals: ${err}`)
  }
}

async function updateAttendance(rehearsalId, attendanceData, isAdmin = false) {
  try {
    const { error, value } = validateAttendance(attendanceData)
    if (error) throw error

    const { present, absent } = value

    if (!isAdmin) {
      throw new Error('Not authorized to update attendance')
    }

    const rehearsal = await getRehearsalById(rehearsalId)

    const collection = await getCollection('rehearsal')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(rehearsalId) },
      {
        $set: {
          attendance: {
            present,
            absent
          },
          updatedAt: new Date()
        }
      },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Rehearsal with id ${rehearsalId} not found`)
    
    const activityCollection = await getCollection('activity_attendance')

    await activityCollection.deleteMany({
      sessionId: rehearsalId,
      activityType: 'תזמורת'
    })

    const presentPromises = present.map((studentId) =>
      activityCollection.insertOne({
        studentId,
        activityType: 'תזמורת',
        groupId: rehearsal.groupId,
        sessionId: rehearsalId,
        date: rehearsal.date,
        status: 'הגיע/ה',
        notes: '',
        createdAt: new Date()
      })
    )

    const absentPromises = absent.map(studentId => 
      activityCollection.insertOne({
        studentId,
        activityType: 'תזמורת',
        groupId: rehearsal.groupId,
        sessionId: rehearsalId,
        date: rehearsal.date,
        status: 'לא הגיע/ה',
        notes: '',
        createdAt: new Date()
      })
    )

    await Promise.all([...presentPromises, ...absentPromises])

    return result
  } catch (err) {
    console.error(`Error updating attendance ${rehearsalId}: ${err.message}`)
    throw new Error(`Error updating attendance ${rehearsalId}: ${err.message}`)
  }
}

function _generateDatesForDayOfWeek(startDate, endDate, dayOfWeek, excludesDates = []) {
    const dates = []
    const currentDate = new Date(startDate)

    currentDate.setDate(currentDate.getDate() + (dayOfWeek - currentDate.getDay() + 7) % 7)

    if (currentDate < startDate) {
      currentDate.setDate(currentDate.getDate() + 7)
    }

    while (currentDate <= endDate) {
      const shouldExclude = excludesDates.some(excludeDate => 
        excludeDate.toDateString() === currentDate.toDateString()
      )

      if (!shouldExclude) {
        dates.push(new Date(currentDate))
      }

      currentDate.setDate(currentDate.getDate() + 7)
  }
  
    return dates
}

function _buildCriteria(filterBy) {
  const criteria = {}

  if (filterBy.groupId) {
    criteria.groupId = filterBy.groupId
  }

  if (filterBy.type) {
    criteria.type = filterBy.type
  }

  if (filterBy.formDate) {
    criteria.date = criteria.date || {}
    criteria.date.$gte = new Date(filterBy.fromDate)
  }

  if (filterBy.toDate) {
    criteria.date = criteria.date || {}
    criteria.date.$lte = new Date(filterBy.toDate)
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