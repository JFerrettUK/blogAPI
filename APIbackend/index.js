const express = require("express");
const { PrismaClient } = require("@prisma/client");
const cors = require("cors");
const { authenticateToken, authorizeRole } = require("./authMiddleware"); // CORRECT PATH

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Import route handlers (Corrected paths)
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
