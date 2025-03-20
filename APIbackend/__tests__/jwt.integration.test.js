const request = require("supertest");
const { app, server } = require("../index");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma");

// These tests will use the real JWT implementation, not mocks
jest.mock("../prisma");

describe("JWT Authentication Integration", () => {
  let validToken;
  const testUser = {
    id: 1,
    email: "test@example.com",
    username: "testuser",
    password: "$2a$10$abcdefghijklmnopqrstuvwxyz", // Fake hashed password
    role: "user",
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Configure prisma mock for login
    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.email === "test@example.com") {
        return testUser;
      }
      return null;
    });
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  it("should login successfully and return a valid JWT token", async () => {
    // Mock bcrypt.compare to always return true for our test
    const bcrypt = require("bcryptjs");
    jest.spyOn(bcrypt, "compare").mockResolvedValue(true);

    const loginData = { email: "test@example.com", password: "password" };

    const res = await request(app).post("/api/users/login").send(loginData);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(typeof res.body.token).toBe("string");
    expect(res.body.token.length).toBeGreaterThan(20);

    // Save token for subsequent tests
    validToken = res.body.token;

    // Verify that the token is actually valid by using it
    const decodedToken = jwt.decode(validToken);
    expect(decodedToken).toHaveProperty("userId", 1);
    expect(decodedToken).toHaveProperty("role", "user");
  });

  it("should access a protected route successfully with a valid JWT", async () => {
    // Skip if login test failed
    if (!validToken) {
      console.warn("Skipping test because valid token not available");
      return;
    }

    // Setup mock for getUserById
    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === 1) {
        return testUser;
      }
      return null;
    });

    const res = await request(app)
      .get("/api/users/1")
      .set("Authorization", `Bearer ${validToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("id", 1);
    expect(res.body).toHaveProperty("username", "testuser");
  });

  it("should return 401 when accessing a protected route without a JWT", async () => {
    const res = await request(app).get("/api/users/1");

    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty("message", "Unauthorized - No token provided");
  });

  it("should return 403 when accessing a protected route with an invalid JWT", async () => {
    // Create an invalid token (this token has been tampered with)
    const invalidToken = validToken ? validToken.slice(0, -5) + "12345" : "invalid.token.here";

    const res = await request(app)
      .get("/api/users/1")
      .set("Authorization", `Bearer ${invalidToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty("message", "Forbidden - Invalid token");
  });

  it("should return 403 when using an expired token", async () => {
    // Create a JWT that's already expired
    const expiredToken = jwt.sign(
      { userId: testUser.id, role: testUser.role },
      process.env.JWT_SECRET || "your_jwt_secret",
      { expiresIn: "0s" } // Expires immediately
    );

    const res = await request(app)
      .get("/api/users/1")
      .set("Authorization", `Bearer ${expiredToken}`);

    expect(res.statusCode).toBe(403);
    expect(res.body).toHaveProperty("message", "Forbidden - Invalid token");
  });
});