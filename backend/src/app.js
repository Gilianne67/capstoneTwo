const express = require("express");
const cookieParser = require("cookie-parser");

const { corsOptions, apiLimiter, helmet } = require("./middleware/security");
const notFound = require("./middleware/notFound");
const errorHandler = require("./utils/errorResponse");

const app = express();

// Security headers
app.use(helmet());

// CORS
app.use(cors(corsOptions));

// Parse JSON request bodies
app.use(express.json({ limit: "10kb" }));

// Parse cookies
app.use(cookieParser());

// Rate limiting
app.use("/api", apiLimiter);

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "IskolarMatch API is running",
  });
});

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
*/

// Example:
// app.use("/api/v1/auth", authRoutes);
// app.use("/api/v1/scholarships", scholarshipRoutes);
// app.use("/api/v1/students", studentRoutes);
// app.use("/api/v1/providers", providerRoutes);

/*
|--------------------------------------------------------------------------
| Error Handling
|--------------------------------------------------------------------------
*/

// 404 must come AFTER all routes
app.use(notFound);

// Global error handler must be LAST
app.use(errorHandler);

// Quick fallback endpoint if full notification system isn't implemented yet
app.get('/api/v1/notifications/unread-count', protect, (req, res) => {
  res.status(200).json({
    success: true,
    count: 0,
  });
});

module.exports = app;