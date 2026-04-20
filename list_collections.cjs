const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function listCollections() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📋 Collections in database:');
    collections.forEach(collection => {
      console.log(`- ${collection.name}`);
    });
    
    // Check each collection for documents
    for (const collection of collections) {
      const count = await mongoose.connection.db.collection(collection.name).countDocuments();
      console.log(`\n${collection.name}: ${count} documents`);
      
      if (count > 0 && count < 10) {
        const docs = await mongoose.connection.db.collection(collection.name).find().toArray();
        console.log('Sample documents:');
        docs.forEach((doc, index) => {
          console.log(`${index + 1}:`, JSON.stringify(doc, null, 2));
        });
      }
    }
    
    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

listCollections();