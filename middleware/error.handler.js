// middleware/error.handler.js

/**
 * Parse Joi-style validation error message to extract field-level errors
 * Example input: '"personalInfo.email" must be a valid email. "credentials.email" must be a valid email'
 * Output: { 'personalInfo.email': 'must be a valid email', 'credentials.email': 'must be a valid email' }
 */
function parseValidationErrors(errorMessage) {
  const validationErrors = {};
  const errorParts = errorMessage.split('. ');

  errorParts.forEach(part => {
    // Match patterns like "personalInfo.email" must be a valid email
    const fieldMatch = part.match(/"([^"]+)"/);
    if (fieldMatch) {
      const fieldPath = fieldMatch[1];
      const message = part.replace(`"${fieldPath}" `, '');
      validationErrors[fieldPath] = message;
    }
  });

  return validationErrors;
}

/**
 * Global error handling middleware
 * Processes errors and sends appropriate responses
 */
export function errorHandler(err, req, res, next) {
  // Log the error for debugging
  console.error('Error:', err)

  // Extract status code or default to 500
  const statusCode = err.statusCode || 500

  // Handle validation errors from services (pattern: "Invalid X data: ...")
  const validationErrorPatterns = [
    'Invalid teacher data:',
    'Invalid student data:',
    'Invalid schedule data:',
    'Invalid rehearsal data:',
    'Invalid orchestra data:',
    'Invalid time block data:',
    'Invalid assignment data:',
    'Invalid update data:',
    'Invalid filter data:',
    'Invalid attendance data:',
    'Invalid bulk create data:'
  ];

  const matchedPattern = validationErrorPatterns.find(pattern =>
    err.message && err.message.includes(pattern)
  );

  if (matchedPattern) {
    const errorContent = err.message.substring(err.message.indexOf(matchedPattern) + matchedPattern.length).trim();
    const validationErrors = parseValidationErrors(errorContent);

    return res.status(400).json({
      error: 'שגיאת אימות נתונים',
      code: 'VALIDATION_ERROR',
      validationErrors: validationErrors,
      message: err.message
    });
  }

  // Handle different types of errors
  switch (err.name) {
    case 'ValidationError':
      return res.status(400).json({
        error: 'Validation Error',
        code: 'VALIDATION_ERROR',
        message: err.message
      })
    
    case 'MongoError':
    case 'MongoServerError':
      return res.status(500).json({
        error: 'Database Error',
        message: 'A database error occurred'
      })
      
    case 'TokenExpiredError':
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Your session has expired. Please log in again'
      })
      
    case 'JsonWebTokenError':
      return res.status(401).json({
        error: 'Authentication Error',
        message: 'Invalid authentication token'
      })
      
    case 'NotFoundError':
      return res.status(404).json({
        error: 'Not Found',
        message: err.message
      })
      
    default:
      // For custom errors with status codes
      if (err.statusCode === 404) {
        return res.status(404).json({
          error: 'Not Found',
          message: err.message
        })
      }
      
      if (err.statusCode === 403) {
        return res.status(403).json({
          error: 'Forbidden',
          message: err.message
        })
      }
      
      if (err.statusCode === 401) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: err.message
        })
      }
      
      if (err.statusCode === 400) {
        return res.status(400).json({
          error: 'Bad Request',
          message: err.message
        })
      }
      
      // Default error response
      return res.status(500).json({
        error: 'Internal Server Error',
        message: err.message
      })
  }
}