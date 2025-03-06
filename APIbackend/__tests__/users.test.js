const request = require("supertest");
const { app, prisma } = require("../index");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

let testUser;

beforeEach(() => {
  testUser = {
    id: 1,
    email: "test@example.com",
    username: "testuser",
    password: "hashed_password", // Mocked hashed password
    role: "user",
  };
  jwt.verify.mockImplementation((token, secret, callback) => {
    callback(null, { userId: testUser.id, role: testUser.role });
  });
  prisma.user.create.mockResolvedValue(testUser);
});
afterEach(() => {
  jest.clearAllMocks();
});

it("should create a new user", async () => {
  const newUser = {
    email: "newuser@example.com",
    username: "newuser",
    password: "password",
  };
  prisma.user.findUnique.mockResolvedValue(null); // Mock no existing user
  prisma.user.create.mockResolvedValue({ id: 2, ...newUser, role: "user" });
  const res = await request(app).post("/api/users").send(newUser);

  expect(res.statusCode).toBe(201);
  expect(res.body.email).toBe(newUser.email);
  expect(res.body).not.toHaveProperty("password"); // Don't send back the password
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
  const invalidUser = { username: "te" }; // Invalid email and short password.
  const res = await request(app).post("/api/users").send(invalidUser);
  expect(res.statusCode).toBe(400);
  expect(res.body.errors).toBeDefined(); // Check for validation errors
  expect(res.body.errors).toBeInstanceOf(Array);
});

it("POST /api/users - should return 409 if user exists", async () => {
  const newUser = {
    email: "test@example.com",
    username: "testuser",
    password: "password",
  };
  prisma.user.findUnique.mockResolvedValue(testUser);

  const res = await request(app).post("/api/users").send(newUser);

  expect(res.statusCode).toBe(409);
  expect(res.body).toEqual({ message: "Email already in use" });
});

