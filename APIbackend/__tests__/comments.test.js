const request = require("supertest");
const { app, server } = require("../index");
const jwt = require("jsonwebtoken");

jest.mock("jsonwebtoken");
jest.mock("../prisma");
const prisma = require("../prisma");

describe("Comment Routes", () => {
  let testComment;
  let testUser;
  let testPost;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    testUser = { id: 1, username: "testuser", role: "author" };
    testPost = {
      id: 1,
      title: "Test Post",
      content: "Post Content",
      authorId: 1,
    };
    testComment = {
      id: 1,
      content: "This is a test comment.",
      postId: 1,
      authorId: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Set up JWT mock
    jwt.verify.mockImplementation((token, secret, callback) => {
      callback(null, { userId: 1, role: "author" });
    });

    // Configure prisma mock methods for testing
    prisma.comment.findMany.mockResolvedValue([testComment]);
    prisma.comment.findUnique.mockResolvedValue(testComment);
    prisma.comment.create.mockResolvedValue(testComment);
    prisma.comment.update.mockResolvedValue(testComment);
    prisma.comment.delete.mockResolvedValue(undefined);
    prisma.post.findUnique.mockResolvedValue(testPost);
  });

  afterAll(() => {
    if (server) {
      server.close();
    }
  });

  it("should get all comments for a post", async () => {
    const res = await request(app).get(`/api/comments/post/${testPost.id}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it("should get a single comment by ID", async () => {
    const res = await request(app).get(`/api/comments/${testComment.id}`);
    expect(res.statusCode).toEqual(200);
    expect(res.body.id).toEqual(testComment.id);
  });

  it("should return 404 if comment is not found", async () => {
    prisma.comment.findUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/comments/999");
    expect(res.statusCode).toEqual(404);
  });

  it("should create a new comment", async () => {
    const newComment = { content: "New Comment", postId: testPost.id };
    // Update the mockResolvedValue to match the expected data
    prisma.comment.create.mockResolvedValue({
      id: 2,
      content: "New Comment",
      postId: testPost.id,
      authorId: testUser.id,
      createdAt: new Date(),
      updatedAt: new Date(),
      author: testUser
    });
    
    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", "Bearer mocked_token")
      .send(newComment);

    expect(res.statusCode).toEqual(201);
    expect(res.body.content).toEqual(newComment.content);
    expect(prisma.comment.create).toHaveBeenCalledWith({
      data: {
        content: newComment.content,
        postId: newComment.postId,
        authorId: testUser.id,
      },
      include: {
        author: { select: { id: true, username: true, email: true } },
      },
    });
  });

  it("should return 400 if comment data is invalid (create)", async () => {
    const invalidComment = { content: "" }; // Missing content
    const res = await request(app)
      .post("/api/comments")
      .set("Authorization", "Bearer mocked_token")
      .send(invalidComment);

    expect(res.statusCode).toEqual(400);
    expect(res.body.errors).toBeDefined();
  });

  it("should update a comment", async () => {
    const updatedCommentData = { content: "Updated Comment" };
    
    // Fix test comment with proper userId structure - needs req.user.id to match authorId
    const testCommentWithUserId = {
      ...testComment,
      authorId: 1
    };
    
    prisma.comment.findUnique.mockResolvedValue(testCommentWithUserId);
    prisma.comment.update.mockResolvedValue({
      ...testCommentWithUserId,
      ...updatedCommentData,
      author: testUser
    });

    const res = await request(app)
      .put(`/api/comments/${testComment.id}`)
      .set("Authorization", "Bearer mocked_token")
      .send(updatedCommentData);

    expect(res.statusCode).toEqual(200);
    expect(res.body.content).toEqual(updatedCommentData.content);
    expect(prisma.comment.update).toHaveBeenCalledWith({
      where: { id: testComment.id },
      data: updatedCommentData,
      include: {
        author: { select: { id: true, username: true, email: true } },
      },
    });
  });

  it("should return 400 if comment data is invalid (update)", async () => {
    const invalidComment = { content: "" }; // Missing content
    const res = await request(app)
      .put(`/api/comments/${testComment.id}`)
      .set("Authorization", "Bearer mocked_token")
      .send(invalidComment);

    expect(res.statusCode).toEqual(400); // Expect a validation error
    expect(res.body.errors).toBeDefined();
  });

  it("should return 403 if unauthorized user tries to update comment", async () => {
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 2, role: "user" }); // Different user
    });

    const updatedComment = { content: "Updated content" };
    const res = await request(app)
      .put(`/api/comments/${testComment.id}`)
      .set("Authorization", "Bearer mocked_token")
      .send(updatedComment);

    expect(res.statusCode).toBe(403);
    expect(prisma.comment.update).not.toHaveBeenCalled();
  });

  it("should return 404 if trying to update a non-existent comment", async () => {
    prisma.comment.findUnique.mockResolvedValue(null); // No comment exists
    
    // Add validation mock to pass validation
    const validContent = { content: "Valid content for testing" };

    const res = await request(app)
      .put(`/api/comments/999`) // Non-existent comment
      .set("Authorization", "Bearer mocked_token")
      .send(validContent);

    expect(res.statusCode).toBe(404); // Not found
  });

  it("should delete a comment", async () => {
    prisma.comment.findUnique.mockResolvedValue(testComment);
    const res = await request(app)
      .delete(`/api/comments/${testComment.id}`)
      .set("Authorization", "Bearer mocked_token");

    expect(res.statusCode).toEqual(204);
    expect(prisma.comment.delete).toHaveBeenCalledWith({
      where: { id: testComment.id },
    });
  });

  it("should return 403 if unauthorized user tries to delete comment", async () => {
    jwt.verify.mockImplementationOnce((token, secret, callback) => {
      callback(null, { userId: 2, role: "user" });
    });
    const res = await request(app)
      .delete(`/api/comments/${testComment.id}`)
      .set("Authorization", "Bearer mocked_token");

    expect(res.statusCode).toBe(403);
    expect(prisma.comment.delete).not.toHaveBeenCalled();
  });

  it("should return 404 if trying to delete a non-existent comment", async () => {
    prisma.comment.findUnique.mockResolvedValue(null); //No comment to delete

    const res = await request(app)
      .delete(`/api/comments/999`) //Non-existent comment
      .set("Authorization", "Bearer mocked_token");
    expect(res.statusCode).toBe(404); // Not found
  });
});