import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const app = express();

let trackerProcess = null;

const allowedOrigins = [
  process.env.CORS_ORIGIN,
  'https://frontend-tracker-uhjm.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000'
].filter(Boolean);

// Enhanced middleware with better security and performance
app.use(cors({
  origin(origin, callback) {
    // Allow server-to-server tools and health checks that do not send Origin.
    if (!origin) return callback(null, true);

    const isExactMatch = allowedOrigins.includes(origin);
    const isVercelPreview = /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin);

    if (isExactMatch || isVercelPreview) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs for testing
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Add health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// MongoDB connection with better error handling and options
mongoose.connect(process.env.MONGO_URI, {
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
})
.then(() => {
  console.log("✅ MongoDB connected");
  console.log("🚀 Starting tracker...");
  const trackerPath = path.join(__dirname, '../agent/tracker.mjs');
  trackerProcess = spawn('node', [trackerPath], { 
    stdio: 'pipe',
    cwd: path.join(__dirname, '../agent'),
    env: { ...process.env, NODE_ENV: 'production' }
  });
  trackerProcess.stdout.on('data', (data) => console.log(`Tracker: ${data}`));
  trackerProcess.stderr.on('data', (data) => console.error(`Tracker ERR: ${data}`));
  trackerProcess.on('error', (err) => {
    console.error('❌ Failed to start tracker:', err.message);
  });
  trackerProcess.on('exit', (code) => {
    console.log(`📊 Tracker exited with code ${code}`);
    trackerProcess = null;
  });
  console.log("✅ Tracker process spawned successfully");
})
.catch(err => {
  console.error("❌ MongoDB connection error:", err);
  process.exit(1);
});

// Graceful shutdown handling
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  if (trackerProcess) {
    console.log('🔄 Killing tracker process...');
    trackerProcess.kill();
    trackerProcess = null;
  }
  await mongoose.connection.close();
  process.exit(0);
});

import trackingRoutes from "./routes/tracking.js";
import controlRoutes from "./routes/control.js";
import dashboardRoutes from "./routes/dashboard.js";
import authRoutes from "./routes/auth.js";

app.use("/api/track", trackingRoutes);
app.use("/api/control", controlRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/auth", authRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Handle 404 for undefined routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => console.log(`🚀 Server running on ${PORT}`));

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

