// middleware/auth.middleware.js
import jwt from 'jsonwebtoken'
import { getCollection } from '../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

export async function authenticateToken(req, res, next) {
  try {
    // Get the authorization header
    const authHeader = req.headers['authorization']
    
    // Check if header exists and has correct format
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    
    // Extract the token
    const token = authHeader.split(' ')[1]
    
    try {
      // Verify the token
      const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
      
      // Find the teacher in the database
      const collection = await getCollection('teacher')
      const teacher = await collection.findOne({
        _id: ObjectId.createFromHexString(decoded._id),
        isActive: true
      })
      
      if (!teacher) {
        return res.status(401).json({ error: 'Teacher was not found' })
      }
      
      // Set the teacher in the request
      req.teacher = teacher
      next()
      
    } catch (tokenErr) {
      // Log the error with timestamp for debugging
      console.error('Authentication error:', {
        ...tokenErr,
        currentTime: new Date()
      })
      
      if (tokenErr.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired' })
      }
      
      return res.status(401).json({ error: 'Invalid token' })
    }
    
  } catch (err) {
    console.error('Authentication error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

export function requireAuth(allowedRoles = []) {
  return async (req, res, next) => {
    try {
      // Check if teacher exists in request (set by authenticateToken)
      if (!req.teacher) {
        return res.status(401).json({ error: 'Authentication required' })
      }
      
      // Admin role has access to everything
      if (req.teacher.roles && req.teacher.roles.includes('מנהל')) {
        req.isAdmin = true
        return next()
      }
      
      // Check if teacher has any of the allowed roles
      const hasRole = req.teacher.roles && 
        allowedRoles.some(role => req.teacher.roles.includes(role))
      
      if (!hasRole) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }
      
      next()
    } catch (err) {
      next(err)
    }
  }
}