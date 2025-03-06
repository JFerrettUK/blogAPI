// APIbackend/__tests__/setup.js

// Mock the Prisma Client globally
jest.mock("@prisma/client", () => {
  return {
    PrismaClient: jest.fn().mockImplementation(() => ({
      $connect: jest.fn(),
      $disconnect: jest.fn(),
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
    })),
  };
});

// Mock bcrypt globally
jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
  compare: jest.fn().mockResolvedValue(true), // Default to true for login
}));

// Mock jsonwebtoken globally
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn().mockReturnValue("mocked_token"),
  verify: jest.fn(), // We'll control this in individual tests
}));

// Global afterAll hook to disconnect Prisma and close the server.
afterAll(async () => {
  const { prisma, server } = require("../index"); //Import here, so the correct file is called.
  if (prisma) {
    await prisma.$disconnect();
  }
  if (server) {
    server.close();
  }
});
