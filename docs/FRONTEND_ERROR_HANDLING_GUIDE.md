# Frontend Error Handling Guide
## Authentication & Authorization Errors

This guide provides comprehensive error handling patterns for frontend applications consuming the Conservatory Backend API.

## Error Response Format

All authentication and authorization errors follow this structure:

```json
{
  "error": "Human-readable error message",
  "code": "MACHINE_READABLE_ERROR_CODE",
  "details": {} // Optional additional context
}
```

## Authentication Error Codes

### Missing or Invalid Tokens

#### `MISSING_TOKEN`
```json
{
  "error": "Authentication required",
  "code": "MISSING_TOKEN"
}
```
**Frontend Action**: Redirect to login page

#### `TOKEN_EXPIRED`
```json
{
  "error": "Token has expired",
  "code": "TOKEN_EXPIRED"
}
```
**Frontend Action**: Attempt refresh token, if fails redirect to login

#### `TOKEN_REVOKED`
```json
{
  "error": "Token has been revoked",
  "code": "TOKEN_REVOKED"
}
```
**Frontend Action**: Clear local storage, redirect to login

#### `MALFORMED_TOKEN`
```json
{
  "error": "Malformed token",
  "code": "MALFORMED_TOKEN"
}
```
**Frontend Action**: Clear local storage, redirect to login

### User Validation Errors

#### `USER_NOT_FOUND`
```json
{
  "error": "Invalid authentication",
  "code": "USER_NOT_FOUND"
}
```
**Frontend Action**: Clear local storage, redirect to login

#### `INVALID_ROLES`
```json
{
  "error": "Invalid user roles",
  "code": "INVALID_ROLES"
}
```
**Frontend Action**: Show error message, contact administrator

## Authorization Error Codes

### Permission Errors

#### `PERMISSION_DENIED`
```json
{
  "error": "Insufficient permissions",
  "code": "PERMISSION_DENIED",
  "required": "teacher:update"
}
```
**Frontend Action**: Show permission denied message, hide/disable UI elements

#### `INSUFFICIENT_ROLE`
```json
{
  "error": "Insufficient permissions",
  "code": "INSUFFICIENT_ROLE",
  "required": ["מנהל"],
  "current": ["מורה"]
}
```
**Frontend Action**: Show role-specific error message

#### `OWNERSHIP_REQUIRED`
```json
{
  "error": "You can only access your own resources",
  "code": "OWNERSHIP_REQUIRED"
}
```
**Frontend Action**: Navigate back or show access denied message

### Rate Limiting

#### `RATE_LIMIT_EXCEEDED`
```json
{
  "error": "Too many authentication attempts",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900
}
```
**Frontend Action**: Show countdown timer, disable login form

## User Creation/Update Error Codes

### Duplicate Detection Errors

#### `DUPLICATE_TEACHER_DETECTED`
```json
{
  "error": "Duplicate teacher detected",
  "code": "DUPLICATE_TEACHER_DETECTED",
  "details": {
    "blocked": true,
    "reason": "BLOCK CREATION: Critical duplicate detected. This appears to be an exact duplicate of an existing teacher.",
    "duplicates": [
      {
        "type": "EMAIL_DUPLICATE",
        "severity": "HIGH",
        "message": "Teacher with email \"user@example.com\" already exists",
        "matches": [
          {
            "id": "60d5ecb54c2e1f001f3a1234",
            "fullName": "John Doe",
            "email": "user@example.com",
            "phone": "0501234567",
            "address": "123 Main St",
            "roles": ["מורה"],
            "createdAt": "2021-06-25T10:00:00.000Z"
          }
        ],
        "conflictingField": "email"
      }
    ],
    "totalDuplicatesFound": 1
  }
}
```
**Frontend Action**: Show detailed duplicate information modal, allow user to review existing teacher, provide "Override" option for admins

#### `EMAIL_DUPLICATE`
```json
{
  "error": "Teacher with this credentials email already exists",
  "code": "EMAIL_DUPLICATE"
}
```
**Frontend Action**: Show field-specific error, highlight email input

### Success with Warnings

#### Teacher Created with Potential Duplicates
```json
{
  "success": true,
  "data": { /* teacher data */ },
  "warnings": {
    "potentialDuplicates": [
      {
        "type": "SIMILAR_NAME_DUPLICATE",
        "severity": "LOW",
        "message": "Teachers with similar names found",
        "matches": [
          {
            "id": "60d5ecb54c2e1f001f3a5678",
            "fullName": "John Smith",
            "email": "different@example.com",
            "phone": "0509876543",
            "address": "456 Oak St",
            "roles": ["מורה"],
            "createdAt": "2021-06-20T10:00:00.000Z"
          }
        ],
        "conflictingField": "fullName",
        "note": "These may be different people, but please verify"
      }
    ],
    "message": "Teacher created successfully, but potential duplicates were found"
  }
}
```
**Frontend Action**: Show success message with warning notification, display potential duplicates for review

## Frontend Implementation Examples

### React Error Handler

```javascript
// errorHandler.js
export const handleTeacherError = (error, navigate, setError, setDuplicateInfo) => {
  const { code, error: message, details } = error.response?.data || {};
  
  switch (code) {
    case 'DUPLICATE_TEACHER_DETECTED':
      setDuplicateInfo(details);
      setError('A teacher with similar information already exists');
      break;
      
    case 'EMAIL_DUPLICATE':
      setError(message || 'This email is already registered');
      break;
      
    case 'MISSING_TOKEN':
    case 'TOKEN_EXPIRED':
    case 'TOKEN_REVOKED':
    case 'MALFORMED_TOKEN':
    case 'USER_NOT_FOUND':
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      navigate('/login');
      break;
      
    case 'PERMISSION_DENIED':
    case 'INSUFFICIENT_ROLE':
    case 'OWNERSHIP_REQUIRED':
      setError('You do not have permission to perform this action');
      break;
      
    case 'RATE_LIMIT_EXCEEDED':
      const retryAfter = error.response?.data?.retryAfter || 900;
      setError(`Too many attempts. Please wait ${retryAfter} seconds`);
      break;
      
    case 'INVALID_ROLES':
      setError('Invalid user roles. Please contact administrator');
      break;
      
    default:
      setError(message || 'An unexpected error occurred');
  }
};

export const handleAuthError = (error, navigate, setError) => {
  const { code, error: message } = error.response?.data || {};
  
  switch (code) {
    case 'MISSING_TOKEN':
    case 'TOKEN_EXPIRED':
    case 'TOKEN_REVOKED':
    case 'MALFORMED_TOKEN':
    case 'USER_NOT_FOUND':
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      navigate('/login');
      break;
      
    case 'PERMISSION_DENIED':
    case 'INSUFFICIENT_ROLE':
    case 'OWNERSHIP_REQUIRED':
      setError('You do not have permission to perform this action');
      break;
      
    case 'RATE_LIMIT_EXCEEDED':
      const retryAfter = error.response?.data?.retryAfter || 900;
      setError(`Too many attempts. Please wait ${retryAfter} seconds`);
      break;
      
    case 'INVALID_ROLES':
      setError('Invalid user roles. Please contact administrator');
      break;
      
    default:
      setError(message || 'An unexpected error occurred');
  }
};
```

### Axios Interceptor Setup

```javascript
// apiClient.js
import axios from 'axios';
import { handleAuthError } from './authErrorHandler';

const apiClient = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

// Request interceptor to add token
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { code } = error.response?.data || {};
    
    // Attempt token refresh for expired tokens
    if (code === 'TOKEN_EXPIRED') {
      try {
        const refreshResponse = await axios.post('/api/auth/refresh');
        const { accessToken } = refreshResponse.data;
        
        localStorage.setItem('accessToken', accessToken);
        
        // Retry original request
        error.config.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient.request(error.config);
      } catch (refreshError) {
        // Refresh failed, handle as auth error
        handleAuthError(refreshError, navigate, setError);
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
```

