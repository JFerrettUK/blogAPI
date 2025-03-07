// APIbackend/routes/users.js
const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersControllers");
const { body, validationResult } = require("express-validator");
const { authenticateToken, authorizeRole } = require("../authMiddleware"); // CORRECT PATH

// Validation middleware
const validateUser = [
  body("email").isEmail().withMessage("Invalid email format."),
  body("username").trim().notEmpty().withMessage("Username is required."),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long."),
];

// GET all users (admin only)
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  usersController.getAllUsers
);

// GET a single user by ID (protected - admin or the user themselves)
router.get("/:id", authenticateToken, usersController.getUserById);

// POST a new user (sign up) - Open, but with validation
router.post("/", validateUser, usersController.createUser);

// POST login user
router.post("/login", usersController.loginUser);

// PUT/PATCH update a user by ID (protected - user or admin)
router.put("/:id", authenticateToken, usersController.updateUser);
router.patch("/:id", authenticateToken, usersController.updateUser);

// DELETE a user by ID (protected - admin or the user themselves)
router.delete("/:id", authenticateToken, usersController.deleteUser);

module.exports = router;
