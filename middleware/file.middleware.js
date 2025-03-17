import { upload, processUploadedFile } from '../services/fileStorage.service.js'

/**
 * Middleware to handle single file upload
 * @param {string} fieldName - Name of the file input field
 * @returns {Function} Express middleware function
 */
export function uploadSingleFile(fieldName) {
  return async (req, res, next) => {
    try {
      // Use multer's single file upload
      upload.single(fieldName)(req, res, async (err) => {
        if (err) {
          // Handle multer upload errors
          return res.status(400).json({ error: err.message })
        }

        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' })
        }

        try {
          // Process the uploaded file (e.g., upload to S3 or local storage)
          const fileInfo = await processUploadedFile(req.file)

          // Attach processed file information to the request
          req.processedFile = {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            ...fileInfo
          }

          next()
        } catch (processError) {
          console.error(`Error processing file: ${processError.message}`)
          return res.status(500).json({ error: 'Error processing uploaded file' })
        }
      })
    } catch (err) {
      console.error(`Error in file upload middleware: ${err.message}`)
      return res.status(500).json({ error: 'File upload failed' })
    }
  }
}

/**
 * Middleware to stream a file for download or preview
 * @param {Object} options - Options for file streaming
 * @returns {Function} Express middleware function
 */
export function streamFile(options = {}) {
  return async (req, res, next) => {
    try {
      const { fileUrl, disposition = 'inline' } = options

      // Implement file streaming logic
      // This could involve reading from local storage or S3
      // For now, it's a placeholder
      res.download(fileUrl, {
        headers: {
          'Content-Disposition': `${disposition}; filename="${path.basename(fileUrl)}"`
        }
      })
    } catch (err) {
      console.error(`Error streaming file: ${err.message}`)
      next(err)
    }
  }
}