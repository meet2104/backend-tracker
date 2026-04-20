const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function listDatabases() {
  try {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    // List all databases
    const admin = client.db().admin();
    const databases = await admin.listDatabases();
    console.log('\n📋 Databases:');
    databases.databases.forEach(db => {
      console.log(`- ${db.name}`);
    });
    
    // Check each database for collections and data
    for (const dbInfo of databases.databases) {
      const db = client.db(dbInfo.name);
      const collections = await db.listCollections().toArray();
      console.log(`\n${dbInfo.name} collections:`);
      collections.forEach(collection => {
        console.log(`  - ${collection.name}`);
      });
      
      // Check for data in all collections
      for (const collection of collections) {
        const count = await db.collection(collection.name).countDocuments();
        console.log(`  ${collection.name}: ${count} documents`);
        if (count > 0 && count <= 5) {
          const sample = await db.collection(collection.name).find().limit(3).toArray();
          console.log(`  Sample ${collection.name}:`);
          sample.forEach((doc, index) => {
            console.log(`    ${index + 1}:`, JSON.stringify(doc, null, 2));
          });
        }
      }
    }
    
    await client.close();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

listDatabases();