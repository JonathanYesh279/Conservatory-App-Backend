import { getCollection } from './mongoDB.service.js';
import { ObjectId } from 'mongodb';

/**
 * Professional Role-Based Access Control (RBAC) Service
 * Provides granular permissions, resource-level access control, and audit logging
 */

// Define granular permissions for each resource
export const PERMISSIONS = {
  // Teacher permissions
  TEACHER_READ: 'teacher:read',
  TEACHER_READ_OWN: 'teacher:read:own',
  TEACHER_CREATE: 'teacher:create',
  TEACHER_UPDATE: 'teacher:update',
  TEACHER_UPDATE_OWN: 'teacher:update:own',
  TEACHER_DELETE: 'teacher:delete',
  TEACHER_SCHEDULE: 'teacher:schedule',
  
  // Student permissions
  STUDENT_READ: 'student:read',
  STUDENT_READ_ASSIGNED: 'student:read:assigned',
  STUDENT_CREATE: 'student:create',
  STUDENT_UPDATE: 'student:update',
  STUDENT_UPDATE_ASSIGNED: 'student:update:assigned',
  STUDENT_DELETE: 'student:delete',
  
  // Orchestra permissions
  ORCHESTRA_READ: 'orchestra:read',
  ORCHESTRA_CREATE: 'orchestra:create',
  ORCHESTRA_UPDATE: 'orchestra:update',
  ORCHESTRA_DELETE: 'orchestra:delete',
  ORCHESTRA_CONDUCT: 'orchestra:conduct',
  
  // Rehearsal permissions
  REHEARSAL_READ: 'rehearsal:read',
  REHEARSAL_CREATE: 'rehearsal:create',
  REHEARSAL_UPDATE: 'rehearsal:update',
  REHEARSAL_DELETE: 'rehearsal:delete',
  
  // Schedule permissions
  SCHEDULE_READ: 'schedule:read',
  SCHEDULE_READ_OWN: 'schedule:read:own',
  SCHEDULE_CREATE: 'schedule:create',
  SCHEDULE_UPDATE: 'schedule:update',
  SCHEDULE_DELETE: 'schedule:delete',
  
  // Admin permissions
  ADMIN_FULL: 'admin:full',
  AUDIT_READ: 'audit:read',
  SYSTEM_CONFIG: 'system:config',
  
  // Theory permissions
  THEORY_READ: 'theory:read',
  THEORY_CREATE: 'theory:create',
  THEORY_UPDATE: 'theory:update',
  THEORY_DELETE: 'theory:delete',
  
  // Bagrut permissions
  BAGRUT_READ: 'bagrut:read',
  BAGRUT_CREATE: 'bagrut:create',
  BAGRUT_UPDATE: 'bagrut:update',
  BAGRUT_DELETE: 'bagrut:delete'
};

