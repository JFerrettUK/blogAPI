const { PrismaClient } = require("@prisma/client");
const { body, validationResult } = require("express-validator");

const prisma = new PrismaClient();

// Validation middleware for creating a post
const validatePost = [
  body("title").trim().notEmpty().withMessage("Title is required."),
  body("content").trim().notEmpty().withMessage("Content is required."),
];

// GET all posts
exports.getAllPosts = async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      include: {
        author: {
          select: { id: true, username: true, email: true }, //select only necessary user fields.
        },
        comments: {
          include: {
            author: {
              select: { id: true, username: true, email: true }, //select only necessary user fields for comments as well.
            },
          },
        },
      },
    });
    res.json(posts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET a single post by ID
exports.getPostById = async (req, res) => {
  try {
    const postId = parseInt(req.params.id);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: { id: true, username: true, email: true },
        },
        comments: {
          include: {
            author: {
              select: { id: true, username: true, email: true },
            },
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    res.json(post);
  } catch (error) {
    console.error("Error fetching post by ID:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST a new post
exports.createPost = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { title, content } = req.body;
    const authorId = req.user.userId; // Get authorId from the authenticated user

    const post = await prisma.post.create({
      data: {
        title,
        content,
        authorId, // Use the extracted authorId
        published: true,
      },
    });
    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT/PATCH update a post
exports.updatePost = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const postId = parseInt(req.params.id);
    const { title, content } = req.body;

    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    //Authorization check
    if (post.authorId !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        content,
      },
      include: { author: { select: { id: true, username: true } } }, // Include author info
    });
    res.json(updatedPost);
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE a post
exports.deletePost = async (req, res) => {
  try {
    const postId = parseInt(req.params.id);

    const post = await prisma.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    if (post.authorId !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.post.delete({
      where: { id: postId },
    });
    res.sendStatus(204); // No Content
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
