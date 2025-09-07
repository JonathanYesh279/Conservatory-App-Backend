# Cascade Deletion Background Jobs & Real-time Notifications Integration Guide

## Overview

This guide explains how to integrate the new background job processing and real-time notification system for cascade deletion operations in your conservatory management system.

## Components Created

### 1. Background Job Processor (`services/cascadeJobProcessor.js`)

**Features:**
- Queue-based job processing with priority support
- Scheduled jobs (daily, weekly, monthly)
- Retry mechanism with exponential backoff
- Circuit breaker pattern for database failures
- Comprehensive metrics and monitoring

**Job Types:**
- `cascadeDeletion`: Single student cascade deletion
- `batchCascadeDeletion`: Multiple students batch processing
- `orphanedReferenceCleanup`: Daily cleanup of invalid references
- `integrityValidation`: Weekly data integrity validation
- `auditLogArchive`: Monthly audit log maintenance

**Scheduled Jobs:**
```javascript
const jobDefinitions = {
  orphanedReferenceCleanup: { schedule: '0 2 * * *', retries: 3 }, // Daily 2 AM
  integrityValidation: { schedule: '0 3 * * 0', retries: 2 },      // Weekly Sunday 3 AM
  auditLogArchive: { schedule: '0 1 1 * *', retries: 1 }          // Monthly 1st 1 AM
};
```

### 2. WebSocket Notification Service (`services/cascadeWebSocketService.js`)

**Features:**
- Real-time progress notifications
- Admin-only system monitoring
- User-specific cascade updates
- Critical system alerts
- Notification history tracking

**WebSocket Events:**
```javascript
// Progress Events
'cascade.progress' // { studentId, step, percentage, details }
'cascade.complete' // { studentId, summary, duration }
'batch.progress'   // { jobId, step, percentage, details }
'batch.complete'   // { jobId, summary, timestamp }

// Integrity Events
'integrity.progress' // { jobId, step, percentage, details }
'integrity.issue'    // { severity, collection, count, fixable }
'integrity.complete' // { jobId, results, timestamp }

// System Events
'deletion.warning' // { impact, affectedCollections, recommendation }
'system.alert'     // { type, severity, message, requiresAttention }
'job.queued'       // { jobId, type, priority, timestamp }
'job.completed'    // { jobId, type, processingTime, result }
```

### 3. REST API Controller (`controllers/cascadeManagementController.js`)

**Endpoints:**
- `POST /api/cascade/delete/:studentId` - Queue single deletion
- `POST /api/cascade/delete/batch` - Queue batch deletion
- `GET /api/cascade/job/:jobId` - Get job status
- `GET /api/cascade/queue/status` - System health (admin)
- `POST /api/cascade/cleanup/orphans` - Manual cleanup (admin)
- `POST /api/cascade/integrity/validate` - Manual validation (admin)
- `GET /api/cascade/audit/:studentId` - Deletion history
- `POST /api/cascade/restore/:studentId` - Restore deleted student (admin)
- `GET /api/cascade/metrics` - System metrics (admin)

### 4. System Initializer (`services/cascadeSystemInitializer.js`)

**Features:**
- Coordinates all cascade services
- System health monitoring
- Graceful shutdown handling
- Database verification
- Error handling and alerts

## Integration Steps

### Step 1: Install Dependencies

The `socket.io` dependency has been installed. Verify in your `package.json`:

```json
{
  "dependencies": {
    "socket.io": "^4.8.1"
  }
}
```

### Step 2: Initialize System in Server

Add to your main server file (`server.js`):

```javascript
import { cascadeSystemInitializer } from './services/cascadeSystemInitializer.js';
import cascadeRoutes from './routes/cascadeManagement.routes.js';

// ... your existing server setup ...

// Add cascade management routes
app.use('/api/cascade', cascadeRoutes);

// Initialize cascade system after server starts
server.listen(port, async () => {
  console.log(`Server running on port ${port}`);
  
  // Initialize cascade deletion system
  try {
    await cascadeSystemInitializer.initialize(server);
    console.log('✅ Cascade system ready');
  } catch (error) {
    console.error('❌ Failed to initialize cascade system:', error);
  }
});
```

### Step 3: Environment Variables

Add to your `.env` file:

