const { MongoClient } = require('mongodb');
require('dotenv').config();

async function fix() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    const db = client.db('conservatory');
    
    const teacherCollection = db.collection('teacher');
    const studentCollection = db.collection('student');
    
    console.log('Checking for student 687805f24f4ada6d8d921fcf...');
    
    const student = await studentCollection.findOne({
      _id: new MongoClient.ObjectId('687805f24f4ada6d8d921fcf')
    });
    
    console.log('Student found:', !!student);
    
    if (!student) {
      console.log('Removing student ID from teacher...');
      
      const result = await teacherCollection.updateOne(
        { _id: new MongoClient.ObjectId('6878056b4f4ada6d8d921fce') },
        { 
          $pull: { 'teaching.studentIds': '687805f24f4ada6d8d921fcf' },
          $set: { updatedAt: new Date() }
        }
      );
      
      console.log('Update result:', result.modifiedCount > 0 ? 'SUCCESS' : 'FAILED');
    }
    
    console.log('Done');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

fix();