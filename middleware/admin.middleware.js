/**
 * Admin Middleware
 * Ensures only admin users can access certain routes
 */

export const adminMiddleware = (req, res, next) => {
  try {
    // Check if user is authenticated first
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Check if user has admin privileges
    if (!req.user.isAdmin && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required',
        code: 'ADMIN_REQUIRED',
        userRole: req.user.role
      });
    }

    // User is admin, allow access
    next();
    
  } catch (error) {
    console.error('Admin middleware error:', error);
    res.status(500).json({
      error: 'Authorization check failed',
      code: 'AUTH_CHECK_FAILED'
    });
  }
};