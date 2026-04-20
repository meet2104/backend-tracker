import Activity from '../models/Activity.js';
import Summary from '../models/Summary.js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const sampleApps = [
  'Chrome', 'VSCode', 'Slack', 'Word', 'Excel', 'Outlook', 'Spotify', 
  'Discord', 'Teams', 'Zoom', 'Photoshop', 'Illustrator', 'Edge', 'Firefox'
];

const sampleMachines = [
  'WORKSTATION-001', 'LAPTOP-XYZ789', 'SERVER-PROD-01', 'DESKTOP-ABC123'
];

const sampleUsers = [
  'user-1', 'user-2', 'user-3', 'user-4', 'user-5'
];

const states = ['active', 'idle'];

// Function to generate a random date within the last 30 days
function getRandomDateWithinDays(days) {
  const now = new Date();
  const startTime = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  const randomTime = Math.random() * (now.getTime() - startTime.getTime()) + startTime.getTime();
  return new Date(randomTime);
}

// Generate realistic sample activity data
function generateSampleActivity(count = 100) {
  const activities = [];
  
  for (let i = 0; i < count; i++) {
    const isForbidden = Math.random() > 0.85; // 15% chance of being forbidden
    
    const activity = {
      userId: sampleUsers[Math.floor(Math.random() * sampleUsers.length)],
      machine: sampleMachines[Math.floor(Math.random() * sampleMachines.length)],
      time: getRandomDateWithinDays(30),
      idleSeconds: Math.floor(Math.random() * 300), // 0-300 seconds idle
      state: states[Math.floor(Math.random() * states.length)],
      activeApp: sampleApps[Math.floor(Math.random() * sampleApps.length)],
      activeTitle: `Document ${Math.floor(Math.random() * 100)}.txt`,
      processCount: Math.floor(Math.random() * 100) + 10, // 10-110 processes
      appUsage: {},
      forbidden: isForbidden
    };
    
    activities.push(activity);
  }
  
  // Sort by time in descending order to have newest first
  activities.sort((a, b) => new Date(b.time) - new Date(a.time));
  
  return activities;
}

// Generate sample summary data
function generateSampleSummary(activities) {
  if (activities.length === 0) {
    return null;
  }
  
  const totalRecords = activities.length;
  const totalHours = (activities.length * 5) / 60; // Assuming 5 min intervals
  
  // Count states
  let activeCount = 0;
  let idleCount = 0;
  const appUsageMap = new Map();
  
  for (const item of activities) {
    if (item.state === 'active') activeCount++;
    else if (item.state === 'idle') idleCount++;
    
    if (item.activeApp) {
      appUsageMap.set(item.activeApp, (appUsageMap.get(item.activeApp) || 0) + 1);
    }
  }
  
  const activePercentage = totalRecords > 0 ? Math.round((activeCount / totalRecords) * 100) : 0;
  
  // Calculate average processes
  const totalProcessCount = activities.reduce((sum, item) => sum + (item.processCount || 0), 0);
  const avgProcesses = totalProcessCount / activities.length;
  
  // Get top applications
  const topApps = Array.from(appUsageMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([appName, usageCount]) => ({ appName, usageCount }));
  
  // Get daily activity for last 7 days
  const dateMap = new Map();
  for (const item of activities) {
    const date = new Date(item.time).toDateString();
    dateMap.set(date, (dateMap.get(date) || 0) + 1);
  }
  
  const dailyActivity = Array.from(dateMap.entries())
    .map(([date, count]) => ({
      date,
      minutesTracked: count * 5 // Assuming 5 min intervals
    }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 7); // Last 7 days

  return {
    totalRecords,
    totalHours: parseFloat(totalHours.toFixed(2)),
    activePercentage,
    avgProcesses: parseFloat(avgProcesses.toFixed(1)),
    topApps,
    dailyActivity,
    stateDistribution: {
      active: activeCount,
      idle: idleCount
    }
  };
}

async function seedDatabase(activityCount = 100) {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');
    
    console.log(`Generating ${activityCount} sample activities...`);
    const sampleActivities = generateSampleActivity(activityCount);
    console.log(`✅ Generated ${sampleActivities.length} sample activities`);
    
    console.log('Deleting existing activity data...');
    await Activity.deleteMany({});
    console.log('✅ Deleted existing activity data');
    
    console.log('Inserting sample activities...');
    await Activity.insertMany(sampleActivities);
    console.log('✅ Inserted sample activities');
    
    console.log('Generating and inserting sample summary...');
    const summaryData = generateSampleSummary(sampleActivities);
    if (summaryData) {
      const summary = new Summary(summaryData);
      await summary.save();
      console.log('✅ Inserted sample summary');
    }
    
    console.log(`✅ Successfully seeded database with ${activityCount} activities and 1 summary!`);
    
    await mongoose.connection.close();
    console.log('✅ Database connection closed.');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
}

// If this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const activityCount = process.argv[2] ? parseInt(process.argv[2]) : 100;
  seedDatabase(activityCount);
}

export { generateSampleActivity, generateSampleSummary, seedDatabase };