```env
# WebSocket Configuration
CLIENT_ORIGIN=http://localhost:3000

# Job Processing Configuration
ENABLE_SCHEDULED_JOBS=true
MAX_CONCURRENT_JOBS=5
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=30000

# Notification Configuration
NOTIFICATION_HISTORY_SIZE=1000
HEALTH_BROADCAST_INTERVAL=30000
```

## Usage Examples

### 1. Queue Single Student Deletion

```javascript
// Frontend API call
const response = await fetch('/api/cascade/delete/60f7b3b4d4f1234567890123', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    reason: 'Student graduated and requested data removal',
    priority: 'high'
  })
});

const result = await response.json();
console.log('Deletion queued:', result.jobId);
```

### 2. Monitor Progress with WebSocket

```javascript
// Frontend WebSocket connection
import io from 'socket.io-client';

const socket = io('/cascade', {
  auth: { token: userToken }
});

// Subscribe to cascade updates for specific student
socket.emit('subscribe.cascade', { studentId: '60f7b3b4d4f1234567890123' });

// Listen for progress updates
socket.on('cascade.progress', (data) => {
  console.log(`Progress: ${data.percentage}% - ${data.details}`);
  updateProgressBar(data.percentage);
});

socket.on('cascade.complete', (data) => {
  console.log('Deletion completed:', data.summary);
  showSuccessMessage(data.summary);
});

socket.on('deletion.warning', (data) => {
  console.log('Impact warning:', data);
  showWarningDialog(data);
});
```

### 3. Admin System Monitoring

```javascript
// Admin dashboard WebSocket setup
socket.emit('subscribe.jobs');
socket.emit('subscribe.integrity');

socket.on('job.queued', (data) => {
  addJobToQueue(data);
});

socket.on('system.alert', (data) => {
  if (data.requiresAttention) {
    showCriticalAlert(data);
  } else {
    addNotification(data);
  }
});

socket.on('integrity.issue', (data) => {
  updateIntegrityReport(data);
});
```

### 4. Batch Operations

```javascript
// Queue batch deletion
const batchResponse = await fetch('/api/cascade/delete/batch', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    studentIds: [
      '60f7b3b4d4f1234567890123',
      '60f7b3b4d4f1234567890124',
      '60f7b3b4d4f1234567890125'
    ],
    reason: 'End of academic year cleanup',
    priority: 'medium'
  })
});
```

## Monitoring and Maintenance

### System Health Check

```javascript
// Get system status
const healthResponse = await fetch('/api/cascade/queue/status', {
  headers: { 'Authorization': `Bearer ${adminToken}` }
});

const health = await healthResponse.json();
console.log('System Health:', health);
```

### Manual Maintenance Operations

```javascript
// Trigger orphaned reference cleanup
await fetch('/api/cascade/cleanup/orphans', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${adminToken}` }
});

// Trigger integrity validation
await fetch('/api/cascade/integrity/validate', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${adminToken}` }
});
```

## Error Handling

The system includes comprehensive error handling:

1. **Circuit Breaker**: Automatically stops processing during database failures
2. **Retry Logic**: Failed jobs are retried with exponential backoff
3. **Graceful Shutdown**: System waits for active jobs before shutting down
4. **Real-time Alerts**: Critical issues trigger immediate WebSocket notifications
5. **Audit Trail**: All operations are logged for troubleshooting

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Authorization**: Admin-only endpoints check user roles
3. **Validation**: Input validation using Joi schemas
4. **Rate Limiting**: Consider adding rate limiting for API endpoints
5. **WebSocket Auth**: WebSocket connections require authentication tokens

## Performance Considerations

1. **Queue Management**: Jobs are prioritized and processed efficiently
2. **Database Indexes**: Audit collection has optimized indexes
3. **Memory Usage**: Job history is limited to prevent memory leaks
4. **Connection Limits**: WebSocket connections are monitored
5. **Batch Sizes**: Batch operations are limited to 50 items

## Troubleshooting

### Common Issues

1. **Jobs Not Processing**: Check circuit breaker status and database connection
2. **WebSocket Connection Fails**: Verify authentication token and CORS settings  
3. **High Memory Usage**: Check job queue size and notification history
4. **Database Locks**: Monitor long-running transactions during cascade operations

### Debug Mode

Enable detailed logging by setting:

```env
DEBUG_CASCADE_SYSTEM=true
LOG_LEVEL=debug
```

This comprehensive system provides robust background processing and real-time monitoring for cascade deletion operations in your conservatory management system.