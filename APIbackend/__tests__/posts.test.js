const request = require("supertest");
const { app, server } = require("../index");
const jwt = require("jsonwebtoken");

jest.mock("jsonwebtoken");
jest.mock("../prisma");
const prisma = require("../prisma");

describe("Post Routes", () => {
  let testPost;
  let testUser;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    testUser = { id: 1, username: "testuser", role: "author" };
    testPost = {
      id: 1,
      title: "Test Post",
      content: "This is a test post.",
      authorId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Set up JWT mock
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: 1, role: "author" });
    });

    // Configure prisma mock methods for testing
    prisma.post.findMany.mockResolvedValue([testPost]);
    prisma.post.findUnique.mockResolvedValue(testPost);
    prisma.post.create.mockResolvedValue(testPost);
    prisma.post.update.mockResolvedValue(testPost);
    prisma.post.delete.mockResolvedValue(undefined);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  it("should get all posts", async () => {
    const res = await request(app).get("/api/posts");
    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("should get a single post by ID", async () => {
    const res = await request(app).get(`/api/posts/${testPost.id}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.id).toEqual(testPost.id);
  });

  it("should return 404 if post is not found", async () => {
    prisma.post.findUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/posts/999");
    expect(res.statusCode).toEqual(404);
  });

  it("should create a new post", async () => {
    const newPost = { title: "New Post", content: "New content" };
    // Update the mockResolvedValue to match the expected data
    prisma.post.create.mockResolvedValue({
      id: 2,
      ...newPost,
      authorId: testUser.id,
      published: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send(newPost);

    expect(res.statusCode).toEqual(201);
    expect(res.body.title).toEqual(newPost.title);
    expect(prisma.post.create).toHaveBeenCalledWith({
      data: {
        title: newPost.title,
        content: newPost.content,
        authorId: testUser.id,
        published: true,
      },
    });
  });

  it("should return 400 if post data is invalid (create)", async () => {
    const invalidPost = { title: "" }; // Missing content
    const res = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send(invalidPost);

    expect(res.statusCode).toEqual(400);
    expect(res.body.errors).toBeDefined();
  });

  it("should update a post", async () => {
    const updatedPostData = {
      title: "Updated Title",
      content: "Updated content",
    };
    prisma.post.findUnique.mockResolvedValue(testPost); // Check exist
    prisma.post.update.mockResolvedValue({
      ...testPost,
      ...updatedPostData,
    });

    const res = await request(app)
      .put(`/api/posts/${testPost.id}`)
      .set("Authorization", "Bearer mocked_token")
      .send(updatedPostData);

    expect(res.statusCode).toEqual(200);
    expect(res.body.title).toEqual(updatedPostData.title);
    expect(prisma.post.update).toHaveBeenCalledWith({
      where: { id: testPost.id },
      data: updatedPostData,
    });
  });

  it("should return 400 if post data is invalid (update)", async () => {
    const invalidPost = { title: "" }; // Missing content
    const res = await request(app)
      .put(`/api/posts/${testPost.id}`)
      .set("Authorization", "Bearer mocked_token")
      .send(invalidPost);
    expect(res.statusCode).toEqual(400);
    expect(res.body.errors).toBeDefined();
  });

  it("should return 403 if unauthorized user tries to update a post", async () => {
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 2, role: "user" }); // Different user
    });

    const updatedPost = { title: "Updated Title", content: "Updated content" };
    const res = await request(app)
      .put(`/api/posts/${testPost.id}`)
      .set("Authorization", "Bearer mocked_token")
      .send(updatedPost);

    expect(res.statusCode).toBe(403);
    expect(prisma.post.update).not.toHaveBeenCalled();
  });

  it("should return 404 if trying to update a non-existent post", async () => {
    prisma.post.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .put(`/api/posts/999`) // Nonexistent post
      .set("Authorization", "Bearer mocked_token")
      .send({ title: "New Title", content: "New content" });

    expect(res.statusCode).toBe(404); // Not found
  });

  it("should delete a post", async () => {
    prisma.post.findUnique.mockResolvedValue(testPost); // Check exist

    const res = await request(app)
      .delete(`/api/posts/${testPost.id}`)
      .set("Authorization", "Bearer mocked_token");

    expect(res.statusCode).toEqual(204);
    expect(prisma.post.delete).toHaveBeenCalledWith({
      where: { id: testPost.id },
    });
  });

  it("should return 403 if unauthorized user tries to delete a post", async () => {
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 2, role: "user" }); // Simulate a different user trying to delete
    });
    const res = await request(app)
      .delete(`/api/posts/${testPost.id}`)
      .set("Authorization", "Bearer mocked_token");

    expect(res.statusCode).toBe(403);
    expect(prisma.post.delete).not.toHaveBeenCalled();
  });

  it("should return 404 if trying to delete a non-existent post", async () => {
    prisma.post.findUnique.mockResolvedValue(null); // Simulate the post not existing

    const res = await request(app)
      .delete(`/api/posts/999`) // Nonexistent post
      .set("Authorization", "Bearer mocked_token");

    expect(res.statusCode).toBe(404); // Not found
  });
});