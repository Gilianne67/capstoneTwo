const dns = require('dns');
// Force Node to use Google Public DNS for SRV record resolution
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const path = require('path');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

// Load Environment Variables
dotenv.config();

// Route & Middleware Imports
const authRoutes = require(path.join(__dirname, 'routes', 'authRoutes'));
const errorHandler = require('./middleware/error');

// Ensure the path matches your project structure (e.g., './middleware/auth' or './middleware/verifyAuth')
const { protect: verifyAuth } = require('./middleware/auth');

// Initialize Express App
const app = express();

// Global Security & Utility Middlewares
app.use(helmet());

// Consolidated CORS Configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5174',
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Rate Limiter
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many requests from this IP, please try again later.' },
});
app.use('/api/v1', limiter);

// Health Check Endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'IskolarMatch Auth API Online' });
});

// Onboarding Route Endpoint
app.post('/api/v1/user/onboarding', verifyAuth, async (req, res) => {
  try {
    const { dob, course, yearLevel, gpa, region, householdIncome, isMinor } = req.body;
    
    // Save profile data & return success
    return res.json({
      success: true,
      message: 'Onboarding completed',
      user: { ...req.user, isOnboarded: true }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Mount Application Routes
app.use('/api/v1/auth', authRoutes);

// Centralized Error Handling Middleware
app.use(errorHandler);


// Environment Variables & Server Startup
const { protect } = require('./middleware/auth');
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/iskolarmatch';

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully.');
    app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  });