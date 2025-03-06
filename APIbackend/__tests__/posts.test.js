const request = require("supertest");
const { app, prisma } = require("../index");
const jwt = require("jsonwebtoken");

describe("Post Routes", () => {
  let testUserId;
  let testPostId;
  let testPost;
  beforeEach(async () => {
    // Mock data for a user and a post.  Good practice to keep this within the
    // test file that needs it, for clarity and isolation.
    testPost = {
      id: 1,
      title: "Test Post",
      content: "Test Content",
      authorId: 1,
      published: true,
    };
    testUserId = 1;
    testPostId = 1;

    // Mock JWT verification to simulate a logged-in user.
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: testUserId, role: "user" });
    });

    // Mock Prisma methods.  This is *crucial* for isolating the tests.
    // We ONLY mock the methods used by *this* set of tests.
    prisma.post.create.mockResolvedValue(testPost);
    prisma.post.findUnique.mockImplementation(({ where }) =>
      where.id === testPostId
        ? Promise.resolve(testPost)
        : Promise.resolve(null)
    );
    prisma.post.findMany.mockResolvedValue([testPost]);
    prisma.post.update.mockImplementation(({ where, data }) =>
      Promise.resolve({ ...testPost, ...data })
    );
    prisma.post.delete.mockResolvedValue();

    const mockUser = {
      id: testUserId,
      email: "test@example.com",
      username: "testuser",
      password: "hashed_password",
      role: "user",
    };
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.email === "test@example.com" || where.id === testUserId) {
        return Promise.resolve(mockUser);
      }
      return Promise.resolve(null);
    });
    //pre making a post and user
    await request(app)
      .post("/api/users")
      .send({
        email: "test@example.com",
        username: "testuser",
        password: "password",
      });
  });

  afterEach(() => {
    jest.clearAllMocks(); // Essential: Clear mocks after each test!
  });

  it("should get all posts", async () => {
    const res = await request(app).get("/api/posts");
    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(prisma.post.findMany).toHaveBeenCalledTimes(1);
  });

  it("should get a specific post by ID", async () => {
    const res = await request(app).get(`/api/posts/${testPostId}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.id).toEqual(testPostId);
    expect(prisma.post.findUnique).toHaveBeenCalledWith({
      where: { id: testPostId },
      select: {
        id: true,
        title: true,
        content: true,
        authorId: true,
        published: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
    });
  });

  it("should return 404 if post not found", async () => {
    const res = await request(app).get("/api/posts/999");
    expect(res.statusCode).toEqual(404);
  });

  it("should create a new post", async () => {
    const newPost = {
      title: "New Post",
      content: "New Content",
      authorId: testUserId,
    };
    prisma.post.create.mockResolvedValue({
      id: 2,
      ...newPost,
      published: false,
    }); // Simulate creation

    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send(newPost);

    expect(res.statusCode).toEqual(201);
    expect(res.body.title).toEqual(newPost.title);
    expect(res.body.authorId).toBe(testUserId); // Verify the author
    expect(prisma.post.create).toHaveBeenCalledWith({
      data: {
        title: newPost.title,
        content: newPost.content,
        authorId: testUserId,
        published: false,
      },
    });
  });

  it("should return 400 if title is missing on POST /api/posts", async () => {
    const newPost = { content: "New Content", authorId: testUserId };
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send(newPost);
    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0].msg).toBe("Title is required");
  });
  it("should return 400 if content is missing on POST /api/posts", async () => {
    const newPost = { title: "New Title", authorId: testUserId };
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send(newPost);

    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0].msg).toBe("Content is required");
  });
  it("should return 500 if authorId is missing on POST /api/posts", async () => {
    const newPost = { title: "New Title", content: "New Content" };
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send(newPost);

    expect(res.statusCode).toBe(500); // Because it will fail internally.  No authorId in req.user
  });

  it("should update a post", async () => {
    const updatedPost = { title: "Updated Title", content: "Updated Content" };
    const res = await request(app)
      .put(`/api/posts/${testPostId}`)
      .set("Authorization", "Bearer mocked_token")
      .send(updatedPost);

    expect(res.statusCode).toEqual(200);
    expect(res.body.title).toEqual("Updated Title");
    expect(res.body.authorId).toEqual(testUserId); // Verify author didn't change
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: testPostId },
      data: updatedPost,
    });
  });

  it("should return 403 if unauthorized user tries to update", async () => {
    // Simulate a different author (user ID 999) trying to update the post.
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 999, role: "user" }); // Different user ID
    });

    const res = await request(app)
      .put(`/api/posts/${testPostId}`)
      .set("Authorization", "Bearer mocked_token")
      .send({ title: "Updated Title" });

    expect(res.statusCode).toBe(403);
    expect(prisma.post.update).not.toHaveBeenCalled(); // Ensure update was NOT called
  });

  it("should return 404 if post not found when updating", async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .put(`/api/posts/999`)
      .set("Authorization", "Bearer mocked_token")
      .send({ title: "Updated Title" });
    expect(res.statusCode).toBe(404);
  });

  it("should delete a post", async () => {
    const res = await request(app)
      .delete(`/api/posts/${testPostId}`)
      .set("Authorization", "Bearer mocked_token");

    expect(res.statusCode).toEqual(204);
    expect(prisma.post.delete).toHaveBeenCalledWith({
      where: { id: testPostId },
    });
  });

  it("should return 403 if unauthorized user tries to delete", async () => {
    // Simulate a different author (user ID 999) trying to delete.
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 999, role: "user" }); // Different user ID
    });

    const res = await request(app)
      .delete(`/api/posts/${testPostId}`)
      .set("Authorization", "Bearer mocked_token");

    expect(res.statusCode).toBe(403);
    expect(prisma.post.delete).not.toHaveBeenCalled(); // Ensure delete was not called
  });

  it("should return 404 if post not found when deleting", async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .delete(`/api/posts/999`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(404);
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
    prisma.post.findUnique.mockResolvedValue({
      id: testPostId,
      authorId: testUserId,
    });
    prisma.post.update.mockRejectedValue(new Error("Database error"));
    const res = await request(app)
      .put(`/api/posts/${testPostId}`)
      .set("Authorization", "Bearer mocked_token")
      .send({ title: "Updated Title" });
    expect(res.statusCode).toBe(500);
  });

  it("should handle server errors for DELETE requests", async () => {
    prisma.post.findUnique.mockResolvedValue({
      id: testPostId,
      authorId: testUserId,
    });
    prisma.post.delete.mockRejectedValue(new Error("Database error"));
    const res = await request(app)
      .delete(`/api/posts/${testPostId}`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(500);
  });
});
