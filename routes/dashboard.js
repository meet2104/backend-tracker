import { Router } from "express";
import Activity from "../models/Activity.js";
import Summary from "../models/Summary.js";

const router = Router();

// Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const totalRecords = await Activity.countDocuments();
    const activeRecords = await Activity.countDocuments({ state: 'active' });
    const idleRecords = await Activity.countDocuments({ state: 'idle' });
    const forbiddenRecords = await Activity.countDocuments({ forbidden: true });
    
    // Get recent activity
    const recentActivity = await Activity.find()
      .sort({ time: -1 })
      .limit(10)
      .select('userId machine time state activeApp activeProcesses forbidden');
    
    // Get top applications
    const topApps = await Activity.aggregate([
      { $group: { _id: "$activeApp", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 }
    ]);
    
    res.json({
      success: true,
      stats: {
        totalRecords,
        activeRecords,
        idleRecords,
        forbiddenRecords,
        activePercentage: totalRecords > 0 ? Math.round((activeRecords / totalRecords) * 100) : 0,
        forbiddenPercentage: totalRecords > 0 ? Math.round((forbiddenRecords / totalRecords) * 100) : 0,
        recentActivity,
        topApps: topApps.map(app => ({
          appName: app._id,
          usageCount: app.count
        }))
      }
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard statistics'
    });
  }
});

// Get summary data for charts
router.get('/summary', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));
    
    // Get daily activity counts
    const dailyActivity = await Activity.aggregate([
      { $match: { time: { $gte: startDate } } },
      {
        $group: {
          _id: {
            year: { $year: "$time" },
            month: { $month: "$time" },
            day: { $dayOfMonth: "$time" }
          },
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: [{ $eq: ["$state", "active"] }, 1, 0] } }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]);
    
    // Get hourly distribution
    const hourlyActivity = await Activity.aggregate([
      { $match: { time: { $gte: startDate } } },
      {
        $group: {
          _id: { $hour: "$time" },
          count: { $sum: 1 },
          activeCount: { $sum: { $cond: [{ $eq: ["$state", "active"] }, 1, 0] } }
        }
      },
      { $sort: { "_id": 1 } }
    ]);
    
    res.json({
      success: true,
      data: {
        dailyActivity: dailyActivity.map(day => ({
          date: `${day._id.year}-${day._id.month.toString().padStart(2, '0')}-${day._id.day.toString().padStart(2, '0')}`,
          total: day.count,
          active: day.activeCount
        })),
        hourlyActivity: hourlyActivity.map(hour => ({
          hour: hour._id,
          total: hour.count,
          active: hour.activeCount
        }))
      }
    });
  } catch (error) {
    console.error('Error getting summary data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get summary data'
    });
  }
});

// Get user activity overview
router.get('/users', async (req, res) => {
  try {
    const userStats = await Activity.aggregate([
      {
        $group: {
          _id: "$userId",
          totalRecords: { $sum: 1 },
          activeRecords: { $sum: { $cond: [{ $eq: ["$state", "active"] }, 1, 0] } },
          machineCount: { $addToSet: "$machine" },
          lastActivity: { $max: "$time" }
        }
      },
      { $sort: { totalRecords: -1 } }
    ]);
    
    res.json({
      success: true,
      users: userStats.map(user => ({
        userId: user._id,
        totalRecords: user.totalRecords,
        activeRecords: user.activeRecords,
        activePercentage: user.totalRecords > 0 ? Math.round((user.activeRecords / user.totalRecords) * 100) : 0,
        machineCount: user.machineCount.length,
        lastActivity: user.lastActivity
      }))
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user statistics'
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Dashboard routes are working',
    timestamp: new Date().toISOString()
  });
});

export default router;