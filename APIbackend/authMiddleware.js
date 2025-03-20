const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret"; // Use environment variable

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res
      .status(401)
      .json({ message: "Unauthorized - No token provided" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: "Forbidden - Invalid token" });
    }
    // Ensure both id and userId are available for backward compatibility
    req.user = {
      ...user,
      id: user.userId || user.id,
    };
    next();
  });
};

const authorizeRole = (...roles) => {
  return (req, res, next) => {
    if (req.user && roles.includes(req.user.role)) {
      next();
    } else {
      return res
        .status(403)
        .json({ message: "Forbidden - Insufficient permissions" });
    }
  };
};

module.exports = { authenticateToken, authorizeRole };
