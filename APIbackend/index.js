// APIbackend/index.js
const express = require("express");
const { PrismaClient } = require("@prisma/client"); // Import PrismaClient
const cors = require("cors");
const { authenticateToken, authorizeRole } = require("./authMiddleware");

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Import route handlers
const userRoutes = require("./routes/users");
const postRoutes = require("./routes/posts");
const commentRoutes = require("./routes/comments");

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
