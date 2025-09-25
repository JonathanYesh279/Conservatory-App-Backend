import 'dotenv/config';
import { MongoClient, ObjectId } from 'mongodb';

const MONGO_URI = process.env.MONGODB_URI;
console.log('🔍 Testing database connection...');
console.log('MONGO_URI:', MONGO_URI);

async function testConnection() {
  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    // List all databases
    const adminDb = client.db().admin();
    const dbList = await adminDb.listDatabases();
    console.log('\n📊 Available databases:');
    dbList.databases.forEach(db => {
      console.log(`   - ${db.name} (${db.sizeOnDisk} bytes)`);
    });
    
    // Check for Conservatory-DB database (the actual database)
    const conservatoryDb = client.db('Conservatory-DB');
    const collections = await conservatoryDb.listCollections().toArray();
    console.log('\n📁 Collections in Conservatory-DB database:');
    collections.forEach(coll => {
      console.log(`   - ${coll.name}`);
    });
    
    // Check orchestra collection specifically (singular, not plural)
    const orchestraCollection = conservatoryDb.collection('orchestra');
    const orchestraCount = await orchestraCollection.countDocuments();
    console.log(`\n🎼 Total orchestras in collection: ${orchestraCount}`);
    
    if (orchestraCount > 0) {
      const sampleOrchestra = await orchestraCollection.findOne();
      console.log('\n🔍 Sample orchestra:');
      console.log('   Name:', sampleOrchestra.name);
      console.log('   ID:', sampleOrchestra._id);
      console.log('   MemberIds:', sampleOrchestra.memberIds);
      console.log('   MemberIds type:', typeof sampleOrchestra.memberIds);
      console.log('   MemberIds length:', sampleOrchestra.memberIds ? sampleOrchestra.memberIds.length : 'null');
      
      // Check if we have the problematic orchestra with the orphaned IDs
      const problemOrchestra = await orchestraCollection.findOne({
        memberIds: { $in: ['68813849abdf329e8afc2688', '68813849abdf329e8afc265e', '68813849abdf329e8afc264f'] }
      });
      
      if (problemOrchestra) {
        console.log('\n⚠️  Found orchestra with problematic orphaned student IDs:');
        console.log('   Name:', problemOrchestra.name);
        console.log('   ID:', problemOrchestra._id);
        console.log('   MemberIds:', problemOrchestra.memberIds);
      }
    }
    
  } catch (error) {
    console.error('❌ Database connection error:', error);
  } finally {
    await client.close();
    console.log('🔐 Database connection closed');
  }
}

testConnection()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });