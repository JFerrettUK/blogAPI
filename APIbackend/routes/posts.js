const express = require("express");
const router = express.Router();
const postsController = require("../controllers/postsControllers"); // CORRECT PATH
const { authenticateToken, authorizeRole } = require("../authMiddleware");
const { body, validationResult } = require("express-validator");

// Validation middleware for creating a post
const validatePost = [
  body("title").trim().notEmpty().withMessage("Title is required."),
  body("content").trim().notEmpty().withMessage("Content is required."),
];

// GET all posts
router.get("/", postsController.getAllPosts);

// GET a single post by ID
router.get("/:id", postsController.getPostById);

// POST a new post (protected route, requires authentication and validation)
router.post("/", authenticateToken, validatePost, postsController.createPost);

// PUT/PATCH update a post by ID (protected, author or admin only)
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
