// APIbackend/index.js
const express = require("express");
const { PrismaClient } = require("@prisma/client"); // Import PrismaClient
const cors = require("cors");
const { authenticateToken, authorizeRole } = require("./authMiddleware");

const app = express();
const port = process.env.PORT || 3001;

// Configure CORS
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS || '*', // In production, set to specific origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Request parsing middleware
app.use(express.json());

// Rate limiting
const rateLimit = require('express-rate-limit');
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later'
});

// Apply rate limiting to all routes
app.use(apiLimiter);

// Import route handlers
const userRoutes = require("./routes/users");
const postRoutes = require("./routes/posts");
const commentRoutes = require("./routes/comments");

// Serve static files from the public directory
app.use(express.static('public'));

// Serve API documentation
app.get('/docs', (req, res) => {
  res.sendFile(__dirname + '/docs/api-documentation.md');
});

// API routes
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);

app.get("/", (req, res) => {
  res.send("Blog API is running!");
});

let server; // Declare server

// Function to get (and initialize) Prisma client
let getPrismaClient = () => {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  return global.prisma;
};

// For tests, we need to provide a mock version
if (process.env.NODE_ENV === 'test') {
  const jestMock = require('jest-mock');
  module.exports.getPrismaClient = jestMock.fn(() => {
    // Return a simple test mock object if global.prisma is not set
    return global.testPrismaMock || {
      user: { findUnique: jestMock.fn(), findMany: jestMock.fn() },
      post: { findUnique: jestMock.fn(), findMany: jestMock.fn() },
      comment: { findUnique: jestMock.fn(), findMany: jestMock.fn() }
    };
  });
} else {
  module.exports.getPrismaClient = getPrismaClient;
}

// Conditionally start the server ONLY if not in a test environment
if (process.env.NODE_ENV !== "test") {
  server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}

// Export app and server
module.exports.app = app;
module.exports.server = server;
