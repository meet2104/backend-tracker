import mongoose from "mongoose";

const ViolationSchema = new mongoose.Schema({
  userId: String,
  machine: String,
  appName: String,
  time: { type: Date, default: Date.now },
  reason: String
});

export default mongoose.model("Violation", ViolationSchema);