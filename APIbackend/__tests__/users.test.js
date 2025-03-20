const request = require("supertest");
const { app, server } = require("../index");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

jest.mock("jsonwebtoken");
jest.mock("bcryptjs");
jest.mock("../prisma");
const prisma = require("../prisma");

describe("User Routes", () => {
  let testUser;
  let testUserId = 1;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Store the test user
    testUser = {
      id: testUserId,
      email: "test@example.com",
      username: "testuser",
      password: "hashed_password",
      role: "user",
    };

    // Configure prisma mock methods for testing
    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.email === "test@example.com" || where.id === testUserId) {
        return testUser;
      }
      return null;
    });

    prisma.user.findMany.mockResolvedValue([testUser]);
    prisma.user.create.mockResolvedValue(testUser);
    prisma.user.update.mockResolvedValue(testUser);
    prisma.user.delete.mockResolvedValue(undefined);

    bcrypt.hash.mockResolvedValue("hashed_password");
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  it("should create a new user", async () => {
    const newUser = {
      email: "newuser@example.com",
      username: "newuser",
      password: "password",
    };
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 2,
      ...newUser,
      role: "user",
    });

    const res = await request(app).post("/api/users").send(newUser);
    expect(res.statusCode).toBe(201);
    expect(res.body.email).toBe(newUser.email);
    expect(res.body).not.toHaveProperty("password");
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: newUser.email,
        username: newUser.username,
        password: "hashed_password",
        role: "user",
      },
    });
  });

  it("should return 400 if user data is invalid", async () => {
    const invalidUser = { username: "te" };
    const res = await request(app).post("/api/users").send(invalidUser);
    expect(res.statusCode).toEqual(400);
    expect(res.body.errors).toBeDefined();
  });

  it("should return 409 if user exists", async () => {
    const existingUser = {
      email: "test@example.com",
      username: "testuser",
      password: "password",
    };
    const res = await request(app).post("/api/users").send(existingUser);
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({ message: "Email already in use" });
  });

  it("should login a user", async () => {
    const loginData = { email: "test@example.com", password: "password" };
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("mocked_token");

    const res = await request(app).post("/api/users/login").send(loginData);
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBe("mocked_token");
    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: testUser.id, role: testUser.role },
      expect.anything(), // Match any secret
      { expiresIn: "1h" }
    );
  });

  it("should return 401 for invalid login credentials", async () => {
    const loginData = { email: "test@example.com", password: "wrongpassword" };
    bcrypt.compare.mockResolvedValue(false);

    const res = await request(app).post("/api/users/login").send(loginData);
    expect(res.statusCode).toBe(401);
  });

  it("should return 400 for missing login credentials", async () => {
    const res = await request(app).post("/api/users/login").send({});
    expect(res.statusCode).toBe(400);
  });

  it("should get all users (admin only)", async () => {
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: testUserId, role: "admin" });
    });
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toEqual(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("should return 403 if user is not an admin", async () => {
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: 2, role: "user" }); // Not an admin
    });
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(403);
  });

  it("should get a user by ID", async () => {
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: testUserId, role: "user" });
    });
    const res = await request(app)
      .get(`/api/users/${testUserId}`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(testUserId);
  });

  it("should return 403 if unauthorized user tries to get user details", async () => {
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: 999, role: "user" }); // Different user
    });
    const res = await request(app)
      .get(`/api/users/${testUserId}`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(403);
  });

  it("should return 404 if user is not found", async () => {
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: 999, role: "user" });
    });
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get("/api/users/999")
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(404);
  });

  it("should update user details", async () => {
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: testUserId, role: "user" });
    });
    const updatedUserData = {
      email: "newemail@example.com",
      username: "newusername",
    };
    prisma.user.update.mockResolvedValue({
      ...testUser,
      ...updatedUserData,
    });

    const res = await request(app)
      .put(`/api/users/${testUserId}`)
      .set("Authorization", "Bearer mocked_token")
      .send(updatedUserData);

    expect(res.statusCode).toEqual(200);
    expect(res.body.email).toBe(updatedUserData.email);
    expect(res.body.username).toBe(updatedUserData.username);
  });

  it("should return 403 if unauthorized user tries to update user", async () => {
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: 2, role: "user" }); // Different user
    });
    const res = await request(app)
      .put(`/api/users/${testUserId}`)
      .set("Authorization", "Bearer mocked_token")
      .send({ username: "updateduser" });
    expect(res.statusCode).toBe(403);
  });

  it("should return 404 when updating a non-existent user", async () => {
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: 99, id: 99, role: "user" });
    });

    // First, we need to make findUnique return null to indicate user not found
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put("/api/users/99")
      .set("Authorization", "Bearer mocked_token")
      .send({ email: "new@mail.com" });

    expect(res.statusCode).toBe(404); // Expect 404
  });

  it("should delete a user", async () => {
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: testUserId, role: "user" });
    });
    const res = await request(app)
      .delete(`/api/users/${testUserId}`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(204);
  });

  it("should return 403 if unauthorized user tries to delete", async () => {
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: 999, role: "user" }); // Different user
    });
    const res = await request(app)
      .delete(`/api/users/${testUserId}`)
      .set("Authorization", "Bearer mocked_token");

    expect(res.statusCode).toBe(403);
  });

  it("should handle Prisma errors during delete and return 500", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: testUserId, role: "user" });
    });
    prisma.user.delete.mockImplementation(() => {
      throw new Error("Some database error");
    });

    const res = await request(app)
      .delete(`/api/users/${testUserId}`)
      .set("Authorization", "Bearer mocked_token");

    expect(res.statusCode).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    prisma.user.delete.mockReset();
  });
});
