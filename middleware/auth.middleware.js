import jwt from 'jsonwebtoken'
import { getCollection } from '../services/mongoDB.service.js'
import { ObjectId } from 'mongodb'

export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization']
    const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
    console.log('Decoded ID from token:', decoded._id)

    const collection = await getCollection('teacher')

    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(decoded._id),
      isActive: true
    }) 
    console.log('Query result:', teacher)

    if (!teacher) {
      return res.status(401).json({ error: 'Teacher was not found' })
    }

    req.teacher = teacher
    next()
  } catch (err) {
     console.error('Authentication error:', {
       name: err.name,
       message: err.message,
       expiredAt: err.expiredAt, // This will show when TokenExpiredError
       currentTime: new Date(),
     });
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired' })
    }
    res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireAuth(roles) {
  return async (req, res, next) => {
    try {
      const teacher = req.teacher
      if (!teacher) {
        return res.status(401).json({ error: 'Authentication required' })
      }

      if (teacher.roles.includes('מנהל')) {
        return next()
      }

      const hasRequiredRole = teacher.roles.some(role => roles.includes(role))
      if (!hasRequiredRole) {
        return res.status(403).json({ error: 'Insufficient permissions' })
      }

      if (req.method !== 'GET' && req.params.id) {
        const isOwner = await _checkOwnership(teacher, req)
        if (!isOwner) {
          return res.status(403).json({ error: 'Not authorized to modify this resource' })
        }
      }

      next()
    } catch (err) {
      next(err)
    }
  }
}

async function _checkOwnership(teacher, req) {
  const resourceId = req.params.id
  const path = req.path

  if (path.includes('/student')) {
    if (teacher.roles.includes('מורה')) {
      return teacher.teaching.studentIds.includes(resourceId)
    }
  }
  else if (path.includes('/orchestra')) {
    if (teacher.roles.includes('מנצח')) {
      return teacher.conducting.orchestraIds.includes(resourceId)
    }
  }
  else if (path.includes('/ensemble')) {
    if (teacher.roles.includes('מדריך הרכב')) {
      return teacher.ensembleIds.includes(resourceId)
    }
  }

  return false
}