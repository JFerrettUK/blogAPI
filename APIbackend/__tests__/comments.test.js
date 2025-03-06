// __tests__/comments.test.js (Continued)

const request = require("supertest");
const { app, prisma } = require("../index"); // THIS IS THE PROBLEM
const jwt = require("jsonwebtoken");

describe("Comments API Endpoints", () => {
  let testUserId;
  let testPostId;
  let testCommentId;
  let mockComment;
  let mockPost;

  beforeEach(async () => {
    // Mock data
    mockComment = { id: 1, content: "Test Comment", postId: 1, authorId: 1 };
    mockPost = {
      id: 1,
      title: "Test Post",
      content: "Test Content",
      authorId: 1,
      published: true,
    };
    const mockUser = {
      id: 1,
      email: "test@example.com",
      username: "testuser",
      password: "hashed_password",
      role: "user",
    };

    // Prisma mocks (consistent mocking)
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.email === "test@example.com" || where.id === mockUser.id) {
        return Promise.resolve(mockUser);
      } else {
        return Promise.resolve(null);
      }
    });
    prisma.post.findUnique.mockImplementation(({ where }) =>
      where.id === mockPost.id
        ? Promise.resolve(mockPost)
        : Promise.resolve(null)
    );
    prisma.comment.findUnique.mockImplementation(({ where }) =>
      where.id === testCommentId
        ? Promise.resolve(mockComment)
        : Promise.resolve(null)
    );
    prisma.comment.findMany.mockResolvedValue([mockComment]);
    prisma.comment.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 2, ...data })
    );
    prisma.comment.update.mockImplementation(({ where, data }) =>
      Promise.resolve({ ...mockComment, ...data })
    );
    prisma.comment.delete.mockResolvedValue();

    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: mockUser.id, role: mockUser.role });
    });

    // Create user and post for testing context (important for foreign keys)
    const userRes = await request(app).post("/api/users").send({
      email: "test@example.com",
      username: "testuser",
      password: "password",
    });
    testUserId = userRes.body.id;
    const postRes = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send({
        title: "Test Post",
        content: "Test Content",
        authorId: testUserId,
      });
    testPostId = postRes.body.id;
    const commentRes = await request(app)
      .post("/api/comments")
      .set("Authorization", "Bearer mocked_token")
      .send({
        content: "Test Comment",
        postId: testPostId,
        authorId: testUserId,
      });
    testCommentId = commentRes.body.id;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should get all comments for a post", async () => {
    const res = await request(app).get(`/api/comments/post/${testPostId}`);
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0); // Now we expect *at least* one
    expect(res.body[0].postId).toBe(testPostId); //and check the returned postId
    expect(prisma.comment.findMany).toHaveBeenCalledWith({
      where: { postId: testPostId },
      include: { author: true },
    });
  });

  it("should return 404 if post not found when getting comments", async () => {
    prisma.post.findUnique.mockResolvedValue(null); // Simulate no post found
    const res = await request(app).get(`/api/comments/post/999`);
    expect(res.statusCode).toEqual(404);
  });

  it("should get a specific comment by ID", async () => {
    const res = await request(app).get(`/api/comments/${testCommentId}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.id).toEqual(testCommentId);
    expect(prisma.comment.findUnique).toHaveBeenCalledWith({
      where: { id: testCommentId },
      include: { author: true },
    });
  });

  it("should return 404 if comment not found (GET)", async () => {
    prisma.comment.findUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/comments/999");
    expect(res.statusCode).toEqual(404);
  });

  it("should create a new comment", async () => {
    const newComment = {
      content: "New Comment",
      postId: testPostId,
      authorId: testUserId,
    };
    prisma.comment.create.mockResolvedValue({ id: 2, ...newComment });

    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", "Bearer mocked_token")
      .send(newComment);

    expect(res.statusCode).toEqual(201);
    expect(res.body.content).toEqual(newComment.content);
    expect(res.body.postId).toBe(testPostId);
    expect(res.body.authorId).toBe(testUserId);
    expect(prisma.comment.create).toHaveBeenCalledWith({
      data: {
        content: newComment.content,
        postId: testPostId,
        authorId: testUserId,
      },
    });
  });

  it("should return 400 if comment content is missing", async () => {
    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", "Bearer mocked_token")
      .send({ postId: testPostId, authorId: testUserId });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0].msg).toBe("Comment content is required.");
  });

  it("should return 400 if postId is invalid when creating comment", async () => {
    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", "Bearer mocked_token")
      .send({
        content: "New Comment",
        authorId: testUserId,
        postId: "invalid",
      });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0].msg).toBe("Post ID must be an integer.");
  });

  it("should return 400 if authorId is invalid when creating comment", async () => {
    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", "Bearer mocked_token")
      .send({
        content: "New Comment",
        postId: testPostId,
        authorId: "invalid",
      });
    expect(res.statusCode).toBe(400);
    expect(res.body.errors[0].msg).toBe("Author ID must be an integer.");
  });

  it("should return 400 if invalid post ID when creating comment", async () => {
    prisma.post.findUnique.mockResolvedValue(null); // Simulate post not found
    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", "Bearer mocked_token")
      .send({ content: "New Comment", postId: 999, authorId: testUserId }); // Invalid post ID

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe("Invalid post ID or author ID");
  });

  it("should update a comment", async () => {
    const updatedComment = { content: "Updated Comment" };
    prisma.comment.findUnique.mockResolvedValue({
      id: testCommentId,
      authorId: testUserId,
      content: "original content",
      postId: 1,
    });
    prisma.comment.update.mockResolvedValue({
      id: testCommentId,
      ...updatedComment,
    });

    const res = await request(app)
      .put(`/api/comments/${testCommentId}`)
      .set("Authorization", "Bearer mocked_token")
      .send(updatedComment);

    expect(res.statusCode).toEqual(200);
    expect(res.body.content).toEqual("Updated Comment");
    expect(prisma.comment.update).toHaveBeenCalledWith({
      where: { id: testCommentId },
      data: updatedComment,
    });
  });

  it("should return 403 if unauthorized user tries to update", async () => {
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 999, role: "user" });
    });

    const res = await request(app)
      .put(`/api/comments/${testCommentId}`)
      .set("Authorization", "Bearer mocked_token")
      .send({ content: "Updated Comment" });

    expect(res.statusCode).toBe(403);
    expect(prisma.comment.update).not.toHaveBeenCalled();
  });

  it("should return 404 if comment not found during update", async () => {
    prisma.comment.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .put(`/api/comments/999`)
      .set("Authorization", "Bearer mocked_token")
      .send({ content: "Updated Content" });
    expect(res.statusCode).toBe(404);
  });

  it("should delete a comment", async () => {
    prisma.comment.findUnique.mockResolvedValue({
      id: testCommentId,
      authorId: testUserId,
    });
    prisma.comment.delete.mockResolvedValue();

    const res = await request(app)
      .delete(`/api/comments/${testCommentId}`)
      .set("Authorization", "Bearer mocked_token");

    expect(res.statusCode).toEqual(204);
    expect(prisma.comment.delete).toHaveBeenCalledWith({
      where: { id: testCommentId },
    });
  });

  it("should return 403 if unauthorized user tries to delete a comment", async () => {
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 999, role: "user" });
    });
    const res = await request(app)
      .delete(`/api/comments/${testCommentId}`)
      .set("Authorization", "Bearer mocked_token");

    expect(res.statusCode).toBe(403);
    expect(prisma.comment.delete).not.toHaveBeenCalled();
  });

  it("should return 404 if comment not found when deleting", async () => {
    prisma.comment.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .delete(`/api/comments/999`) // Non-existent ID
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(404);
  });

  it("should handle server errors during comment retrieval by ID", async () => {
    prisma.comment.findUnique.mockRejectedValue(new Error("Database error"));
    const res = await request(app).get(`/api/comments/${testCommentId}`);
    expect(res.statusCode).toBe(500);
  });

  it("should handle server errors when updating", async () => {
    prisma.comment.findUnique.mockResolvedValue({
      id: testCommentId,
      authorId: testUserId,
    });
    prisma.comment.update.mockRejectedValue(new Error("Database error"));
    const res = await request(app)
      .put(`/api/comments/${testCommentId}`)
      .set("Authorization", "Bearer mocked_token")
      .send({ content: "new content" });
    expect(res.statusCode).toBe(500);
  });

  it("should handle server errors when deleting", async () => {
    prisma.comment.findUnique.mockResolvedValue({
      id: testCommentId,
      authorId: testUserId,
    });
    prisma.comment.delete.mockRejectedValue(new Error("Database error"));
    const res = await request(app)
      .delete(`/api/comments/${testCommentId}`)
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(500);
  });
});
