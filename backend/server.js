const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./config/db');

dotenv.config();

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

app.use(helmet());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Routes
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');

// Auth
app.use('/api/v1/auth', authRoutes);

// Student
app.use('/api/v1/students', studentRoutes);

// Health
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'IsKolarMatch API Engine Online',
  });
});

const PORT = process.env.PORT || 5000;

// Start server only after MongoDB connects
const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(
        `🚀 Server running in ${
          process.env.NODE_ENV || 'development'
        } mode on port ${PORT}`
      );
    });
  } catch (error) {
    console.error('❌ Server startup failed:', error.message);
    process.exit(1);
  }
};

startServer();