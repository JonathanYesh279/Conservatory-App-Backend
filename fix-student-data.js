import 'dotenv/config';
import { getCollection } from './services/mongoDB.service.js';
import { initializeMongoDB } from './services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

async function fixStudentData() {
  try {
    // Initialize MongoDB connection
    await initializeMongoDB(process.env.MONGODB_URI);
    
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    
    const teacherId = '6878056b4f4ada6d8d921fce';
    const studentId = '687805f24f4ada6d8d921fcf';
    
    console.log('🔍 Checking if student exists...');
    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });
    
    if (!student) {
      console.log('❌ Student does not exist in database');
      console.log('🔧 Removing student ID from teacher...');
      
      // Remove the non-existent student ID from teacher
      const result = await teacherCollection.updateOne(
        { _id: ObjectId.createFromHexString(teacherId) },
        { 
          $pull: { 
            'teaching.studentIds': studentId 
          },
          $set: { 
            updatedAt: new Date() 
          }
        }
      );
      
      if (result.modifiedCount === 1) {
        console.log('✅ Successfully removed non-existent student ID from teacher');
      } else {
        console.log('❌ Failed to update teacher');
      }
    } else {
      console.log('✅ Student exists in database');
    }
    
    // Verify the fix
    const updatedTeacher = await teacherCollection.findOne({
      _id: ObjectId.createFromHexString(teacherId)
    });
    
    console.log('📋 Teacher student IDs after fix:', updatedTeacher.teaching.studentIds);
    
  } catch (error) {
    console.error('Error fixing student data:', error);
  } finally {
    process.exit(0);
  }
}

fixStudentData();