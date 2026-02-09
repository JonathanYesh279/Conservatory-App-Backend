import { getCollection } from '../../services/mongoDB.service.js'
import { validateOrchestra } from './orchestra.validation.js'
import { ObjectId } from 'mongodb'
import { createLogger } from '../../services/logger.service.js'

const logger = createLogger('orchestraService')

export const orchestraService = {
  getOrchestras,
  getOrchestraById,
  addOrchestra,
  updateOrchestra,
  removeOrchestra,
  addMember,
  removeMember,
  updateRehearsalAttendance,
  getRehearsalAttendance,
  getStudentAttendanceStats
}

async function getOrchestras(filterBy) {
  try {
    const collection = await getCollection('orchestra')
    const criteria = _buildCriteria(filterBy)

    const orchestras = await collection.aggregate([
      { $match: criteria },
      {
        $lookup: {
          from: 'student',
          let: { memberIds: { $ifNull: ['$memberIds', []] } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $cond: {
                    if: { $eq: [{ $size: '$$memberIds' }, 0] },
                    then: false, // No members to match
                    else: {
                      $in: [
                        '$_id',
                        {
                          $map: {
                            input: '$$memberIds',
                            as: 'memberId',
                            in: { $toObjectId: '$$memberId' }
                          }
                        }
                      ]
                    }
                  }
                }
              }
            },
            {
              $project: {
                _id: 1,
                personalInfo: 1,
                academicInfo: 1,
                enrollments: 1,
                contactInfo: 1
              }
            }
          ],
          as: 'members'
        }
      },
      {
        $lookup: {
          from: 'teacher',
          let: { conductorId: '$conductorId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: '$_id' }, '$$conductorId']
                }
              }
            },
            {
              $project: {
                _id: 1,
                personalInfo: 1,
                roles: 1,
                conducting: 1
              }
            }
          ],
          as: 'conductor'
        }
      },
      {
        $addFields: {
          conductor: { $arrayElemAt: ['$conductor', 0] }
        }
      }
    ]).toArray()

    return orchestras
  } catch (err) {
    logger.error({ err: err.message }, 'Error in getOrchestras')
    throw new Error(`Error in orchestraService.getOrchestras: ${err}`)
  }
}

async function getOrchestraById(orchestraId) {
  try {
    const collection = await getCollection('orchestra')

    const orchestras = await collection.aggregate([
      { $match: { _id: ObjectId.createFromHexString(orchestraId) } },
      {
        $lookup: {
          from: 'student',
          let: { memberIds: { $ifNull: ['$memberIds', []] } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $cond: {
                    if: { $eq: [{ $size: '$$memberIds' }, 0] },
                    then: false, // No members to match
                    else: {
                      $in: [
                        '$_id',
                        {
                          $map: {
                            input: '$$memberIds',
                            as: 'memberId',
                            in: { $toObjectId: '$$memberId' }
                          }
                        }
                      ]
                    }
                  }
                }
              }
            },
            {
              $project: {
                _id: 1,
                personalInfo: 1,
                academicInfo: 1,
                enrollments: 1,
                contactInfo: 1
              }
            }
          ],
          as: 'members'
        }
      },
      {
        $lookup: {
          from: 'teacher',
          let: { conductorId: '$conductorId' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [{ $toString: '$_id' }, '$$conductorId']
                }
              }
            },
            {
              $project: {
                _id: 1,
                personalInfo: 1,
                roles: 1,
                conducting: 1
              }
            }
          ],
          as: 'conductor'
        }
      },
      {
        $addFields: {
          conductor: { $arrayElemAt: ['$conductor', 0] }
        }
      }
    ]).toArray()

    const orchestra = orchestras[0]

    if (!orchestra) throw new Error(`Orchestra with id ${orchestraId} not found`)
    return orchestra
  } catch (err) {
    logger.error({ orchestraId, err: err.message }, 'Error in getOrchestraById')
    throw new Error(`Error in orchestraService.getOrchestraById: ${err}`)
  }
}

async function addOrchestra(orchestraToAdd) {
  try {
    const { error, value } = validateOrchestra(orchestraToAdd);

    if (error) throw new Error(`Validation error: ${error.message}`);

    if (!value.schoolYearId) {
      const schoolYearService =
        require('../school-year/school-year.service.js').schoolYearService;
      const currentSchoolYear = await schoolYearService.getCurrentSchoolYear();
      value.schoolYearId = currentSchoolYear._id.toString();
    }

    // Insert into orchestra collection
    const collection = await getCollection('orchestra');
    const result = await collection.insertOne(value);

    // Get teacher collection explicitly and check if it's valid
    const teacherCollection = await getCollection('teacher');
    if (
      !teacherCollection ||
      typeof teacherCollection.updateOne !== 'function'
    ) {
      logger.error('Teacher collection is not valid');
      throw new Error(
        'Database connection issue: Cannot access teacher collection'
      );
    }

    // Update teacher record
    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(value.conductorId) },
      {
        $push: { 'conducting.orchestraIds': result.insertedId.toString() },
      }
    );

    return { _id: result.insertedId, ...value };
  } catch (err) {
    logger.error({ err: err.message }, 'Error in addOrchestra');
    throw new Error(`Error in orchestraService.addOrchestra: ${err}`);
  }
}

