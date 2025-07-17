import 'dotenv/config';
import { getCollection, initializeMongoDB } from './services/mongoDB.service.js';
import { ObjectId } from 'mongodb';

console.log('Starting fix script...');

async function runFix() {
  try {
    console.log('Initializing MongoDB...');
    await initializeMongoDB(process.env.MONGODB_URI);
    console.log('MongoDB initialized successfully');
    
    const teacherCollection = await getCollection('teacher');
    const studentCollection = await getCollection('student');
    
    const teacherId = '6878056b4f4ada6d8d921fce';
    const studentId = '687805f24f4ada6d8d921fcf';
    
    console.log('Checking student existence...');
    const student = await studentCollection.findOne({
      _id: ObjectId.createFromHexString(studentId)
    });
    
    console.log('Student found:', !!student);
    
    if (!student) {
      console.log('Removing student ID from teacher...');
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
      console.log('Update result:', result);
    }
    
    console.log('Fix completed successfully');
  } catch (error) {
    console.error('Error:', error);
  }
  process.exit(0);
}

runFix();