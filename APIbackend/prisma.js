// APIbackend/prisma.js
const { PrismaClient } = require("@prisma/client");

// Initialize Prisma client singleton
let prisma;

if (process.env.NODE_ENV === 'test') {
  // In test environment, return a mock object
  prisma = {
    user: { 
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    post: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    },
    comment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    }
  };
} else {
  // In production/development, use the real PrismaClient
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

module.exports = prisma;
