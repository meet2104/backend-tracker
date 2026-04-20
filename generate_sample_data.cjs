const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

// Activity schema
const ActivitySchema = new mongoose.Schema({
  userId: String,
  machine: String,
  time: Date,
  idleSeconds: Number,
  state: String,
  activeApp: String,
  activeTitle: String,
  processCount: Number,
  appUsage: Object,
  forbidden: Boolean
});

const Activity = mongoose.model("Activity", ActivitySchema);

async function generateSampleData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Clear existing data
    await Activity.deleteMany({});
    console.log('🧹 Cleared existing activity data');
    
    // Generate sample data for the last 7 days
    const sampleData = [];
    const apps = ['Chrome', 'VSCode', 'Slack', 'Outlook', 'Word', 'Excel', 'Teams', 'Spotify', 'Firefox', 'Notepad++'];
    const machines = ['DESKTOP-ABC123', 'WORKSTATION-001', 'LAPTOP-XYZ789', 'SERVER-PROD-01'];
    const states = ['active', 'idle'];
    
    const now = new Date();
    
    // Generate 200 sample records over 7 days
    for (let i = 0; i < 200; i++) {
      const randomDate = new Date(now.getTime() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      
      sampleData.push({
        userId: `user-${Math.floor(Math.random() * 5) + 1}`,
        machine: machines[Math.floor(Math.random() * machines.length)],
        time: randomDate,
        idleSeconds: Math.random() > 0.7 ? Math.floor(Math.random() * 300) : 0,
        state: states[Math.floor(Math.random() * states.length)],
        activeApp: apps[Math.floor(Math.random() * apps.length)],
        activeTitle: `Document ${Math.floor(Math.random() * 100)}.txt`,
        processCount: Math.floor(Math.random() * 50) + 10,
        appUsage: {},
        forbidden: Math.random() > 0.95
      });
    }
    
    // Insert sample data
    await Activity.insertMany(sampleData);
    console.log(`✅ Generated ${sampleData.length} sample activity records`);
    
    // Verify the data
    const count = await Activity.countDocuments();
    console.log(`📊 Total activity records in database: ${count}`);
    
    await mongoose.connection.close();
    console.log('✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

generateSampleData();