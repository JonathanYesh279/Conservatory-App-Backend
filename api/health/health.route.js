import { Router } from 'express'
import { getDB } from '../../services/mongoDB.service.js'

const router = Router()

// GET /api/health/live - Liveness probe
router.get('/live', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  })
})

// GET /api/health/ready - Readiness probe (checks DB connection)
router.get('/ready', async (req, res) => {
  try {
    const db = getDB()
    await db.command({ ping: 1 })
    res.json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString()
    })
  } catch {
    res.status(503).json({
      status: 'not ready',
      database: 'disconnected',
      timestamp: new Date().toISOString()
    })
  }
})

export default router
