import { getCollection } from '../../services/mongoDB.service.js'
import { validateOrchestra } from './orchestra.validation.js'
import { ObjectId } from 'mongodb'

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
    console.log('🔍 orchestraService.getOrchestras called with filterBy:', filterBy)
    const collection = await getCollection('orchestra')
    const criteria = _buildCriteria(filterBy)
    console.log('🔍 Built criteria:', criteria)

    // Use aggregation pipeline to populate members with full student data
    console.log('🔍 Starting aggregation pipeline...')
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

    console.log('🔍 Aggregation completed. Found orchestras:', orchestras.length)
    if (orchestras.length > 0) {
      console.log('🔍 First orchestra sample:')
      console.log('   - Name:', orchestras[0].name)
      console.log('   - Members count:', orchestras[0].members ? orchestras[0].members.length : 'undefined')
      console.log('   - MemberIds:', orchestras[0].memberIds)
      console.log('   - Members data sample:', JSON.stringify(orchestras[0].members?.slice(0, 1), null, 2))
      console.log('   - Conductor populated:', !!orchestras[0].conductor)
      
      // Special debugging for specific orchestra
      const targetOrchestra = orchestras.find(o => o._id.toString() === '687a77cdca26e53e23b0ce4b')
      if (targetOrchestra) {
        console.log('🎯 FOUND TARGET ORCHESTRA 687a77cdca26e53e23b0ce4b:')
        console.log('   - Name:', targetOrchestra.name)
        console.log('   - MemberIds array:', targetOrchestra.memberIds)
        console.log('   - MemberIds length:', targetOrchestra.memberIds ? targetOrchestra.memberIds.length : 0)
        console.log('   - Members populated:', targetOrchestra.members ? targetOrchestra.members.length : 0)
        if (targetOrchestra.members && targetOrchestra.members.length > 0) {
          console.log('   - Populated member details:', targetOrchestra.members.map(m => ({
            _id: m._id,
            name: m.personalInfo ? `${m.personalInfo.firstName} ${m.personalInfo.lastName}` : 'No name'
          })))
        }
      }
    }

    return orchestras
  } catch (err) {
    console.error(`Error in orchestraService.getOrchestras: ${err}`)
    throw new Error(`Error in orchestraService.getOrchestras: ${err}`)
  }
}