async function updateOrchestra(orchestraId, orchestraToUpdate, teacherId, isAdmin = false, userRoles = []) {
  try {
    const { error, value } = validateOrchestra(orchestraToUpdate)
    if (error) throw new Error(`Validation error: ${error.message}`)

    const collection = await getCollection('orchestra')
    const existingOrchestra = await getOrchestraById(orchestraId)

    // Check authorization: admin can always edit, conductor can edit only if they conduct this orchestra
    const isConductor = userRoles.includes('מנצח')
    const isEnsembleInstructor = userRoles.includes('מדריך הרכב')
    const canEditBasedOnRole = isConductor || isEnsembleInstructor
    const isAssignedConductor = existingOrchestra.conductorId === teacherId.toString()

    if (!isAdmin && !(canEditBasedOnRole && isAssignedConductor)) {
      throw new Error('Not authorized to modify this orchestra')
    }

    if (existingOrchestra.conductorId !== value.conductorId) {
      const teacherCollection = await getCollection('teacher')

      await teacherCollection.updateOne(
        { _id: ObjectId.createFromHexString(existingOrchestra.conductorId) },
        {
          $pull: { 'conducting.orchestraIds': orchestraId }
        }
      )

      await teacherCollection.updateOne(
        { _id: ObjectId.createFromHexString(value.conductorId) },
        {
          $push: { 'conducting.orchestraIds': orchestraId }
        }
      )
    }

    // ALWAYS preserve memberIds and rehearsalIds from the existing document.
    // These arrays are only modified through their dedicated endpoints
    // (addMember/removeMember for members, rehearsal service for rehearsals).
    // The updateOrchestra endpoint is for basic fields only (name, type, location, etc).
    const updateValue = { ...value }
    updateValue.memberIds = existingOrchestra.memberIds || []
    updateValue.rehearsalIds = existingOrchestra.rehearsalIds || []

    // Add lastModified timestamp
    updateValue.lastModified = new Date()

    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(orchestraId) },
      { $set: updateValue },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Orchestra with id ${orchestraId} not found`)

    // Return populated orchestra with full member data
    return await getOrchestraById(orchestraId)
  } catch (err) {
    logger.error({ orchestraId, err: err.message }, 'Error in updateOrchestra')
    throw new Error(`Error in orchestraService.updateOrchestra: ${err}`)
  }
}

async function removeOrchestra(orchestraId, teacherId, isAdmin = false, userRoles = []) {
  try {
    const collection = await getCollection('orchestra');
    const orchestra = await getOrchestraById(orchestraId);

    // Only admin can delete orchestras
    if (!isAdmin) {
      throw new Error('Not authorized to modify this orchestra');
    }

    const teacherCollection = await getCollection('teacher');
    if (
      !teacherCollection ||
      typeof teacherCollection.updateOne !== 'function'
    ) {
      throw new Error(
        'Teacher collection not available or updateOne method not found'
      );
    }

    await teacherCollection.updateOne(
      { _id: ObjectId.createFromHexString(orchestra.conductorId) },
      {
        $pull: { 'conducting.orchestraIds': orchestraId },
      }
    );

    const studentCollection = await getCollection('student');
    if (
      !studentCollection ||
      typeof studentCollection.updateMany !== 'function'
    ) {
      throw new Error(
        'Student collection not available or updateMany method not found'
      );
    }

    await studentCollection.updateMany(
      { 'enrollments.orchestraIds': orchestraId },
      {
        $pull: { 'enrollments.orchestraIds': orchestraId },
      }
    );

    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(orchestraId) },
      { $set: { isActive: false } },
      { returnDocument: 'after' }
    );

    if (!result) throw new Error(`Orchestra with id ${orchestraId} not found`);
    return result;
  } catch (err) {
    logger.error({ orchestraId, err: err.message }, 'Error in removeOrchestra');
    throw new Error(`Error in orchestraService.removeOrchestra: ${err}`);
  }
}

async function addMember(orchestraId, studentId, teacherId, isAdmin = false, userRoles = []) {
  try {
    const orchestra = await getOrchestraById(orchestraId)

    // Check authorization: admin can always edit, conductor can edit only if they conduct this orchestra
    const isConductor = userRoles.includes('מנצח')
    const isEnsembleInstructor = userRoles.includes('מדריך הרכב')
    const canEditBasedOnRole = isConductor || isEnsembleInstructor
    const isAssignedConductor = orchestra.conductorId === teacherId.toString()

    if (!isAdmin && !(canEditBasedOnRole && isAssignedConductor)) {
      throw new Error('Not authorized to modify this orchestra')
    }

    // Step 1: Update orchestra memberIds FIRST (authoritative side)
    const collection = await getCollection('orchestra')
    const orchestraResult = await collection.updateOne(
      { _id: ObjectId.createFromHexString(orchestraId) },
      { $addToSet: { memberIds: studentId } }
    )

    if (orchestraResult.matchedCount === 0) {
      throw new Error(`Orchestra with id ${orchestraId} not found`)
    }

    logger.info({ orchestraId, studentId, modified: orchestraResult.modifiedCount }, 'Updated orchestra memberIds')

    // Step 2: Update student enrollments
    try {
      const studentCollection = await getCollection('student')
      await studentCollection.updateOne(
        { _id: ObjectId.createFromHexString(studentId) },
        { $addToSet: { 'enrollments.orchestraIds': orchestraId } }
      )
      logger.info({ orchestraId, studentId }, 'Updated student enrollments.orchestraIds')
    } catch (studentErr) {
      // Rollback orchestra update
      logger.error({ orchestraId, studentId, err: studentErr.message }, 'Student update failed, rolling back orchestra memberIds')
      await collection.updateOne(
        { _id: ObjectId.createFromHexString(orchestraId) },
        { $pull: { memberIds: studentId } }
      )
      throw studentErr
    }

    // Return populated orchestra with full member data
    return await getOrchestraById(orchestraId)
  } catch (err) {
    logger.error({ orchestraId, studentId, err: err.message }, 'Error in addMember')
    throw new Error(`Error in orchestraService.addMember: ${err}`)
  }
}

async function removeMember(orchestraId, studentId, teacherId, isAdmin = false, userRoles = []) {
  try {
    const orchestra = await getOrchestraById(orchestraId)

    // Check authorization: admin can always edit, conductor can edit only if they conduct this orchestra
    const isConductor = userRoles.includes('מנצח')
    const isEnsembleInstructor = userRoles.includes('מדריך הרכב')
    const canEditBasedOnRole = isConductor || isEnsembleInstructor
    const isAssignedConductor = orchestra.conductorId === teacherId.toString()

    if (!isAdmin && !(canEditBasedOnRole && isAssignedConductor)) {
      throw new Error('Not authorized to modify this orchestra')
    }

    // Step 1: Update orchestra memberIds FIRST (authoritative side)
    const collection = await getCollection('orchestra')
    const orchestraResult = await collection.updateOne(
      { _id: ObjectId.createFromHexString(orchestraId) },
      { $pull: { memberIds: studentId } }
    )

    if (orchestraResult.matchedCount === 0) {
      throw new Error(`Orchestra with id ${orchestraId} not found`)
    }

    logger.info({ orchestraId, studentId, modified: orchestraResult.modifiedCount }, 'Removed student from orchestra memberIds')

    // Step 2: Update student enrollments
    try {
      const studentCollection = await getCollection('student')
      await studentCollection.updateOne(
        { _id: ObjectId.createFromHexString(studentId) },
        { $pull: { 'enrollments.orchestraIds': orchestraId } }
      )
      logger.info({ orchestraId, studentId }, 'Removed orchestraId from student enrollments')
    } catch (studentErr) {
      // Rollback orchestra update
      logger.error({ orchestraId, studentId, err: studentErr.message }, 'Student update failed, rolling back orchestra memberIds')
      await collection.updateOne(
        { _id: ObjectId.createFromHexString(orchestraId) },
        { $addToSet: { memberIds: studentId } }
      )
      throw studentErr
    }

    // Return populated orchestra with full member data
    return await getOrchestraById(orchestraId)
  } catch (err) {
    logger.error({ orchestraId, studentId, err: err.message }, 'Error in removeMember')
    throw new Error(`Error in orchestraService.removeMember: ${err}`)
  }
}

async function updateRehearsalAttendance(rehearsalId, attendance, teacherId, isAdmin = false, userRoles = []) {
  try {
    const rehearsalCollection = await getCollection('rehearsal')
    const rehearsal = await rehearsalCollection.findOne({
      _id: ObjectId.createFromHexString(rehearsalId)
    }) 

    if (!rehearsal) throw new Error(`Rehearsal with id ${rehearsalId} not found`)
    
    const orchestra = await getOrchestraById(rehearsal.groupId)
    
    // Check authorization: admin can always edit, conductor can edit only if they conduct this orchestra
    const isConductor = userRoles.includes('מנצח')
    const isEnsembleInstructor = userRoles.includes('מדריך הרכב')
    const canEditBasedOnRole = isConductor || isEnsembleInstructor
    const isAssignedConductor = orchestra.conductorId === teacherId.toString()
    
    if (!isAdmin && !(canEditBasedOnRole && isAssignedConductor)) {
      throw new Error('Not authorized to modify this orchestra')
    }
    
    const updatedRehearsal = await rehearsalCollection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(rehearsalId) },
      { $set: { attendance } },
      { returnDocument: 'after' }
    )
    
    const activityCollection = await getCollection('activity_attendance')

    const presentPromises = attendance.present.map(studentId =>
      activityCollection.updateOne(
        {
          studentId,
          sessionId: rehearsalId,
          activityType: 'תזמורת',
        },
        {
          $set: {
            groupId: rehearsal.groupId,
            date: rehearsal.date,
            status: 'הגיע/ה',
            createdAt: new Date(),
          }
        },
        { upsert: true }
      )
    )

    const absentPromises = attendance.absent.map(studentId => 
      activityCollection.updateOne(
          {
            studentId,
            sessionId: rehearsalId,
            activityType: 'תזמורת',
          },
          {
            $set: {
              groupId: rehearsal.groupId,
              date: rehearsal.date,
              status: 'לא הגיע/ה',
              createdAt: new Date(),
            }
          },
          { upsert: true }
      )
    )
    
    await Promise.all([...presentPromises, ...absentPromises])
    return updatedRehearsal
  } catch (err) {
    logger.error({ rehearsalId, err: err.message }, 'Error in updateRehearsalAttendance')
    throw new Error(`Error in orchestraService.updateRehearsalAttendance: ${err}`)
  }
}

async function getRehearsalAttendance(rehearsalId) {
  try {
    const rehearsalCollection = await getCollection('rehearsal')
    const rehearsal = await rehearsalCollection.findOne({
      _id: ObjectId.createFromHexString(rehearsalId)
    })

    if (!rehearsal) throw new Error(`Rehearsal with id ${rehearsalId} not found`)
    return rehearsal.attendance
  } catch (err) {
    logger.error({ rehearsalId, err: err.message }, 'Error in getRehearsalAttendance')
    throw new Error(`Error in orchestraService.getRehearsalAttendance: ${err}`)
  }
}

async function getStudentAttendanceStats(orchestraId, studentId) {
  try {
    const activityCollection = await getCollection('activity_attendance');

    const attendanceRecords = await activityCollection.find({
      groupId: orchestraId,
      studentId,
      activityType: 'תזמורת'
    }).toArray()

    const totalRehearsals = attendanceRecords.length
    const attended = attendanceRecords.filter(record => record.status === 'הגיע/ה').length
    const attendanceRate = totalRehearsals ? (attended / totalRehearsals) * 100 : 0

    const recentHistory = attendanceRecords
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 10)
      .map((record) => ({
        date: record.date,
        status: record.status,
        sessionId: record.sessionId,
        notes: record.notes,
      }))

    const result = {
      totalRehearsals,
      attended,
      attendanceRate,
      recentHistory,
    }

    // For empty results, add a message
    if (totalRehearsals === 0) {
      result.message =
        'No attendance records found for this student in this orchestra'
    }
    return result
  } catch (err) {
    logger.error({ orchestraId, studentId, err: err.message }, 'Error in getStudentAttendanceStats')
    throw new Error(`Error in orchestraService.getStudentAttendanceStats: ${err}`)
  }
}

function _buildCriteria(filterBy) {
  const criteria = {}

  // Handle batch fetching by IDs - highest priority
  if (filterBy.ids) {
    const idsArray = Array.isArray(filterBy.ids) ? filterBy.ids : filterBy.ids.split(',')
    criteria._id = {
      $in: idsArray.map(id => ObjectId.createFromHexString(id.trim()))
    }
    // When fetching by specific IDs, return all (active and inactive)
    return criteria
  }

  if (filterBy.name) {
    criteria.name = { $regex: filterBy.name, $options: 'i' }
  }

  if (filterBy.type) {
    criteria.type = filterBy.type
  }

  if (filterBy.conductorId) {
    criteria.conductorId = filterBy.conductorId
  }

  if (filterBy.memberId) {
    criteria.memberIds = filterBy.memberId
  }

  if (filterBy.schoolYearId) {
    criteria.schoolYearId = filterBy.schoolYearId
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

