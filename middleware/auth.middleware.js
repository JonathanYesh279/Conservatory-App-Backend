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
        error: 'Authentication required',
        code: 'MISSING_TOKEN'
      });
    }

    // Validate token format
    if (!token || token === 'undefined' || token === 'null') {
      console.log('Invalid token format:', token);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token format',
        code: 'INVALID_TOKEN_FORMAT'
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
        error: 'Teacher was not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Check token version for revocation support
    const tokenVersion = teacher.credentials?.tokenVersion || 0;
    if (decoded.version !== undefined && decoded.version < tokenVersion) {
      return res.status(401).json({ 
        success: false, 
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
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
    
    let errorCode = 'INVALID_TOKEN';
    let errorMessage = 'Invalid token';
    
    if (err.name === 'TokenExpiredError') {
      errorCode = 'TOKEN_EXPIRED';
      errorMessage = 'Token has expired';
    } else if (err.name === 'JsonWebTokenError') {
      errorCode = 'MALFORMED_TOKEN';
      errorMessage = 'Malformed token';
    }
    
    return res.status(401).json({ 
      success: false, 
      error: errorMessage,
      code: errorCode
    });
  }
}

export function requireAuth(roles) {
  return async (req, res, next) => {
    try {
      const teacher = req.teacher;
      if (!teacher) {
        return res.status(401).json({ 
          success: false, 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (teacher.roles.includes('מנהל')) {
        req.isAdmin = true;
        return next();
      }

      const hasRequiredRole = teacher.roles.some((role) =>
        roles.includes(role)
      );
      if (!hasRequiredRole) {
        return res.status(403).json({ 
          success: false, 
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: roles,
          current: teacher.roles
        });
      }

      next();
    } catch (err) {
      console.error('Role authorization error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Authorization failed',
        code: 'AUTH_FAILED'
      });
    }
  };
}
