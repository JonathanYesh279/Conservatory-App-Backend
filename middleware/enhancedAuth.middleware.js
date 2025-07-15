import jwt from 'jsonwebtoken';
import { getCollection } from '../services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import { PermissionService, PERMISSIONS } from '../services/permissionService.js';

/**
 * Enhanced Authentication and Authorization Middleware
 * Provides secure token validation, role-based access control, and audit logging
 */

/**
 * Enhanced token authentication with security improvements
 */
export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      await logSecurityEvent(null, 'missing_token', req.ip, req.get('User-Agent'), 'No authentication token provided');
      return res.status(401).json({ 
        error: 'Authentication required',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    
    // Get fresh user data from database
    const collection = await getCollection('teacher');
    const teacher = await collection.findOne({
      _id: ObjectId.createFromHexString(decoded._id),
      isActive: true,
    });

    if (!teacher) {
      await logSecurityEvent(decoded._id, 'invalid_user', req.ip, req.get('User-Agent'), 'Teacher not found or inactive');
      return res.status(401).json({ 
        error: 'Invalid authentication',
        code: 'USER_NOT_FOUND'
      });
    }

    // Validate roles
    if (!PermissionService.validateRoles(teacher.roles)) {
      await logSecurityEvent(teacher._id.toString(), 'invalid_roles', req.ip, req.get('User-Agent'), 'Invalid roles detected');
      return res.status(401).json({ 
        error: 'Invalid user roles',
        code: 'INVALID_ROLES'
      });
    }

    // Check if token version is still valid (for token revocation)
    const tokenVersion = teacher.credentials?.tokenVersion || 0;
    if (decoded.version !== undefined && decoded.version < tokenVersion) {
      await logSecurityEvent(teacher._id.toString(), 'revoked_token', req.ip, req.get('User-Agent'), 'Token has been revoked');
      return res.status(401).json({ 
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }

    // Attach user data to request
    req.teacher = teacher;
    req.user = {
      _id: teacher._id.toString(),
      roles: teacher.roles,
      fullName: teacher.personalInfo?.fullName || 'Unknown',
      email: teacher.credentials?.email,
      permissions: PermissionService.getUserPermissions(teacher.roles)
    };

    // Log successful authentication
    await logSecurityEvent(teacher._id.toString(), 'auth_success', req.ip, req.get('User-Agent'), 'Successful authentication');
    
    next();
  } catch (err) {
    console.error('Authentication error:', {
      name: err.name,
      message: err.message,
      stack: err.stack
    });

    let errorCode = 'INVALID_TOKEN';
    let errorMessage = 'Invalid token';

    if (err.name === 'TokenExpiredError') {
      errorCode = 'TOKEN_EXPIRED';
      errorMessage = 'Token has expired';
      await logSecurityEvent(null, 'expired_token', req.ip, req.get('User-Agent'), 'Token expired');
    } else if (err.name === 'JsonWebTokenError') {
      errorCode = 'MALFORMED_TOKEN';
      errorMessage = 'Malformed token';
      await logSecurityEvent(null, 'malformed_token', req.ip, req.get('User-Agent'), 'Malformed token');
    } else {
      await logSecurityEvent(null, 'auth_error', req.ip, req.get('User-Agent'), err.message);
    }

    res.status(401).json({ 
      error: errorMessage,
      code: errorCode
    });
  }
}

/**
 * Enhanced permission-based authorization
 */
export function requirePermission(permission, options = {}) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const { resourceType, getResourceId } = options;
      
      if (!user) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      let resourceId = null;
      if (getResourceId && typeof getResourceId === 'function') {
        resourceId = getResourceId(req);
      } else if (req.params.id) {
        resourceId = req.params.id;
      }

      const hasAccess = await PermissionService.canAccessResource(
        user._id,
        user.roles,
        permission,
        resourceType,
        resourceId
      );

      if (!hasAccess) {
        await logSecurityEvent(
          user._id, 
          'access_denied', 
          req.ip, 
          req.get('User-Agent'), 
          `Access denied for permission: ${permission}, resource: ${resourceType}:${resourceId}`
        );
        
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          code: 'PERMISSION_DENIED',
          required: permission
        });
      }

      // Add permission context to request
      req.permissionContext = {
        permission,
        resourceType,
        resourceId,
        hasAccess: true
      };

      next();
    } catch (err) {
      console.error('Authorization error:', err);
      await logSecurityEvent(
        req.user?._id, 
        'auth_error', 
        req.ip, 
        req.get('User-Agent'), 
        `Authorization error: ${err.message}`
      );
      
      res.status(500).json({ 
        error: 'Authorization check failed',
        code: 'AUTH_CHECK_FAILED'
      });
    }
  };
}

