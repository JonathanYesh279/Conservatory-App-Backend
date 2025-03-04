import { getCollection } from '../../services/mongoDB.service.js'
import { validateSchoolYear } from './school-year.validation.js'
import { ObjectId } from 'mongodb'

export const schoolYearService = {
  getSchoolYears,
  getSchoolYearById,
  getCurrentSchoolYear,
  createSchoolYear,
  updateSchoolYear,
  setCurrentSchoolYear,
  rolloverToNewYear
}

async function getSchoolYears() {
  try {
    const collection = await getCollection('school_year')
    return await collection.find({ isActive: true }).sort({ startDate: -1 }).limit(4).toArray()
  } catch (err) {
    console.error(`Error in schoolYearService.getSchoolYears: ${err}`)
    throw new Error(`Error in schoolYearService.getSchoolYears: ${err}`)
  }
}

async function getSchoolYearById(schoolYearId) {
  try {
    const collection = await getCollection('school_year')
    const schoolYear = await collection.findOne({
      _id: ObjectId.createFromHexString(schoolYearId)
    })

    if (!schoolYear) throw new Error(`School year with id ${schoolYearId} not found`)
    return schoolYear
  } catch (err) {
    console.error(`Error in schoolYearService.getSchoolYearById: ${err}`)
    throw new Error(`Error in schoolYearService.getSchoolYearById: ${err}`)
  }
}

async function getCurrentSchoolYear() {
  try {
    const collection = await getCollection('school_year')
    const schoolYear = await collection.findOne({ isCurrent: true })

    if (!schoolYear) {
      const currentYear = new Date().getFullYear()
      const defaultYear = {
        name: `${currentYear}-${currentYear + 1}`,
        startDate: new Date(`${currentYear}-08-20`),
        endDate: new Date(`${currentYear + 1}-08-01`),
        isCurrent: true
      }

      const { id } = await createSchoolYear(defaultYear)
      return await getSchoolYearById(id.toString())
    }

    return schoolYear
  } catch (err) {
    console.error(`Error in schoolYearService.getCurrentSchoolYear: ${err}`)
    throw new Error(`Error in schoolYearService.getCurrentSchoolYear: ${err}`)
  }
}

async function createSchoolYear(schoolYearData) {
  try {
    const { error, value } = validateSchoolYear(schoolYearData)
    if (error) throw new Error(`Validation error: ${error}`)  
    
    if (value.isCurrent) {
      const collection = await getCollection('school_year')
      await collection.updateMany(
        { isCurrent: true },
        { $set: { isCurrent: false, updatedAt: new Date() } }
      )
    }

    value.createdAt = new Date()
    value.updatedAt = new Date()

    const collection = await getCollection('school_year')
    const result = await collection.insertOne(value)

    return { _id: result.insertedId, ...value }
  } catch (err) {
    console.error(`Error in schoolYearService.createSchoolYear: ${err}`)
    throw new Error(`Error in schoolYearService.createSchoolYear: ${err}`) 
  }
}

async function updateSchoolYear(schoolYearId, schoolYearData) {
  try {
    const { error, value } = validateSchoolYear(schoolYearData)
    if (error) throw new Error(`Validation error: ${error.message}`)
    
    value.updatedAt = new Date()

    if (value.isCurrent) {
      const collection = await getCollection('school_year') 
      await collection.updateMany(
        { _id: { $ne: ObjectId.createFromHexString(schoolYearId) }, isCurrent: true },
        { $set: { isCurrent: false, updatedAt: new Date() } }
      )
    }

    const collection = await getCollection('school_year')
    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(schoolYearId) },
      { $set: value },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`School year with id ${schoolYearId} not found`)
    return result
  } catch (err) {
    console.error(`Error in schoolYearService.updateSchoolYear: ${err}`)
    throw new Error(`Error in schoolYearService.updateSchoolYear: ${err}`)
  }
}

