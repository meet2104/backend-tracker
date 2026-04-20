import mongoose from "mongoose";

const ActivitySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  machine: {
    type: String,
    required: true,
    index: true
  },
  time: {
    type: Date,
    required: true,
    index: true
  },
  idleSeconds: {
    type: Number,
    default: 0
  },
  state: {
    type: String,
    required: true,
    enum: ['active', 'idle', 'away'],
    index: true
  },
  activeApp: {
    type: String,
    required: true,
    index: true
  },
  activeTitle: {
    type: String,
    default: ''
  },
  processCount: {
    type: Number,
    default: 0
  },
  appUsage: {
    type: Object,
    default: {}
  },
  forbidden: {
    type: Boolean,
    default: false,
    index: true
  }
});

// Add compound indexes for efficient querying
ActivitySchema.index({ time: -1 });
ActivitySchema.index({ userId: 1, time: -1 });
ActivitySchema.index({ machine: 1, time: -1 });
ActivitySchema.index({ state: 1, time: -1 });

export default mongoose.model("Activity", ActivitySchema);