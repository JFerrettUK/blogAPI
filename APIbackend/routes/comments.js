// APIbackend/routes/comments.js
const express = require("express");
const router = express.Router();
const commentsController = require("../controllers/commentsControllers");
const { authenticateToken, authorizeRole } = require("../authMiddleware");

// GET all comments for a specific post
router.get("/post/:postId", commentsController.getCommentsByPostId);

// GET a single comment by ID (less common, but could be useful)
router.get("/:id", commentsController.getCommentById);

// POST a new comment on a post (protected route, requires authentication)
router.post("/", authenticateToken, commentsController.createComment);

// PUT/PATCH update a comment by ID (protected, author or admin only)
router.put(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
  commentsController.updateComment
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("author", "admin"),
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
