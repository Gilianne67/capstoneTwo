const dns = require('dns');
// Force Node to use Google Public DNS for SRV record resolution (MongoDB Atlas compatibility)
dns.setServers(['8.8.8.8', '8.8.4.4']);

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Load Environment Variables
dotenv.config();

// Initialize Express Application
const app = express();

// Route & Middleware Imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const adminRoutes = require('./routes/adminRoutes');
const consentRoutes = require('./routes/consentRoutes');
const providerRoutes = require('./routes/providerRoutes');
const scholarshipRoutes = require('./routes/scholarshipRoutes');
const studentRoutes = require('./routes/studentRoutes');
const errorHandler = require('./middleware/error');

// Security Middlewares
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // Allows frontend access to uploaded files
  })
);

// Serve local uploaded static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// CORS Configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
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

// Body Parsing & Cookie Handling
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP Request Logger
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Global API Rate Limiter
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 100,
  message: { success: false, error: 'Too many requests from this IP, please try again later.' },
});
app.use('/api/v1', limiter);

// Health Check Endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'IskolarMatch API Online' });
});

// GridFS Mongo Document Streaming Route
app.get('/api/v1/documents/:filename', async (req, res) => {
  try {
    if (!mongoose.connection.db) {
      return res.status(500).json({ message: 'Database connection not initialized' });
    }

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'uploads', // Maps to uploads.files and uploads.chunks
    });

    const files = await bucket.find({ filename: req.params.filename }).toArray();
    if (!files || files.length === 0) {
      return res.status(404).json({ message: 'Document file not found in database' });
    }

    const file = files[0];
    res.set('Content-Type', file.contentType || 'image/jpeg');
    res.set('Content-Length', file.length);

    const downloadStream = bucket.openDownloadStreamByName(req.params.filename);

    downloadStream.on('error', (err) => {
      console.error('GridFS Stream Error:', err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error streaming document file' });
      }
    });

    downloadStream.pipe(res);
  } catch (error) {
    console.error('GridFS streaming error:', error);
    res.status(500).json({ message: 'Error retrieving document from database' });
  }
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

// Centralized Error Handling Middleware (must be registered after routes)
app.use(errorHandler);

// Database Connection & Server Initialization
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