// Define role-permission mappings
export const ROLE_PERMISSIONS = {
  'מנהל': [
    PERMISSIONS.ADMIN_FULL,
    PERMISSIONS.TEACHER_READ,
    PERMISSIONS.TEACHER_CREATE,
    PERMISSIONS.TEACHER_UPDATE,
    PERMISSIONS.TEACHER_DELETE,
    PERMISSIONS.TEACHER_SCHEDULE,
    PERMISSIONS.STUDENT_READ,
    PERMISSIONS.STUDENT_CREATE,
    PERMISSIONS.STUDENT_UPDATE,
    PERMISSIONS.STUDENT_DELETE,
    PERMISSIONS.ORCHESTRA_READ,
    PERMISSIONS.ORCHESTRA_CREATE,
    PERMISSIONS.ORCHESTRA_UPDATE,
    PERMISSIONS.ORCHESTRA_DELETE,
    PERMISSIONS.REHEARSAL_READ,
    PERMISSIONS.REHEARSAL_CREATE,
    PERMISSIONS.REHEARSAL_UPDATE,
    PERMISSIONS.REHEARSAL_DELETE,
    PERMISSIONS.SCHEDULE_READ,
    PERMISSIONS.SCHEDULE_CREATE,
    PERMISSIONS.SCHEDULE_UPDATE,
    PERMISSIONS.SCHEDULE_DELETE,
    PERMISSIONS.THEORY_READ,
    PERMISSIONS.THEORY_CREATE,
    PERMISSIONS.THEORY_UPDATE,
    PERMISSIONS.THEORY_DELETE,
    PERMISSIONS.BAGRUT_READ,
    PERMISSIONS.BAGRUT_CREATE,
    PERMISSIONS.BAGRUT_UPDATE,
    PERMISSIONS.BAGRUT_DELETE,
    PERMISSIONS.AUDIT_READ,
    PERMISSIONS.SYSTEM_CONFIG
  ],
  
  'מורה': [
    PERMISSIONS.TEACHER_READ_OWN,
    PERMISSIONS.TEACHER_UPDATE_OWN,
    PERMISSIONS.STUDENT_READ_ASSIGNED,
    PERMISSIONS.STUDENT_CREATE,
    PERMISSIONS.STUDENT_UPDATE_ASSIGNED,
    PERMISSIONS.SCHEDULE_READ_OWN,
    PERMISSIONS.SCHEDULE_CREATE,
    PERMISSIONS.SCHEDULE_UPDATE,
    PERMISSIONS.REHEARSAL_READ,
    PERMISSIONS.THEORY_READ
  ],
  
  'מנצח': [
    PERMISSIONS.TEACHER_READ_OWN,
    PERMISSIONS.TEACHER_UPDATE_OWN,
    PERMISSIONS.ORCHESTRA_READ,
    PERMISSIONS.ORCHESTRA_CONDUCT,
    PERMISSIONS.ORCHESTRA_UPDATE,
    PERMISSIONS.STUDENT_READ,
    PERMISSIONS.REHEARSAL_READ,
    PERMISSIONS.REHEARSAL_CREATE,
    PERMISSIONS.REHEARSAL_UPDATE,
    PERMISSIONS.SCHEDULE_READ,
    PERMISSIONS.SCHEDULE_CREATE,
    PERMISSIONS.SCHEDULE_UPDATE
  ],
  
  'מדריך הרכב': [
    PERMISSIONS.TEACHER_READ_OWN,
    PERMISSIONS.TEACHER_UPDATE_OWN,
    PERMISSIONS.STUDENT_READ,
    PERMISSIONS.STUDENT_UPDATE,
    PERMISSIONS.REHEARSAL_READ,
    PERMISSIONS.REHEARSAL_CREATE,
    PERMISSIONS.REHEARSAL_UPDATE,
    PERMISSIONS.SCHEDULE_READ,
    PERMISSIONS.SCHEDULE_CREATE,
    PERMISSIONS.SCHEDULE_UPDATE
  ],
  
  'מורה תאוריה': [
    PERMISSIONS.TEACHER_READ_OWN,
    PERMISSIONS.TEACHER_UPDATE_OWN,
    PERMISSIONS.STUDENT_READ_ASSIGNED,
    PERMISSIONS.STUDENT_UPDATE_ASSIGNED,
    PERMISSIONS.THEORY_READ,
    PERMISSIONS.THEORY_CREATE,
    PERMISSIONS.THEORY_UPDATE,
    PERMISSIONS.THEORY_DELETE,
    PERMISSIONS.BAGRUT_READ,
    PERMISSIONS.BAGRUT_CREATE,
    PERMISSIONS.BAGRUT_UPDATE,
    PERMISSIONS.BAGRUT_DELETE,
    PERMISSIONS.SCHEDULE_READ_OWN,
    PERMISSIONS.SCHEDULE_CREATE,
    PERMISSIONS.SCHEDULE_UPDATE
  ]
};

export class PermissionService {
  /**
   * Check if user has a specific permission
   */
  static hasPermission(userRoles, permission) {
    if (!Array.isArray(userRoles)) {
      return false;
    }
    
    // Admin has all permissions
    if (userRoles.includes('מנהל')) {
      return true;
    }
    
    // Check if any of the user's roles grants the permission
    return userRoles.some(role => {
      const rolePermissions = ROLE_PERMISSIONS[role] || [];
      return rolePermissions.includes(permission);
    });
  }
  
