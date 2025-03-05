// APIbackend/controllers/commentsControllers.js
const { PrismaClient } = require("@prisma/client");
const { body, validationResult } = require("express-validator");

const prisma = new PrismaClient();

// Validation middleware
const validateComment = [
  body("content").trim().notEmpty().withMessage("Comment content is required."),
  body("postId").isInt().withMessage("Post ID must be an integer."),
  body("authorId").isInt().withMessage("Author ID must be an integer."),
];

// GET all comments for a specific post
exports.getCommentsByPostId = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);
    const comments = await prisma.comment.findMany({
      where: { postId: postId },
      include: { author: true }, // Include author information
    });
    res.json(comments);
  } catch (error) {
    console.error("Error fetching comments by post ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET a single comment by ID
exports.getCommentById = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: { author: true }, // Include author
    });
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }
    res.json(comment);
  } catch (error) {
    console.error("Error fetching comment by ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST a new comment
exports.createComment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { content, postId, authorId, username, email } = req.body;

    const comment = await prisma.comment.create({
      data: {
        content,
        postId: parseInt(postId), // Parse postId to integer
        authorId: parseInt(authorId), // Parse authorId to integer
        username,
        email,
      },
    });
    res.status(201).json(comment);
  } catch (error) {
    console.error("Error creating comment:", error);
    if (error.code === "P2003") {
      // Foreign key constraint failed
      return res.status(400).json({ error: "Invalid post ID or author ID" });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT/PATCH update a comment by ID
exports.updateComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const { content } = req.body;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      return res.status(404).json({ error: "Comment Not found" });
    }

    if (req.user.id !== comment.authorId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
    });
    res.json(updatedComment);
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE a comment by ID
exports.deleteComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      return res.status(404).json({ error: "Comment Not found" });
    }

    if (req.user.id !== comment.authorId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });
    res.sendStatus(204); // No content
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
