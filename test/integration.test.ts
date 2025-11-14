import { describe, it, expect } from "vitest";
import {
  success,
  error,
  created,
  notFound,
  withHandler,
  validate,
  validateAndSanitize,
  ApiError,
} from "../src";

describe("Integration: Real-world API handler patterns", () => {
  describe("Simple CRUD operations", () => {
    it("GET handler returns success", async () => {
      const getUser = withHandler(() => {
        const user = { id: 1, name: "John", email: "john@example.com" };
        return success(user);
      });

      const response = await getUser();
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual({
        success: true,
        data: { id: 1, name: "John", email: "john@example.com" },
      });
    });

    it("POST handler with validation", async () => {
      const createUser = withHandler((body: any) => {
        const validated = validate(body, {
          name: ["string", { minLength: 2 }],
          email: "email",
          age: ["number", { min: 18 }],
        });

        const newUser = { id: 123, ...validated };
        return created(newUser);
      });

      const response = await createUser({
        name: "Jane",
        email: "jane@example.com",
        age: 25,
      });

      const json = await response.json();
      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(123);
    });

    it("POST handler rejects invalid data", async () => {
      const createUser = withHandler((body: any) => {
        const validated = validate(body, {
          email: "email",
          age: ["number", { min: 18 }],
        });
        return created(validated);
      });

      const response = await createUser({
        email: "invalid-email",
        age: 15,
      });

      const json = await response.json();
      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it("PATCH handler with partial validation", async () => {
      const updateUser = withHandler((id: number, updates: any) => {
        // In real app, you'd fetch user first
        const validated = validateAndSanitize(updates, {
          name: ["string?", { minLength: 2 }],
          email: "email?",
          bio: ["string?", { maxLength: 500 }],
        });

        const updatedUser = { id, ...validated };
        return success(updatedUser);
      });

      const response = await updateUser(1, { name: "Updated Name" });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.data.name).toBe("Updated Name");
    });

    it("DELETE handler returns 404 for missing resource", async () => {
      const deleteUser = withHandler((id: number) => {
        // Simulate user not found
        const userExists = false;
        if (!userExists) {
          throw new ApiError("User not found", 404);
        }
        return success({ deleted: true });
      });

      const response = await deleteUser(999);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe("User not found");
    });
  });

  describe("Authentication and Authorization", () => {
    it("handles unauthorized access", async () => {
      const protectedRoute = withHandler((token?: string) => {
        if (!token) {
          throw new ApiError("No token provided", 401);
        }
        return success({ message: "Access granted" });
      });

      const response = await protectedRoute();
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.error).toBe("No token provided");
    });

    it("handles forbidden access", async () => {
      const adminRoute = withHandler((userRole: string) => {
        if (userRole !== "admin") {
          throw new ApiError("Admin access required", 403);
        }
        return success({ message: "Admin dashboard" });
      });

      const response = await adminRoute("user");
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.error).toBe("Admin access required");
    });
  });

  describe("Complex validation scenarios", () => {
    it("validates user registration with multiple constraints", async () => {
      const register = withHandler((body: any) => {
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
                  : "must contain uppercase letter and number",
            },
          ],
          age: ["number", { min: 18 }, { max: 120 }],
          terms: [
            "boolean",
            { custom: (v) => v === true || "must accept terms" },
          ],
        });

        return created({ id: 1, ...validated });
      });

      const validData = {
        username: "john_doe",
        email: "john@example.com",
        password: "SecurePass123",
        age: 25,
        terms: true,
      };

      const response = await register(validData);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
    });

    it("sanitizes malicious input", async () => {
      const createPost = withHandler((body: any) => {
        // Remove any fields not in schema (like admin flags, etc.)
        const validated = validateAndSanitize(body, {
          title: ["string", { minLength: 3 }],
          content: ["string", { minLength: 10 }],
          published: "boolean?",
        });

        return created(validated);
      });

      const maliciousData = {
        title: "My Post",
        content: "This is my post content",
        published: false,
        isAdmin: true, // Should be removed
        role: "admin", // Should be removed
        __proto__: { hack: true }, // Should be removed
      };

      const response = await createPost(maliciousData);
      const json = await response.json();

      expect(json.data).toEqual({
        title: "My Post",
        content: "This is my post content",
        published: false,
      });
      expect(json.data).not.toHaveProperty("isAdmin");
      expect(json.data).not.toHaveProperty("role");
    });

    it("validates nested data structures", async () => {
      const createOrder = withHandler((body: any) => {
        const validated = validate(body, {
          items: "array",
          customer: "object",
          total: ["number", { min: 0 }],
          status: [{ enum: ["pending", "processing", "shipped", "delivered"] }],
        });

        return created(validated);
      });

      const orderData = {
        items: [{ id: 1, qty: 2 }],
        customer: { name: "John", email: "john@example.com" },
        total: 99.99,
        status: "pending",
      };

      const response = await createOrder(orderData);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
    });
  });

  describe("Error handling patterns", () => {
    it("handles database errors gracefully", async () => {
      const originalError = console.error;
      console.error = () => {};

      const getUser = withHandler(async (id: number) => {
        // Simulate database error
        throw new Error("Database connection failed");
      });

      const response = await getUser(1);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe("Internal Server Error");

      console.error = originalError;
    });

    it("handles validation errors with field details", async () => {
      const updateProfile = withHandler((body: any) => {
        const validated = validate(body, {
          name: ["string", { minLength: 2 }],
          email: "email",
          age: ["number", { min: 18 }],
        });
        return success(validated);
      });

      const response = await updateProfile({
        name: "A", // Too short
        email: "invalid", // Invalid email
        age: 15, // Too young
      });

      const json = await response.json();
      expect(response.status).toBe(500);
      expect(json.success).toBe(false);
    });

    it("uses custom error codes", async () => {
      const processPayment = withHandler(() => {
        throw new ApiError("Payment failed", 402);
      });

      const response = await processPayment();
      expect(response.status).toBe(402);
    });
  });

  describe("Response shortcuts", () => {
    it("uses notFound for missing resources", async () => {
      const getPost = withHandler((id: number) => {
        const post = null; // Simulate not found
        if (!post) {
          return notFound(`Post with id ${id} not found`);
        }
        return success(post);
      });

      const response = await getPost(999);
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.error).toBe("Post with id 999 not found");
    });

    it("chains validation and response helpers", async () => {
      const login = withHandler((body: any) => {
        const validated = validate(body, {
          email: "email",
          password: ["string", { minLength: 8 }],
        });

        // Simulate login logic
        const token = "jwt-token-here";
        return success({ token, user: validated.email });
      });

      const response = await login({
        email: "user@example.com",
        password: "password123",
      });

      const json = await response.json();
      expect(response.status).toBe(200);
      expect(json.data.token).toBeDefined();
    });
  });

  describe("Real Next.js patterns", () => {
    it("simulates Next.js route handler with query params", async () => {
      const getUsers = withHandler(
        (searchParams: { page?: string; limit?: string }) => {
          const page = parseInt(searchParams.page || "1");
          const limit = parseInt(searchParams.limit || "10");

          // Simulate pagination
          const users = Array.from({ length: limit }, (_, i) => ({
            id: (page - 1) * limit + i + 1,
            name: `User ${i + 1}`,
          }));

          return success({
            users,
            pagination: { page, limit, total: 100 },
          });
        }
      );

      const response = await getUsers({ page: "2", limit: "5" });
      const json = await response.json();

      expect(json.data.users).toHaveLength(5);
      expect(json.data.pagination.page).toBe(2);
    });

    it("handles file upload validation", async () => {
      const uploadFile = withHandler((body: any) => {
        const validated = validate(body, {
          filename: ["string", { pattern: /^[\w\-. ]+\.(jpg|png|pdf)$/i }],
          size: ["number", { max: 5 * 1024 * 1024 }], // 5MB max
          type: [{ enum: ["image/jpeg", "image/png", "application/pdf"] }],
        });

        return created({ uploaded: true, ...validated });
      });

      const response = await uploadFile({
        filename: "document.pdf",
        size: 1024 * 1024, // 1MB
        type: "application/pdf",
      });

      const json = await response.json();
      expect(response.status).toBe(201);
      expect(json.data.uploaded).toBe(true);
    });
  });
});
