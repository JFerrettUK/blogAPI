const prisma = require("../prisma");
const { body, validationResult } = require("express-validator");

// Validation middleware
const validateComment = [
  body("content").trim().notEmpty().withMessage("Content is required."),
];

// GET all comments for a specific post
exports.getCommentsByPostId = async (req, res) => {
  try {
    const postId = parseInt(req.params.postId);

    const post = await prisma.post.findUnique({
      where: { id: postId },
    });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    const comments = await prisma.comment.findMany({
      where: { postId: postId },
      include: {
        author: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    res.json(comments);
  } catch (error) {
    console.error("Error fetching comments by post ID:", error.message, error.stack, { postId: req.params.postId });
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
    console.error("Error fetching comment by ID:", error.message, error.stack, { commentId: req.params.id });
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST a new comment
exports.createComment = [validateComment, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const { content, postId } = req.body;
    const authorId = req.user.userId; // Get authorId from the authenticated user (VERY IMPORTANT)

    const comment = await prisma.comment.create({
      data: {
        content,
        postId: parseInt(postId), // Ensure postId is an integer
        authorId: authorId, // Use the authenticated user's ID
      },
      include: {
        author: { select: { id: true, username: true, email: true } },
      }, // Include author in the response
    });
    res.status(201).json(comment);
  } catch (error) {
    console.error("Error creating comment:", error.message, error.stack, { postId: req.body.postId, authorId: req.user.userId, content: req.body.content });
    if (error.code === "P2003") {
      // Foreign key constraint failed (post doesn't exist)
      return res.status(400).json({ error: "Invalid post ID" });
    }

    res.status(500).json({ error: "Internal server error" });
  }
}];

// PUT/PATCH update a comment
exports.updateComment = [validateComment, async (req, res) => {
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

    if (req.user.id !== comment.authorId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden." });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        author: { select: { id: true, username: true, email: true } },
      },
    });
    res.json(updatedComment);
  } catch (error) {
    console.error("Error updating comment:", error.message, error.stack, { commentId: req.params.id, userId: req.user.id });
    res.status(500).json({ error: "Internal server error" });
  }
}];

// DELETE a comment
exports.deleteComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      return res.status(404).json({ error: "Comment Not found" });
    }
    // authorization check
    if (req.user.id !== comment.authorId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });
    res.sendStatus(204);
  } catch (error) {
    console.error("Error deleting comment:", error.message, error.stack, { commentId: req.params.id, userId: req.user.id });
    res.status(500).json({ error: "Internal server error" });
  }
};
