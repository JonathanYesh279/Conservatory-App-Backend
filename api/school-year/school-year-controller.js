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
    next(err)
  }
}

async function getSchoolYearById(req, res, next) {
  try {
    const { id } = req.params
    const schoolYear = await schoolYearService.getSchoolYearById(id)
    res.json(schoolYear)
  } catch (err) {
    next(err)
  }
}

async function getCurrentSchoolYear(req, res, next) {
  try {
    const schoolYear = await schoolYearService.getCurrentSchoolYear()
    res.json(schoolYear)
  } catch (err) {
    next(err)
  }
}

async function createSchoolYear(req, res, next) {
  try {
    const schoolYearData = req.body
    const newSchoolYear = await schoolYearService.createSchoolYear(schoolYearData)
    res.status(201).json(newSchoolYear) 
  } catch (err) {
    next(err) 
  }
}

async function updateSchoolYear(req, res, next) {
  try {
    const { id } = req.params
    const schoolYearData = req.body
    const updatedSchoolYear = await schoolYearService.updateSchoolYear(id, schoolYearData)
    res.json(updatedSchoolYear)
  } catch (err) {
    next(err)
  }
}

async function setCurrentSchoolYear(req, res, next) {
  try {
    const { id } = req.params
    const schoolYear = await schoolYearService.setCurrentSchoolYear(id)
    res.json(schoolYear)
  } catch (err) {
    next(err)
  }
}

async function rolloverToNewYear(req, res, next) {
  try {
    const { id } = req.params
    const newSchoolYear = await schoolYearService.rolloverToNewYear(id)
    res.json(newSchoolYear)
  } catch (err) {
    next(err)
  }
}