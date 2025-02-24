import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initializeMongoDB } from './services/mongoDB.service.js'
import path from 'path'
import { fileURLToPath } from 'url'
import cookieParser from 'cookie-parser'
import { authenticateToken } from './middleware/auth.middleware.js'

import studentRoutes from './api/student/student.route.js'
import teacherRoutes from './api/teacher/teacher.route.js'
import authRoutes from './api/auth/auth.route.js'
import orchestraRoutes from './api/orchestra/orchestra.route.js'
 
const _filename = fileURLToPath(import.meta.url)
const _dirname = path.dirname(_filename)

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

app.use(cors(corsOptions))
app.use(express.json())
app.use(cookieParser())


// Middlewares
app.use(cors())
app.use(express.json())

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
app.use('/api/student', authenticateToken, studentRoutes)
app.use('/api/teacher', authenticateToken, teacherRoutes)
app.use('/api/orchestra', authenticateToken, orchestraRoutes)

// Test route
app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'OK',
        message: 'Server is running'
    })
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})