# Next-Api-Responder

A lightweight, type-safe utility library for building consistent and robust API responses in Next.js App Router. Includes validation, error handling, and response formatting helpers.

# ✨ Features

- 🎯 Type-safe responses - Full TypeScript support with proper types
- ✅ Built-in validation - Comprehensive validation with 10+ built-in validators
- 🛡️ Input sanitization - Remove unwanted fields automatically
- 🚦 Error handling - Automatic error catching and formatting
- 📦 Zero dependencies - Lightweight and fast
- 🎨 Consistent format - Standardized { success, data/error } shape
- 🔧 Framework-friendly - Works seamlessly with Next.js App Router

## 📦 Installation

```
npm install next-api-responder
# or
yarn add next-api-responder
# or
pnpm add next-api-responder
```

## 🚀 Quick Start Example

```ts
// app/api/users/route.ts
import { success, created, validate, withHandler } from "next-api-responder";
import { NextRequest } from "next/server";

// Temporary in-memory data store for example
let users: Array<{ id: number; name: string; email: string; age: number }> = [];
let idCounter = 1;

export const GET = withHandler(async () => {
  // Return all users
  return success(users);
});

export const POST = withHandler(async (request: NextRequest) => {
  const body = await request.json();

  // Validate incoming data
  const validated = validate(body, {
    name: ["string", { minLength: 2 }],
    email: "email",
    age: ["number", { min: 18 }],
  });

  // Create new user in memory
  const newUser = {
    id: idCounter++,
    ...validated,
  };

  users.push(newUser);

  return created(newUser);
});
```

## Response format:

```javascript

// Success
{
  "success": true,
  "data": { "id": 1, "name": "John" }
}

// Error
{
  "success": false,
  "error": "Validation failed"
}

```

## 📖 Table of Contents

- Response Helpers
- Validation
- Error Handling
- Complete Examples
- API Reference

## 🎨 Response Helpers

### Basic Responses

```ts
import {
  success,
  error,
  created,
  notFound,
  unauthorized,
  forbidden,
} from "next-api-responder";

// Success with custom status
success({ user: { id: 1 } }); // 200
success({ user: { id: 1 } }, 200); // Custom status

// Common success responses
created({ id: 123 }); // 201 Created

// Error responses
error("Invalid input"); // 400 Bad Request
error("Server error", 500); // Custom status
unauthorized(); // 401 "Unauthorized"
unauthorized("Invalid token"); // 401 with custom message
forbidden(); // 403 "Forbidden"
notFound(); // 404 "Not Found"
notFound("User not found"); // 404 with custom message
```

## Using withHandler

### Automatically catches errors and converts them to formatted responses:

```ts
import { withHandler, success, ApiError } from "next-api-responder";

export const GET = withHandler(async (request: NextRequest) => {
  // Any ApiError is automatically caught and formatted
  const user = await getUser(id);
  if (!user) {
    throw new ApiError("User not found", 404);
  }

  // Generic errors become 500 responses
  return success(user);
});
```

## ✅ Validation

### Basic Types

```ts
import { validate } from "next-api-responder";

const validated = validate(data, {
  name: "string", // Required string
  age: "number", // Required number
  active: "boolean", // Required boolean
  tags: "array", // Required array
  profile: "object", // Required object
  bio: "string?", // Optional string
  website: "url?", // Optional URL
});
```

## Email and URL Validation

```ts
validate(data, {
  email: "email", // Valid email required
  website: "url", // Valid URL required
  backup: "email?", // Optional email
});
```

## String Constraints

```ts
validate(data, {
  username: ["string", { minLength: 3 }, { maxLength: 20 }],
  password: ["string", { minLength: 8 }],
  bio: [{ maxLength: 500 }],
  code: [{ pattern: /^[A-Z]{3}\d{3}$/ }], // Regex pattern
});
```

## Number Constraints

```ts
validate(data, {
  age: ["number", { min: 18 }, { max: 120 }],
  score: [{ min: 0 }, { max: 100 }],
  price: ["number", { min: 0 }],
});
```

## Enum Validation

```ts
validate(data, {
  status: [{ enum: ["active", "inactive", "pending"] }],
  role: [{ enum: ["user", "admin", "moderator"] }],
});
```

## Custom Validation

```ts
validate(data, {
  password: [
    "string",
    { minLength: 8 },
    {
      custom: (value) =>
        /[A-Z]/.test(value) && /[0-9]/.test(value)
          ? true
          : "must contain uppercase letter and number",
    },
  ],
  age: [
    {
      custom: (value) => value >= 18 || "must be 18 or older",
    },
  ],
});
```

## Partial Validation (for PATCH requests)

