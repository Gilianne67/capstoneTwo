const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connectDB = require('./config/db');

dotenv.config();
connectDB();

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Route Files
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');

// 🔍 DEBUG LOGS
console.log('--- SERVER DEBUG ---');
console.log('authRoutes:', authRoutes);
console.log('type of authRoutes:', typeof authRoutes);
console.log('studentRoutes:', studentRoutes);
console.log('type of studentRoutes:', typeof studentRoutes);

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/students', studentRoutes);
// Health Check Endpoint
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({ status: 'success', message: 'IsKolarMatch API Engine Online' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});