### Enhanced Teacher Form Component

```javascript
// TeacherForm.jsx
import React, { useState } from 'react';
import { handleTeacherError } from './errorHandler';
import DuplicateTeacherModal from './DuplicateTeacherModal';

const TeacherForm = () => {
  const [formData, setFormData] = useState({
    personalInfo: { email: '', fullName: '', phone: '', address: '' },
    credentials: { email: '', password: '' },
    roles: ['מורה']
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [duplicateInfo, setDuplicateInfo] = useState(null);
  const [warnings, setWarnings] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e, overrideDuplicates = false) => {
    e.preventDefault();
    setErrors({});
    setSubmitError('');
    setDuplicateInfo(null);
    setWarnings(null);
    setIsSubmitting(true);
    
    try {
      const submitData = overrideDuplicates ? 
        { ...formData, forceCreate: true } : formData;
      
      const response = await apiClient.post('/api/teacher', submitData);
      
      // Handle success with warnings
      if (response.data.warnings) {
        setWarnings(response.data.warnings);
      }
      
      // Success handling
      console.log('Teacher created successfully:', response.data);
      
    } catch (error) {
      const { code, details } = error.response?.data || {};
      
      if (code === 'DUPLICATE_TEACHER_DETECTED') {
        setDuplicateInfo(details);
      } else if (code === 'EMAIL_DUPLICATE') {
        setErrors({
          email: 'This email is already registered'
        });
      } else {
        handleTeacherError(error, navigate, setSubmitError, setDuplicateInfo);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDuplicateOverride = () => {
    // Admin override - force creation despite duplicates
    handleSubmit({ preventDefault: () => {} }, true);
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Full Name *</label>
          <input
            type="text"
            value={formData.personalInfo.fullName}
            onChange={(e) => setFormData({
              ...formData,
              personalInfo: { ...formData.personalInfo, fullName: e.target.value }
            })}
            className={errors.fullName ? 'error' : ''}
            required
          />
          {errors.fullName && <span className="error-text">{errors.fullName}</span>}
        </div>

        <div className="form-group">
          <label>Email *</label>
          <input
            type="email"
            value={formData.personalInfo.email}
            onChange={(e) => setFormData({
              ...formData,
              personalInfo: { ...formData.personalInfo, email: e.target.value },
              credentials: { ...formData.credentials, email: e.target.value }
            })}
            className={errors.email ? 'error' : ''}
            required
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label>Phone *</label>
          <input
            type="tel"
            value={formData.personalInfo.phone}
            onChange={(e) => setFormData({
              ...formData,
              personalInfo: { ...formData.personalInfo, phone: e.target.value }
            })}
            className={errors.phone ? 'error' : ''}
            pattern="05[0-9]{8}"
            placeholder="0501234567"
            required
          />
          {errors.phone && <span className="error-text">{errors.phone}</span>}
        </div>

        <div className="form-group">
          <label>Address *</label>
          <input
            type="text"
            value={formData.personalInfo.address}
            onChange={(e) => setFormData({
              ...formData,
              personalInfo: { ...formData.personalInfo, address: e.target.value }
            })}
            className={errors.address ? 'error' : ''}
            required
          />
          {errors.address && <span className="error-text">{errors.address}</span>}
        </div>

        <div className="form-group">
          <label>Password *</label>
          <input
            type="password"
            value={formData.credentials.password}
            onChange={(e) => setFormData({
              ...formData,
              credentials: { ...formData.credentials, password: e.target.value }
            })}
            required
          />
        </div>
        
        {submitError && <div className="error-message">{submitError}</div>}
        
        {warnings && (
          <div className="warning-message">
            <h4>⚠️ Potential Duplicates Found</h4>
            <p>{warnings.message}</p>
            <details>
              <summary>View Similar Teachers</summary>
              {warnings.potentialDuplicates.map((duplicate, index) => (
                <div key={index} className="duplicate-warning">
                  <strong>{duplicate.type}:</strong> {duplicate.message}
                  {duplicate.matches.map((match, i) => (
                    <div key={i} className="match-info">
                      {match.fullName} - {match.email} - {match.phone}
                    </div>
                  ))}
                </div>
              ))}
            </details>
          </div>
        )}
        
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Teacher'}
        </button>
      </form>

      {/* Duplicate Detection Modal */}
      {duplicateInfo && (
        <DuplicateTeacherModal
          duplicateInfo={duplicateInfo}
          onClose={() => setDuplicateInfo(null)}
          onOverride={handleDuplicateOverride}
          userRole={currentUser?.roles || []}
        />
      )}
    </>
  );
};
```

