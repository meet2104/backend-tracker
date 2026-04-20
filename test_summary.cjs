
const mongoose = require('mongoose');

const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Summary schema (since we can't import the model directly)
const SummarySchema = new mongoose.Schema({
  totalRecords: Number,
  totalHours: Number,
  activePercentage: Number,
  avgProcesses: Number,
  topApps: [{
    appName: String,
    usageCount: Number
  }],
  dailyActivity: [{
    date: String,
    minutesTracked: Number
  }],
  stateDistribution: {
    active: Number,
    idle: Number
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
});

const Summary = mongoose.model("Summary", SummarySchema);

async function testSummaryStorage() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get all summaries
    const summaries = await Summary.find().sort({ generatedAt: -1 });
    console.log(`\n📊 Found ${summaries.length} summary records:`);
    
    summaries.forEach((summary, index) => {
      console.log(`\n--- Summary ${index + 1} ---`);
      console.log(`ID: ${summary._id}`);
      console.log(`Generated at: ${summary.generatedAt}`);
      console.log(`Total Records: ${summary.totalRecords}`);
      console.log(`Total Hours: ${summary.totalHours}`);
      console.log(`Active Percentage: ${summary.activePercentage}%`);
      console.log(`Avg Processes: ${summary.avgProcesses}`);
      console.log(`Top Apps: ${summary.topApps.length} apps`);
      console.log(`Daily Activity: ${summary.dailyActivity.length} days`);
      console.log(`State Distribution: Active=${summary.stateDistribution.active}, Idle=${summary.stateDistribution.idle}`);
    });
    
    // Get the latest summary
    const latestSummary = await Summary.findOne().sort({ generatedAt: -1 });
    console.log(`\n📈 Latest Summary:`);
    console.log(JSON.stringify(latestSummary, null, 2));
    
    await mongoose.connection.close();
    console.log('\n✅ Disconnected from MongoDB');
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSummaryStorage();