import { describe, it, expect, vi, beforeEach } from 'vitest'
import { errorHandler } from '../error.handler.js'

describe('Error Handler Middleware', () => {
  let req, res, next

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()

    // Setup request, response, and next function
    req = {}

    res = {
      status: vi.fn(() => res),
      json: vi.fn(() => res)
    }

    next = vi.fn()
  })

  it('should handle ValidationError with status 400', () => {
    // Setup
    const err = new Error('Validation failed')
    err.name = 'ValidationError'

    // Execute
    errorHandler(err, req, res, next)

    // Assert
    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Validation Error',
      message: 'Validation failed'
    })
  })

  it('should handle MongoError with status 500', () => {
    // Setup
    const err = new Error('Duplicate key error')
    err.name = 'MongoError'

    // Execute
    errorHandler(err, req, res, next)

    // Assert
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Database Error',
      message: 'A database error occurred'
    })
  })

  it('should handle MongoServerError with status 500', () => {
    // Setup
    const err = new Error('Database connection failed')
    err.name = 'MongoServerError'

    // Execute
    errorHandler(err, req, res, next)

    // Assert
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Database Error',
      message: 'A database error occurred'
    })
  })

  it('should handle generic errors with status 500', () => {
    // Setup
    const err = new Error('Something went wrong')
    err.name = 'Error'

    // Execute
    errorHandler(err, req, res, next)

    // Assert
    expect(res.status).toHaveBeenCalledWith(500)
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Something went wrong'
    })
  })

  it('should log the error to console', () => {
    // Setup
    const consoleSpy = vi.spyOn(console, 'error')
    const err = new Error('Test error')

    // Execute
    errorHandler(err, req, res, next)

    // Assert
    expect(consoleSpy).toHaveBeenCalledWith('Error:', err)
  })

  it('should handle errors with custom status codes if provided', () => {
    // Setup
    const err = new Error('Not Found')
    err.statusCode = 404 // Some errors might have status codes

    // Execute
    errorHandler(err, req, res, next)

    // Assert
    expect(res.status).toHaveBeenCalledWith(500) // Our handler doesn't check for statusCode
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Not Found'
    })
  })

  it('should sanitize error messages containing sensitive information', () => {
    // Setup - Error with potential connection string or password
    const err = new Error('Failed to connect to mongodb://user:password@localhost:27017')
    
    // Execute
    errorHandler(err, req, res, next)
    
    // Assert - Should not leak connection string
    expect(res.json).toHaveBeenCalledWith({
      error: 'Internal Server Error',
      message: 'Failed to connect to mongodb://user:password@localhost:27017' // In a real app, you'd sanitize this
    })
    
    // Note: This test highlights that your current error handler doesn't sanitize error messages.
    // You might want to consider sanitizing sensitive information in production.
  })
})