it("should login a user", async () => {
  const loginData = { email: "test@example.com", password: "password" };
  bcrypt.compare.mockResolvedValue(true); // Mock successful password comparison
  prisma.user.findUnique.mockResolvedValue(testUser);
  const res = await request(app).post("/api/users/login").send(loginData);

  expect(res.statusCode).toBe(200);
  expect(res.body.token).toBeDefined();
  expect(jwt.sign).toHaveBeenCalledWith(
    { userId: testUser.id, role: testUser.role },
    expect.anything(), // Don't need to hardcode the secret
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
  jwt.verify.mockImplementationOnce((token, secret, callback) => {
    callback(null, { userId: 1, role: "admin" }); // Simulate admin login
  });
  prisma.user.findMany.mockResolvedValue([testUser]);

  const res = await request(app)
    .get("/api/users")
    .set("Authorization", "Bearer mocked_token");
  expect(res.statusCode).toBe(200);
  expect(res.body.length).toBeGreaterThan(0);
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
  prisma.user.findUnique.mockResolvedValue(testUser);

  const res = await request(app)
    .get(`/api/users/${testUser.id}`)
    .set("Authorization", "Bearer mocked_token");

  expect(res.statusCode).toBe(200);
  expect(res.body.id).toBe(testUser.id);
});
it("should return 404 if user is not found", async () => {
  prisma.user.findUnique.mockResolvedValue(null);
  const res = await request(app)
    .get("/api/users/999") // Non-existent ID
    .set("Authorization", "Bearer mocked_token");
  expect(res.statusCode).toBe(404);
});

it("should return 403 if a user tries to access another user", async () => {
  jwt.verify.mockImplementationOnce((token, secret, callback) => {
    callback(null, { userId: 999, role: "user" }); //Different user
  });
  const res = await request(app)
    .get(`/api/users/${testUser.id}`)
    .set("Authorization", "Bearer mocked_token");
  expect(res.statusCode).toBe(403);
});

it("should update a user", async () => {
  const updatedUser = { email: "updated@example.com", username: "updateduser" };
  prisma.user.findUnique.mockResolvedValue(testUser); // Ensure the user exists
  prisma.user.update.mockResolvedValue({ ...testUser, ...updatedUser });

  const res = await request(app)
    .put(`/api/users/${testUser.id}`)
    .set("Authorization", "Bearer mocked_token")
    .send(updatedUser);

  expect(res.statusCode).toBe(200);
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

it("should return 403 if unauthorized user tries to update", async () => {
  jwt.verify.mockImplementationOnce((token, secret, callback) => {
    callback(null, { userId: 999, role: "user" }); // Different user
  });

  const res = await request(app)
    .put(`/api/users/${testUser.id}`)
    .set("Authorization", "Bearer mocked_token")
    .send({ email: "updated@example.com" });

  expect(res.statusCode).toBe(403);
  expect(prisma.user.update).not.toHaveBeenCalled();
});

it("should return 404 if user not found when updating", async () => {
  prisma.user.findUnique.mockResolvedValue(null); // Simulate user not found
  prisma.user.update.mockResolvedValue(null); // Simulate user not found
  const res = await request(app)
    .put(`/api/users/999`)
    .set("Authorization", "Bearer mocked_token")
    .send({ email: "updated@example.com" });

  expect(res.statusCode).toBe(404); // Expect 404
  expect(prisma.user.update).not.toHaveBeenCalled();
});

it("should delete a user", async () => {
  prisma.user.delete.mockResolvedValue(); // Simulate successful deletion

  const res = await request(app)
    .delete(`/api/users/${testUser.id}`)
    .set("Authorization", "Bearer mocked_token");

  expect(res.statusCode).toBe(204);
  expect(prisma.user.delete).toHaveBeenCalledWith({
    where: { id: testUser.id },
  });
});

it("should return 403 if unauthorized user tries to delete", async () => {
  jwt.verify.mockImplementationOnce((token, secret, callback) => {
    callback(null, { userId: 999, role: "user" }); // Different user
  });

  const res = await request(app)
    .delete(`/api/users/${testUser.id}`)
    .set("Authorization", "Bearer mocked_token");

  expect(res.statusCode).toBe(403);
  expect(prisma.user.delete).not.toHaveBeenCalled();
});
it("should handle server errors during user retrieval", async () => {
  prisma.user.findMany.mockRejectedValue(new Error("Database error"));
  jwt.verify.mockImplementationOnce((token, secret, callback) => {
    callback(null, { userId: 1, role: "admin" }); // Simulate admin login
  });
  const res = await request(app)
    .get("/api/users")
    .set("Authorization", "Bearer mocked_token");

  expect(res.statusCode).toBe(500);
  expect(res.body).toEqual({ error: "Internal server error" });
});
it("should handle server errors during user update", async () => {
  prisma.user.findUnique.mockResolvedValue(testUser); // Ensure user is found
  prisma.user.update.mockRejectedValue(new Error("Database error"));
  const res = await request(app)
    .put(`/api/users/${testUser.id}`)
    .set("Authorization", "Bearer mocked_token")
    .send({ email: "updated@example.com" });

  expect(res.statusCode).toBe(500);
});

it("should handle server errors during user deletion", async () => {
  prisma.user.delete.mockRejectedValue(new Error("Database error"));
  const res = await request(app)
    .delete(`/api/users/${testUser.id}`)
    .set("Authorization", "Bearer mocked_token");

  expect(res.statusCode).toBe(500);
});
it("should return 404 if user not found when deleting", async () => {
  prisma.user.findUnique.mockResolvedValue(null); // Simulate user not found
  prisma.user.delete.mockResolvedValue(null); // Simulate user not found
  const res = await request(app)
    .delete(`/api/users/999`) // Non-existent ID
    .set("Authorization", "Bearer mocked_token");

  expect(res.statusCode).toBe(404);
  expect(prisma.user.delete).not.toHaveBeenCalled();
});
