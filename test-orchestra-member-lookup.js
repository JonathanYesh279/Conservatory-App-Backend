import { getCollection } from './services/mongoDB.service.js';
import { ObjectId } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

async function testOrchestraMemberLookup() {
  try {
    console.log('========================================');
    console.log('Testing Orchestra Member Lookup Issue');
    console.log('========================================\n');

    const orchestraId = '687a77cdca26e53e23b0ce4b';
    
    // Step 1: Get raw orchestra data
    console.log('Step 1: Fetching raw orchestra data...');
    const orchestraCollection = await getCollection('orchestra');
    const rawOrchestra = await orchestraCollection.findOne({ 
      _id: ObjectId.createFromHexString(orchestraId) 
    });
    
    if (!rawOrchestra) {
      console.log('❌ Orchestra not found!');
      process.exit(1);
    }
    
    console.log('✅ Found orchestra:', rawOrchestra.name);
    console.log('   - memberIds:', rawOrchestra.memberIds);
    console.log('   - memberIds count:', rawOrchestra.memberIds ? rawOrchestra.memberIds.length : 0);
    console.log('   - memberIds type:', Array.isArray(rawOrchestra.memberIds) ? 'array' : typeof rawOrchestra.memberIds);
    
    if (rawOrchestra.memberIds && rawOrchestra.memberIds.length > 0) {
      console.log('\nStep 2: Testing member lookup...');
      
      // Test the old way (broken)
      console.log('\n2a. Testing OLD aggregation method (converting student _id to string):');
      const oldAggregation = await orchestraCollection.aggregate([
        { $match: { _id: ObjectId.createFromHexString(orchestraId) } },
        {
          $lookup: {
            from: 'student',
            let: { memberIds: '$memberIds' },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $in: [{ $toString: '$_id' }, '$$memberIds']
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
            as: 'members_old'
          }
        }
      ]).toArray();
      
      const oldResult = oldAggregation[0];
      console.log('   - Members found with OLD method:', oldResult.members_old ? oldResult.members_old.length : 0);
      
      // Test the new way (fixed)
      console.log('\n2b. Testing NEW aggregation method (converting memberIds to ObjectId):');
      const newAggregation = await orchestraCollection.aggregate([
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
            as: 'members_new'
          }
        }
      ]).toArray();
      
      const newResult = newAggregation[0];
      console.log('   - Members found with NEW method:', newResult.members_new ? newResult.members_new.length : 0);
      
      if (newResult.members_new && newResult.members_new.length > 0) {
        console.log('   - Member details:');
        newResult.members_new.forEach(member => {
          console.log(`     • ${member._id}: ${member.personalInfo?.firstName || 'Unknown'} ${member.personalInfo?.lastName || ''}`);
        });
      }
      
      // Step 3: Verify student exists
      console.log('\nStep 3: Verifying students exist in database...');
      const studentCollection = await getCollection('student');
      
      for (const memberId of rawOrchestra.memberIds) {
        try {
          const student = await studentCollection.findOne({ 
            _id: ObjectId.createFromHexString(memberId) 
          });
          
          if (student) {
            console.log(`   ✅ Student ${memberId} found: ${student.personalInfo?.firstName || 'Unknown'} ${student.personalInfo?.lastName || ''}`);
          } else {
            console.log(`   ❌ Student ${memberId} NOT found in database!`);
          }
        } catch (error) {
          console.log(`   ⚠️ Error checking student ${memberId}: ${error.message}`);
        }
      }
      
      // Summary
      console.log('\n========================================');
      console.log('SUMMARY:');
      console.log(`Orchestra has ${rawOrchestra.memberIds.length} member ID(s) stored`);
      console.log(`OLD method found: ${oldResult.members_old ? oldResult.members_old.length : 0} member(s)`);
      console.log(`NEW method found: ${newResult.members_new ? newResult.members_new.length : 0} member(s)`);
      
      if (newResult.members_new && newResult.members_new.length === rawOrchestra.memberIds.length) {
        console.log('✅ FIX SUCCESSFUL: All members are now properly populated!');
      } else {
        console.log('⚠️ Still issues with member population');
      }
      console.log('========================================');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the test
testOrchestraMemberLookup();