```ts
import { validatePartial } from "next-api-responder";

export const PATCH = withHandler(async (request: NextRequest) => {
  const updates = await request.json();

  // Only validates fields that are present in the request
  const validated = validatePartial(updates, {
    name: ["string", { minLength: 2 }],
    email: "email",
    bio: ["string?", { maxLength: 500 }],
  });

  // Update only the provided fields
  await db.user.update({ where: { id }, data: validated });
  return success(validated);
});
```

## Sanitization (Remove Unknown Fields)

```ts
import { validateAndSanitize } from "next-api-responder";

// User sends: { name: "John", email: "...", isAdmin: true, role: "admin" }
const clean = validateAndSanitize(data, {
  name: "string",
  email: "email",
});
// Result: { name: "John", email: "..." }
// isAdmin and role are removed!
```

# 🛡️ Error Handling

## Using ApiError

```ts
import { ApiError, withHandler } from "next-api-responder";

export const GET = withHandler(async (request: NextRequest) => {
  const user = await db.user.findUnique({ where: { id } });

  if (!user) {
    throw new ApiError("User not found", 404);
  }

  if (!user.active) {
    throw new ApiError("Account suspended", 403);
  }

  return success(user);
});
```

## ValidationError

### Validation errors include detailed field information:

```ts
try {
  validate(data, schema);
} catch (error) {
  if (error instanceof ValidationError) {
    console.log(error.message); // "email: must be valid email; age: must be at least 18"
    console.log(error.fields); // { email: ["must be valid email"], age: ["must be at least 18"] }
  }
}
```

## 🎯 Complete Examples

### User Registration

```ts
// app/api/auth/register/route.ts
import { NextRequest } from "next/server";
import { withHandler, created, validate, ApiError } from "next-api-responder";

export const POST = withHandler(async (request: NextRequest) => {
  const body = await request.json();

  const validated = validate(body, {
    username: [
      "string",
      { minLength: 3 },
      { maxLength: 20 },
      { pattern: /^[a-zA-Z0-9_]+$/ },
    ],
    email: "email",
    password: [
      "string",
      { minLength: 8 },
      {
        custom: (v) =>
          /[A-Z]/.test(v) && /[0-9]/.test(v)
            ? true
            : "must contain uppercase and number",
      },
    ],
    age: ["number", { min: 18 }, { max: 120 }],
    terms: ["boolean", { custom: (v) => v === true || "must accept terms" }],
  });

  // Check if user exists
  const exists = await db.user.findUnique({
    where: { email: validated.email },
  });

  if (exists) {
    throw new ApiError("Email already registered", 409);
  }

  // Hash password and create user
  const hashedPassword = await hash(validated.password);
  const user = await db.user.create({
    data: { ...validated, password: hashedPassword },
  });

  return created({ id: user.id, username: user.username });
});
```

## Complete CRUD Operations

```ts
// app/api/posts/route.ts
import { NextRequest } from "next/server";
import {
  withHandler,
  success,
  created,
  validateAndSanitize,
} from "next-api-responder";

const postSchema = {
  title: ["string", { minLength: 3 }, { maxLength: 200 }],
  content: ["string", { minLength: 10 }],
  published: "boolean?",
  tags: "array?",
};

// GET - List posts with pagination
export const GET = withHandler(async (request: NextRequest) => {
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "10");

  const [posts, total] = await Promise.all([
    db.post.findMany({
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.post.count(),
  ]);

  return success({
    posts,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

// POST - Create post
export const POST = withHandler(async (request: NextRequest) => {
  const body = await request.json();

  // Validate and remove any extra fields
  const validated = validateAndSanitize(body, postSchema);

  const post = await db.post.create({ data: validated });

  return created(post);
});
```

```ts
// app/api/posts/[id]/route.ts
import { NextRequest } from "next/server";
import {
  withHandler,
  success,
  validatePartial,
  ApiError,
} from "next-api-responder";

// GET - Single post
export const GET = withHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const post = await db.post.findUnique({
      where: { id: params.id },
    });

    if (!post) {
      throw new ApiError("Post not found", 404);
    }

    return success(post);
  }
);

// PATCH - Update post
export const PATCH = withHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    const updates = await request.json();

    // Only validate provided fields
    const validated = validatePartial(updates, {
      title: ["string", { minLength: 3 }, { maxLength: 200 }],
      content: ["string", { minLength: 10 }],
      published: "boolean?",
    });

    const post = await db.post.update({
      where: { id: params.id },
      data: validated,
    });

    return success(post);
  }
);

// DELETE - Delete post
export const DELETE = withHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    await db.post.delete({ where: { id: params.id } });

    return success({ deleted: true });
  }
);
```

