import mongoose from "mongoose";

const SummarySchema = new mongoose.Schema({
  totalRecords: {
    type: Number,
    required: true,
    index: true
  },
  totalHours: {
    type: Number,
    required: true
  },
  activePercentage: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  avgProcesses: {
    type: Number,
    required: true
  },
  topApps: [{
    appName: {
      type: String,
      required: true
    },
    usageCount: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  dailyActivity: [{
    date: {
      type: String,
      required: true
    },
    minutesTracked: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  stateDistribution: {
    active: {
      type: Number,
      required: true,
      min: 0
    },
    idle: {
      type: Number,
      required: true,
      min: 0
    }
  },
  generatedAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Add compound index for efficient querying
SummarySchema.index({ generatedAt: -1 });

export default mongoose.model("Summary", SummarySchema);