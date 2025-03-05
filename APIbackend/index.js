// ./APIbackend/index.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs"); // For password hashing
const jwt = require("jsonwebtoken"); // For authentication
const cors = require("cors"); // For handling Cross-Origin Resource Sharing
const { body, validationResult } = require("express-validator"); //Input validation
const { authenticateToken, authorizeRole } = require("./authMiddleware");

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"; // Use environment variable for secret

app.use(cors()); // Enable CORS for all origins - configure this for production!
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

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

module.exports = { app, server, prisma }; // Export for testing