/**
 * Backward compatibility wrapper for existing requireAuth function
 */
export function requireAuth(roles) {
  return async (req, res, next) => {
    try {
      const teacher = req.teacher;
      if (!teacher) {
        return res.status(401).json({ 
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Admin bypass (but with logging)
      if (teacher.roles.includes('מנהל')) {
        req.isAdmin = true;
        await logSecurityEvent(teacher._id.toString(), 'admin_access', req.ip, req.get('User-Agent'), 'Admin access granted');
        return next();
      }

      // Check if user has any of the required roles
      const hasRequiredRole = teacher.roles.some((role) => roles.includes(role));
      
      if (!hasRequiredRole) {
        await logSecurityEvent(
          teacher._id.toString(), 
          'role_access_denied', 
          req.ip, 
          req.get('User-Agent'), 
          `Required roles: ${roles.join(', ')}, User roles: ${teacher.roles.join(', ')}`
        );
        
        return res.status(403).json({ 
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_ROLE',
          required: roles,
          current: teacher.roles
        });
      }

      await logSecurityEvent(teacher._id.toString(), 'role_access_granted', req.ip, req.get('User-Agent'), `Access granted with roles: ${teacher.roles.join(', ')}`);
      next();
    } catch (err) {
      console.error('Role authorization error:', err);
      res.status(500).json({ 
        error: 'Authorization failed',
        code: 'AUTH_FAILED'
      });
    }
  };
}

/**
 * Middleware to validate resource ownership
 */
export function requireOwnership(resourceType) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const resourceId = req.params.id;
      
      if (!user || !resourceId) {
        return res.status(400).json({ 
          error: 'Invalid request',
          code: 'INVALID_REQUEST'
        });
      }

      // Admin bypass
      if (user.roles.includes('מנהל')) {
        req.isOwner = true;
        return next();
      }

      const isOwner = await PermissionService.checkResourceOwnership(user._id, resourceType, resourceId);
      
      if (!isOwner) {
        await logSecurityEvent(
          user._id, 
          'ownership_denied', 
          req.ip, 
          req.get('User-Agent'), 
          `Ownership denied for ${resourceType}:${resourceId}`
        );
        
        return res.status(403).json({ 
          error: 'You can only access your own resources',
          code: 'OWNERSHIP_REQUIRED'
        });
      }

      req.isOwner = true;
      next();
    } catch (err) {
      console.error('Ownership check error:', err);
      res.status(500).json({ 
        error: 'Ownership check failed',
        code: 'OWNERSHIP_CHECK_FAILED'
      });
    }
  };
}

/**
 * Rate limiting middleware for authentication endpoints
 */
export function rateLimitAuth(maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  const attempts = new Map();
  
  return (req, res, next) => {
    const identifier = req.ip + (req.body?.email || '');
    const now = Date.now();
    const userAttempts = attempts.get(identifier) || { count: 0, resetTime: now + windowMs };
    
    if (now > userAttempts.resetTime) {
      userAttempts.count = 1;
      userAttempts.resetTime = now + windowMs;
    } else {
      userAttempts.count++;
    }
    
    attempts.set(identifier, userAttempts);
    
    if (userAttempts.count > maxAttempts) {
      logSecurityEvent(null, 'rate_limit_exceeded', req.ip, req.get('User-Agent'), `Too many auth attempts from ${req.ip}`);
      return res.status(429).json({
        error: 'Too many authentication attempts',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((userAttempts.resetTime - now) / 1000)
      });
    }
    
    next();
  };
}

/**
 * Security event logging
 */
async function logSecurityEvent(userId, eventType, ip, userAgent, details) {
  try {
    const auditCollection = await getCollection('security_log');
    
    const logEntry = {
      userId,
      eventType,
      ip,
      userAgent,
      details,
      timestamp: new Date(),
      severity: getSeverityLevel(eventType)
    };
    
    await auditCollection.insertOne(logEntry);
    
    // Log critical security events to console
    if (logEntry.severity === 'high') {
      console.warn('SECURITY EVENT:', logEntry);
    }
    
  } catch (error) {
    console.error('Error logging security event:', error);
  }
}

/**
 * Get severity level for security events
 */
function getSeverityLevel(eventType) {
  const highSeverity = ['rate_limit_exceeded', 'invalid_user', 'revoked_token', 'malformed_token'];
  const mediumSeverity = ['access_denied', 'ownership_denied', 'role_access_denied'];
  
  if (highSeverity.includes(eventType)) return 'high';
  if (mediumSeverity.includes(eventType)) return 'medium';
  return 'low';
}

export { PERMISSIONS };