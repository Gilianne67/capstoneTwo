const dns = require('dns');
// Force Node to use Google Public DNS for SRV record resolution (MongoDB Atlas compatibility)
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const path = require('path');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const { configureTrustProxy, mountRateLimiters } = require('./middleware/rateLimit');

// Load Environment Variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Initialize Express Application
const app = express();

configureTrustProxy(app);

// Route & Middleware Imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const consentRoutes = require('./routes/consentRoutes');
const providerRoutes = require('./routes/providerRoutes');
const scholarshipRoutes = require('./routes/scholarshipRoutes');
const studentRoutes = require('./routes/studentRoutes');
const matchingRoutes = require('./routes/matchingRoutes');
const documentRoutes = require('./routes/documentRoutes');
const errorHandler = require('./middleware/error');
const moderationRoutes = require('./routes/moderationRoutes');
const taxonomyRoutes = require('./routes/taxonomyRoutes');
const auditRoutes = require('./routes/auditRoutes');
const { protect } = require('./middleware/auth');
const { rehydrateRevocations } = require('./services/tokenService');
const broadcastRoutes = require('./routes/broadcastRoutes');
const { getActiveUserBroadcasts } = require('./controllers/broadcastController');
const faqRoutes = require('./routes/faqRoutes');

// Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows frontend access to uploaded files
  })
);

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
  'http://localhost:5173',          // Local Vite dev
  'http://localhost:5174',          // Vite fallback when 5173 is already in use
  'http://localhost:3000',          // Alternative local port
  'https://iskolarmatch.website',     // Production frontend
  'https://www.iskolarmatch.website'  // Production www alias
].filter(Boolean); 

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    } else {
      console.warn(`🚨 [CORS BLOCKED] Unauthorized origin attempted connection: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions)); // Handle preflight requests

// Body Parsing & Cookie Handling
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP Request Logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// General traffic is limited per signed-in session, and per IP when anonymous.
// Login, registration, password changes, and email-sending auth routes also
// pass through stricter per-IP limiters mounted inside mountRateLimiters.
mountRateLimiters(app);

// Root Endpoint
app.get('/', (req, res) => {
  res.status(200).json({ status: 'success', message: 'IskolarMatch API Online' });
});

// Health Check Endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'IskolarMatch API Online' });
});

// Mount Application Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/consent', consentRoutes);
app.use('/api/v1/provider', providerRoutes);
app.use('/api/v1/providers', providerRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/scholarships', scholarshipRoutes);
app.use('/api/v1/students', studentRoutes);
app.use('/api/v1/matching', matchingRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/admin/moderation', moderationRoutes);
app.use('/api/v1/admin/taxonomy', taxonomyRoutes);
app.use('/api/v1/admin/audit-logs', auditRoutes);
app.use('/api/v1/admin', broadcastRoutes);
app.get('/api/v1/broadcasts/active', protect, getActiveUserBroadcasts);
app.use('/api/v1/faqs', faqRoutes);

// Quick fallback endpoint for notifications
app.get('/api/v1/notifications/unread-count', protect, (req, res) => {
  res.status(200).json({
    success: true,
    count: 0,
  });
});

// Centralized Error Handling Middleware
app.use(errorHandler);

const { closeMatchingPool } = require('./services/matchingWorkerRunner');

// Database Connection & Server Initialization
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/iskolarmatch';
let httpServer = null;
let stopping = false;

const shutdown = (signal) => {
  if (stopping) {
    return;
  }

  stopping = true;
  console.log(`${signal} received. Closing matching worker pool.`);
  closeMatchingPool();

  const exitAfterDatabase = () => {
    mongoose.connection.close(false).then(
      () => process.exit(0),
      () => process.exit(1)
    );
  };

  if (!httpServer) {
    exitAfterDatabase();
    return;
  }

  httpServer.close(exitAfterDatabase);
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log('✅ Connected to MongoDB successfully.');
    try {
      await rehydrateRevocations();
    } catch (err) {
      console.error('Revocation cache rehydrate failed.');
    }
    httpServer = app.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Database connection error:', err);
    process.exit(1);
  });