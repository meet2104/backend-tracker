import express from "express";
import Activity from "../models/Activity.js";
import Violation from "../models/Violation.js";
import Summary from "../models/Summary.js";

const router = express.Router();

// Validation middleware for activity data
const validateActivityData = (req, res, next) => {
  const { userId, machine, time, state, activeApp } = req.body;
  
  if (!userId || typeof userId !== 'string') {
    return res.status(400).json({ error: "Valid userId is required" });
  }
  
  if (!machine || typeof machine !== 'string') {
    return res.status(400).json({ error: "Valid machine name is required" });
  }
  
  if (!time || isNaN(Date.parse(time))) {
    return res.status(400).json({ error: "Valid time is required" });
  }
  
  if (!state || !['active', 'idle', 'away'].includes(state)) {
    return res.status(400).json({ error: "Valid state (active, idle, away) is required" });
  }
  
  if (!activeApp || typeof activeApp !== 'string') {
    return res.status(400).json({ error: "Valid activeApp is required" });
  }
  
  next();
};

// Store activity with validation
router.post("/activity", validateActivityData, async (req, res) => {
  try {
    // Sanitize and validate the incoming data
    const activityData = {
      userId: req.body.userId,
      machine: req.body.machine,
      time: new Date(req.body.time),
      idleSeconds: req.body.idleSeconds || 0,
      state: req.body.state,
      activeApp: req.body.activeApp,
      activeTitle: req.body.activeTitle || '',
      processCount: req.body.processCount || 0,
      appUsage: req.body.appUsage || {},
      forbidden: req.body.forbidden || false
    };
    
    await Activity.create(activityData);
    res.status(201).json({ message: "Activity recorded successfully" });
  } catch (error) {
    console.error("Error storing activity:", error);
    res.status(500).json({ error: "Failed to store activity" });
  }
});

// Store violation with validation
router.post("/violations", async (req, res) => {
  try {
    const violationData = {
      userId: req.body.userId,
      machine: req.body.machine || 'unknown',
      appName: req.body.appName,
      time: req.body.time || new Date().toISOString(),
      reason: req.body.reason
    };
    
    console.log("🚨 Violation received:", violationData);
    await Violation.create(violationData);
    res.status(201).json({ message: "Violation recorded successfully" });
  } catch (error) {
    console.error("Error storing violation:", error);
    res.status(500).json({ error: "Failed to store violation" });
  }
});

// Get all activity with pagination and filtering
router.get("/activity", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 200;
    const userId = req.query.userId;
    const machine = req.query.machine;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    
    // Validate query parameters
    if (page < 1 || limit < 1 || limit > 1000) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }
    
    const query = {};
    if (userId) query.userId = userId;
    if (machine) query.machine = machine;
    if (startDate || endDate) {
      query.time = {};
      if (startDate) query.time.$gte = new Date(startDate);
      if (endDate) query.time.$lte = new Date(endDate);
    }
    
    const data = await Activity.find(query)
      .sort({ time: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
      
    // Get total count for pagination info
    const totalCount = await Activity.countDocuments(query);
    
    res.json({
      data,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount
      }
    });
  } catch (error) {
    console.error("Error fetching activity:", error);
    res.status(500).json({ error: "Failed to fetch activity data" });
  }
});

// Get all violations with pagination and filtering
router.get("/violations", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 200;
    const userId = req.query.userId;
    const machine = req.query.machine;
    
    if (page < 1 || limit < 1 || limit > 1000) {
      return res.status(400).json({ error: "Invalid pagination parameters" });
    }
    
    const query = {};
    if (userId) query.userId = userId;
    if (machine) query.machine = machine;
    
    const data = await Violation.find(query)
      .sort({ time: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
      
    const totalCount = await Violation.countDocuments(query);
    
    res.json({
      data,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount
      }
    });
  } catch (error) {
    console.error("Error fetching violations:", error);
    res.status(500).json({ error: "Failed to fetch violation data" });
  }
});

