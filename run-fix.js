import 'dotenv/config';
import { getCollection, initializeMongoDB } from './services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

async function fixData() {
  console.log('Starting fix...');
  
  try {
    await initializeMongoDB(process.env.MONGODB_URI);
    console.log('Database connected');
    
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    
    // Check if student exists
    const studentId = '687805f24f4ada6d8d921fcf';
    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });
    
    if (!student) {
      console.log('Student not found, removing from teacher...');
      const teacherId = '6878056b4f4ada6d8d921fce';
      
      const result = await teacherCollection.updateOne(
        { _id: ObjectId.createFromHexString(teacherId) },
        { 
          $pull: { 'teaching.studentIds': studentId },
          $set: { updatedAt: new Date() }
        }
      );
      
      console.log('Fixed:', result.modifiedCount > 0);
    } else {
      console.log('Student exists, no fix needed');
    }
    
    console.log('Process completed');
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixData();