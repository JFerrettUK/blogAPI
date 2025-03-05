// APIbackend/routes/posts.js
const express = require("express");
const router = express.Router();
const postsController = require("../controllers/postsControllers");
const { authenticateToken, authorizeRole } = require("../authMiddleware");

// GET all posts
router.get("/", postsController.getAllPosts);

// GET a single post by ID
router.get("/:id", postsController.getPostById);

// POST a new post (protected route, requires authentication)
router.post("/", authenticateToken, postsController.createPost);

// PUT/PATCH update a post by ID (protected, author or admin only)
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  postsController.updatePost
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  postsController.updatePost
); // Or separate for partial updates

// DELETE a post by ID (protected, author or admin only)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  postsController.deletePost
);

module.exports = router;
