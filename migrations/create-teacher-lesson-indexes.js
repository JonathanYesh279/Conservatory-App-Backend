/**
 * Database Indexing Script for Teacher-Student Lesson Performance
 * 
 * This script creates optimized indexes for efficient teacher lesson queries
 * based on the single source of truth approach using student teacherAssignments.
 * 
 * Usage: node migrations/create-teacher-lesson-indexes.js
 */

import 'dotenv/config';
import { getCollection } from '../services/mongoDB.service.js';

const INDEXES_CONFIG = [
  // ===== STUDENT COLLECTION INDEXES =====
  {
    collection: 'student',
    indexes: [
      {
        name: 'teacherAssignments_teacherId_1',
        spec: { 'teacherAssignments.teacherId': 1 },
        options: {
          background: true,
          partialFilterExpression: {
            'teacherAssignments.teacherId': { $exists: true }
          }
        },
        description: 'Primary index for teacher lesson queries - enables efficient lookups by teacher'
      },
      {
        name: 'teacherAssignments_compound_optimal',
        spec: {
          'teacherAssignments.teacherId': 1,
          'teacherAssignments.isActive': 1,
          'teacherAssignments.day': 1,
          'teacherAssignments.time': 1
        },
        options: {
          background: true,
          partialFilterExpression: {
            'teacherAssignments.teacherId': { $exists: true }
          }
        },
        description: 'Compound index for optimal teacher schedule queries with day/time sorting'
      },
      {
        name: 'teacherAssignments_active_lessons',
        spec: {
          'teacherAssignments.teacherId': 1,
          'teacherAssignments.isActive': 1,
          isActive: 1
        },
        options: {
          background: true,
          partialFilterExpression: {
            'teacherAssignments.isActive': { $ne: false },
            isActive: { $ne: false }
          }
        },
        description: 'Index for active lessons filtering'
      },
      {
        name: 'teacherIds_backward_compatibility',
        spec: { 'teacherIds': 1 },
        options: {
          background: true,
          partialFilterExpression: {
            'teacherIds': { $exists: true, $ne: [] }
          }
        },
        description: 'Backward compatibility index for legacy teacherIds queries'
      },
      {
        name: 'student_active_efficient',
        spec: {
          isActive: 1,
          'personalInfo.fullName': 1
        },
        options: {
          background: true
        },
        description: 'Efficient index for active student lookups with name sorting'
      }
    ]
  },
  
  // ===== TEACHER COLLECTION INDEXES =====
  {
    collection: 'teacher',
    indexes: [
      {
        name: 'teaching_studentIds_efficient',
        spec: { 'teaching.studentIds': 1 },
        options: {
          background: true,
          partialFilterExpression: {
            'teaching.studentIds': { $exists: true, $ne: [] }
          }
        },
        description: 'Index for teacher-student relationship queries'
      },
      {
        name: 'teacher_active_with_students',
        spec: {
          isActive: 1,
          'teaching.studentIds': 1,
          'personalInfo.fullName': 1
        },
        options: {
          background: true
        },
        description: 'Compound index for active teachers with student relationships'
      },
      {
        name: 'teaching_timeBlocks_efficient',
        spec: {
          'teaching.timeBlocks._id': 1,
          'teaching.timeBlocks.day': 1,
          'teaching.timeBlocks.isActive': 1
        },
        options: {
          background: true,
          partialFilterExpression: {
            'teaching.timeBlocks': { $exists: true, $ne: [] }
          }
        },
        description: 'Index for timeBlock validation queries'
      }
    ]
  }
];

