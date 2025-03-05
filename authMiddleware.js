// APIbackend/authMiddleware.js
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret";

// Middleware to authenticate JWT tokens
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized - No token provided" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error("JWT verification error:", err);
      return res.status(403).json({ message: "Forbidden - Invalid token" });
    }
    req.user = user; // Attach the user payload to the request object
    next();
  });
};

// Middleware to authorize based on roles
const authorizeRole = (...roles) => {
  // Use a rest parameter to accept multiple roles
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      // Check if user has the required role
      return res
        .status(403)
        .json({ message: "Forbidden - Insufficient permissions" });
    }
    next();
  };
};

module.exports = { authenticateToken, authorizeRole };
