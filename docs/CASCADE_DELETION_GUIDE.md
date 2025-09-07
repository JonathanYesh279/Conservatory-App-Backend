# MongoDB Cascade Deletion System Guide

A comprehensive cascade deletion system for the conservatory application with MongoDB aggregation pipelines, performance indexes, and transaction support.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation & Setup](#installation--setup)
4. [Core Components](#core-components)
5. [Usage Examples](#usage-examples)
6. [MongoDB Native Operations](#mongodb-native-operations)
7. [Performance Optimization](#performance-optimization)
8. [Data Integrity Validation](#data-integrity-validation)
9. [Audit Trail](#audit-trail)
10. [Troubleshooting](#troubleshooting)

## Overview

This cascade deletion system provides:

- **Transaction-based cascade operations** with rollback support
- **Comprehensive data integrity validation** using aggregation pipelines
- **Performance-optimized indexes** for efficient bulk operations
- **Audit trail functionality** with snapshot and restore capabilities
- **Orphaned reference detection** and cleanup utilities
- **Bidirectional relationship consistency** validation

### Key Features

- ✅ MongoDB native operations (no ORM dependencies)
- ✅ ACID transaction support with automatic rollback
- ✅ Academic data preservation (archive vs delete)
- ✅ Bulk operations for large-scale maintenance
- ✅ Real-time data integrity monitoring
- ✅ Comprehensive audit logging

## Architecture

```
├── services/
│   ├── cascadeDeletion.service.js           # Main cascade operations
│   ├── cascadeDeletionAggregation.service.js # Data integrity pipelines
│   └── mongoDB.service.js                    # Database connection
├── migrations/
│   ├── cascade-deletion-indexes.js          # Performance indexes
│   └── cascade-deletion-cleanup.js          # Migration utilities
└── scripts/
    └── cascade-deletion-demo.js             # Demo and testing
```

## Installation & Setup

### 1. Install Dependencies

Ensure you have the MongoDB native driver:

```bash
npm install mongodb
```

### 2. Create Performance Indexes

```javascript
import { createCascadeDeletionIndexes } from './migrations/cascade-deletion-indexes.js';
await createCascadeDeletionIndexes();
```

### 3. Run Migration Setup

```javascript
import { cascadeDeletionCleanup } from './migrations/cascade-deletion-cleanup.js';
await cascadeDeletionCleanup.runCompleteMigration();
```

## Core Components

### 1. Cascade Deletion Service

Main service for performing cascade deletions with full transaction support.

```javascript
import { cascadeDeletionService } from './services/cascadeDeletion.service.js';

// Delete a single student with cascade operations
const result = await cascadeDeletionService.cascadeDeleteStudent(
  studentId,
  userId,
  'Administrative deletion'
);

// Bulk deletion
const bulkResult = await cascadeDeletionService.bulkCascadeDeleteStudents(
  [studentId1, studentId2, studentId3],
  userId,
  'Bulk administrative cleanup'
);

// Restore from deletion
const restoreResult = await cascadeDeletionService.restoreStudent(
  studentId,
  userId,
  auditId
);
```

### 2. Data Integrity Aggregation Service

Advanced aggregation pipelines for data integrity validation.

```javascript
import { cascadeDeletionAggregationService } from './services/cascadeDeletionAggregation.service.js';

// Find all orphaned student references
const orphanedRefs = await cascadeDeletionAggregationService.findOrphanedStudentReferences();

// Detect bidirectional inconsistencies
const inconsistencies = await cascadeDeletionAggregationService.detectBidirectionalInconsistencies();

// Generate impact report for specific student
const impactReport = await cascadeDeletionAggregationService.generateCascadeDeletionImpactReport(studentId);

// Complete data integrity validation
const integrityReport = await cascadeDeletionAggregationService.validateDataIntegrity();
```

### 3. Performance Indexes

Compound indexes optimized for cascade deletion queries:

```javascript
// Student collection indexes
{ _id: 1, isActive: 1 }                      // Primary lookup
{ teacherIds: 1, isActive: 1 }               // Teacher relationships
{ orchestraIds: 1, isActive: 1 }             // Orchestra relationships
{ bagrutId: 1, isActive: 1 }                 // Bagrut relationship
{ 'teacherAssignments.teacherId': 1, isActive: 1 } // Nested assignments

// Teacher collection indexes
{ 'teaching.studentIds': 1, isActive: 1 }    // Student references
{ 'teaching.schedule.studentId': 1, isActive: 1 } // Schedule optimization

// And more for all collections...
```

## Usage Examples

### Basic Cascade Deletion

```javascript
const studentId = '507f1f77bcf86cd799439011';
const userId = '507f1f77bcf86cd799439012';

try {
  // Generate impact report first
  const impact = await cascadeDeletionAggregationService
    .generateCascadeDeletionImpactReport(studentId);
    
  console.log('Deletion will affect:');
  console.log(`- ${impact.impactSummary.teachersAffected} teachers`);
  console.log(`- ${impact.impactSummary.orchestrasAffected} orchestras`);
  console.log(`- ${impact.impactSummary.rehearsalsAffected} rehearsals`);
  
  // Perform cascade deletion
  const result = await cascadeDeletionService.cascadeDeleteStudent(
    studentId,
    userId,
    'Student transferred to another institution'
  );
  
  console.log('Deletion completed:');
  console.log(`- Audit ID: ${result.auditId}`);
  console.log(`- Documents affected: ${result.totalAffectedDocuments}`);
  console.log(`- Collections updated: ${result.cascadeOperations.length}`);
  
} catch (error) {
  console.error('Cascade deletion failed:', error);
}
```

### Data Integrity Monitoring

```javascript
// Run comprehensive integrity check
const integrityReport = await cascadeDeletionAggregationService.validateDataIntegrity();

console.log(`Data Integrity Score: ${integrityReport.overallHealth.score}/100`);

if (integrityReport.overallHealth.score < 95) {
  console.log('Issues detected:');
  
  // Handle orphaned references
  if (integrityReport.overallHealth.issues.orphanedReferences > 0) {
    console.log('Cleaning up orphaned references...');
    await cascadeDeletionCleanup.cleanupOrphanedReferences();
  }
  
  // Handle bidirectional inconsistencies
  if (integrityReport.overallHealth.issues.bidirectionalIssues > 0) {
    console.log('Fixing bidirectional inconsistencies...');
    // Custom logic to sync relationships
  }
}
```

### Bulk Operations

```javascript
// Find inactive students for cleanup
const inactiveStudents = await db.collection('student')
  .find({ isActive: false, deletedAt: { $lt: new Date(Date.now() - 30*24*60*60*1000) } })
  .toArray();

const studentIds = inactiveStudents.map(s => s._id.toString());

// Bulk cascade deletion
const bulkResult = await cascadeDeletionService.bulkCascadeDeleteStudents(
  studentIds,
  userId,
  'Cleanup of inactive students older than 30 days'
);

console.log(`Processed: ${bulkResult.totalStudents} students`);
console.log(`Successful: ${bulkResult.successful}`);
console.log(`Failed: ${bulkResult.failed}`);
console.log(`Total documents affected: ${bulkResult.totalDocumentsAffected}`);
```

## MongoDB Native Operations

### Direct MongoDB Shell Commands

#### Create Indexes
```javascript
// Student collection indexes
db.student.createIndex({ _id: 1, isActive: 1 }, { name: "student_cascade_primary" });
db.student.createIndex({ "teacherIds": 1, isActive: 1 }, { name: "student_teacher_cascade" });
db.student.createIndex({ "orchestraIds": 1, isActive: 1 }, { name: "student_orchestra_cascade" });

// Teacher collection indexes  
db.teacher.createIndex({ "teaching.studentIds": 1, isActive: 1 }, { name: "teacher_students_cascade" });
db.teacher.createIndex({ "teaching.schedule.studentId": 1, isActive: 1 }, { name: "teacher_schedule_cascade", sparse: true });
```

#### Find Orphaned References
```javascript
// Get all active student IDs
var activeStudentIds = db.student.distinct("_id", { isActive: true });

// Find orphaned references in teacher collection
db.teacher.aggregate([
  { $match: { isActive: true } },
  { $unwind: "$teaching.studentIds" },
  { $match: { "teaching.studentIds": { $nin: activeStudentIds } } },
  {
    $group: {
      _id: "$teaching.studentIds",
      referencedInTeachers: { $push: "$_id" },
      count: { $sum: 1 }
    }
  }
]);
```

#### Bulk Cleanup Operations
```javascript
// Clean up teacher references
db.teacher.updateMany(
  { isActive: true },
  { $pull: { "teaching.studentIds": { $nin: activeStudentIds } } }
);

// Free up schedule slots
db.teacher.updateMany(
  { 
    isActive: true,
    "teaching.schedule.studentId": { $nin: activeStudentIds }
  },
  {
    $set: {
      "teaching.schedule.$[slot].studentId": null,
      "teaching.schedule.$[slot].status": "available",
      "teaching.schedule.$[slot].updatedAt": new Date()
    }
  },
  {
    arrayFilters: [{ "slot.studentId": { $nin: activeStudentIds } }]
  }
);
```

### Advanced Aggregation Pipelines

#### Bidirectional Consistency Check
```javascript
// Find students referencing teachers that don't reference back
db.student.aggregate([
  { $match: { isActive: true } },
  { $unwind: "$teacherIds" },
  {
    $lookup: {
      from: "teacher",
      let: { studentId: "$_id", teacherId: "$teacherIds" },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $eq: ["$_id", "$$teacherId"] },
                { $eq: ["$isActive", true] },
                { $not: { $in: ["$$studentId", "$teaching.studentIds"] } }
              ]
            }
          }
        }
      ],
      as: "inconsistentTeacher"
    }
  },
  { $match: { inconsistentTeacher: { $ne: [] } } },
  {
    $project: {
      studentId: "$_id",
      teacherId: "$teacherIds",
      issue: "Student references teacher but teacher does not reference student"
    }
  }
]);
```

#### Cascade Impact Analysis
```javascript
// Generate comprehensive impact report for student deletion
db.student.aggregate([
  { $match: { _id: ObjectId("STUDENT_ID_HERE") } },
  {
    $lookup: {
      from: "teacher",
      localField: "_id",
      foreignField: "teaching.studentIds",
      as: "relatedTeachers"
    }
  },
  {
    $lookup: {
      from: "orchestra", 
      localField: "_id",
      foreignField: "memberIds",
      as: "relatedOrchestras"
    }
  },
  {
    $lookup: {
      from: "bagrut",
      localField: "_id", 
      foreignField: "studentId",
      as: "relatedBagrut"
    }
  },
  {
    $project: {
      studentInfo: { 
        firstName: "$personalInfo.firstName",
        lastName: "$personalInfo.lastName" 
      },
      impactSummary: {
        teachersAffected: { $size: "$relatedTeachers" },
        orchestrasAffected: { $size: "$relatedOrchestras" },
        bagrutRecords: { $size: "$relatedBagrut" }
      }
    }
  }
]);
```

## Performance Optimization

### Index Usage Guidelines

1. **Always use compound indexes** for cascade deletion queries
2. **Include isActive field** in all indexes for active data filtering
3. **Use sparse indexes** for optional fields like bagrutId
4. **Create covering indexes** for frequently accessed field combinations

### Query Optimization Tips

```javascript
// Good: Uses index efficiently
db.teacher.find({ 
  "teaching.studentIds": studentId, 
  isActive: true 
});

// Bad: Full collection scan
db.teacher.find({ 
  "teaching.studentIds": studentId 
});

// Good: Uses compound index
db.student.find({ 
  teacherIds: teacherId, 
  isActive: true 
});

// Good: Batch operations
db.teacher.updateMany(
  { "teaching.studentIds": { $in: studentIds }, isActive: true },
  { $pull: { "teaching.studentIds": { $in: studentIds } } }
);
```

### Bulk Operation Best Practices

1. **Use transactions** for data consistency
2. **Batch operations** in groups of 1000 documents
3. **Use sessions** for all related operations
4. **Implement proper error handling** with rollback

## Data Integrity Validation

### Integrity Checks Schedule

```javascript
// Daily integrity check
const runDailyIntegrityCheck = async () => {
  const report = await cascadeDeletionAggregationService.validateDataIntegrity();
  
  if (report.overallHealth.score < 90) {
    // Send alert to administrators
    console.log('Data integrity issue detected - score:', report.overallHealth.score);
    
    // Auto-fix minor issues
    if (report.overallHealth.issues.orphanedReferences > 0) {
      await cascadeDeletionCleanup.cleanupOrphanedReferences();
    }
  }
};

// Schedule daily at 2 AM
// setInterval(runDailyIntegrityCheck, 24 * 60 * 60 * 1000);
```

### Validation Thresholds

- **Score 95-100**: Excellent integrity
- **Score 85-94**: Good integrity, minor issues
- **Score 70-84**: Fair integrity, requires attention
- **Score < 70**: Poor integrity, immediate action required

## Audit Trail

### Audit Record Structure

```javascript
{
  _id: ObjectId,
  entityType: "student",
  entityId: ObjectId("student_id"),
  deletionType: "cascade_cleanup",
  cascadeOperations: [
    {
      collection: "teacher",
      operation: "remove_student_references", 
      affectedDocuments: 3,
      details: {
        studentsRemoved: 3,
        scheduleSlotsFreed: 5
      }
    }
  ],
  snapshot: {
    student: { /* complete student document */ },
    relatedData: { /* all related documents */ }
  },
  timestamp: ISODate,
  userId: ObjectId("admin_user_id"),
  reason: "Administrative deletion"
}
```

### Audit Queries

```javascript
// Find all deletions by user
db.deletion_audit.find({ userId: ObjectId("user_id") }).sort({ timestamp: -1 });

// Find all deletions in date range
db.deletion_audit.find({
  timestamp: {
    $gte: ISODate("2024-01-01"),
    $lte: ISODate("2024-01-31")
  }
});

// Find all cascade operations affecting specific collection
db.deletion_audit.find({ "cascadeOperations.collection": "teacher" });
```

## Troubleshooting

### Common Issues

#### 1. Transaction Timeout
```javascript
// Increase transaction timeout for large operations
const options = {
  readConcern: { level: 'majority' },
  writeConcern: { w: 'majority' },
  maxTimeMS: 300000 // 5 minutes
};

await session.withTransaction(async () => {
  // cascade operations
}, options);
```

#### 2. Index Creation Failures
```javascript
// Handle index creation errors gracefully
try {
  await collection.createIndex(indexSpec, { name: indexName });
} catch (error) {
  if (error.code !== 85) { // Index already exists
    throw error;
  }
}
```

#### 3. Memory Issues with Large Datasets
```javascript
// Use cursor for large aggregations
const cursor = db.collection('student').aggregate([
  // pipeline
], { allowDiskUse: true, cursor: { batchSize: 100 } });

while (await cursor.hasNext()) {
  const doc = await cursor.next();
  // process document
}
```

### Performance Monitoring

```javascript
// Monitor query performance
db.setProfilingLevel(1, { slowms: 1000 });

// Check slow operations
db.system.profile.find().sort({ ts: -1 }).limit(10);

// Analyze index usage
db.collection.aggregate([
  { $indexStats: {} }
]);
```

### Error Recovery

```javascript
// Automatic rollback on transaction failure
try {
  await session.withTransaction(async () => {
    // cascade operations
  });
} catch (error) {
  console.error('Transaction failed, automatic rollback completed');
  // Additional cleanup if needed
}
```

## Running the Demo

Execute the comprehensive demo script:

```bash
node scripts/cascade-deletion-demo.js
```

The demo will:
1. Create all performance indexes
2. Run migration setup  
3. Analyze current data integrity
4. Find orphaned references
5. Detect bidirectional inconsistencies
6. Demonstrate cascade deletion (if test data available)
7. Analyze index performance

## Conclusion

This cascade deletion system provides enterprise-grade data integrity management for the conservatory application. It combines MongoDB's native capabilities with comprehensive validation, audit trails, and performance optimization to ensure reliable and efficient data management operations.

For additional support or feature requests, refer to the implementation files in the `services/` and `migrations/` directories.