async function createIndexes() {
  console.log('🚀 Creating Database Indexes for Teacher-Student Lesson Performance');
  console.log('====================================================================\n');

  const indexResults = {
    created: 0,
    existing: 0,
    failed: 0,
    errors: []
  };

  try {
    for (const collectionConfig of INDEXES_CONFIG) {
      const { collection: collectionName, indexes } = collectionConfig;
      
      console.log(`📊 Processing collection: ${collectionName}`);
      console.log(`   Creating ${indexes.length} indexes...\n`);

      const collection = await getCollection(collectionName);

      for (const indexConfig of indexes) {
        try {
          console.log(`   🔧 Creating index: ${indexConfig.name}`);
          console.log(`      Spec: ${JSON.stringify(indexConfig.spec)}`);
          console.log(`      Description: ${indexConfig.description}`);

          // Check if index already exists
          const existingIndexes = await collection.indexes();
          const indexExists = existingIndexes.some(idx => idx.name === indexConfig.name);

          if (indexExists) {
            console.log(`      ✅ Index already exists: ${indexConfig.name}`);
            indexResults.existing++;
          } else {
            // Create the index
            await collection.createIndex(indexConfig.spec, {
              name: indexConfig.name,
              ...indexConfig.options
            });
            
            console.log(`      🎉 Index created successfully: ${indexConfig.name}`);
            indexResults.created++;
          }

          console.log(); // Empty line for readability

        } catch (indexError) {
          console.error(`      ❌ Failed to create index ${indexConfig.name}:`, indexError.message);
          indexResults.failed++;
          indexResults.errors.push({
            collection: collectionName,
            indexName: indexConfig.name,
            error: indexError.message
          });
        }
      }
    }

    // Generate index analysis report
    await generateIndexAnalysisReport();

    // Print summary
    console.log('📈 Index Creation Summary:');
    console.log('=========================');
    console.log(`✅ Created: ${indexResults.created}`);
    console.log(`📋 Already existing: ${indexResults.existing}`);
    console.log(`❌ Failed: ${indexResults.failed}`);
    
    if (indexResults.errors.length > 0) {
      console.log('\n❌ Errors:');
      indexResults.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.collection}.${error.indexName}: ${error.error}`);
      });
    }

    if (indexResults.failed === 0) {
      console.log('\n🎉 All indexes created successfully!');
      console.log('   Teacher lesson queries should now be significantly faster.');
    } else {
      console.log('\n⚠️  Some indexes failed to create. Please review the errors above.');
    }

    return indexResults.failed === 0;

  } catch (error) {
    console.error('💥 Index creation failed with fatal error:', error);
    return false;
  }
}

async function generateIndexAnalysisReport() {
  console.log('\n🔍 Index Analysis Report:');
  console.log('=========================');

  try {
    const studentCollection = await getCollection('student');
    const teacherCollection = await getCollection('teacher');

    // Analyze student collection
    const studentStats = await studentCollection.stats();
    const studentIndexes = await studentCollection.indexes();
    
    console.log(`📊 Student Collection:`);
    console.log(`   Documents: ${studentStats.count.toLocaleString()}`);
    console.log(`   Indexes: ${studentIndexes.length}`);
    console.log(`   Data Size: ${(studentStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Index Size: ${(studentStats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);

    // Count students with teacherAssignments
    const studentsWithAssignments = await studentCollection.countDocuments({
      'teacherAssignments': { $exists: true, $ne: [] }
    });
    console.log(`   Students with teacherAssignments: ${studentsWithAssignments.toLocaleString()}`);

    // Analyze teacher collection
    const teacherStats = await teacherCollection.stats();
    const teacherIndexes = await teacherCollection.indexes();
    
    console.log(`\n👨‍🏫 Teacher Collection:`);
    console.log(`   Documents: ${teacherStats.count.toLocaleString()}`);
    console.log(`   Indexes: ${teacherIndexes.length}`);
    console.log(`   Data Size: ${(teacherStats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Index Size: ${(teacherStats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);

    // Count teachers with students
    const teachersWithStudents = await teacherCollection.countDocuments({
      'teaching.studentIds': { $exists: true, $ne: [] }
    });
    console.log(`   Teachers with students: ${teachersWithStudents.toLocaleString()}`);

    // Performance recommendations
    console.log(`\n💡 Performance Recommendations:`);
    
    const avgAssignmentsPerStudent = studentsWithAssignments > 0 ? 
      (await calculateAverageAssignments()) : 0;
    
    if (avgAssignmentsPerStudent > 5) {
      console.log(`   ⚠️  High assignment count (${avgAssignmentsPerStudent.toFixed(1)} avg) - consider data archiving`);
    }
    
    if (studentStats.count > 10000) {
      console.log(`   📈 Large dataset detected - monitor query performance closely`);
    }
    
    if ((studentStats.totalIndexSize / studentStats.size) > 0.5) {
      console.log(`   🔍 Index-to-data ratio is high - monitor index usage`);
    }

  } catch (error) {
    console.error('Error generating analysis report:', error.message);
  }
}

async function calculateAverageAssignments() {
  try {
    const studentCollection = await getCollection('student');
    
    const pipeline = [
      {
        $match: {
          'teacherAssignments': { $exists: true, $ne: [] }
        }
      },
      {
        $project: {
          assignmentCount: { $size: '$teacherAssignments' }
        }
      },
      {
        $group: {
          _id: null,
          avgAssignments: { $avg: '$assignmentCount' }
        }
      }
    ];

    const result = await studentCollection.aggregate(pipeline).toArray();
    return result.length > 0 ? result[0].avgAssignments : 0;

  } catch (error) {
    console.error('Error calculating average assignments:', error);
    return 0;
  }
}

/**
 * Test index performance with sample queries
 */
async function testIndexPerformance() {
  console.log('\n🧪 Testing Index Performance:');
  console.log('=============================');

  try {
    const studentCollection = await getCollection('student');

    // Test 1: Teacher lesson lookup
    console.log('Test 1: Teacher lesson lookup query...');
    const testTeacherId = '507f1f77bcf86cd799439011'; // Mock teacher ID
    
    const start1 = Date.now();
    const lessons = await studentCollection.find({
      'teacherAssignments.teacherId': testTeacherId,
      'teacherAssignments.isActive': { $ne: false },
      isActive: { $ne: false }
    }).explain('executionStats');
    const duration1 = Date.now() - start1;
    
    console.log(`   Execution time: ${duration1}ms`);
    console.log(`   Documents examined: ${lessons.executionStats?.docsExamined || 'N/A'}`);
    console.log(`   Index used: ${lessons.executionStats?.executionStages?.indexName || 'collection scan'}`);

    // Test 2: Weekly schedule query
    console.log('\nTest 2: Weekly schedule aggregation...');
    
    const start2 = Date.now();
    const weeklySchedule = await studentCollection.aggregate([
      {
        $match: {
          'teacherAssignments.teacherId': testTeacherId,
          'teacherAssignments.isActive': { $ne: false }
        }
      },
      { $unwind: '$teacherAssignments' },
      {
        $match: {
          'teacherAssignments.teacherId': testTeacherId,
          'teacherAssignments.isActive': { $ne: false }
        }
      },
      {
        $group: {
          _id: '$teacherAssignments.day',
          lessons: { $push: '$teacherAssignments' }
        }
      }
    ]).explain('executionStats');
    const duration2 = Date.now() - start2;
    
    console.log(`   Execution time: ${duration2}ms`);
    console.log(`   Pipeline optimized: ${weeklySchedule.stages?.[0]?.executionStats?.executionStages?.inputStage ? 'Yes' : 'No'}`);

    console.log('\n✅ Performance testing completed');

  } catch (error) {
    console.error('Error testing index performance:', error.message);
  }
}

/**
 * Drop all custom indexes (for development/testing)
 */
async function dropCustomIndexes() {
  console.log('🗑️  Dropping custom indexes...');
  
  const indexResults = {
    dropped: 0,
    errors: []
  };

  try {
    for (const collectionConfig of INDEXES_CONFIG) {
      const collection = await getCollection(collectionConfig.collection);
      
      for (const indexConfig of collectionConfig.indexes) {
        try {
          await collection.dropIndex(indexConfig.name);
          console.log(`   ✅ Dropped: ${indexConfig.name}`);
          indexResults.dropped++;
        } catch (error) {
          if (error.message.includes('index not found')) {
            console.log(`   ℹ️  Index not found: ${indexConfig.name}`);
          } else {
            console.error(`   ❌ Error dropping ${indexConfig.name}:`, error.message);
            indexResults.errors.push(error.message);
          }
        }
      }
    }

    console.log(`\n📊 Dropped ${indexResults.dropped} indexes`);
    
    if (indexResults.errors.length > 0) {
      console.log('❌ Errors:', indexResults.errors);
    }

  } catch (error) {
    console.error('Error dropping indexes:', error);
  }
}

// Execute based on command line arguments
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.includes('--drop')) {
    dropCustomIndexes()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Failed to drop indexes:', error);
        process.exit(1);
      });
  } else if (args.includes('--test')) {
    testIndexPerformance()
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Failed to test performance:', error);
        process.exit(1);
      });
  } else {
    createIndexes()
      .then(success => {
        if (args.includes('--test-after')) {
          return testIndexPerformance();
        }
        return success;
      })
      .then(() => process.exit(0))
      .catch(error => {
        console.error('Failed to create indexes:', error);
        process.exit(1);
      });
  }
}

export { createIndexes, testIndexPerformance, dropCustomIndexes };