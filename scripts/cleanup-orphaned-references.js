#!/usr/bin/env node

/**
 * Cleanup Script for Orphaned References
 * 
 * This script fixes orphaned references in the database:
 * 1. Removes non-existent student IDs from teachers' teaching.studentIds arrays
 * 2. Removes non-existent orchestra IDs from teachers' conducting.orchestraIds arrays
 * 3. Removes non-existent teacher IDs from students' teacherIds arrays
 * 4. Removes non-existent orchestra IDs from students' enrollments.orchestraIds arrays
 */

import { MongoClient, ObjectId } from 'mongodb';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MONGO_URL = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const DB_NAME = 'conservatory_app';

async function connectToDatabase() {
  const client = new MongoClient(MONGO_URL);
  await client.connect();
  return client.db(DB_NAME);
}

async function cleanupOrphanedStudentReferences() {
  console.log('🧹 Starting cleanup of orphaned student references...');
  
  const db = await connectToDatabase();
  const teacherCollection = db.collection('teacher');
  const studentCollection = db.collection('student');
  
  // Get all active students
  const allStudents = await studentCollection.find({ isActive: true }).toArray();
  const validStudentIds = new Set(allStudents.map(student => student._id.toString()));
  
  console.log(`📊 Found ${validStudentIds.size} valid students in database`);
  
  // Find teachers with studentIds that reference non-existent students
  const teachers = await teacherCollection.find({ 
    'teaching.studentIds': { $exists: true, $not: { $size: 0 } }
  }).toArray();
  
  let totalOrphanedReferences = 0;
  let teachersUpdated = 0;
  
  for (const teacher of teachers) {
    const studentIds = teacher.teaching?.studentIds || [];
    const validStudentIdsForTeacher = studentIds.filter(studentId => validStudentIds.has(studentId));
    const orphanedStudentIds = studentIds.filter(studentId => !validStudentIds.has(studentId));
    
    if (orphanedStudentIds.length > 0) {
      console.log(`🔍 Teacher ${teacher._id} (${teacher.personalInfo?.fullName || 'Unknown'})`);
      console.log(`   - Original student count: ${studentIds.length}`);
      console.log(`   - Valid students: ${validStudentIdsForTeacher.length}`);
      console.log(`   - Orphaned references: ${orphanedStudentIds.length}`);
      console.log(`   - Orphaned IDs: ${orphanedStudentIds.join(', ')}`);
      
      // Update teacher record
      await teacherCollection.updateOne(
        { _id: teacher._id },
        { 
          $set: { 
            'teaching.studentIds': validStudentIdsForTeacher,
            updatedAt: new Date()
          }
        }
      );
      
      totalOrphanedReferences += orphanedStudentIds.length;
      teachersUpdated++;
      console.log(`   ✅ Updated teacher record`);
    }
  }
  
  console.log(`\n🎯 Cleanup Results:`);
  console.log(`   - Teachers processed: ${teachers.length}`);
  console.log(`   - Teachers updated: ${teachersUpdated}`);
  console.log(`   - Total orphaned references removed: ${totalOrphanedReferences}`);
}