// Generate and store summary data with caching
router.get("/summary", async (req, res) => {
  try {
    // Check if a summary was generated recently (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const recentSummary = await Summary.findOne({ generatedAt: { $gt: fiveMinutesAgo } }).sort({ generatedAt: -1 });
    
    if (recentSummary) {
      console.log("Using cached summary from:", recentSummary.generatedAt);
      return res.json(recentSummary);
    }
    
    const activities = await Activity.find()
      .sort({ time: -1 })
      .limit(1000)
      .select('userId machine time state activeApp processCount'); // Only select needed fields for performance
    
    console.log(`Found ${activities.length} activities for summary generation`);
    
    if (activities.length === 0) {
      console.log("No activity data found");
      return res.status(404).json({ error: "No activity data found" });
    }

    // Calculate summary metrics efficiently
    const totalRecords = activities.length;
    const totalHours = (activities.length * 5) / 60; // Assuming 5 min intervals
    
    // Count states more efficiently
    let activeCount = 0;
    let idleCount = 0;
    const appUsageMap = new Map();
    const dateMap = new Map();
    
    for (const item of activities) {
      // Count states
      if (item.state === 'active') activeCount++;
      else if (item.state === 'idle') idleCount++;
      
      // Count app usage
      if (item.activeApp) {
        appUsageMap.set(item.activeApp, (appUsageMap.get(item.activeApp) || 0) + 1);
      }
      
      // Group by date
      const date = new Date(item.time).toDateString();
      dateMap.set(date, (dateMap.get(date) || 0) + 1);
    }
    
    const activePercentage = totalRecords > 0 ? Math.round((activeCount / totalRecords) * 100) : 0;
    
    // Calculate average processes more efficiently
    const totalProcessCount = activities.reduce((sum, item) => sum + (item.processCount || 0), 0);
    const avgProcesses = activities.length > 0 ? 
      parseFloat((totalProcessCount / activities.length).toFixed(1)) : 0;

    console.log(`Calculated metrics: Records=${totalRecords}, Hours=${totalHours}, Active=${activePercentage}%`);

    // Get top applications
    const topApps = Array.from(appUsageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([appName, usageCount]) => ({ appName, usageCount }));

    console.log(`Top apps: ${JSON.stringify(topApps)}`);

    // Get daily activity for last 7 days
    const dailyActivity = Array.from(dateMap.entries())
      .map(([date, count]) => ({
        date,
        minutesTracked: count * 5 // Assuming 5 min intervals
      }))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 7); // Last 7 days

    console.log(`Daily activity: ${JSON.stringify(dailyActivity)}`);

    // State distribution
    const stateDistribution = {
      active: activeCount,
      idle: idleCount
    };

    console.log(`State distribution: ${JSON.stringify(stateDistribution)}`);

    // Create summary document
    const summary = new Summary({
      totalRecords,
      totalHours: parseFloat(totalHours.toFixed(2)),
      activePercentage,
      avgProcesses,
      topApps,
      dailyActivity,
      stateDistribution
    });

    console.log(`Created summary object: ${JSON.stringify(summary)}`);

    const savedSummary = await summary.save();
    console.log(`Saved summary with ID: ${savedSummary._id}`);

    res.json(savedSummary);
  } catch (error) {
    console.error("Error generating summary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get state distribution over time (for line chart)
router.get("/state-distribution", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    
    // Get recent activities sorted by time (oldest first for time series)
    const activities = await Activity.find()
      .sort({ time: 1 })
      .limit(limit)
      .select('time state');
    
    if (activities.length === 0) {
      return res.json({ 
        success: true, 
        data: [] 
      });
    }
    
    // Group by time buckets (each activity as a point)
    const timeSeriesData = activities.map(activity => ({
      time: activity.time,
      timestamp: new Date(activity.time).getTime(),
      hour: new Date(activity.time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      isActive: activity.state === 'active' ? 1 : 0,
      isIdle: activity.state === 'idle' ? 1 : 0
    }));
    
    res.json({ 
      success: true, 
      data: timeSeriesData,
      summary: {
        totalPoints: timeSeriesData.length,
        activeCount: timeSeriesData.filter(d => d.isActive).length,
        idleCount: timeSeriesData.filter(d => d.isIdle).length
      }
    });
  } catch (error) {
    console.error("Error fetching state distribution:", error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
});

// Get latest summary with caching considerations
router.get("/latest-summary", async (req, res) => {
  try {
    const summary = await Summary.findOne().sort({ generatedAt: -1 });
    if (!summary) {
      return res.status(404).json({ 
        success: false,
        error: "No summary data found",
        summary: {
          totalRecords: 0,
          activeSessions: 0,
          blockedEvents: 0,
          activePercentage: 0,
          mostUsedApps: [],
          timestamp: new Date()
        }
      });
    }
    res.json({ 
      success: true, 
      summary 
    });
  } catch (error) {
    console.error("Error fetching summary:", error);
    res.status(500).json({ 
      success: false,
      error: "Internal server error" 
    });
  }
});

// Get summary statistics by date range
router.get("/summary/date-range", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required" });
    }
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }
    
    const activities = await Activity.find({
      time: { $gte: start, $lte: end }
    }).select('state activeApp processCount');
    
    if (activities.length === 0) {
      return res.json({ 
        totalRecords: 0,
        activeSessions: 0,
        idleSessions: 0,
        activePercentage: 0,
        avgProcesses: 0,
        mostUsedApps: []
      });
    }
    
    // Calculate stats for the date range
    const totalRecords = activities.length;
    const activeCount = activities.filter(item => item.state === 'active').length;
    const idleCount = activities.filter(item => item.state === 'idle').length;
    const activePercentage = totalRecords > 0 ? Math.round((activeCount / totalRecords) * 100) : 0;
    
    const totalProcessCount = activities.reduce((sum, item) => sum + (item.processCount || 0), 0);
    const avgProcesses = totalProcessCount / activities.length;
    
    // Calculate most used apps
    const appUsageMap = new Map();
    activities.forEach(item => {
      if (item.activeApp) {
        appUsageMap.set(item.activeApp, (appUsageMap.get(item.activeApp) || 0) + 1);
      }
    });
    
    const mostUsedApps = Array.from(appUsageMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));
    
    res.json({
      totalRecords,
      activeSessions: activeCount,
      idleSessions: idleCount,
      activePercentage,
      avgProcesses: parseFloat(avgProcesses.toFixed(1)),
      mostUsedApps
    });
  } catch (error) {
    console.error("Error fetching date range summary:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;