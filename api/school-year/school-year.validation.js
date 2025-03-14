import Joi from 'joi'

export const schoolYearSchema = Joi.object({
  name: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().required(),
  isCurrent: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
  createdAt: Joi.date().optional(),
  updatedAt: Joi.date().optional()
})

export function validateSchoolYear(schoolYear) {
  try {
    // Handle null/undefined input
    if (!schoolYear) {
      return {
        error: new Error('School year data is required'),
        value: null
      }
    }

    // Perform validation with Joi
    const result = schoolYearSchema.validate(schoolYear, { 
      abortEarly: false,
      stripUnknown: false
    })
    
    // Format error messages if there's an error
    if (result.error) {
      const errorMessage = result.error.details
        .map(detail => detail.message)
        .join(', ')
      
      return {
        error: new Error(`Invalid school year data: ${errorMessage}`),
        value: schoolYear // Return original data for reference
      }
    }
    
    // Return successful validation
    return {
      error: null,
      value: result.value
    }
  } catch (err) {
    // Handle unexpected Joi errors
    console.error(`Validation error: ${err.message}`)
    return {
      error: new Error(`Validation error`),
      value: schoolYear || {}
    }
  }
}