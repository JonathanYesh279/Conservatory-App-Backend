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
      requiresPasswordChange: teacher.credentials?.requiresPasswordChange || false,
    };

    // Add user object for cascade management compatibility
    req.user = {
      id: teacher._id.toString(),
      role: teacher.roles?.includes('מנהל') ? 'admin' : 'teacher',
      isAdmin: teacher.roles?.includes('מנהל') || false,
      email: teacher.credentials?.email,
      fullName: teacher.personalInfo?.fullName
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

// Default auth middleware export for cascade management
export const authMiddleware = authenticateToken;

export function requireAuth(roles) {
  return async (req, res, next) => {
    try {
      console.log('=== REQUIRE AUTH DEBUG ===');
      console.log('Required roles:', roles);
      console.log('Request path:', req.path);
      console.log('Request method:', req.method);
      
      const teacher = req.teacher;
      console.log('Teacher from req:', teacher ? 'exists' : 'missing');
      console.log('Teacher roles:', teacher?.roles);
      
      if (!teacher) {
        console.log('AUTH FAILED: No teacher in request');
        return res.status(401).json({ 
          success: false, 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      console.log('Checking if teacher has מנהל role...');
      if (teacher.roles && teacher.roles.includes('מנהל')) {
        console.log('✅ User is admin, granting access');
        req.isAdmin = true;
        return next();
      }

      console.log('User is not admin, checking required roles...');
      console.log('Teacher roles array:', teacher.roles);
      console.log('Required roles array:', roles);
      
      const hasRequiredRole = teacher.roles && teacher.roles.some((role) =>
        roles.includes(role)
      );
      console.log('Has required role:', hasRequiredRole);
      
      if (!hasRequiredRole) {
        console.log('❌ INSUFFICIENT PERMISSIONS');
        console.log('Required:', roles);
        console.log('Current:', teacher.roles);
        console.log('Teacher roles type:', typeof teacher.roles);
        console.log('Roles array type:', typeof roles);
        return res.status(403).json({ 
          success: false, 
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: roles,
          current: teacher.roles
        });
      }

      console.log('✅ Permission granted');
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

export function checkPasswordChangeRequired(req, res, next) {
  try {
    const teacher = req.teacher;
    
    // Allow these specific routes even if password change is required
    const allowedPaths = [
      '/api/auth/force-password-change',
      '/api/auth/logout',
      '/api/auth/validate',
      '/force-password-change'  // Allow access to the password change page
    ];
    
    if (allowedPaths.includes(req.path)) {
      return next();
    }
    
    // For API routes, return JSON error
    if (req.path.startsWith('/api/')) {
      if (teacher && teacher.credentials && teacher.credentials.requiresPasswordChange) {
        return res.status(403).json({
          success: false,
          error: 'Password change required',
          code: 'PASSWORD_CHANGE_REQUIRED',
          requiresPasswordChange: true,
          redirectUrl: '/force-password-change'
        });
      }
    } else {
      // For non-API routes (web pages), redirect to password change page
      if (teacher && teacher.credentials && teacher.credentials.requiresPasswordChange) {
        return res.redirect('/force-password-change');
      }
    }
    
    next();
  } catch (err) {
    console.error('Password change check error:', err);
    
    if (req.path.startsWith('/api/')) {
      res.status(500).json({
        success: false,
        error: 'Authorization check failed',
        code: 'AUTH_CHECK_FAILED'
      });
    } else {
      res.status(500).send('Authorization check failed');
    }
  }
}