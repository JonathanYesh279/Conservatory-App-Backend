import { getCollection } from '../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

export async function addSchoolYearToRequest(req, res, next) {
  try {
    if (req.path === '/current' || req.path === '/list') {
      return next()
    }

    if (req.query.schoolYearId) {
      const collection = await getCollection('school_year')
      const schoolYear = await collection.findOne({
        _id: ObjectId.createFromHexString(req.query.schoolYearId)
      })

      if (!schoolYear) throw new Error(`School year with id ${req.query.schoolYearId} not found`)
      
      req.schoolYear = schoolYear
    } else {
      const collection = await getCollection('school_year')
      let schoolYear = await collection.findOne({ isCurrent: true })

      if (!schoolYear) {
        const currentYear = new Date().getFullYear()
        const defaultYear = {
          name: `${currentYear}-${currentYear + 1}`,
          startDate: new Date(`${currentYear}-08-20`),
          endDate: new Date(`${currentYear + 1}-08-01`),
          isCurrent: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }

        const result = await collection.insertOne(defaultYear)
        schoolYear = { _id: result.insertedId, ...defaultYear }
      }

      req.schoolYear = schoolYear
    }

    req.query.schoolYearId = req.schoolYear._id.toString()

    next()
  } catch (err) {
    console.error(`Error in schoolYearMiddleware.addSchoolYearToRequest: ${err}`)
    return res.status(500).json({ error: 'Error processing school year information' })
  }
}