async function cleanupOrphanedOrchestraReferences() {
  console.log('\n🧹 Starting cleanup of orphaned orchestra references...');
  
  const db = await connectToDatabase();
  const teacherCollection = db.collection('teacher');
  const orchestraCollection = db.collection('orchestra');
  const studentCollection = db.collection('student');
  
  // Get all active orchestras
  const allOrchestras = await orchestraCollection.find({ isActive: true }).toArray();
  const validOrchestraIds = new Set(allOrchestras.map(orchestra => orchestra._id.toString()));
  
  console.log(`📊 Found ${validOrchestraIds.size} valid orchestras in database`);
  
  // Clean up teacher orchestra references
  const teachersWithOrchestras = await teacherCollection.find({ 
    'conducting.orchestraIds': { $exists: true, $not: { $size: 0 } }
  }).toArray();
  
  let teacherOrphanedReferences = 0;
  let teachersUpdatedForOrchestras = 0;
  
  for (const teacher of teachersWithOrchestras) {
    const orchestraIds = teacher.conducting?.orchestraIds || [];
    const validOrchestraIdsForTeacher = orchestraIds.filter(orchestraId => validOrchestraIds.has(orchestraId));
    const orphanedOrchestraIds = orchestraIds.filter(orchestraId => !validOrchestraIds.has(orchestraId));
    
    if (orphanedOrchestraIds.length > 0) {
      console.log(`🔍 Teacher ${teacher._id} (${teacher.personalInfo?.fullName || 'Unknown'})`);
      console.log(`   - Original orchestra count: ${orchestraIds.length}`);
      console.log(`   - Valid orchestras: ${validOrchestraIdsForTeacher.length}`);
      console.log(`   - Orphaned orchestra references: ${orphanedOrchestraIds.length}`);
      console.log(`   - Orphaned Orchestra IDs: ${orphanedOrchestraIds.join(', ')}`);
      
      // Update teacher record
      await teacherCollection.updateOne(
        { _id: teacher._id },
        { 
          $set: { 
            'conducting.orchestraIds': validOrchestraIdsForTeacher,
            updatedAt: new Date()
          }
        }
      );
      
      teacherOrphanedReferences += orphanedOrchestraIds.length;
      teachersUpdatedForOrchestras++;
      console.log(`   ✅ Updated teacher orchestra references`);
    }
  }
  
  // Clean up student orchestra references
  const studentsWithOrchestras = await studentCollection.find({ 
    'enrollments.orchestraIds': { $exists: true, $not: { $size: 0 } }
  }).toArray();
  
  let studentOrphanedReferences = 0;
  let studentsUpdatedForOrchestras = 0;
  
  for (const student of studentsWithOrchestras) {
    const orchestraIds = student.enrollments?.orchestraIds || [];
    const validOrchestraIdsForStudent = orchestraIds.filter(orchestraId => validOrchestraIds.has(orchestraId));
    const orphanedOrchestraIds = orchestraIds.filter(orchestraId => !validOrchestraIds.has(orchestraId));
    
    if (orphanedOrchestraIds.length > 0) {
      console.log(`🔍 Student ${student._id} (${student.personalInfo?.fullName || 'Unknown'})`);
      console.log(`   - Original orchestra count: ${orchestraIds.length}`);
      console.log(`   - Valid orchestras: ${validOrchestraIdsForStudent.length}`);
      console.log(`   - Orphaned orchestra references: ${orphanedOrchestraIds.length}`);
      console.log(`   - Orphaned Orchestra IDs: ${orphanedOrchestraIds.join(', ')}`);
      
      // Update student record
      await studentCollection.updateOne(
        { _id: student._id },
        { 
          $set: { 
            'enrollments.orchestraIds': validOrchestraIdsForStudent,
            updatedAt: new Date()
          }
        }
      );
      
      studentOrphanedReferences += orphanedOrchestraIds.length;
      studentsUpdatedForOrchestras++;
      console.log(`   ✅ Updated student orchestra references`);
    }
  }
  
  console.log(`\n🎯 Orchestra Cleanup Results:`);
  console.log(`   - Teachers with orchestras processed: ${teachersWithOrchestras.length}`);
  console.log(`   - Teachers updated: ${teachersUpdatedForOrchestras}`);
  console.log(`   - Teacher orphaned orchestra references removed: ${teacherOrphanedReferences}`);
  console.log(`   - Students with orchestras processed: ${studentsWithOrchestras.length}`);
  console.log(`   - Students updated: ${studentsUpdatedForOrchestras}`);
  console.log(`   - Student orphaned orchestra references removed: ${studentOrphanedReferences}`);
}