async function getOrchestraById(orchestraId) {
  try {
    console.log('🔍 getOrchestraById called with:', orchestraId)
    const collection = await getCollection('orchestra')
    
    // First, let's check what's actually in the database
    if (orchestraId === '687a77cdca26e53e23b0ce4b') {
      const rawOrchestra = await collection.findOne({ _id: ObjectId.createFromHexString(orchestraId) })
      console.log('🎯 RAW DATABASE DATA for orchestra 687a77cdca26e53e23b0ce4b:')
      console.log('   - memberIds:', rawOrchestra ? rawOrchestra.memberIds : 'Not found')
      console.log('   - memberIds type:', rawOrchestra && rawOrchestra.memberIds ? typeof rawOrchestra.memberIds : 'N/A')
      console.log('   - memberIds length:', rawOrchestra && rawOrchestra.memberIds ? rawOrchestra.memberIds.length : 0)
    }
    
    // Use aggregation pipeline to populate members with full student data
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
    
    // Debug logging for specific orchestra
    if (orchestraId === '687a77cdca26e53e23b0ce4b' && orchestra) {
      console.log('🎯 AGGREGATION RESULT for orchestra 687a77cdca26e53e23b0ce4b:')
      console.log('   - Orchestra found:', !!orchestra)
      console.log('   - memberIds:', orchestra.memberIds)
      console.log('   - members populated count:', orchestra.members ? orchestra.members.length : 0)
      if (orchestra.members && orchestra.members.length > 0) {
        console.log('   - Member details:', orchestra.members.map(m => ({
          _id: m._id,
          name: m.personalInfo ? `${m.personalInfo.firstName} ${m.personalInfo.lastName}` : 'No name'
        })))
      } else {
        console.log('   - ⚠️ No members populated despite having memberIds!')
      }
    }
    
    if (!orchestra) throw new Error(`Orchestra with id ${orchestraId} not found`)
    return orchestra
  } catch (err) {
    console.error(`Error in orchestraService.getOrchestraById: ${err}`)
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
      console.error('Teacher collection is not valid:', teacherCollection);
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
    console.error(`Error in orchestraService.addOrchestra: ${err}`);
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

    // 🔥 CRITICAL FIX: Preserve memberIds and rehearsalIds from existing document
    // The frontend may send partial updates without these arrays, and the validation
    // schema applies default([]) which would wipe out existing data.
    // Only use the validated value if it was EXPLICITLY provided in the original request
    // AND contains actual data (not just an empty default).
    const updateValue = { ...value }

    // Preserve memberIds: Only update if explicitly provided with actual member IDs
    // The orchestraToUpdate check ensures we use frontend intent, not validation defaults
    if (!orchestraToUpdate.memberIds || orchestraToUpdate.memberIds.length === 0) {
      // Frontend didn't send memberIds or sent empty array - preserve existing
      updateValue.memberIds = existingOrchestra.memberIds || []
      console.log(`🛡️ PROTECTION: Preserving ${updateValue.memberIds.length} memberIds for orchestra ${orchestraId}`)
    } else {
      console.log(`📝 UPDATE: Frontend explicitly sent ${orchestraToUpdate.memberIds.length} memberIds for orchestra ${orchestraId}`)
    }

    // Preserve rehearsalIds: Only update if explicitly provided with actual rehearsal IDs
    if (!orchestraToUpdate.rehearsalIds || orchestraToUpdate.rehearsalIds.length === 0) {
      // Frontend didn't send rehearsalIds or sent empty array - preserve existing
      updateValue.rehearsalIds = existingOrchestra.rehearsalIds || []
      console.log(`🛡️ PROTECTION: Preserving ${updateValue.rehearsalIds.length} rehearsalIds for orchestra ${orchestraId}`)
    } else {
      console.log(`📝 UPDATE: Frontend explicitly sent ${orchestraToUpdate.rehearsalIds.length} rehearsalIds for orchestra ${orchestraId}`)
    }

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
    console.error(`Error in orchestraService.updateOrchestra: ${err}`)
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
    console.error(`Error in orchestraService.removeOrchestra: ${err}`);
    throw new Error(`Error in orchestraService.removeOrchestra: ${err}`);
  }
}

