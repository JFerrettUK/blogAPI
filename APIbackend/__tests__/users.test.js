// __tests__/users.test.js
const request = require("supertest");
const { app, prisma, server } = require("../index"); // Import app, prisma, and server
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

describe("User Routes", () => {
  const testUser = {
    id: 1,
    email: "test@example.com",
    username: "testuser",
    password: "hashed_password", // Mock hashed password
    role: "user",
  };

  beforeAll((done) => {
    // Use beforeAll for server setup
    if (!server) {
      // Check if server is already running
      // Remove 'let' here.  We want to assign to the imported 'server'.
      app.listen(3001, () => {
        console.log("Test server running on port 3001");
        done(); // Call done() to signal async operation completion
      });
    } else {
      done();
    }
  });

  beforeEach(() => {
    // Mock user.findUnique for user-related lookups.
    prisma.user.findUnique.mockImplementation(async ({ where }) => {
      if (where.email === "test@example.com" || where.id === 1) {
        return testUser;
      } else {
        return null;
      }
    });

    prisma.user.create.mockResolvedValue(testUser);
    prisma.user.findMany.mockResolvedValue([testUser]);
    prisma.user.update.mockResolvedValue(testUser);
    prisma.user.delete.mockResolvedValue();

    bcrypt.hash.mockResolvedValue("hashed_password"); // Mock the bcrypt hash function
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("mocked_token");
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: testUser.id, role: testUser.role });
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Correctly close the server after *all* tests
    if (server) {
      await server.close();
    }
    await prisma.$disconnect();
  });

  it("should create a new user", async () => {
    const newUser = {
      email: "newuser@example.com",
      username: "newuser",
      password: "password",
    };
    prisma.user.findUnique.mockResolvedValue(null); //ensure no user exists
    prisma.user.create.mockResolvedValue({ id: 2, ...newUser, role: "user" });
    const res = await request(app).post("/api/users").send(newUser);
    expect(res.statusCode).toEqual(201);
    expect(res.body.email).toBe(newUser.email);
  });

  it("should return a 400 if invalid data", async () => {
    const res = await request(app)
      .post("/api/users")
      .send({ email: "bademail", username: "testuser", password: "password" });
    expect(res.statusCode).toEqual(400);
  });

  it("should return 409 if email exists", async () => {
    prisma.user.findUnique.mockResolvedValueOnce(testUser);
    const res = await request(app)
      .post("/api/users")
      .send({
        email: "test@example.com",
        username: "anotheruser",
        password: "password",
      });
    expect(res.statusCode).toBe(409);
  });

  it("should authenticate a user", async () => {
    const loginData = { email: "test@example.com", password: "password" };
    prisma.user.findUnique.mockResolvedValue(testUser); // User exists
    bcrypt.compare.mockResolvedValue(true); // Password matches

    const res = await request(app).post("/api/users/login").send(loginData);
    expect(res.statusCode).toBe(200);
    expect(res.body.token).toBeDefined(); // Token should be present
  });

  it("should return 401 for incorrect password", async () => {
    const loginData = { email: "test@example.com", password: "wrongpassword" };
    bcrypt.compare.mockResolvedValue(false); //Password Does not Match

    const res = await request(app).post("/api/users/login").send(loginData);
    expect(res.statusCode).toBe(401);
  });

  it("should return 401 for no user found", async () => {
    prisma.user.findUnique.mockResolvedValue(null); // Simulate user not found

    const res = await request(app)
      .post("/api/users/login")
      .send({ email: "nonexistent@example.com", password: "password" });

    expect(res.statusCode).toBe(401);
  });

  it("should return 400 for missing credentials", async () => {
    const res = await request(app).post("/api/users/login").send({});
    expect(res.statusCode).toBe(400);
  });

  it("should get all users (admin only)", async () => {
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 1, role: "admin" }); // Simulate admin login
    });

    prisma.user.findMany.mockResolvedValue([testUser]);
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toEqual(200);
  });

  it("should respond with 403 if user does not have required role", async () => {
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 2, role: "user" }); // Not an admin
    });
    const res = await request(app)
      .get("/api/users")
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(403);
  });

  it("should get a user by ID", async () => {
    prisma.user.findUnique.mockResolvedValue(testUser); // User exists
    const res = await request(app)
      .get(`/api/users/1`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(1);
  });

  it("should return 403 if unauthorized user tries to get user details", async () => {
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 2, role: "user" }); // Different user
    });
    const res = await request(app)
      .get(`/api/users/1`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(403);
  });

  it("should return 404 if user not found when deleting", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .delete(`/api/users/999`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(404);
  });

  it("should update user details", async () => {
    const updatedUser = {
      email: "newemail@example.com",
      username: "newusername",
    };
    prisma.user.findUnique.mockResolvedValue(testUser);
    prisma.user.update.mockResolvedValue({ ...testUser, ...updatedUser });
    const res = await request(app)
      .put(`/api/users/1`)
      .set("Authorization", "Bearer mocked_token")
      .send(updatedUser);

    expect(res.statusCode).toEqual(200);
    expect(res.body.email).toBe(updatedUser.email);
    expect(res.body.username).toBe(updatedUser.username);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: testUser.id },
      data: updatedUser,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  });

  it("should return 403 if unauthorized user tries to update user", async () => {
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 2, role: "user" });
    });
    const res = await request(app)
      .put(`/api/users/1`)
      .set("Authorization", "Bearer mocked_token")
      .send({ username: "updateduser" });
    expect(res.statusCode).toBe(403);
  });

  it("should delete a user", async () => {
    prisma.user.delete.mockResolvedValue();
    prisma.user.findUnique.mockResolvedValue(testUser);

    const res = await request(app)
      .delete(`/api/users/1`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(204);
  });

  it("should return a 404 error when trying to update a non-existent user", async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put("/api/users/999") // Non-existent user ID
      .set("Authorization", "Bearer mocked_token")
      .send({ username: "updatedname" });

    expect(res.statusCode).toBe(404);
    expect(res.body).toEqual({ error: "User not found" });
  });

  it("should return 403 if unauthorized user tries to delete", async () => {
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 999, role: "user" }); // Different user
    });

    const res = await request(app)
      .delete(`/api/users/1`)
      .set("Authorization", "Bearer mocked_token");

    expect(res.statusCode).toBe(403);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });
});