### Duplicate Teacher Modal Component

```javascript
// DuplicateTeacherModal.jsx
import React from 'react';

const DuplicateTeacherModal = ({ duplicateInfo, onClose, onOverride, userRole }) => {
  const isAdmin = userRole.includes('מנהל');
  
  return (
    <div className="modal-overlay">
      <div className="modal-content duplicate-modal">
        <div className="modal-header">
          <h2>🚨 Duplicate Teacher Detected</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="alert alert-error">
            <strong>Reason:</strong> {duplicateInfo.reason}
          </div>
          
          <div className="duplicates-list">
            <h3>Existing Teachers Found:</h3>
            {duplicateInfo.duplicates.map((duplicate, index) => (
              <div key={index} className={`duplicate-item severity-${duplicate.severity.toLowerCase()}`}>
                <div className="duplicate-header">
                  <span className={`severity-badge ${duplicate.severity.toLowerCase()}`}>
                    {duplicate.severity}
                  </span>
                  <span className="duplicate-type">{duplicate.type}</span>
                </div>
                
                <p className="duplicate-message">{duplicate.message}</p>
                
                <div className="matching-teachers">
                  {duplicate.matches.map((match, i) => (
                    <div key={i} className="teacher-match">
                      <div className="teacher-info">
                        <strong>{match.fullName}</strong>
                        <div className="contact-info">
                          📧 {match.email} | 📞 {match.phone}
                        </div>
                        <div className="address-info">
                          📍 {match.address}
                        </div>
                        <div className="meta-info">
                          Roles: {match.roles.join(', ')} | 
                          Created: {new Date(match.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <button 
                        className="view-teacher-btn"
                        onClick={() => window.open(`/teachers/${match.id}`, '_blank')}
                      >
                        View Details
                      </button>
                    </div>
                  ))}
                </div>
                
                {duplicate.note && (
                  <p className="duplicate-note">
                    <em>{duplicate.note}</em>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
        
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          
          <button 
            className="btn btn-primary"
            onClick={() => {
              // Navigate to existing teacher
              if (duplicateInfo.duplicates[0]?.matches[0]?.id) {
                window.location.href = `/teachers/${duplicateInfo.duplicates[0].matches[0].id}`;
              }
            }}
          >
            View Existing Teacher
          </button>
          
          {isAdmin && (
            <button 
              className="btn btn-warning"
              onClick={onOverride}
              title="Admin override - create anyway"
            >
              Create Anyway (Admin)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default DuplicateTeacherModal;
```

### CSS Styles for Duplicate Detection

