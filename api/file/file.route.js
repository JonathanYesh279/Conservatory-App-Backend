import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { requireAuth } from '../../middleware/auth.middleware.js'
import { STORAGE_MODE, streamFileFromS3 } from '../../services/fileStorage.service.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const UPLOAD_DIR = path.join(path.dirname(path.dirname(__dirname)), 'uploads')

const router = express.Router()

// Serve files
router.get('/:filename', requireAuth(['מורה', 'מנצח', 'מדריך הרכב', 'מנהל']), serveFile)

async function serveFile(req, res, next) {
  try {
    const { filename } = req.params

    if (STORAGE_MODE === 'local') {
      const filePath = path.join(UPLOAD_DIR, filename)

      if (!fs.existsSync(filePath)) {
        return res.status(404).send('File not found')
      }

      return res.sendFile(filePath)
    } else if (STORAGE_MODE === 's3') {
      try {
        await streamFileFromS3(filename, res)
      } catch (streamError) {
        console.error(`Error streaming file from S3: ${streamError}`)
        return res.status(500).send('Error streaming file from S3')
      }
    } else {
      return res.status(500).send('Invalid storage configuration')
    }
  } catch (err) {
    console.error(`Error serving file: ${err}`)
    return res.status(500).send('Error serving file')
  }
}

export default router