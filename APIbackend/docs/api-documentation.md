# Blog API Documentation

## Overview

This API provides endpoints for managing a blog with users, posts, and comments functionality. All API endpoints are prefixed with `/api`.

## Authentication

The API uses JWT tokens for authentication. Upon successful login, a token is issued which must be included in subsequent requests.

**Include the token in your requests using the Authorization header:**

```
Authorization: Bearer <your_token>
```

## Rate Limiting

API requests are limited to 100 requests per 15-minute window per IP address to prevent abuse. If you exceed this limit, you'll receive a 429 Too Many Requests response.

## Common Response Codes

- 200: Request successful
- 201: Resource created successfully
- 204: No content (successful deletion)
- 400: Bad request (validation errors)
- 401: Unauthorized (no authentication token)
- 403: Forbidden (insufficient permissions)
- 404: Resource not found
- 429: Too many requests
- 500: Server error

## Endpoints

### Users

#### Register a new user

- **URL**: `/api/users`
- **Method**: `POST`
- **Auth required**: No
- **Headers**: `Content-Type: application/json`
- **Request body**:

```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

- **Response**: 201 Created

```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "username"
}
```

#### Login

- **URL**: `/api/users/login`
- **Method**: `POST`
- **Auth required**: No
- **Headers**: `Content-Type: application/json`
- **Request body**:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

- **Response**: 200 OK

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Get all users (admin only)

- **URL**: `/api/users`
- **Method**: `GET`
- **Auth required**: Yes (admin role)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: 200 OK

```json
[
  {
    "id": 1,
    "username": "username",
    "email": "user@example.com",
    "role": "user"
  }
]
```

#### Get user by ID

- **URL**: `/api/users/:id`
- **Method**: `GET`
- **Auth required**: Yes (user's own profile or admin)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: 200 OK

```json
{
  "id": 1,
  "username": "username",
  "email": "user@example.com",
  "role": "user",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

#### Update user

- **URL**: `/api/users/:id`
- **Method**: `PUT` or `PATCH`
- **Auth required**: Yes (user's own profile or admin)
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Request body** (all fields optional):

```json
{
  "email": "newemail@example.com",
  "username": "newusername",
  "password": "newpassword123"
}
```

- **Response**: 200 OK

```json
{
  "id": 1,
  "username": "newusername",
  "email": "newemail@example.com",
  "role": "user",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

#### Delete user

- **URL**: `/api/users/:id`
- **Method**: `DELETE`
- **Auth required**: Yes (user's own profile or admin)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: 204 No Content

### Posts

#### Get all posts

- **URL**: `/api/posts`
- **Method**: `GET`
- **Auth required**: No
- **Response**: 200 OK

```json
[
  {
    "id": 1,
    "title": "Post Title",
    "content": "Post content...",
    "published": true,
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z",
    "author": {
      "id": 1,
      "username": "username",
      "email": "user@example.com"
    },
    "comments": [
      {
        "id": 1,
        "content": "Comment content...",
        "createdAt": "2023-01-01T00:00:00.000Z",
        "author": {
          "id": 2,
          "username": "commenter",
          "email": "commenter@example.com"
        }
      }
    ]
  }
]
```

#### Get post by ID

- **URL**: `/api/posts/:id`
- **Method**: `GET`
- **Auth required**: No
- **Response**: 200 OK

```json
{
  "id": 1,
  "title": "Post Title",
  "content": "Post content...",
  "published": true,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z",
  "author": {
    "id": 1,
    "username": "username",
    "email": "user@example.com"
  },
  "comments": [
    {
      "id": 1,
      "content": "Comment content...",
      "createdAt": "2023-01-01T00:00:00.000Z",
      "author": {
        "id": 2,
        "username": "commenter",
        "email": "commenter@example.com"
      }
    }
  ]
}
```

#### Create a post

- **URL**: `/api/posts`
- **Method**: `POST`
- **Auth required**: Yes
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Request body**:

```json
{
  "title": "Post Title",
  "content": "Post content..."
}
```

- **Response**: 201 Created

```json
{
  "id": 1,
  "title": "Post Title",
  "content": "Post content...",
  "published": true,
  "authorId": 1,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

#### Update a post

- **URL**: `/api/posts/:id`
- **Method**: `PUT` or `PATCH`
- **Auth required**: Yes (post author or admin)
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Request body** (all fields optional):

```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "published": false
}
```

- **Response**: 200 OK

```json
{
  "id": 1,
  "title": "Updated Title",
  "content": "Updated content...",
  "published": false,
  "authorId": 1,
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z"
}
```

#### Delete a post

- **URL**: `/api/posts/:id`
- **Method**: `DELETE`
- **Auth required**: Yes (post author or admin)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: 204 No Content

### Comments

#### Get comments for a post

- **URL**: `/api/comments/post/:postId`
- **Method**: `GET`
- **Auth required**: No
- **Response**: 200 OK

```json
[
  {
    "id": 1,
    "content": "Comment content...",
    "createdAt": "2023-01-01T00:00:00.000Z",
    "updatedAt": "2023-01-01T00:00:00.000Z",
    "postId": 1,
    "author": {
      "id": 2,
      "username": "commenter",
      "email": "commenter@example.com"
    }
  }
]
```

#### Get comment by ID

- **URL**: `/api/comments/:id`
- **Method**: `GET`
- **Auth required**: No
- **Response**: 200 OK

```json
{
  "id": 1,
  "content": "Comment content...",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z",
  "postId": 1,
  "author": {
    "id": 2,
    "username": "commenter",
    "email": "commenter@example.com"
  }
}
```

#### Create a comment

- **URL**: `/api/comments`
- **Method**: `POST`
- **Auth required**: Yes
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Request body**:

```json
{
  "content": "Comment content...",
  "postId": 1
}
```

- **Response**: 201 Created

```json
{
  "id": 1,
  "content": "Comment content...",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z",
  "postId": 1,
  "authorId": 2,
  "author": {
    "id": 2,
    "username": "commenter",
    "email": "commenter@example.com"
  }
}
```

#### Update a comment

- **URL**: `/api/comments/:id`
- **Method**: `PUT` or `PATCH`
- **Auth required**: Yes (comment author or admin)
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <token>`
- **Request body**:

```json
{
  "content": "Updated comment content..."
}
```

- **Response**: 200 OK

```json
{
  "id": 1,
  "content": "Updated comment content...",
  "createdAt": "2023-01-01T00:00:00.000Z",
  "updatedAt": "2023-01-01T00:00:00.000Z",
  "postId": 1,
  "authorId": 2,
  "author": {
    "id": 2,
    "username": "commenter",
    "email": "commenter@example.com"
  }
}
```

#### Delete a comment

- **URL**: `/api/comments/:id`
- **Method**: `DELETE`
- **Auth required**: Yes (comment author or admin)
- **Headers**: `Authorization: Bearer <token>`
- **Response**: 204 No Content

## Error Responses

### Validation Errors (400 Bad Request)

```json
{
  "errors": [
    {
      "msg": "Email is required",
      "param": "email",
      "location": "body"
    }
  ]
}
```

### Authentication Errors (401 Unauthorized)

```json
{
  "message": "Unauthorized - No token provided"
}
```

### Authorization Errors (403 Forbidden)

```json
{
  "message": "Forbidden - Invalid token"
}
```

or

```json
{
  "message": "Forbidden - Insufficient permissions"
}
```

### Resource Not Found (404 Not Found)

```json
{
  "error": "User not found"
}
```

### Rate Limit Exceeded (429 Too Many Requests)

```json
{
  "message": "Too many requests from this IP, please try again later"
}
```

### Server Error (500 Internal Server Error)

```json
{
  "error": "Internal server error"
}
```
