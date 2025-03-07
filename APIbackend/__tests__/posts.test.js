// __tests__/posts.test.js
const request = require("supertest");
const { app, prisma, server } = require("../index"); // Import app, prisma, and server
const jwt = require("jsonwebtoken");

describe("Post Routes", () => {
  const testUserId = 1;
  const testPostId = 1;
  const testUser = {
    id: testUserId,
    email: "test@example.com",
    username: "testuser",
    password: "hashed_password",
    role: "user",
  };
  const testPost = {
    id: testPostId,
    title: "Test Post",
    content: "Test Content",
    authorId: testUserId,
    published: true,
  };

  beforeAll((done) => {
    if (!server) {
      app.listen(3001, () => {
        console.log("Test server running on port 3001");
        done();
      });
    } else {
      done();
    }
  });

  beforeEach(() => {
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: testUserId, role: "user" });
    });

    // Mock Prisma methods *for this file's tests*
    prisma.post.findMany.mockReset();
    prisma.post.findUnique.mockReset();
    prisma.post.create.mockReset();
    prisma.post.update.mockReset();
    prisma.post.delete.mockReset();
    prisma.user.findUnique.mockReset();

    prisma.post.findMany.mockResolvedValue([testPost]);
    prisma.post.findUnique.mockImplementation(async ({ where }) => {
      if (where.id === testPostId) {
        return testPost;
      } else {
        return null;
      }
    });
    prisma.post.create.mockImplementation(async ({ data }) => ({
      id: 2,
      ...data,
    })); // Simulate ID generation
    prisma.post.update.mockImplementation(async ({ where, data }) => ({
      ...testPost,
      ...data,
    }));
    prisma.post.delete.mockResolvedValue();
    prisma.user.findUnique.mockResolvedValue(testUser);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    if (server) {
      await server.close();
    }
    await prisma.$disconnect();
  });

  it("should get all posts", async () => {
    const res = await request(app).get("/api/posts");
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("should get a post by ID", async () => {
    const res = await request(app).get(`/api/posts/${testPostId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(testPostId);
  });

  it("should return 404 if post not found on GET /api/posts/:id", async () => {
    prisma.post.findUnique.mockResolvedValue(null);

    const response = await request(app).get(`/api/posts/999`); // Non-existent ID
    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe("Post not found");
  });

  it("should create a new post", async () => {
    const newPost = {
      title: "New Post",
      content: "New Content",
      authorId: testUserId,
    };
    prisma.post.create.mockResolvedValue({ id: 2, ...newPost });
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send(newPost);
    expect(res.statusCode).toBe(201);
  });

  it("should return 400 if title is missing on POST /api/posts", async () => {
    const newPost = { content: "New Content", authorId: testUserId };
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send(newPost);
    expect(res.statusCode).toBe(400);
  });
  it("should return 400 if content is missing on POST /api/posts", async () => {
    const newPost = { title: "New Title", authorId: testUserId };
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send(newPost);

    expect(res.statusCode).toBe(400);
  });

  it("should return 403 if unauthorized user attempts to post on POST /api/posts", async () => {
    // Set up a different user in the token.
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 999, role: "user" }); // Different user ID
    });

    const newPost = {
      title: "New Post",
      content: "New Content",
      authorId: testUserId,
    };
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send(newPost);

    expect(res.statusCode).toBe(403);
    expect(prisma.post.create).not.toHaveBeenCalled(); // Verify create wasn't called.
  });

  it("should update a post", async () => {
    const updatedPost = { title: "Updated Title", content: "Updated Content" };
    prisma.post.findUnique.mockResolvedValue(testPost);
    prisma.post.update.mockResolvedValue({ ...testPost, ...updatedPost });

    const res = await request(app)
      .put(`/api/posts/${testPostId}`)
      .set("Authorization", "Bearer mocked_token")
      .send(updatedPost);

    expect(res.statusCode).toBe(200);
    expect(res.body.title).toBe("Updated Title");
    expect(res.body.content).toBe("Updated Content");
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: testPostId },
      data: updatedPost,
    });
  });

  it("should return 404 if post not found when updating", async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .put(`/api/posts/999`)
      .set("Authorization", "Bearer mocked_token")
      .send({ title: "Updated Title" });
    expect(res.statusCode).toBe(404);
  });

  it("should return 403 if unauthorized user tries to update", async () => {
    prisma.post.findUnique.mockResolvedValue({ id: testPostId, authorId: 2 }); // Simulate different author
    const res = await request(app)
      .put(`/api/posts/${testPostId}`)
      .set("Authorization", "Bearer mocked_token")
      .send({ title: "Updated Title" });
    expect(res.statusCode).toBe(403);
  });

  it("should delete a post", async () => {
    prisma.post.findUnique.mockResolvedValue(testPost);
    prisma.post.delete.mockResolvedValue();
    const res = await request(app)
      .delete(`/api/posts/${testPostId}`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(204);
    expect(prisma.post.delete).toHaveBeenCalledWith({
      where: { id: testPostId },
    });
  });

  it("should return 404 if post not found when deleting", async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .delete(`/api/posts/999`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(404);
  });

  it("should return 403 if unauthorized user tries to delete", async () => {
    prisma.post.findUnique.mockResolvedValue({ id: testPostId, authorId: 2 });
    const res = await request(app)
      .delete(`/api/posts/${testPostId}`)
      .set("Authorization", "Bearer mocked_token"); // Simulate logged-in user
    expect(res.statusCode).toBe(403);
  });

  it("should handle server errors for GET requests", async () => {
    prisma.post.findMany.mockRejectedValue(new Error("Database error"));
    const res = await request(app).get("/api/posts");
    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
  });

  it("should handle server errors for POST requests", async () => {
    prisma.post.create.mockRejectedValue(new Error("Database error"));
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send({ title: "New Post", content: "New Content", authorId: 1 });
    expect(res.statusCode).toBe(500);
  });

  it("should handle server errors for PUT requests", async () => {
    prisma.post.findUnique.mockResolvedValue(testPost);
    prisma.post.update.mockRejectedValue(new Error("Database error"));
    const res = await request(app)
      .put(`/api/posts/${testPostId}`)
      .set("Authorization", "Bearer mocked_token")
      .send({ title: "Updated Title" });
    expect(res.statusCode).toBe(500);
  });

  it("should handle server errors for DELETE requests", async () => {
    prisma.post.findUnique.mockResolvedValue(testPost);
    prisma.post.delete.mockRejectedValue(new Error("Database error"));
    const res = await request(app)
      .delete(`/api/posts/${testPostId}`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(500);
  });
});
