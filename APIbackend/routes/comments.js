const express = require("express");
const router = express.Router();
const commentsController = require("../controllers/commentsControllers"); // Correct Path
const { authenticateToken, authorizeRole } = require("../authMiddleware");
const { body, validationResult } = require("express-validator"); // Import for validation

// Validation middleware
const validateComment = [
  body("content").trim().notEmpty().withMessage("Comment content is required."),
  body("postId").isInt().withMessage("Post ID must be an integer."),
  // authorId is now derived from the token, so we don't validate it in the request body anymore.
];

// GET all comments for a specific post
router.get("/post/:postId", commentsController.getCommentsByPostId);

// GET a single comment by ID
router.get("/:id", commentsController.getCommentById);

// POST a new comment on a post (protected route, requires authentication and validation)
router.post(
  "/",
  authenticateToken,
  commentsController.createComment
);

// PUT/PATCH update a comment by ID (protected, author or admin only)
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  commentsController.updateComment
); // Validation is now in the controller
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  commentsController.updateComment
); // Validation is now in the controller

// DELETE a comment by ID (protected, author or admin only)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  commentsController.deleteComment
);

module.exports = router;