```css
/* Duplicate detection styles */
.duplicate-modal {
  max-width: 800px;
  max-height: 80vh;
  overflow-y: auto;
}

.severity-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8em;
  font-weight: bold;
  text-transform: uppercase;
}

.severity-badge.critical {
  background-color: #dc3545;
  color: white;
}

.severity-badge.high {
  background-color: #fd7e14;
  color: white;
}

.severity-badge.medium {
  background-color: #ffc107;
  color: black;
}

.severity-badge.low {
  background-color: #6c757d;
  color: white;
}

.duplicate-item {
  border: 1px solid #dee2e6;
  border-radius: 8px;
  padding: 16px;
  margin: 12px 0;
}

.duplicate-item.severity-critical {
  border-left: 4px solid #dc3545;
  background-color: #f8d7da;
}

.duplicate-item.severity-high {
  border-left: 4px solid #fd7e14;
  background-color: #fff3cd;
}

.duplicate-item.severity-medium {
  border-left: 4px solid #ffc107;
  background-color: #fff3cd;
}

.duplicate-item.severity-low {
  border-left: 4px solid #6c757d;
  background-color: #f8f9fa;
}

.teacher-match {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin: 8px 0;
  background-color: white;
}

.teacher-info {
  flex: 1;
}

.contact-info, .address-info, .meta-info {
  font-size: 0.9em;
  color: #666;
  margin: 4px 0;
}

.warning-message {
  background-color: #fff3cd;
  border: 1px solid #ffeaa7;
  border-radius: 6px;
  padding: 12px;
  margin: 16px 0;
}

.warning-message details {
  margin-top: 8px;
}

.warning-message summary {
  cursor: pointer;
  font-weight: bold;
  color: #856404;
}

.duplicate-warning {
  margin: 8px 0;
  padding: 8px;
  background-color: white;
  border-radius: 4px;
}

.match-info {
  font-size: 0.9em;
  color: #666;
  margin-left: 16px;
  padding: 4px 0;
}
```

### Vue.js Error Handler

```javascript
// errorHandler.js (Vue)
export const handleAuthError = (error, router, store) => {
  const { code, error: message } = error.response?.data || {};
  
  switch (code) {
    case 'MISSING_TOKEN':
    case 'TOKEN_EXPIRED':
    case 'TOKEN_REVOKED':
    case 'MALFORMED_TOKEN':
    case 'USER_NOT_FOUND':
      store.dispatch('auth/logout');
      router.push('/login');
      break;
      
    case 'PERMISSION_DENIED':
    case 'INSUFFICIENT_ROLE':
    case 'OWNERSHIP_REQUIRED':
      store.dispatch('notifications/showError', 
        'You do not have permission to perform this action');
      break;
      
    case 'RATE_LIMIT_EXCEEDED':
      const retryAfter = error.response?.data?.retryAfter || 900;
      store.dispatch('notifications/showError', 
        `Too many attempts. Please wait ${retryAfter} seconds`);
      break;
      
    default:
      store.dispatch('notifications/showError', 
        message || 'An unexpected error occurred');
  }
};
```

## Best Practices

### 1. **Consistent Error Display**
- Use the same error display components across the application
- Show field-specific errors near the relevant inputs
- Display general errors in a prominent location

### 2. **User Experience**
- Provide clear, actionable error messages
- Show loading states during token refresh attempts
- Implement retry mechanisms for network errors

### 3. **Security**
- Never expose sensitive backend error details to users
- Log detailed errors to browser console for debugging
- Clear authentication state immediately on auth failures

### 4. **Performance**
- Cache permission checks where appropriate
- Implement optimistic UI updates with error rollback
- Use debouncing for validation requests

### 5. **Accessibility**
- Ensure error messages are accessible to screen readers
- Use appropriate ARIA labels for error states
- Maintain keyboard navigation during error states

## Error Prevention Strategies

### 1. **Proactive Permission Checking**
```javascript
// Check permissions before showing UI elements
const canEditTeacher = user.permissions.includes('teacher:update');

return (
  <div>
    {canEditTeacher && (
      <button onClick={handleEdit}>Edit Teacher</button>
    )}
  </div>
);
```

### 2. **Role-Based Route Protection**
```javascript
// React Router guards
const ProtectedRoute = ({ children, requiredPermission }) => {
  const { user } = useAuth();
  
  if (!user.permissions.includes(requiredPermission)) {
    return <Navigate to="/unauthorized" />;
  }
  
  return children;
};
```

### 3. **Form Validation**
- Implement client-side validation to prevent obvious errors
- Use real-time validation for email uniqueness
- Provide immediate feedback for invalid inputs

This guide ensures robust error handling that provides excellent user experience while maintaining security.