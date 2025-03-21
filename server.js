import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import mongoSanitize from 'express-mongo-sanitize'
import helmet from 'helmet'
import { initializeMongoDB } from './services/mongoDB.service.js'
import path from 'path'
import fileRoutes from './api/file/file.route.js'  
import { STORAGE_MODE } from './services/fileStorage.service.js'
import { fileURLToPath } from 'url'
import cookieParser from 'cookie-parser'
import { authenticateToken } from './middleware/auth.middleware.js'
import { addSchoolYearToRequest } from './middleware/school-year.middleware.js'

import schoolYearRoutes from './api/school-year/school-year.route.js'
import studentRoutes from './api/student/student.route.js'
import teacherRoutes from './api/teacher/teacher.route.js'
import authRoutes from './api/auth/auth.route.js'
import orchestraRoutes from './api/orchestra/orchestra.route.js'
import rehearsalRoutes from './api/rehearsal/rehearsal.route.js'
import bagrutRoutes from './api/bagrut/bagrut.route.js'
 
const _filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(_filename)

const app = express()

const NODE_ENV = process.env.NODE_ENV || 'development'
const MONGO_URI = process.env.MONGO_URI
const FRONTEND_URL = process.env.FRONTEND_URL === 'production'
  ? process.env.FRONTEND_URL
  : 'http://localhost:5173'

const corsOptions = {
  origin: NODE_ENV === 'production'
    ? [FRONTEND_URL]
    : ['http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200
}

if (STORAGE_MODE === 'local') {
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())
app.use(helmet())
app.use(mongoSanitize())

// Initialzie MongoDB
await initializeMongoDB(MONGO_URI).catch(console.error)

if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  })
}

// Routes
app.use('/api/auth', authRoutes)

app.use('/api/student', authenticateToken, addSchoolYearToRequest, studentRoutes)
app.use('/api/teacher', authenticateToken, addSchoolYearToRequest, teacherRoutes)
app.use('/api/orchestra', authenticateToken, addSchoolYearToRequest, orchestraRoutes)
app.use('/api/rehearsal', authenticateToken, addSchoolYearToRequest, rehearsalRoutes)
app.use('/api/bagrut', authenticateToken, addSchoolYearToRequest, bagrutRoutes)
app.use('/api/school-year', authenticateToken, addSchoolYearToRequest, schoolYearRoutes)
app.use('/api/files', authenticateToken, fileRoutes)

// Test route
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'OK',
        message: 'Server is running'
    })
})

app.use((req, res) => {
  console.log('404 Not Found:', req.method, req.originalUrl);
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl,
  })
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})