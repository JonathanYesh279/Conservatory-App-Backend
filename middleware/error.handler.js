export function errorHandler(err, req, res, next) {
  console.error('Error:', err)

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
    })
  }

  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return res.status(500).json({
      error: 'Database Error',
      message: 'A database error occurred',
    })
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  })
}
