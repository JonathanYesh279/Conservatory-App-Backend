import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import multer from 'multer'
import { fileURLToPath } from 'utl'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const unlinkAsync = promisify(fs.unlink)

// Determine storage mode from environment variable
const STORAGE_MODE = process.env.STORAGE_MODE || 'local' // switch to 's3' for AWS S3 storage
const UPLOAD_DIR = path.join(path.dirname(__dirname), 'uploads')

if (STORAGE_MODE === 'local') {
  fs.existsSync(UPLOAD_DIR) || fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

const localStorage = multer.diskStorage({
  destination: function (req, res, cb) {
    cb(null, UPLOAD_DIR)
  },
  filename: function (req, res, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const extension = path.extname(file.originalname)
    cb(null, uniqueSuffix + extension)
  }
})

const storage = STORAGE_MODE === 'local' ? localStorage : null

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']
    const extension = path.extname(file.originalname).toLowerCase()

    if (allowedTypes.includes(extension)) {
      cb(null, true)
    } else {
      cb(new Error(`Invalid file type. Only ${allowedTypes.join(', ')} files are allowed.`))
    }
  }
})

async function deleteFile(fileUrl) {
  if (STORAGE_MODE === 'local') {
    try {
      const filename = path.basename(fileUrl)
      const filePath = path.join(UPLOAD_DIR, filename)

      if (fs.existsSync(filePath)) {
        await unlinkAsync(filePath)
        console.log(`File ${filename} deleted`)
      } else {
        console.warn(`File ${filename} not found`)
      }
      return { success: true }
    } catch (err) {
      console.error(`Error deleting file: ${err}`)
      throw new Error(`Error deleting file: ${err}`)
    }
  }

  // Add S3 deletion later when switching to production 
  return { success: false, message: 'S3 deletion not implemented yet' }
}

function getFileUrl(file) {
  if (STORAGE_MODE === 'local') {
    return `/uploads/${file.filename}`
  }

  // Return S3 URL when implementing S3 storage
  return file.path
}

export { upload, deleteFile, getFileUrl }