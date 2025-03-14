import { schoolYearService } from './school-year.service.js'

export const schoolYearController = {
  getSchoolYears,
  getSchoolYearById,
  getCurrentSchoolYear,
  createSchoolYear,
  updateSchoolYear,
  setCurrentSchoolYear,
  rolloverToNewYear
}

async function getSchoolYears(req, res, next) {
  try {
    const schoolYears = await schoolYearService.getSchoolYears()
    res.json(schoolYears)
  } catch (err) {
    console.error(`Error in getSchoolYears controller: ${err.message}`)
    next(err)
  }
}

async function getSchoolYearById(req, res, next) {
  try {
    const { id } = req.params
    
    if (!id) {
      return res.status(400).json({ error: 'School year ID is required' })
    }
    
    const schoolYear = await schoolYearService.getSchoolYearById(id)
    res.json(schoolYear)
  } catch (err) {
    console.error(`Error in getSchoolYearById controller: ${err.message}`)
    
    // Handle "not found" errors with 404 status
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message })
    }
    
    next(err)
  }
}

async function getCurrentSchoolYear(req, res, next) {
  try {
    const schoolYear = await schoolYearService.getCurrentSchoolYear()
    res.json(schoolYear)
  } catch (err) {
    console.error(`Error in getCurrentSchoolYear controller: ${err.message}`)
    next(err)
  }
}

async function createSchoolYear(req, res, next) {
  try {
    const schoolYearData = req.body
    
    if (!schoolYearData || Object.keys(schoolYearData).length === 0) {
      return res.status(400).json({ error: 'School year data is required' })
    }
    
    const newSchoolYear = await schoolYearService.createSchoolYear(schoolYearData)
    res.status(201).json(newSchoolYear) 
  } catch (err) {
    console.error(`Error in createSchoolYear controller: ${err.message}`)
    
    // Handle validation errors with 400 status
    if (err.message.includes('Invalid school year data')) {
      return res.status(400).json({ error: err.message })
    }
    
    next(err) 
  }
}

async function updateSchoolYear(req, res, next) {
  try {
    const { id } = req.params
    const schoolYearData = req.body
    
    if (!id) {
      return res.status(400).json({ error: 'School year ID is required' })
    }
    
    if (!schoolYearData || Object.keys(schoolYearData).length === 0) {
      return res.status(400).json({ error: 'School year data is required' })
    }
    
    const updatedSchoolYear = await schoolYearService.updateSchoolYear(id, schoolYearData)
    res.json(updatedSchoolYear)
  } catch (err) {
    console.error(`Error in updateSchoolYear controller: ${err.message}`)
    
    // Handle "not found" errors with 404 status
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message })
    }
    
    // Handle validation errors with 400 status
    if (err.message.includes('Invalid school year data')) {
      return res.status(400).json({ error: err.message })
    }
    
    next(err)
  }
}

async function setCurrentSchoolYear(req, res, next) {
  try {
    const { id } = req.params
    
    if (!id) {
      return res.status(400).json({ error: 'School year ID is required' })
    }
    
    const schoolYear = await schoolYearService.setCurrentSchoolYear(id)
    res.json(schoolYear)
  } catch (err) {
    console.error(`Error in setCurrentSchoolYear controller: ${err.message}`)
    
    // Handle "not found" errors with 404 status
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message })
    }
    
    next(err)
  }
}

async function rolloverToNewYear(req, res, next) {
  try {
    const { id } = req.params
    
    if (!id) {
      return res.status(400).json({ error: 'Previous school year ID is required' })
    }
    
    const newSchoolYear = await schoolYearService.rolloverToNewYear(id)
    res.json(newSchoolYear)
  } catch (err) {
    console.error(`Error in rolloverToNewYear controller: ${err.message}`)
    
    // Handle "not found" errors with 404 status
    if (err.message.includes('not found')) {
      return res.status(404).json({ error: err.message })
    }
    
    next(err)
  }
}