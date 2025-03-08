import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'

// Import routes
import authRoutes from '../api/auth/auth.route.js'
import studentRoutes from '../api/student/student.route.js'
import teacherRoutes from '../api/teacher/teacher.route.js'
import orchestraRoutes from '../api/orchestra/orchestra.route.js'
import rehearsalRoutes from '../api/rehearsal/rehearsal.route.js'
import bagrutRoutes from '../api/bagrut/bagrut.route.js'
import schoolYearRoutes from '../api/school-year/school-year.route.js'

// Mock middleware
import { authenticateToken, requireAuth } from '../middleware/auth.middleware.js'
import { errorHandler } from '../middleware/error.handler.js'

// For tests, we'll create an Express app without starting the server.
export function setupTestApp() {
  const app = express()

  // Middleware
  app.use(express.json())
  app.use(cookieParser())
  app.use(cors({ origin: 'http://localhost:5173', credentials: true }))
  app.use(helmet())
  app.use(mongoSanitize())

  // Routes using the same routes as main app
  app.use('/api/auth', authRoutes)
  app.use('/api/student', authenticateToken, studentRoutes)
  app.use('/api/teacher', authenticateToken, teacherRoutes)
  app.use('/api/orchestra', authenticateToken, orchestraRoutes)
  app.use('/api/rehearsal', authenticateToken, rehearsalRoutes)
  app.use('/api/bagrut', authenticateToken, bagrutRoutes)
  app.use('/api/school-year', authenticateToken, schoolYearRoutes)

  app.use(errorHandler)

  return app
}