async function addMember(orchestraId, studentId, teacherId, isAdmin = false, userRoles = []) {
  try {
    console.log('=== ADD MEMBER SERVICE DEBUG ===')
    console.log('Parameters received:', {
      orchestraId,
      studentId,
      teacherId,
      isAdmin,
      userRoles
    })
    
    const orchestra = await getOrchestraById(orchestraId)
    console.log('Orchestra found:', {
      _id: orchestra._id,
      name: orchestra.name,
      conductorId: orchestra.conductorId
    })

    // Check authorization: admin can always edit, conductor can edit only if they conduct this orchestra
    const isConductor = userRoles.includes('מנצח')
    const isEnsembleInstructor = userRoles.includes('מדריך הרכב')
    const canEditBasedOnRole = isConductor || isEnsembleInstructor
    const isAssignedConductor = orchestra.conductorId === teacherId.toString()
    
    console.log('Authorization check:', {
      isConductor,
      isEnsembleInstructor,
      canEditBasedOnRole,
      isAssignedConductor,
      isAdmin,
      orchestraConductorId: orchestra.conductorId,
      requestingTeacherId: teacherId.toString()
    })
    
    if (!isAdmin && !(canEditBasedOnRole && isAssignedConductor)) {
      console.error('❌ Authorization failed in addMember service')
      throw new Error('Not authorized to modify this orchestra')
    }
    
    console.log('✅ Authorization passed, updating student enrollment')
    console.log('🔍 Student ID to update:', studentId)
    console.log('🔍 Orchestra ID to add:', orchestraId)
    
    const studentCollection = await getCollection('student')
    const studentUpdateResult = await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { $addToSet: { 'enrollments.orchestraIds': orchestraId } }
    )
    
    console.log('🔍 Student update result:', {
      acknowledged: studentUpdateResult.acknowledged,
      matchedCount: studentUpdateResult.matchedCount,
      modifiedCount: studentUpdateResult.modifiedCount,
      upsertedCount: studentUpdateResult.upsertedCount
    })
    
    console.log('✅ Student enrollment updated, updating orchestra member list')
    const collection = await getCollection('orchestra')
    
    console.log('🔍 Before update - attempting to add studentId:', studentId)
    console.log('🔍 Orchestra ID for update:', orchestraId)
    
    // First, let's use updateOne to get more detailed update information
    const updateResult = await collection.updateOne(
      { _id: ObjectId.createFromHexString(orchestraId) },
      { $addToSet: { memberIds: studentId } }
    )
    
    console.log('🔍 Update operation result:', {
      acknowledged: updateResult.acknowledged,
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
      upsertedCount: updateResult.upsertedCount
    })
    
    if (updateResult.matchedCount === 0) {
      console.error('❌ Orchestra not found during update')
      throw new Error(`Orchestra with id ${orchestraId} not found`)
    }
    
    if (updateResult.acknowledged && updateResult.matchedCount > 0) {
      console.log('✅ Database update operation completed successfully')
      
      // Now fetch the updated document to verify
      const updatedOrchestra = await collection.findOne({ _id: ObjectId.createFromHexString(orchestraId) })
      
      console.log('🔍 Verification - Updated orchestra memberIds:', {
        memberCount: updatedOrchestra.memberIds ? updatedOrchestra.memberIds.length : 0,
        memberIds: updatedOrchestra.memberIds,
        contains_new_student: updatedOrchestra.memberIds ? updatedOrchestra.memberIds.includes(studentId) : false
      })
      
      if (!updatedOrchestra.memberIds.includes(studentId)) {
        console.error('❌ CRITICAL: Student was not added to memberIds array despite successful update!')
        console.error('Database state after update:', updatedOrchestra.memberIds)
        console.error('Attempted to add studentId:', studentId)
        throw new Error('Database inconsistency: Student not added to orchestra memberIds')
      } else {
        console.log('✅ Student successfully added to memberIds array - verification passed')
      }
    } else {
      console.error('❌ Database update was not acknowledged')
      throw new Error('Database update failed - operation not acknowledged')
    }
    
    console.log('✅ Orchestra member list updated successfully')
    
    // Return populated orchestra with full member data
    return await getOrchestraById(orchestraId)
  } catch (err) {
    console.error(`❌ Error in orchestraService.addMember: ${err}`)
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
    
    const studentCollection = await getCollection('student')
    await studentCollection.updateOne(
      { _id: ObjectId.createFromHexString(studentId) },
      { $pull: { 'enrollments.orchestraIds': orchestraId } }
    )

    const collection = await getCollection('orchestra')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(orchestraId) },
      { $pull: { memberIds: studentId } },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`Orchestra with id ${orchestraId} not found`)
    
    // Return populated orchestra with full member data
    return await getOrchestraById(orchestraId)
  } catch (err) {
    console.error(`Error in orchestraService.removeMember: ${err}`)
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
    console.error(`Error in orchestraService.updateRehearsalAttendance: ${err}`)
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
    console.error(`Error in orchestraService.getRehearsalAttendance: ${err}`)
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
    console.error(`Error in orchestraService.getStudentAttendanceStats: ${err}`)
    throw new Error(`Error in orchestraService.getStudentAttendanceStats: ${err}`)
  }
}

function _buildCriteria(filterBy) {
  const criteria = {}
  console.log('🔍 orchestraService._buildCriteria called with filterBy:', JSON.stringify(filterBy))

  // Handle batch fetching by IDs - highest priority
  if (filterBy.ids) {
    console.log('🎯 Found ids parameter:', filterBy.ids)
    const idsArray = Array.isArray(filterBy.ids) ? filterBy.ids : filterBy.ids.split(',')
    console.log('🎯 Parsed IDs array:', idsArray)
    criteria._id = { 
      $in: idsArray.map(id => ObjectId.createFromHexString(id.trim())) 
    }
    console.log('🎯 Built criteria with IDs:', JSON.stringify(criteria))
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