async function cleanupOrphanedTeacherReferences() {
  console.log('\n🧹 Starting cleanup of orphaned teacher references in students...');
  
  const db = await connectToDatabase();
  const teacherCollection = db.collection('teacher');
  const studentCollection = db.collection('student');
  
  // Get all active teachers
  const allTeachers = await teacherCollection.find({ isActive: true }).toArray();
  const validTeacherIds = new Set(allTeachers.map(teacher => teacher._id.toString()));
  
  console.log(`📊 Found ${validTeacherIds.size} valid teachers in database`);
  
  // Find students with teacherIds that reference non-existent teachers
  const studentsWithTeachers = await studentCollection.find({ 
    teacherIds: { $exists: true, $not: { $size: 0 } }
  }).toArray();
  
  let totalOrphanedTeacherReferences = 0;
  let studentsUpdated = 0;
  
  for (const student of studentsWithTeachers) {
    const teacherIds = student.teacherIds || [];
    const validTeacherIdsForStudent = teacherIds.filter(teacherId => validTeacherIds.has(teacherId));
    const orphanedTeacherIds = teacherIds.filter(teacherId => !validTeacherIds.has(teacherId));
    
    if (orphanedTeacherIds.length > 0) {
      console.log(`🔍 Student ${student._id} (${student.personalInfo?.fullName || 'Unknown'})`);
      console.log(`   - Original teacher count: ${teacherIds.length}`);
      console.log(`   - Valid teachers: ${validTeacherIdsForStudent.length}`);
      console.log(`   - Orphaned teacher references: ${orphanedTeacherIds.length}`);
      console.log(`   - Orphaned Teacher IDs: ${orphanedTeacherIds.join(', ')}`);
      
      // Update student record
      await studentCollection.updateOne(
        { _id: student._id },
        { 
          $set: { 
            teacherIds: validTeacherIdsForStudent,
            updatedAt: new Date()
          }
        }
      );
      
      totalOrphanedTeacherReferences += orphanedTeacherIds.length;
      studentsUpdated++;
      console.log(`   ✅ Updated student record`);
    }
  }
  
  console.log(`\n🎯 Teacher Reference Cleanup Results:`);
  console.log(`   - Students processed: ${studentsWithTeachers.length}`);
  console.log(`   - Students updated: ${studentsUpdated}`);
  console.log(`   - Total orphaned teacher references removed: ${totalOrphanedTeacherReferences}`);
}

async function generateReport() {
  console.log('\n📊 Generating database integrity report...');
  
  const db = await connectToDatabase();
  const teacherCollection = db.collection('teacher');
  const studentCollection = db.collection('student');
  const orchestraCollection = db.collection('orchestra');
  
  const teacherCount = await teacherCollection.countDocuments({ isActive: true });
  const studentCount = await studentCollection.countDocuments({ isActive: true });
  const orchestraCount = await orchestraCollection.countDocuments({ isActive: true });
  
  // Count relationships
  const teachersWithStudents = await teacherCollection.countDocuments({ 
    'teaching.studentIds': { $exists: true, $not: { $size: 0 } }
  });
  
  const studentsWithTeachers = await studentCollection.countDocuments({ 
    teacherIds: { $exists: true, $not: { $size: 0 } }
  });
  
  const teachersWithOrchestras = await teacherCollection.countDocuments({ 
    'conducting.orchestraIds': { $exists: true, $not: { $size: 0 } }
  });
  
  const studentsWithOrchestras = await studentCollection.countDocuments({ 
    'enrollments.orchestraIds': { $exists: true, $not: { $size: 0 } }
  });
  
  console.log(`\n📈 Database Summary:`);
  console.log(`   - Total Active Teachers: ${teacherCount}`);
  console.log(`   - Total Active Students: ${studentCount}`);
  console.log(`   - Total Active Orchestras: ${orchestraCount}`);
  console.log(`   - Teachers with student assignments: ${teachersWithStudents}`);
  console.log(`   - Students with teacher assignments: ${studentsWithTeachers}`);
  console.log(`   - Teachers conducting orchestras: ${teachersWithOrchestras}`);
  console.log(`   - Students enrolled in orchestras: ${studentsWithOrchestras}`);
  
  // Close the connection
  await db.client.close();
}

// Main execution
async function main() {
  try {
    console.log('🚀 Starting Database Cleanup Script');
    console.log('=====================================\n');
    
    await cleanupOrphanedStudentReferences();
    await cleanupOrphanedOrchestraReferences();
    await cleanupOrphanedTeacherReferences();
    await generateReport();
    
    console.log('\n✅ Cleanup completed successfully!');
    console.log('=====================================');
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as cleanupOrphanedReferences };