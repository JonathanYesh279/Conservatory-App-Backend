import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { initializeMongoDB } from './services/mongoDB.service.js'
import path from 'path'
import { fileURLToPath } from 'url'

import studentRoutes from './api/student/student.route.js'
 
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
app.use('/api/student', studentRoutes)

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