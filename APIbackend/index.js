// index.js
const express = require("express");
const bodyParser = require("body-parser");
const { PrismaClient } = require("@prisma/client");

const app = express();
const port = 3001;

// Use bodyParser.json() to parse JSON payloads
app.use(bodyParser.json());

// Import routes
const userRoutes = require("./routes/users");
const postRoutes = require("./routes/posts");
const commentRoutes = require("./routes/comments");
const authMiddleware = require("./authMiddleware"); // Import authMiddleware

// Mount routes at their respective paths
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);

app.get("/", (req, res) => {
  res.send("Blog API is running!");
});

const prisma = new PrismaClient();

let server; // Declare server outside the listener

if (process.env.NODE_ENV !== "test") {
  server = app.listen(port, () => {
    // Only listen if not in test environment.
    console.log(`Server is running on port ${port}`);
  });
}

module.exports = { app, server, prisma }; // Export app, server and prisma