  /**
   * Check if user can access a specific resource
   */
  static async canAccessResource(userId, userRoles, permission, resourceType, resourceId = null) {
    try {
      // Admin can access everything
      if (userRoles.includes('מנהל')) {
        await this.logAccess(userId, permission, resourceType, resourceId, true, 'Admin access');
        return true;
      }
      
      // Check basic permission first
      if (!this.hasPermission(userRoles, permission)) {
        await this.logAccess(userId, permission, resourceType, resourceId, false, 'Permission denied');
        return false;
      }
      
      // For "own" permissions, check resource ownership
      if (permission.includes(':own') && resourceId) {
        const hasOwnership = await this.checkResourceOwnership(userId, resourceType, resourceId);
        await this.logAccess(userId, permission, resourceType, resourceId, hasOwnership, 
          hasOwnership ? 'Own resource access' : 'Not resource owner');
        return hasOwnership;
      }
      
      // For "assigned" permissions, check if user is assigned to resource
      if (permission.includes(':assigned') && resourceId) {
        const isAssigned = await this.checkResourceAssignment(userId, resourceType, resourceId);
        await this.logAccess(userId, permission, resourceType, resourceId, isAssigned,
          isAssigned ? 'Assigned resource access' : 'Not assigned to resource');
        return isAssigned;
      }
      
      await this.logAccess(userId, permission, resourceType, resourceId, true, 'Permission granted');
      return true;
      
    } catch (error) {
      console.error('Error checking resource access:', error);
      await this.logAccess(userId, permission, resourceType, resourceId, false, `Error: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Check if user owns a resource
   */
  static async checkResourceOwnership(userId, resourceType, resourceId) {
    try {
      const collection = await getCollection(resourceType);
      
      if (resourceType === 'teacher') {
        const resource = await collection.findOne({
          _id: ObjectId.createFromHexString(resourceId)
        });
        return resource && resource._id.toString() === userId;
      }
      
      // Add more resource ownership checks as needed
      return false;
      
    } catch (error) {
      console.error('Error checking resource ownership:', error);
      return false;
    }
  }
  
  /**
   * Check if user is assigned to a resource
   */
  static async checkResourceAssignment(userId, resourceType, resourceId) {
    try {
      if (resourceType === 'student') {
        const studentCollection = await getCollection('student');
        const student = await studentCollection.findOne({
          _id: ObjectId.createFromHexString(resourceId),
          teacherIds: userId
        });
        return !!student;
      }
      
      if (resourceType === 'orchestra') {
        const teacherCollection = await getCollection('teacher');
        const teacher = await teacherCollection.findOne({
          _id: ObjectId.createFromHexString(userId),
          'conducting.orchestraIds': resourceId
        });
        return !!teacher;
      }
      
      return false;
      
    } catch (error) {
      console.error('Error checking resource assignment:', error);
      return false;
    }
  }
  
  /**
   * Log access attempts for audit purposes
   */
  static async logAccess(userId, permission, resourceType, resourceId, granted, reason) {
    try {
      const auditCollection = await getCollection('audit_log');
      
      const logEntry = {
        userId,
        action: 'access_check',
        permission,
        resourceType,
        resourceId,
        granted,
        reason,
        timestamp: new Date(),
        ip: null, // To be set by middleware
        userAgent: null // To be set by middleware
      };
      
      await auditCollection.insertOne(logEntry);
      
    } catch (error) {
      console.error('Error logging access:', error);
      // Don't throw error to avoid breaking the main flow
    }
  }
  
  /**
   * Get all permissions for a user based on their roles
   */
  static getUserPermissions(userRoles) {
    if (!Array.isArray(userRoles)) {
      return [];
    }
    
    const permissions = new Set();
    
    userRoles.forEach(role => {
      const rolePermissions = ROLE_PERMISSIONS[role] || [];
      rolePermissions.forEach(permission => permissions.add(permission));
    });
    
    return Array.from(permissions);
  }
  
  /**
   * Validate if roles are valid
   */
  static validateRoles(roles) {
    if (!Array.isArray(roles)) {
      return false;
    }
    
    const validRoles = Object.keys(ROLE_PERMISSIONS);
    return roles.every(role => validRoles.includes(role));
  }
  
  /**
   * Get filtered data based on user permissions
   */
  static async getFilteredData(userId, userRoles, collection, filter = {}) {
    try {
      const coll = await getCollection(collection);
      
      // Admin can see everything
      if (userRoles.includes('מנהל')) {
        return await coll.find(filter).toArray();
      }
      
      // Apply role-based filtering
      let enhancedFilter = { ...filter };
      
      if (collection === 'teacher') {
        // Teachers can only see themselves unless they have broader permissions
        if (!this.hasPermission(userRoles, PERMISSIONS.TEACHER_READ)) {
          enhancedFilter._id = ObjectId.createFromHexString(userId);
        }
      }
      
      if (collection === 'student') {
        // Teachers can only see assigned students
        if (!this.hasPermission(userRoles, PERMISSIONS.STUDENT_READ)) {
          enhancedFilter.teacherIds = userId;
        }
      }
      
      return await coll.find(enhancedFilter).toArray();
      
    } catch (error) {
      console.error('Error getting filtered data:', error);
      throw error;
    }
  }
}

export default PermissionService;