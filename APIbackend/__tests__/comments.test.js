// __tests__/comments.test.js
const request = require("supertest");
const { app, prisma, server } = require("../index"); // Import app, prisma, and server
const jwt = require("jsonwebtoken");

describe("Comment Routes", () => {
  const testUserId = 1;
  const testPostId = 1;
  const testCommentId = 1;
  const mockComment = {
    id: testCommentId,
    content: "Test Comment",
    postId: testPostId,
    authorId: testUserId,
  };
  const mockPost = {
    id: 1,
    title: "Test Post",
    content: "Test Content",
    authorId: 1,
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
    // Mock authentication
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: testUserId, role: "user" });
    });

    // Mock Prisma methods *for this file's tests*
    prisma.comment.findMany.mockReset();
    prisma.comment.findUnique.mockReset();
    prisma.comment.create.mockReset();
    prisma.comment.update.mockReset();
    prisma.comment.delete.mockReset();
    prisma.post.findUnique.mockReset();

    prisma.comment.findMany.mockResolvedValue([mockComment]);
    prisma.comment.findUnique.mockImplementation(({ where }) =>
      where.id === testCommentId
        ? Promise.resolve(mockComment)
        : Promise.resolve(null)
    );
    prisma.comment.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 2, ...data })
    );
    prisma.comment.update.mockImplementation(({ where, data }) =>
      Promise.resolve({ ...mockComment, ...data })
    );
    prisma.comment.delete.mockResolvedValue();
    prisma.post.findUnique.mockImplementation(({ where }) =>
      where.id === testPostId
        ? Promise.resolve(mockPost)
        : Promise.resolve(null)
    );
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

  it("should get all comments for a post", async () => {
    const res = await request(app).get(`/api/comments/post/${testPostId}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
  });

  it("should get a comment by ID", async () => {
    const res = await request(app).get(`/api/comments/${testCommentId}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.id).toBe(testCommentId);
  });

  it("should create a new comment", async () => {
    const newComment = {
      content: "My New Comment",
      postId: testPostId,
      authorId: testUserId,
    };
    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", "Bearer mocked_token")
      .send(newComment);
    expect(res.statusCode).toBe(201);
  });

  it("should update comment", async () => {
    const updatedComment = { content: "Updated Comment" };
    prisma.comment.findUnique.mockResolvedValue(mockComment);
    const res = await request(app)
      .put(`/api/comments/${testCommentId}`)
      .set("Authorization", `Bearer mocked_token`)
      .send(updatedComment);
    expect(res.statusCode).toBe(200);
  });

  it("should delete comment", async () => {
    prisma.comment.findUnique.mockResolvedValue(mockComment);
    const res = await request(app)
      .delete(`/api/comments/${testCommentId}`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(204);
  });

  it("should return 404 if comment not found on GET /api/comments/:id", async () => {
    prisma.comment.findUnique.mockResolvedValue(null);

    const response = await request(app).get(`/api/comments/999`); // Non-existent ID
    expect(response.statusCode).toBe(404);
  });

  it("should return 404 if post not found when getting comments", async () => {
    prisma.post.findUnique.mockResolvedValue(null); // Simulate post not found.
    const res = await request(app).get(`/api/comments/post/999`);
    expect(res.statusCode).toEqual(404);
  });
  it("should return 403 if unauthorized user tries to update", async () => {
    prisma.comment.findUnique.mockResolvedValue({
      id: testCommentId,
      authorId: 2,
    }); // Simulate different author.

    const res = await request(app)
      .put(`/api/comments/${testCommentId}`)
      .set("Authorization", "Bearer mocked_token") // Correct token for userId 1
      .send({ content: "Updated Comment" });

    expect(res.statusCode).toBe(403);
    expect(prisma.comment.update).not.toHaveBeenCalled();
  });
  it("should return 403 if unauthorized user tries to delete", async () => {
    prisma.comment.findUnique.mockResolvedValue({
      id: testCommentId,
      authorId: 2,
    }); // Simulate different author

    const res = await request(app)
      .delete(`/api/comments/${testCommentId}`)
      .set("Authorization", "Bearer mocked_token"); // Simulate logged-in user
    expect(res.statusCode).toBe(403);
  });
  it("should return 400 if postId is invalid in create", async () => {
    const newComment = {
      content: "New Comment",
      postId: "invalid",
      authorId: testUserId,
    };
    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", "Bearer mocked_token")
      .send(newComment);

    expect(res.statusCode).toEqual(400);
  });
  it("should return 400 if authorId is invalid in create", async () => {
    const newComment = {
      content: "New Comment",
      postId: testPostId,
      authorId: "invalid",
    };
    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", "Bearer mocked_token")
      .send(newComment);

    expect(res.statusCode).toBe(400);
  });
  it("should handle server errors during comment retrieval by ID", async () => {
    prisma.comment.findUnique.mockRejectedValue(new Error("Database error"));
    const res = await request(app).get(`/api/comments/${testCommentId}`);
    expect(res.statusCode).toBe(500);
  });

  it("should handle server errors when updating", async () => {
    prisma.comment.findUnique.mockResolvedValue(mockComment);
    prisma.comment.update.mockRejectedValue(new Error("Database error"));
    const res = await request(app)
      .put(`/api/comments/${testCommentId}`)
      .set("Authorization", "Bearer mocked_token")
      .send({ content: "new content" });
    expect(res.statusCode).toBe(500);
  });

  it("should handle server errors when deleting", async () => {
    prisma.comment.findUnique.mockResolvedValue(mockComment);
    prisma.comment.delete.mockRejectedValue(new Error("Database error"));
    const res = await request(app)
      .delete(`/api/comments/${testCommentId}`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(500);
  });
});
