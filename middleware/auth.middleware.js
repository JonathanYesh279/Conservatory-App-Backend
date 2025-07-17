import jwt from 'jsonwebtoken';
import { getCollection } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      console.log('No auth token found for request to:', req.path);
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    // Validate token format
    if (!token || token === 'undefined' || token === 'null') {
      console.log('Invalid token format:', token);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token format' 
      });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    console.log('Decoded ID from token:', decoded._id);

    const collection = await getCollection('teacher');

    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(decoded._id),
      isActive: true,
    });
    console.log('Query result:', teacher);

    if (!teacher) {
      return res.status(401).json({ 
        success: false, 
        error: 'Teacher was not found' 
      });
    }

    // Add the decoded token data to req.loggedinUser as well
    // This makes it available for the bulkCreateRehearsals function
    req.teacher = teacher;
    req.loggedinUser = {
      _id: teacher._id.toString(),
      roles: teacher.roles,
      fullName: teacher.personalInfo?.fullName || 'Unknown',
      email: teacher.credentials?.email,
    };
    next();
  } catch (err) {
    console.error('Authentication error:', {
      name: err.name,
      message: err.message,
      expiredAt: err.expiredAt, // This will show when TokenExpiredError
      currentTime: new Date(),
    });
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token has expired' 
      });
    }
    res.status(401).json({ 
      success: false, 
      error: 'Invalid token' 
    });
  }
}

export function requireAuth(roles) {
  return async (req, res, next) => {
    try {
      const teacher = req.teacher;
      if (!teacher) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (teacher.roles.includes('מנהל')) {
        req.isAdmin = true;
        return next();
      }

      const hasRequiredRole = teacher.roles.some((role) =>
        roles.includes(role)
      );
      if (!hasRequiredRole) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}
