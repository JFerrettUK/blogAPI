const request = require("supertest");
const { app, server, prisma } = require("../index");

// Mock the entire Prisma client.  This is a cleaner approach for unit testing.
jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn(() => ({
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    post: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    comment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    $disconnect: jest.fn(),
  })),
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mocked_token"),
  verify: jest.fn((token, secret, callback) => {
    callback(null, { userId: 1, role: "user" }); // Default user
  }),
}));

describe("API Endpoint Tests", () => {
  let userId;
  let postId;
  let commentId;

  beforeAll(async () => {
    // Simplified setup: mock return values directly
    const mockUser = {
      id: 1,
      email: "test@example.com",
      username: "testuser",
      password: "hashed_password",
    };
    const mockPost = {
      id: 1,
      title: "Test Post",
      content: "Test Content",
      authorId: 1,
      published: true,
    };
    const mockComment = {
      id: 1,
      content: "Test Comment",
      postId: 1,
      authorId: 1,
    };

    prisma.user.create.mockResolvedValue(mockUser);
    prisma.user.findUnique.mockImplementation(({ where }) => {
      if (where.email === "test@example.com" || where.id === 1)
        return Promise.resolve(mockUser);
      return Promise.resolve(null);
    });
    prisma.post.create.mockResolvedValue(mockPost);
    prisma.post.findUnique.mockImplementation(({ where }) =>
      where.id === 1 ? Promise.resolve(mockPost) : Promise.resolve(null)
    );
    prisma.post.findMany.mockResolvedValue([mockPost]);
    prisma.comment.create.mockResolvedValue(mockComment);
    prisma.comment.findUnique.mockImplementation(({ where }) =>
      where.id === 1 ? Promise.resolve(mockComment) : Promise.resolve(null)
    );
    prisma.comment.findMany.mockResolvedValue([mockComment]);
    prisma.user.update.mockImplementation(({ where, data }) =>
      Promise.resolve({ ...mockUser, ...data })
    );
    prisma.post.update.mockImplementation(({ where, data }) =>
      Promise.resolve({ ...mockPost, ...data })
    );
    prisma.comment.update.mockImplementation(({ where, data }) =>
      Promise.resolve({ ...mockComment, ...data })
    );
    prisma.user.delete.mockResolvedValue();
    prisma.post.delete.mockResolvedValue();
    prisma.comment.delete.mockResolvedValue();

    // Create a user and post for consistent setup
    const userRes = await request(app)
      .post("/api/users")
      .send({
        email: "test@example.com",
        username: "testuser",
        password: "password",
      });
    userId = userRes.body.id;
    const postRes = await request(app)
      .post("/api/posts")
      .set("Authorization", "Bearer mocked_token")
      .send({ title: "Test Post", content: "Test Content", authorId: userId });
    postId = postRes.body.id;
    const commentRes = await request(app)
      .post("/api/comments")
      .set("Authorization", "Bearer mocked_token")
      .send({ content: "Test Comment", postId: postId, authorId: userId });
    commentId = commentRes.body.id;
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await prisma.$disconnect();
    server.close();
  });

  describe("User Routes", () => {
    it("GET /api/users - should return all users (admin only)", async () => {
      const res = await request(app)
        .get("/api/users")
        .set("Authorization", "Bearer mocked_token");
      expect(res.statusCode).toBe(403); // Expect 403, not 200, because of authorization

      jwt.verify.mockImplementationOnce((token, secret, callback) => {
        callback(null, { userId: 1, role: "admin" }); // Simulate a valid token for admin
      });
      const res2 = await request(app)
        .get("/api/users")
        .set("Authorization", "Bearer mocked_token");
      expect(res2.statusCode).toBe(200);
      expect(Array.isArray(res2.body)).toBe(true);
    });

    it("GET /api/users/:id - should return a single user", async () => {
      const res = await request(app)
        .get(`/api/users/${userId}`)
        .set("Authorization", "Bearer mocked_token");
      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(userId);
    });

    it("GET /api/users/:id - should return 404 for non-existent user", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .get(`/api/users/999`)
        .set("Authorization", "Bearer mocked_token");
      expect(res.statusCode).toBe(404);
    });

    it("POST /api/users - should create a new user", async () => {
      const newUser = {
        email: "newuser@example.com",
        username: "newuser",
        password: "newpassword",
      };
      prisma.user.create.mockResolvedValue({ id: 2, ...newUser }); // Simulate successful creation

      const res = await request(app).post("/api/users").send(newUser);
      expect(res.statusCode).toBe(201);
      expect(res.body.email).toBe(newUser.email);
      expect(res.body).not.toHaveProperty("password"); // Check password is not returned
    });

    it("POST /api/users - should return 400 for invalid input", async () => {
      const res = await request(app)
        .post("/api/users")
        .send({ email: "invalid" }); // Invalid email
      expect(res.statusCode).toBe(400);
    });

    it("POST /api/users - should return 409 if user exists", async () => {
      const newUser = {
        email: "test@example.com",
        username: "testuser",
        password: "password",
      };
      prisma.user.findUnique.mockResolvedValue(newUser);

      const res = await request(app).post("/api/users").send(newUser);

      expect(res.statusCode).toBe(409);
      expect(res.body).toEqual({ message: "Email already in use" });
    });

    it("PUT /api/users/:id - should update a user", async () => {
      const updatedUserData = { username: "updateduser" };
      const res = await request(app)
        .put(`/api/users/${userId}`)
        .set("Authorization", "Bearer mocked_token")
        .send(updatedUserData);
      expect(res.statusCode).toBe(200);
      expect(res.body.username).toBe("updateduser");

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: updatedUserData,
      });
    });

    it("PUT /api/users/:id - should return 403 if unauthorized user", async () => {
      jwt.verify.mockImplementationOnce((token, secret, callback) => {
        callback(null, { userId: 2, role: "user" }); // Different user ID
      });

      const res = await request(app)
        .put(`/api/users/1`) // Trying to update user 1
        .set("Authorization", "Bearer mocked_token")
        .send({ username: "updateduser2" });
      expect(res.statusCode).toBe(403);
    });

    it("DELETE /api/users/:id - should delete a user", async () => {
      const res = await request(app)
        .delete(`/api/users/${userId}`)
        .set("Authorization", "Bearer mocked_token");
      expect(res.statusCode).toBe(204);
    });

    it("should return 404 if user is not found during delete", async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .delete(`/api/users/999`)
        .set("Authorization", "Bearer mocked_token");
      expect(res.statusCode).toBe(404);
    });

    it("should return 403 if unauthorized user tries to delete", async () => {
      jwt.verify.mockImplementationOnce((token, secret, callback) => {
        callback(null, { userId: 999, role: "user" }); // Different user ID, not admin
      });
      const res = await request(app)
        .delete(`/api/users/${userId}`)
        .set("Authorization", "Bearer mocked_token");
      expect(res.statusCode).toBe(403);
    });
  });

  describe("Post Routes", () => {
    it("should create a new post on POST /api/posts", async () => {
      const newPost = {
        title: "New Post",
        content: "New Content",
        authorId: userId,
      };
      prisma.post.create.mockResolvedValue({ id: 2, ...newPost }); // Mock the database call

      const res = await request(app)
        .post("/api/posts")
        .set("Authorization", "Bearer mocked_token") // Simulate an authenticated request
        .send(newPost);

      expect(res.statusCode).toBe(201);
      expect(res.body.title).toBe(newPost.title);
      expect(prisma.post.create).toHaveBeenCalledWith({ data: newPost }); // Verify Prisma was called correctly
    });

    it("should get all posts on GET /api/posts", async () => {
      prisma.post.findMany.mockResolvedValue([
        { id: 1, title: "Test Post", content: "Test Content" },
      ]);
      const res = await request(app).get("/api/posts");
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual([
        { id: 1, title: "Test Post", content: "Test Content" },
      ]);
    });

    it("should get a single post on GET /api/posts/:id", async () => {
      prisma.post.findUnique.mockResolvedValue({
        id: postId,
        title: "Test Post",
        content: "Test Content",
      });
      const res = await request(app).get(`/api/posts/${postId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(postId);
    });

    it("should return 404 if post not found on GET /api/posts/:id", async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      const res = await request(app).get("/api/posts/999"); // Non-existent ID
      expect(res.statusCode).toBe(404);
    });

    it("should update a post on PUT /api/posts/:id", async () => {
      const updatedPost = {
        title: "Updated Title",
        content: "Updated Content",
        published: true,
      };
      prisma.post.findUnique.mockResolvedValue({ id: 1, authorId: 1 });
      prisma.post.update.mockResolvedValue({ id: 1, ...updatedPost });
      const res = await request(app)
        .put("/api/posts/1")
        .set("Authorization", "Bearer mocked_token")
        .send(updatedPost);
      expect(res.statusCode).toBe(200);
      expect(res.body.title).toBe("Updated Title");
    });

    it("should return 404 if post is not found for update", async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .put("/api/posts/999")
        .set("Authorization", "Bearer mocked_token")
        .send({ title: "Updated Title" });
      expect(res.statusCode).toBe(404);
    });

    it("should return 403 if user is not the author or admin", async () => {
      prisma.post.findUnique.mockResolvedValue({ id: postId, authorId: 2 }); // Simulate different author
      const res = await request(app)
        .put(`/api/posts/${postId}`)
        .set("Authorization", "Bearer mocked_token")
        .send({ title: "Updated Title" });
      expect(res.statusCode).toBe(403);
    });

    it("should delete a post on DELETE /api/posts/:id", async () => {
      prisma.post.findUnique.mockResolvedValue({
        id: postId,
        authorId: userId,
      });
      prisma.post.delete.mockResolvedValue();

      const res = await request(app)
        .delete(`/api/posts/${postId}`)
        .set("Authorization", "Bearer mocked_token");
      expect(res.statusCode).toBe(204);
      expect(prisma.post.delete).toHaveBeenCalledWith({
        where: { id: postId },
      });
    });

    it("should return 404 if post is not found for delete", async () => {
      prisma.post.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .delete(`/api/posts/999`)
        .set("Authorization", "Bearer mocked_token");
      expect(res.statusCode).toBe(404);
    });

    it("should return 403 if unauthorized user tries to delete a post", async () => {
      prisma.post.findUnique.mockResolvedValue({ id: postId, authorId: 2 });
      const res = await request(app)
        .delete(`/api/posts/${postId}`)
        .set("Authorization", "Bearer mocked_token");
      expect(res.statusCode).toBe(403);
    });
  });

  describe("Comment Routes", () => {
    it("should create a new comment on POST /api/comments", async () => {
      const newComment = {
        content: "New Comment",
        postId: postId,
        authorId: userId,
      };
      prisma.comment.create.mockResolvedValue({ id: 2, ...newComment });

      const res = await request(app)
        .post("/api/comments")
        .set("Authorization", "Bearer mocked_token") // Ensure authentication
        .send(newComment);

      expect(res.statusCode).toBe(201);
      expect(res.body.content).toBe(newComment.content);
      expect(res.body.postId).toBe(newComment.postId);
      expect(res.body.authorId).toBe(newComment.authorId);
      expect(prisma.comment.create).toHaveBeenCalledWith({
        data: {
          content: newComment.content,
          postId: newComment.postId,
          authorId: newComment.authorId,
          username: undefined, //username and email are now undefined, because they come from token.
          email: undefined,
        },
      });
    });

    it("should get all comments for a post on GET /api/comments/post/:postId", async () => {
      const mockComments = [
        { id: 1, content: "Test Comment", postId: postId, authorId: userId },
      ];
      prisma.comment.findMany.mockResolvedValue(mockComments);

      const response = await request(app).get(`/api/comments/post/${postId}`);
      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(prisma.comment.findMany).toHaveBeenCalledWith({
        where: { postId: postId },
        include: { author: true },
      });
    });

    it("should get a single comment on GET /api/comments/:id", async () => {
      const mockComment = {
        id: commentId,
        content: "Test Comment",
        postId: postId,
        authorId: userId,
      };
      prisma.comment.findUnique.mockResolvedValue(mockComment);
      const res = await request(app).get(`/api/comments/${commentId}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(commentId);
      expect(prisma.comment.findUnique).toHaveBeenCalledWith({
        where: { id: commentId },
        include: { author: true },
      });
    });

    it("should return 404 if comment not found on GET /api/comments/:id", async () => {
      prisma.comment.findUnique.mockResolvedValue(null);
      const res = await request(app).get(`/api/comments/999`); // Non-existent ID
      expect(res.statusCode).toBe(404);
    });

    it("should update a comment on PUT /api/comments/:id", async () => {
      const updatedComment = { content: "Updated Comment" };
      prisma.comment.findUnique.mockResolvedValue({
        id: commentId,
        authorId: userId,
        content: "Test Comment",
        postId: 1,
      });
      prisma.comment.update.mockResolvedValue({
        id: commentId,
        ...updatedComment,
      });

      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set("Authorization", "Bearer mocked_token")
        .send(updatedComment);

      expect(res.statusCode).toBe(200);
      expect(res.body.content).toBe("Updated Comment");
      expect(prisma.comment.update).toHaveBeenCalledWith({
        where: { id: commentId },
        data: updatedComment,
      });
    });
    it("should return 404 if comment not found during update", async () => {
      prisma.comment.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .put(`/api/comments/999`) // Use a non-existent ID
        .set("Authorization", "Bearer mocked_token")
        .send({ content: "Updated Content" });
      expect(res.statusCode).toBe(404);
    });

    it("should return 403 if unauthorized user tries to update a comment", async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: commentId,
        authorId: 999,
      }); // Simulate different author.
      const res = await request(app)
        .put(`/api/comments/${commentId}`)
        .set("Authorization", "Bearer mocked_token")
        .send({ content: "Updated Content" });
      expect(res.statusCode).toBe(403);
    });

    it("should delete a comment on DELETE /api/comments/:id", async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: commentId,
        authorId: userId,
        content: "test Content",
        postId: 1,
      });
      prisma.comment.delete.mockResolvedValue();

      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set("Authorization", "Bearer mocked_token"); // Simulate authentication

      expect(res.statusCode).toBe(204);
      expect(prisma.comment.delete).toHaveBeenCalledWith({
        where: { id: commentId },
      });
    });

    it("should return 404 if trying to delete a non-existent comment", async () => {
      prisma.comment.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .delete(`/api/comments/999`)
        .set("Authorization", "Bearer mocked_token");
      expect(res.statusCode).toBe(404);
    });
    it("should return 403 if unauthorized user tries to delete a comment", async () => {
      prisma.comment.findUnique.mockResolvedValue({
        id: commentId,
        authorId: 999,
      }); // Simulate different author

      const res = await request(app)
        .delete(`/api/comments/${commentId}`)
        .set("Authorization", "Bearer mocked_token"); // Simulate logged-in user
      expect(res.statusCode).toBe(403);
    });

    it("should return 400 if comment content is missing on POST", async () => {
      const invalidComment = { postId: 1, authorId: 1 }; // Missing content
      const res = await request(app)
        .post("/api/comments")
        .set("Authorization", "Bearer mocked_token")
        .send(invalidComment);
      expect(res.statusCode).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it("should return 400 if postId is missing on POST", async () => {
      const invalidComment = { content: "new comment", authorId: 1 };
      const res = await request(app)
        .post("/api/comments")
        .set("Authorization", "Bearer mocked_token")
        .send(invalidComment);
      expect(res.statusCode).toBe(400);
    });

    it("should return 400 if authorId is missing on POST", async () => {
      const invalidComment = { content: "new comment", postId: 1 };
      const res = await request(app)
        .post("/api/comments")
        .set("Authorization", "Bearer mocked_token")
        .send(invalidComment);
      expect(res.statusCode).toBe(400);
    });
    it("should handle foreign key constraint error on comment creation", async () => {
      const newComment = { content: "New Comment", postId: 999, authorId: 999 }; // Invalid IDs
      const error = new Error();
      error.code = "P2003"; // Prisma's foreign key constraint failed code.
      prisma.comment.create.mockRejectedValue(error);

      const res = await request(app)
        .post("/api/comments")
        .set("Authorization", "Bearer mocked_token")
        .send(newComment);

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe("Invalid post ID or author ID");
    });
  });

  describe("Error Handling", () => {
    // Generic error handling (replace repetitive tests)

    it("should handle server errors for GET requests", async () => {
      prisma.post.findMany.mockRejectedValue(new Error("Database error"));
      const res = await request(app).get("/api/posts");
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Internal server error" });

      prisma.user.findMany.mockRejectedValue(new Error("Database error"));
      const res2 = await request(app)
        .get("/api/users")
        .set("Authorization", "Bearer mocked_token");
      expect(res2.statusCode).toBe(500);

      prisma.comment.findMany.mockRejectedValue(new Error("Database Error"));
      const res3 = await request(app).get("/api/comments/post/1");
      expect(res3.statusCode).toBe(500);
    });

    it("should handle server errors for POST requests", async () => {
      prisma.post.create.mockRejectedValue(new Error("Database error"));
      const res = await request(app)
        .post("/api/posts")
        .set("Authorization", "Bearer mocked_token")
        .send({ title: "New Post", content: "New content", authorId: 1 });
      expect(res.statusCode).toBe(500);

      prisma.user.create.mockRejectedValue(new Error("database error"));
      const res2 = await request(app)
        .post("/api/users")
        .send({
          email: "email@email.com",
          username: "username",
          password: "password",
        });
      expect(res2.statusCode).toBe(500);

      prisma.comment.create.mockRejectedValue(new Error("Database error"));
      const res3 = await request(app)
        .post("/api/comments")
        .set("Authorization", "Bearer mocked_token")
        .send({
          content: "New Comment",
          postId: 1,
          authorId: 1,
          username: "testuser",
          email: "test@test.com",
        });
      expect(res3.statusCode).toBe(500);
    });

    it("should handle server errors for PUT requests", async () => {
      prisma.post.update.mockRejectedValue(new Error("Database error"));
      prisma.post.findUnique.mockResolvedValue({
        id: postId,
        authorId: userId,
      });
      const res = await request(app)
        .put("/api/posts/1")
        .set("Authorization", "Bearer mocked_token")
        .send({ title: "Updated Title" });
      expect(res.statusCode).toBe(500);

      prisma.user.update.mockRejectedValue(new Error("Database Error"));
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: "test@test.com",
        username: "testuser",
      });
      const res2 = await request(app)
        .put("/api/users/1")
        .set("Authorization", "Bearer mocked_token")
        .send({ email: "updated@example.com" });
      expect(res2.statusCode).toBe(500);

      prisma.comment.update.mockRejectedValue(new Error("Database error"));
      prisma.comment.findUnique.mockResolvedValue({ id: 1, authorId: 1 });
      const res3 = await request(app)
        .put(`/api/comments/1`)
        .set("Authorization", "Bearer mocked_token")
        .send({ content: "Updated Comment" });
      expect(res3.statusCode).toBe(500);
    });

    it("should handle server errors for DELETE requests", async () => {
      prisma.post.delete.mockRejectedValue(new Error("Database error"));
      prisma.post.findUnique.mockResolvedValue({ id: 1, authorId: 1 });
      const res = await request(app)
        .delete("/api/posts/1")
        .set("Authorization", "Bearer mocked_token");
      expect(res.statusCode).toBe(500);

      prisma.user.delete.mockRejectedValue(new Error("Database error"));
      prisma.user.findUnique.mockResolvedValue({
        id: 1,
        email: "test@test.com",
        username: "testuser",
      });
      const res2 = await request(app)
        .delete("/api/users/1")
        .set("Authorization", "Bearer mocked_token");
      expect(res2.statusCode).toBe(500);

      prisma.comment.delete.mockRejectedValue(new Error("database error"));
      prisma.comment.findUnique.mockResolvedValue({ id: 1, authorId: 1 });
      const res3 = await request(app)
        .delete("/api/comments/1")
        .set("Authorization", "Bearer mocked_token");
      expect(res3.statusCode).toBe(500);
    });
  });

  it('should respond with "Blog API is running!" on GET /', async () => {
    const response = await request(app).get("/");
    expect(response.statusCode).toBe(200);
    expect(response.text).toBe("Blog API is running!");
  });
});