## Authentication Middleware

```ts
// lib/auth.ts
import { ApiError } from "next-api-responder";
import { NextRequest } from "next/server";

export async function requireAuth(request: NextRequest) {
  const token = request.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    throw new ApiError("No token provided", 401);
  }

  const user = await verifyToken(token);

  if (!user) {
    throw new ApiError("Invalid or expired token", 401);
  }

  return user;
}

export async function requireAdmin(request: NextRequest) {
  const user = await requireAuth(request);

  if (user.role !== "admin") {
    throw new ApiError("Admin access required", 403);
  }

  return user;
}

// Usage in protected route
export const DELETE = withHandler(
  async (request: NextRequest, { params }: { params: { id: string } }) => {
    await requireAdmin(request);

    await db.user.delete({ where: { id: params.id } });

    return success({ deleted: true });
  }
);
```

## File Upload with Validation

```ts
// app/api/upload/route.ts
import { withHandler, created, validate } from "next-api-responder";

export const POST = withHandler(async (request: NextRequest) => {
  const body = await request.json();

  const validated = validate(body, {
    filename: ["string", { pattern: /^[\w\-. ]+\.(jpg|jpeg|png|pdf)$/i }],
    size: [
      "number",
      { max: 5 * 1024 * 1024 }, // 5MB max
    ],
    mimetype: [{ enum: ["image/jpeg", "image/png", "application/pdf"] }],
  });

  // Process file upload...
  const fileUrl = await uploadToStorage(validated);

  return created({
    url: fileUrl,
    filename: validated.filename,
  });
});
```

# 📚 API Reference

## Response Helpers

| Function                | Status | Description        |
| ----------------------- | ------ | ------------------ |
| success(data, status?)  | 200    | Success response   |
| created(data)           | 201    | Resource created   |
| error(message, status?) | 400    | Error response     |
| unauthorized(message?)  | 401    | Not authenticated  |
| forbidden(message?)     | 403    | Not authorized     |
| notFound(message?)      | 404    | Resource not found |

## Validation Functions

| Function                          | Description                        |
| --------------------------------- | ---------------------------------- |
| validate(data, schema)            | Validates all fields in schema     |
| validatePartial(data, schema)     | Validates only the provided fields |
| sanitize(data, schema)            | Removes fields not in schema       |
| validateAndSanitize(data, schema) | Validates and sanitizes together   |

## Validation Types

| Type    | Description      | Example   |
| ------- | ---------------- | --------- |
| string  | Required string  | "string"  |
| string? | Optional string  | "string?" |
| number  | Required number  | "number"  |
| boolean | Required boolean | "boolean" |
| array   | Required array   | "array"   |
| object  | Required object  | "object"  |
| email   | Valid email      | "email"   |
| url     | Valid URL        | "url"     |

## 🟧 Validation Constraints

| Constraint           | Applies To      | Example                   |
| -------------------- | --------------- | ------------------------- |
| `{ min: n }`         | numbers         | `{ min: 18 }`             |
| `{ max: n }`         | numbers         | `{ max: 100 }`            |
| `{ minLength: n }`   | strings, arrays | `{ minLength: 8 }`        |
| `{ maxLength: n }`   | strings, arrays | `{ maxLength: 50 }`       |
| `{ pattern: regex }` | strings         | `{ pattern: /^[A-Z]+$/ }` |
| `{ enum: [...] }`    | any             | `{ enum: ["a", "b"] }`    |
| `{ custom: fn }`     | any             | `{ custom: v => v > 0 }`  |

## Classes

### ApiError

```ts
class ApiError extends Error {
  constructor(message: string, status: number);
}

// Usage
throw new ApiError("Not found", 404);
```

### ValidationError

```ts
class ValidationError extends Error {
  fields: Record<string, string[]>;
  constructor(message: string, fields?: Record<string, string[]>);
}

// Automatically thrown by validate()
```

## 🤝 Contributing

### Contributions are welcome! Please feel free to submit a Pull Request here - https://github.com/ArshadChowdhury/next-api-responder

# 📄 License

MIT © Mohammed Arshad

## 🔗 Useful Links

- **GitHub Repository** — [https://github.com/ArshadChowdhury/next-api-responder](https://github.com/ArshadChowdhury/next-api-responder)
- **npm Package** — [https://www.npmjs.com/package/next-api-responder](https://www.npmjs.com/package/next-api-responder)
- **Report Issues** — [https://github.com/ArshadChowdhury/next-api-responder/issues](https://github.com/ArshadChowdhury/next-api-responder/issues)

### Made with ❤️ for the Next.js community
