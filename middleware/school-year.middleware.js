import { getCollection } from '../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

export async function addSchoolYearToRequest(req, res, next) {
  // Skip for certain paths and time-block routes
  if (req.path === '/current' || req.path === '/list' || req.path.includes('/time-blocks')) {
    return next()
  }

  try {
    // If schoolYearId is provided in query params, use it
    if (req.query.schoolYearId) {
      try {
        const collection = await getCollection('school_year')
        const schoolYear = await collection.findOne({
          _id: ObjectId.createFromHexString(req.query.schoolYearId)
        })

        if (schoolYear) {
          req.schoolYear = schoolYear
          return next()
        }
      } catch (err) {
        console.error(`Error in schoolYearMiddleware.addSchoolYearToRequest: ${err}`)
        return res.status(500).json({ error: 'Error processing school year information' })
      }
    }

    // Otherwise, get the current school year
    const collection = await getCollection('school_year')
    let schoolYear = await collection.findOne({ isCurrent: true })

    // If no current year exists, create a default one
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
      schoolYear = {
        _id: result.insertedId,
        ...defaultYear
      }
    }
    
    // Add to request object
    req.schoolYear = schoolYear
    req.query.schoolYearId = schoolYear._id.toString()
    next()
  } catch (err) {
    console.error(`Error in schoolYearMiddleware.addSchoolYearToRequest: ${err}`)
    res.status(500).json({ error: 'Error processing school year information' })
  }
}