async function setCurrentSchoolYear(schoolYearId) {
  try {
    const collection = await getCollection('school_year')
    await collection.updateMany(
      { isCurrent: true },
      { $set: { isCurrent: false, updatedAt: new Date() } }
    )

    const result = await collection.findOneAndUpdate(
      { _id: ObjectId.createFromHexString(schoolYearId) },
      { $set: { isCurrent: true, updatedAt: new Date() } },
      { returnDocument: 'after' }
    )

    if (!result) throw new Error(`School year with id ${schoolYearId} not found`)
    return result
  } catch (err) {
    console.error(`Error in schoolYearService.setCurrentSchoolYear: ${err}`)
    throw new Error(`Error in schoolYearService.setCurrentSchoolYear: ${err}`)
  }
}

async function rolloverToNewYear(prevYearId) {
  try {
    const prevYear = await getSchoolYearById(prevYearId)

    const newYearStartDate = new Date(prevYear.endDate)
    newYearStartDate.setDate(newYearStartDate.getDate() + 1)

    const newYearEndDate = new Date(newYearStartDate)
    newYearEndDate.setFullYear(newYearEndDate.getFullYear() + 1)
    newYearEndDate.setMonth(7) //August
    newYearEndDate.setDate(1)

    const startYear = newYearStartDate.getFullYear()
    const endYear = newYearEndDate.getFullYear()

    const newYear = {
      name: `${startYear}-${endYear}`,
      startDate: newYearStartDate,
      endDate: newYearEndDate,
      isCurrent: true,
      isActive: true
    }

    const createdYear = await createSchoolYear(newYear)
    const newYearId = createdYear._id.toString()

    // Roll over students
    const studentCollection = await getCollection('student')
    const activeStudents = await studentCollection.find({
      isActive: true,
      'enrollments.schoolYears': {
        $elemMatch: {
          schoolYearId: prevYearId,
          isActive: true
        }
      }
    }).toArray()

    for (const student of activeStudents) {
      const hasNewYearEntry = student.enrollments.schoolYears && student.enrollments.schoolYears.some(sy => sy.schoolYearId === newYearId)

      if (!hasNewYearEntry) {
        await studentCollection.updateOne(
          { _id: student._id },
          {
            $push: {
              'enrollments.schoolYears': {
                schoolYearId: newYearId,
                isActive: true
              }
            }
          }
        )
      }
    }

    // Roll over teachers
    const teacherCollection = await getCollection('teacher')
    const activeTeachers = await teacherCollection.find({
      isActive: true,
      'schoolYears': {
        $elemMatch: {
          schoolYearId: prevYearId,
          isActive: true
        }
      }
    }).toArray()

    for (const teacher of activeTeachers) {
      const hasNewYearEntry = teacher.schoolYears && teacher.schoolYears.some(sy => sy.schoolYearId === newYearId)

      if (!hasNewYearEntry) {
        await teacherCollection.updateOne(
          { _id: teacher._id },
          {
            $push: {
              'schoolYears': {
                schoolYearId: newYearId,
                isActive: true
              }
            }
          }
        )
      }
    }
    
    // Roll over orchestras
    const orchestraCollection = await getCollection('orchestra')
    const activeOrchestras = await orchestraCollection.find({
      isActive: true,
      schoolYearId: prevYearId
    }).toArray()

    for (const orchestra of activeOrchestras) {
      const memberIds = []
      const filteredMemberIds = orchestra.memberIds || []

      for (const memberId of filteredMemberIds) {
        const student = await studentCollection.findOne({
          _id: ObjectId.createFromHexString(memberId),
          'enrollments.schoolYears': {
            $elemMatch: {
              schoolYearId: newYearId,
              isActive: true
            }
          }
        })

        if (student) memberIds.push(memberId)
      }
      
      const existingOrchestra = await orchestraCollection.findOne({
        name: orchestra.name,
        schoolYearId: newYearId
      })

      if (!existingOrchestra) {
        const newOrchestra = {
          ...orchestra,
          _id: undefined,
          schoolYearId: createdYear._id.toString(),
          memberIds: memberIds,
          rehearsalIds: [],
          createdAt: new Date(),
          updatedAt: new Date()
        }

        await orchestraCollection.insertOne(newOrchestra)
      }
    }

    return createdYear
  } catch (err) {
    console.error(`Error in schoolYearService.rolloverToNewYear: ${err}`)
    throw new Error(`Error in schoolYearService.rolloverToNewYear: ${err}`)
  }
}

