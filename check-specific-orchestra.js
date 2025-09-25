import { getCollection } from './services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function checkSpecificOrchestra() {
  try {
    console.log('========================================');
    console.log('Checking Specific Orchestra 687a77cdca26e53e23b0ce4b');
    console.log('========================================\n');

    const orchestraId = '687a77cdca26e53e23b0ce4b';
    
    const orchestraCollection = await getCollection('orchestra');
    const studentCollection = await getCollection('student');
    
    // Get the orchestra
    const orchestra = await orchestraCollection.findOne({ 
      _id: ObjectId.createFromHexString(orchestraId) 
    });
    
    if (!orchestra) {
      console.log('❌ Orchestra not found!');
      process.exit(1);
    }
    
    console.log('Orchestra found:');
    console.log('  Name:', orchestra.name);
    console.log('  Type:', orchestra.type);
    console.log('  Is Active:', orchestra.isActive);
    console.log('  School Year ID:', orchestra.schoolYearId);
    console.log('  Conductor ID:', orchestra.conductorId);
    console.log('  Member IDs:', orchestra.memberIds);
    console.log('  Member Count:', orchestra.memberIds ? orchestra.memberIds.length : 0);
    
    if (orchestra.memberIds && orchestra.memberIds.length > 0) {
      console.log('\nChecking each member:');
      
      for (const memberId of orchestra.memberIds) {
        try {
          const student = await studentCollection.findOne({ 
            _id: ObjectId.createFromHexString(memberId) 
          });
          
          if (student) {
            console.log(`  ✅ Member ${memberId}: ${student.personalInfo?.firstName} ${student.personalInfo?.lastName}`);
          } else {
            console.log(`  ❌ Member ${memberId}: NOT FOUND IN DATABASE (orphaned)`);
            
            // Try to clean it up
            console.log('    Removing orphaned member from orchestra...');
            const updateResult = await orchestraCollection.updateOne(
              { _id: ObjectId.createFromHexString(orchestraId) },
              { $pull: { memberIds: memberId } }
            );
            
            if (updateResult.modifiedCount > 0) {
              console.log('    ✅ Orphaned member removed successfully');
            } else {
              console.log('    ⚠️ Failed to remove orphaned member');
            }
          }
        } catch (error) {
          console.log(`  ⚠️ Error checking member ${memberId}:`, error.message);
        }
      }
      
      // Check the final state
      const updatedOrchestra = await orchestraCollection.findOne({ 
        _id: ObjectId.createFromHexString(orchestraId) 
      });
      
      console.log('\nFinal Orchestra State:');
      console.log('  Member IDs:', updatedOrchestra.memberIds);
      console.log('  Member Count:', updatedOrchestra.memberIds ? updatedOrchestra.memberIds.length : 0);
    }
    
    // Test the aggregation pipeline with the fix
    console.log('\n========================================');
    console.log('Testing Aggregation Pipeline:');
    console.log('========================================\n');
    
    const aggregationResult = await orchestraCollection.aggregate([
      { $match: { _id: ObjectId.createFromHexString(orchestraId) } },
      {
        $lookup: {
          from: 'student',
          let: { memberIds: '$memberIds' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $in: [
                    '$_id',
                    {
                      $map: {
                        input: '$$memberIds',
                        as: 'memberId',
                        in: { $toObjectId: '$$memberId' }
                      }
                    }
                  ]
                }
              }
            },
            {
              $project: {
                _id: 1,
                'personalInfo.firstName': 1,
                'personalInfo.lastName': 1
              }
            }
          ],
          as: 'members'
        }
      }
    ]).toArray();
    
    const aggregatedOrchestra = aggregationResult[0];
    console.log('Aggregation Result:');
    console.log('  Orchestra Name:', aggregatedOrchestra.name);
    console.log('  MemberIds in document:', aggregatedOrchestra.memberIds);
    console.log('  Members populated:', aggregatedOrchestra.members ? aggregatedOrchestra.members.length : 0);
    
    if (aggregatedOrchestra.members && aggregatedOrchestra.members.length > 0) {
      console.log('  Populated members:');
      aggregatedOrchestra.members.forEach(member => {
        console.log(`    - ${member._id}: ${member.personalInfo?.firstName} ${member.personalInfo?.lastName}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the check
checkSpecificOrchestra();