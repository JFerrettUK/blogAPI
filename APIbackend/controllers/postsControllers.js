const prisma = require("../prisma");
const { body, validationResult } = require("express-validator");

// Validation middleware
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
              select: { id: true, username: true, email: true },
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

// POST create a new post
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
        authorId: authorId, // Use the extracted authorId
        published: true,
      },
    });
    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT/PATCH update a post by ID
exports.updatePost = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  try {
    const postId = parseInt(req.params.id);
    const { title, content, published } = req.body;

    const post = await prisma.post.findUnique({ where: { id: postId } });
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }
    if (post.authorId !== req.user.userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updatedPost = await prisma.post.update({
      where: { id: postId },
      data: {
        title,
        content,
        published,
      },
    });
    res.json(updatedPost);
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE a post by ID
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
    res.sendStatus(204); // No content
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
