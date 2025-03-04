import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import multer from 'multer'
import { fileURLToPath } from 'url'
import { S3Client } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'stream'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const unlinkAsync = promisify(fs.unlink)

// Storage configuration from environment variables
const STORAGE_MODE = process.env.STORAGE_MODE || 'local'; // 'local' or 's3'
const UPLOAD_DIR = path.join(path.dirname(__dirname), 'uploads')
const S3_BUCKET = process.env.S3_BUCKET
const S3_REGION = process.env.S3_REGION || 'eu-central-1'
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY
const S3_SECRET_KEY = process.env.S3_SECRET_KEY

// Ensure local upload directory exists
if (STORAGE_MODE === 'local') {
  fs.existsSync(UPLOAD_DIR) || fs.mkdirSync(UPLOAD_DIR, { recursive: true })
}

// Initialize S3 client if using S3 storage
let s3Client
if (STORAGE_MODE === 's3') {
  if (!S3_BUCKET || !S3_ACCESS_KEY || !S3_SECRET_KEY) {
    console.error(
      'S3 configuration is incomplete. Check your environment variables.'
    );
  } else {
    s3Client = new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY,
        secretAccessKey: S3_SECRET_KEY,
      },
    })
  }
}

// Configure local storage
const localStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    const extension = path.extname(file.originalname)
    cb(null, uniqueSuffix + extension)
  },
})

// Configure S3 storage
const s3Storage = multer.memoryStorage()

// Select the appropriate storage based on the mode
const storage = STORAGE_MODE === 'local' ? localStorage : s3Storage

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png']
    const extension = path.extname(file.originalname).toLowerCase()

    if (allowedTypes.includes(extension)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          `Invalid file type. Only ${allowedTypes.join(
            ', '
          )} files are allowed.`
        )
      )
    }
  },
})

// Upload a file to S3
async function uploadToS3(file) {
  try {
    const key = `uploads/${Date.now()}-${file.originalname.replace(
      /\s+/g,
      '-'
    )}`

    const uploadParams = {
      Bucket: S3_BUCKET,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const upload = new Upload({
      client: s3Client,
      params: uploadParams,
    });

    await upload.done()

    return {
      key,
      location: `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`,
    };
  } catch (err) {
    console.error(`Error uploading to S3: ${err}`)
    throw new Error(`Error uploading to S3: ${err.message}`)
  }
}

// Get a file from S3
async function getFileFromS3(key) {
  try {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    })

    const response = await s3Client.send(command)
    return response
  } catch (err) {
    console.error(`Error fetching file from S3: ${err}`)
    throw new Error(`Error fetching file from S3: ${err.message}`)
  }
}

// Stream a file from S3
async function streamFileFromS3(key, res) {
  try {
    const file = await getFileFromS3(key)
    const stream = Readable.from(file.Body)

    res.set({
      'Content-Type': file.ContentType,
      'Content-Length': file.ContentLength,
      'Content-Disposition': `inline; filename="${path.basename(key)}"`,
    });

    stream.pipe(res)
  } catch (err) {
    console.error(`Error streaming file from S3: ${err}`)
    throw new Error(`Error streaming file from S3: ${err.message}`)
  }
}

// Delete a file (from local storage or S3)
async function deleteFile(fileUrl) {
  if (STORAGE_MODE === 'local') {
    try {
      const filename = path.basename(fileUrl)
      const filePath = path.join(UPLOAD_DIR, filename)

      if (fs.existsSync(filePath)) {
        await unlinkAsync(filePath)
        console.log(`File ${filename} deleted from local storage`)
      } else {
        console.warn(`File ${filename} not found in local storage`)
      }
      return { success: true }
    } catch (err) {
      console.error(`Error deleting file from local storage: ${err}`)
      throw new Error(`Error deleting file from local storage: ${err.message}`)
    }
  } else if (STORAGE_MODE === 's3') {
    try {
      // Extract key from fileUrl
      const key = fileUrl.includes('https://')
        ? fileUrl.split('.com/')[1] // Extract from full URL
        : fileUrl; // Already a key

      const command = new DeleteObjectCommand({
        Bucket: S3_BUCKET,
        Key: key,
      })

      await s3Client.send(command)
      console.log(`File ${key} deleted from S3`)

      return { success: true }
    } catch (err) {
      console.error(`Error deleting file from S3: ${err}`)
      throw new Error(`Error deleting file from S3: ${err.message}`)
    }
  }

  return { success: false, message: 'Invalid storage mode' }
}

// Get the URL for a file (local path or S3 URL)
function getFileUrl(file) {
  if (STORAGE_MODE === 'local') {
    return `/uploads/${file.filename}`
  } else if (STORAGE_MODE === 's3' && file.buffer) {
    // This is called after the upload to S3 is complete
    return file.s3Location
  }

  return file.path || null
}

// Process uploaded file (handle S3 upload if needed)
async function processUploadedFile(file) {
  if (STORAGE_MODE === 's3' && file) {
    try {
      const s3Result = await uploadToS3(file)
      file.s3Key = s3Result.key
      file.s3Location = s3Result.location
      return { url: s3Result.location, key: s3Result.key }
    } catch (err) {
      console.error(`Error processing file upload: ${err}`)
      throw new Error(`Error processing file upload: ${err.message}`)
    }
  } else {
    return { url: getFileUrl(file) }
  }
}

export {
  upload,
  deleteFile,
  getFileUrl,
  processUploadedFile,
  getFileFromS3,
  streamFileFromS3,
  STORAGE_MODE,
}
