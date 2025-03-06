const express = require("express");
const router = express.Router();
const commentsController = require("../controllers/commentsControllers"); // CORRECT PATH
const { authenticateToken, authorizeRole } = require("../authMiddleware");
const { body, validationResult } = require("express-validator");

//Validation Middleware
const validateComment = [
  body("content").trim().notEmpty().withMessage("Comment content is required."),
  body("postId").isInt().withMessage("Post ID must be an integer."),
  body("authorId").isInt().withMessage("Author ID must be an integer."),
];

// GET all comments for a specific post
router.get("/post/:postId", commentsController.getCommentsByPostId);

// GET a single comment by ID
router.get("/:id", commentsController.getCommentById);

// POST a new comment on a post (protected route, requires authentication and validation)
router.post(
  "/",
  authenticateToken,
  validateComment,
  commentsController.createComment
);

// PUT/PATCH update a comment by ID (protected, author or admin only)
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  validateComment,
  commentsController.updateComment
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  validateComment,
  commentsController.updateComment
);

// DELETE a comment by ID (protected, author or admin only)
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  commentsController.deleteComment
);

module.exports = router;
