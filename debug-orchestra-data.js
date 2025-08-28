import { initializeMongoDB, getCollection } from './services/mongoDB.service.js';

async function debugOrchestraData() {
  try {
    await initializeMongoDB();
    
    const orchestraCollection = await getCollection('orchestra');
    const studentCollection = await getCollection('student');
    
    // Get first orchestra with members
    const orchestra = await orchestraCollection.findOne({
      memberIds: { $exists: true, $ne: [] }
    });
    
    console.log('📋 Orchestra document:');
    console.log('   Name:', orchestra.name);
    console.log('   ID:', orchestra._id);
    console.log('   Member IDs:', orchestra.memberIds);
    console.log('   Member IDs types:', orchestra.memberIds.map(id => typeof id));
    
    if (orchestra.memberIds.length > 0) {
      const firstMemberId = orchestra.memberIds[0];
      console.log('   First member ID:', firstMemberId);
      console.log('   First member ID type:', typeof firstMemberId);
      
      // Try to find student by string ID
      const studentByString = await studentCollection.findOne({
        _id: firstMemberId
      });
      console.log('   Student found by string ID:', !!studentByString);
      
      // Try to find student by ObjectId conversion
      const { ObjectId } = require('mongodb');
      try {
        const studentByObjectId = await studentCollection.findOne({
          _id: ObjectId.createFromHexString(firstMemberId)
        });
        console.log('   Student found by ObjectId:', !!studentByObjectId);
        if (studentByObjectId) {
          console.log('   Student name:', studentByObjectId.personalInfo?.fullName);
        }
      } catch (err) {
        console.log('   Error converting to ObjectId:', err.message);
      }
      
      // Check how the student _id is stored
      const allStudents = await studentCollection.find({}).limit(1).toArray();
      if (allStudents.length > 0) {
        console.log('   Sample student _id:', allStudents[0]._id);
        console.log('   Sample student _id type:', typeof allStudents[0]._id);
        console.log('   Sample student _id toString():', allStudents[0]._id.toString());
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugOrchestraData();