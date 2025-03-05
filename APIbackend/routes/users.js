// APIbackend/routes/users.js
const express = require("express");
const router = express.Router();
const usersController = require("../controllers/usersControllers");
const { body } = require("express-validator");
const { authenticateToken, authorizeRole } = require("../authMiddleware"); // Import auth middleware

// Validation middleware
const validateUser = [
  body("username")
    .trim()
    .isLength({ min: 3 })
    .withMessage("Username must be at least 3 characters long."),
  body("email").isEmail().withMessage("Invalid email address."),
  body("password")
    .isLength({ min: 6 })
    .withMessage("Password must be at least 6 characters long."),
];

// GET all users (protected - admin only)
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

// PUT/PATCH update a user by ID (protected - user or admin)
router.put("/:id", authenticateToken, usersController.updateUser);
router.patch("/:id", authenticateToken, usersController.updateUser); // Consider PATCH for partial updates

// DELETE a user by ID (protected - admin or the user themselves)
router.delete("/:id", authenticateToken, usersController.deleteUser);

module.exports = router;
