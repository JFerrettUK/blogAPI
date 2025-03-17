# CLAUDE.md - Blog API Development Guide

## Build Commands
- `npm run dev` - Run server with hot reload (nodemon)
- `npm start` - Run server in production mode
- `npm test` - Run all tests
- `npx jest __tests__/posts.test.js` - Run specific test file
- `npx jest -t "should create a new post"` - Run test by name

## Code Style Guidelines
- **Modules**: Use CommonJS `require()/exports` pattern
- **Naming**: camelCase for variables/functions, PascalCase for classes
- **Error Handling**: Use try/catch with specific error messages and appropriate HTTP status codes
- **Database**: Prisma client singleton via getPrismaClient()
- **Auth**: JWT tokens with middleware for authentication/authorization
- **Validation**: Use express-validator for input validation
- **Formatting**: 2-space indentation, semicolons required
- **Controller Pattern**: Separate route handlers by resource (users, posts, comments)
- **Testing**: Jest + supertest, use mocks for external dependencies
- **Documentation**: Include JSDoc-style comments for exported functions