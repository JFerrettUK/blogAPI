// __tests__/api.test.js  (This file is now much smaller)

const request = require("supertest");
const { app, server } = require("../index"); // Import your Express app and server.

describe("Blog API Integration Tests", () => {
  // Global setup and teardown (for the entire test suite)

  afterAll(async () => {
    await server.close(); // Close the server after all tests are done
  });

  // Test suite for User routes
  describe("User Routes", () => {
    require("./users.test.js"); // Import the user tests
  });

  // Test suite for Post routes
  describe("Post Routes", () => {
    require("./posts.test.js"); //Import post tests.
  });

  // Test suite for Comment routes
  describe("Comment Routes", () => {
    require("./comments.test.js");
  });

  it("GET / - should return a welcome message", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toEqual(200);
    expect(res.text).toBe("Blog API is running!");
  });
});
