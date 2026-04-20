import { Router } from "express";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const CONFIG_PATH = join(__dirname, '../../agent/config.json');
const FORBIDDEN_PATH = join(__dirname, '../../agent/forbidden.json');
const DEFAULT_SERVER_URL = process.env.PUBLIC_SERVER_URL || 'https://backend-tracker-0ovf.onrender.com';

// Read config file
const readConfig = () => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const data = fs.readFileSync(CONFIG_PATH, 'utf8');
      return JSON.parse(data);
    }
    return {
      userId: "default",
      machine: "default",
      trackingInterval: 5000,
      serverUrl: DEFAULT_SERVER_URL
    };
  } catch (error) {
    console.error('Error reading config:', error);
    return {
      userId: "default",
      machine: "default",
      trackingInterval: 5000,
      serverUrl: DEFAULT_SERVER_URL
    };
  }
};

// Write config file
const writeConfig = (config) => {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing config:', error);
    return false;
  }
};

// Read forbidden apps
const readForbidden = () => {
  try {
    if (fs.existsSync(FORBIDDEN_PATH)) {
      const data = fs.readFileSync(FORBIDDEN_PATH, 'utf8');
      const parsed = JSON.parse(data);
      // Support both legacy array format and object format: { apps: [] }
      if (Array.isArray(parsed)) return parsed;
      return Array.isArray(parsed?.apps) ? parsed.apps : [];
    }
    return [];
  } catch (error) {
    console.error('Error reading forbidden apps:', error);
    return [];
  }
};

// Write forbidden apps
const writeForbidden = (apps) => {
  try {
    // Keep file format aligned with the tracker, which reads a raw array.
    fs.writeFileSync(FORBIDDEN_PATH, JSON.stringify(apps, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing forbidden apps:', error);
    return false;
  }
};

// Get current configuration
router.get('/config', (req, res) => {
  try {
    const config = readConfig();
    res.json({ 
      success: true,
      config: config 
    });
  } catch (error) {
    console.error('Error getting config:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get configuration'
    });
  }
});

// Update configuration
router.post('/config', (req, res) => {
  try {
    const { userId, machine, trackingInterval, serverUrl } = req.body;
    const config = readConfig();
    
    if (userId !== undefined) config.userId = userId;
    if (machine !== undefined) config.machine = machine;
    if (trackingInterval !== undefined) config.trackingInterval = trackingInterval;
    if (serverUrl !== undefined) config.serverUrl = serverUrl;
    
    const success = writeConfig(config);
    
    if (success) {
      res.json({ 
        success: true,
        config: config,
        message: 'Configuration updated successfully'
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Failed to save configuration'
      });
    }
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update configuration'
    });
  }
});

// Get forbidden applications
router.get('/forbidden', (req, res) => {
  try {
    const apps = readForbidden();
    res.json({ 
      success: true,
      apps: apps
    });
  } catch (error) {
    console.error('Error getting forbidden apps:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get forbidden applications'
    });
  }
});

// Update forbidden applications
router.post('/forbidden', (req, res) => {
  try {
    const { apps } = req.body;
    if (!Array.isArray(apps)) {
      return res.status(400).json({ 
        success: false,
        error: 'Apps must be an array'
      });
    }
    
    const success = writeForbidden(apps);
    
    if (success) {
      res.json({ 
        success: true,
        apps: apps,
        message: 'Forbidden applications updated successfully'
      });
    } else {
      res.status(500).json({ 
        success: false,
        error: 'Failed to save forbidden applications'
      });
    }
  } catch (error) {
    console.error('Error updating forbidden apps:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to update forbidden applications'
    });
  }
});

// Health check
router.get('/health', (req, res) => {
  res.json({ 
    success: true,
    message: 'Control routes are working',
    timestamp: new Date().toISOString()
  });
});

// Get tracker status
router.get('/tracker-status', (req, res) => {
  try {
    const statusPath = join(__dirname, '../../agent/status.json');
    let enabled = true;
    if (fs.existsSync(statusPath)) {
      const data = fs.readFileSync(statusPath, 'utf8');
      const status = JSON.parse(data);
      enabled = status.enabled !== false;
    }
    res.json({ 
      success: true,
      status: enabled ? 'running' : 'stopped',
      enabled: enabled
    });
  } catch (error) {
    console.error('Error getting tracker status:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to get tracker status'
    });
  }
});

// Start tracker
router.post('/tracker-start', (req, res) => {
  try {
    const statusPath = join(__dirname, '../../agent/status.json');
    fs.writeFileSync(statusPath, JSON.stringify({ enabled: true }, null, 2));
    res.json({ 
      success: true,
      message: 'Tracker started',
      status: 'running'
    });
  } catch (error) {
    console.error('Error starting tracker:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to start tracker'
    });
  }
});

// Stop tracker
router.post('/tracker-stop', (req, res) => {
  try {
    const statusPath = join(__dirname, '../../agent/status.json');
    fs.writeFileSync(statusPath, JSON.stringify({ enabled: false }, null, 2));
    res.json({ 
      success: true,
      message: 'Tracker stopped',
      status: 'stopped'
    });
  } catch (error) {
    console.error('Error stopping tracker:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to stop tracker'
    });
  }
});

export default router;
