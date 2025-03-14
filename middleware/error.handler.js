// middleware/error.handler.js

/**
 * Global error handling middleware
 * Processes errors and sends appropriate responses
 */
export function errorHandler(err, req, res, next) {
  // Log the error for debugging
  console.error('Error:', err)

  // Extract status code or default to 500
  const statusCode = err.statusCode || 500
  
  // Handle different types of errors
  switch (err.name) {
    case 'ValidationError':
      return res.status(400).json({
        error: 'Validation Error',
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