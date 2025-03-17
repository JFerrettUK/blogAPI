const express = require("express");
const router = express.Router();
const postsController = require("../controllers/postsControllers"); // Correct Path
const { authenticateToken, authorizeRole } = require("../authMiddleware");
const { body } = require("express-validator"); // Import validation tools

// Validation middleware for creating a post
const validatePost = [
  body("title").trim().notEmpty().withMessage("Title is required."),
  body("content").trim().notEmpty().withMessage("Content is required."),
  // Add other validation rules as needed
];

// GET all posts
router.get("/", postsController.getAllPosts);

// GET a single post by ID
router.get("/:id", postsController.getPostById);

// POST a new post (protected route, requires authentication and input validation)
router.post("/", authenticateToken, validatePost, postsController.createPost);

// PUT/PATCH update a post by ID (protected, author or admin only, and input validation)
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  validatePost,
  postsController.updatePost
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  validatePost,
  postsController.updatePost
);

// DELETE a post by ID (protected, author or admin only)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  postsController.deletePost
);

module.exports = router;
