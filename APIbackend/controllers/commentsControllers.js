const { PrismaClient } = require("@prisma/client");
const { validationResult } = require("express-validator");
const prisma = new PrismaClient();

// GET all comments for a specific post
exports.getCommentsByPostId = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);

    const comments = await prisma.comment.findMany({
      where: { postId: postId },
      include: {
        author: {
          select: { id: true, username: true, email: true },
        },
      },
    });
    if (!comments || comments.length === 0) {
      return res.status(404).json({ error: "No comments found for this post" });
    }

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
      include: {
        author: {
          select: { id: true, username: true, email: true },
        },
      },
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

// POST a new comment on a post
exports.createComment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { content, postId } = req.body; // Only expect content and postId
    const authorId = req.user.userId; // Get authorId from req.user

    const comment = await prisma.comment.create({
      data: {
        content,
        postId,
        authorId, // Use the extracted authorId
      },
    });
    res.status(201).json(comment);
  } catch (error) {
    console.error("Error creating comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT/PATCH update a comment
exports.updateComment = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const commentId = parseInt(req.params.id);
    const { content } = req.body;

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (comment.authorId !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden." });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: { author: { select: { id: true, username: true } } }, // Include author info
    });
    res.json(updatedComment);
  } catch (error) {
    console.error("Error updating comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE a comment
exports.deleteComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (comment.authorId !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });
    res.sendStatus(204); // No Content
  } catch (error) {
    console.error("Error deleting comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
