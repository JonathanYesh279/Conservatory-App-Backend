import { upload, processUploadedFile, STORAGE_MODE } from '../services/fileStorage.service.js'

export const uploadSingleFile = (fieldName) => {
  return async (req, res, next) => {
    try {
      upload.single(fieldName)(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: err.message })
        }

        if (!req.file) {
          return res.status(400).json({ error: 'No file uploaded' })
        }

        try {
          const fileInfo = await processUploadedFile(req.file)

          req.processedFile = {
            originalname: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            ...fileInfo
          }

          next()
        } catch (proccessError) {
          console.error(`Error processing file: ${proccessError.message}`)
          return res.status(500).json({ error: 'Error processing uploaded file' })
        }
      })
    } catch (err) {
      console.error(`Error uploading file: ${err.message}`)
      return res.status(500).json({ error: 'Error uploading file' })
    }
  }
}

export const uploadMultipleFiles = (fieldName, maxCount = 5) => {
  return async (req, res, next) => {
    try {
      upload.array(fieldName, maxCount)(req, res, async (err) => {
        if (err) {
          return res.status(400).json({ error: err.message })
        }

        if (!req.file || !req.file.length === 0) {
          return res.status(400).json({ error: 'No file uploaded' })
        }

        try {
          const processedFiles = await Promise.all(
            req.files.map(async (file) => {
              const fileInfo = await processUploadedFile(file)
              return {
                orginalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
                ...fileInfo
              }
            })
          )

          req.processedFiles = processedFiles
          next()
        } catch (proccessError) { 
          console.error(`Error processing file: ${proccessError.message}`)
          return res.status(500).json({ error: 'Error processing uploaded file' })
        }
      })
    } catch (err) {
      console.error(`Upload middleware error: ${err.message}`)
      return res.status(500).json({ error: 'Error uploading file' })
    }
  }
}