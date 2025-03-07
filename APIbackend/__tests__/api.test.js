const request = require("supertest");
const { app, server } = require("../index");

describe("Blog API Integration Tests", () => {
  afterAll(async () => {
    await server.close();
  });

  it("GET / - should return a welcome message", async () => {
    const res = await request(app).get("/");
    expect(res.statusCode).toEqual(200);
    expect(res.text).toBe("Blog API is running!");
  });
});
