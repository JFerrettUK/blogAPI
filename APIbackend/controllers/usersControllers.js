// APIbackend/controllers/usersControllers.js

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"; //added for login route

// GET all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      }, // Don't include password
    });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// GET a single user by ID
exports.getUserById = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (req.user.id !== userId && req.user.role !== "admin") {
      //Added authorization
      return res.status(403).json({ message: "Forbidden" });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      }, // Exclude password
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST a new user (sign up)
exports.createUser = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { email, username, password } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email },
    });
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use" }); // 409 Conflict
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashedPassword,
        role: "user", // Set a default role
      },
    });
    // *Never* send back the password, even the hashed one.
    res
      .status(201)
      .json({ id: user.id, email: user.email, username: user.username });
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// POST user login
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: "1h",
    });
    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// PUT/PATCH update a user by ID
exports.updateUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { email, username, password } = req.body; //Allow password update here, but hash it.

    //Authorization check
    if (req.user.id !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const updateData = {};
    if (email) updateData.email = email;
    if (username) updateData.username = username;
    if (password) {
      updateData.password = await bcrypt.hash(password, 10); // Hash the new password
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      }, // Don't return the password
    });
    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    if (error.code === "P2002") {
      return res
        .status(400)
        .json({ error: "Email or username already in use." });
    }
    res.status(500).json({ error: "Internal server error" });
  }
};

// DELETE a user by ID
exports.deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    if (req.user.id !== userId && req.user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.user.delete({
      where: { id: userId },
    });
    res.sendStatus(204); // No Content
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};
