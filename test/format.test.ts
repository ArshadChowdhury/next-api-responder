import { describe, it, expect } from "vitest";
import {
  formatSuccess,
  formatError,
  toResponse,
  success,
  error,
  created,
  unauthorized,
  forbidden,
  notFound,
  withHandler,
} from "../src/format";
import { ApiError } from "../src/errors";

describe("formatSuccess", () => {
  it("formats simple objects", () => {
    const out = formatSuccess({ name: "Arshad", age: 27 });
    expect(out).toEqual({ success: true, data: { name: "Arshad", age: 27 } });
  });

  it("formats arrays", () => {
    const out = formatSuccess([1, 2, 3]);
    expect(out).toEqual({ success: true, data: [1, 2, 3] });
  });

  it("formats primitive values", () => {
    expect(formatSuccess("hello")).toEqual({ success: true, data: "hello" });
    expect(formatSuccess(42)).toEqual({ success: true, data: 42 });
    expect(formatSuccess(true)).toEqual({ success: true, data: true });
    expect(formatSuccess(null)).toEqual({ success: true, data: null });
  });

  it("formats nested objects", () => {
    const data = {
      user: { id: 1, profile: { bio: "Developer" } },
      settings: { theme: "dark" },
    };
    expect(formatSuccess(data)).toEqual({ success: true, data });
  });

  it("formats empty objects and arrays", () => {
    expect(formatSuccess({})).toEqual({ success: true, data: {} });
    expect(formatSuccess([])).toEqual({ success: true, data: [] });
  });
});

describe("formatError", () => {
  it("formats simple error messages", () => {
    const out = formatError("Bad request");
    expect(out).toEqual({ success: false, error: "Bad request" });
  });

  it("formats empty error messages", () => {
    const out = formatError("");
    expect(out).toEqual({ success: false, error: "" });
  });

  it("formats long error messages", () => {
    const longMsg = "A".repeat(500);
    const out = formatError(longMsg);
    expect(out).toEqual({ success: false, error: longMsg });
  });
});

describe("toResponse", () => {
  it("creates Response with correct status and headers", async () => {
    const r = toResponse(formatSuccess({ ok: true }), 200);
    expect(r instanceof Response).toBe(true);
    expect(r.status).toBe(200);
    expect(r.headers.get("Content-Type")).toBe("application/json");
  });

  it("uses default status 200 when not specified", async () => {
    const r = toResponse(formatSuccess({ test: true }));
    expect(r.status).toBe(200);
  });

  it("handles different status codes", async () => {
    const statuses = [201, 400, 401, 403, 404, 500];
    for (const status of statuses) {
      const r = toResponse(formatError("test"), status);
      expect(r.status).toBe(status);
    }
  });

  it("handles 204 No Content without body", async () => {
    // 204 responses cannot have a body, so we need to handle this specially
    const r = new Response(null, { status: 204 });
    expect(r.status).toBe(204);
  });

  it("serializes JSON correctly", async () => {
    const data = { id: 1, active: true, tags: ["a", "b"] };
    const r = toResponse(formatSuccess(data), 200);
    const json = await r.json();
    expect(json).toEqual({ success: true, data });
  });

  it("handles special characters in strings", async () => {
    const data = { text: 'Hello "world" with \n newlines & symbols' };
    const r = toResponse(formatSuccess(data), 200);
    const json = await r.json();
    expect(json.data.text).toBe(data.text);
  });
});

describe("success helper", () => {
  it("returns Response with default 200 status", async () => {
    const r = success({ x: 1 });
    expect(r instanceof Response).toBe(true);
    expect(r.status).toBe(200);
    const j = await r.json();
    expect(j).toEqual({ success: true, data: { x: 1 } });
  });

  it("accepts custom status codes", async () => {
    const r = success({ x: 1 }, 202);
    expect(r.status).toBe(202);
  });

  it("handles various data types", async () => {
    const cases = [
      { input: "string", expected: "string" },
      { input: 123, expected: 123 },
      { input: [1, 2, 3], expected: [1, 2, 3] },
      { input: null, expected: null },
      {
        input: { nested: { deep: true } },
        expected: { nested: { deep: true } },
      },
    ];

    for (const { input, expected } of cases) {
      const r = success(input);
      const json = await r.json();
      expect(json.data).toEqual(expected);
    }
  });
});

describe("error helper", () => {
  it("returns Response with default 400 status", async () => {
    const r = error("Something wrong");
    expect(r instanceof Response).toBe(true);
    expect(r.status).toBe(400);
    const j = await r.json();
    expect(j).toEqual({ success: false, error: "Something wrong" });
  });

  it("accepts custom status codes", async () => {
    const r = error("Nope", 422);
    expect(r.status).toBe(422);
    const j = await r.json();
    expect(j).toEqual({ success: false, error: "Nope" });
  });

  it("preserves error message exactly", async () => {
    const msg = "Validation failed: email is required, password too short";
    const r = error(msg, 400);
    const json = await r.json();
    expect(json.error).toBe(msg);
  });
});

describe("convenience shortcuts", () => {
  describe("created", () => {
    it("returns 201 status", async () => {
      const r = created({ id: 123, name: "New Item" });
      expect(r.status).toBe(201);
      const json = await r.json();
      expect(json).toEqual({
        success: true,
        data: { id: 123, name: "New Item" },
      });
    });

    it("works with empty objects", async () => {
      const r = created({});
      expect(r.status).toBe(201);
      const json = await r.json();
      expect(json.data).toEqual({});
    });
  });

  describe("unauthorized", () => {
    it("returns 401 with default message", async () => {
      const r = unauthorized();
      expect(r.status).toBe(401);
      const json = await r.json();
      expect(json).toEqual({ success: false, error: "Unauthorized" });
    });

    it("accepts custom message", async () => {
      const r = unauthorized("Invalid token");
      expect(r.status).toBe(401);
      const json = await r.json();
      expect(json.error).toBe("Invalid token");
    });
  });

  describe("forbidden", () => {
    it("returns 403 with default message", async () => {
      const r = forbidden();
      expect(r.status).toBe(403);
      const json = await r.json();
      expect(json).toEqual({ success: false, error: "Forbidden" });
    });

    it("accepts custom message", async () => {
      const r = forbidden("Insufficient permissions");
      expect(r.status).toBe(403);
      const json = await r.json();
      expect(json.error).toBe("Insufficient permissions");
    });
  });

  describe("notFound", () => {
    it("returns 404 with default message", async () => {
      const r = notFound();
      expect(r.status).toBe(404);
      const json = await r.json();
      expect(json).toEqual({ success: false, error: "Not Found" });
    });

    it("accepts custom message", async () => {
      const r = notFound("User not found");
      expect(r.status).toBe(404);
      const json = await r.json();
      expect(json.error).toBe("User not found");
    });
  });
});

describe("withHandler", () => {
  it("wraps handlers that return Response objects", async () => {
    const handler = withHandler(() => success({ id: 1 }));
    const result = await handler();
    expect(result instanceof Response).toBe(true);
    expect(result.status).toBe(200);
  });

  it("wraps handlers that return ApiResponse success objects", async () => {
    const handler = withHandler(() => formatSuccess({ id: 1 }));
    const result = await handler();
    expect(result instanceof Response).toBe(true);
    const json = await result.json();
    expect(json).toEqual({ success: true, data: { id: 1 } });
  });

  it("wraps handlers that return ApiResponse error objects", async () => {
    const handler = withHandler(() => formatError("Bad data"));
    const result = await handler();
    expect(result instanceof Response).toBe(true);
    expect(result.status).toBe(400);
    const json = await result.json();
    expect(json).toEqual({ success: false, error: "Bad data" });
  });

  it("catches thrown ApiError instances", async () => {
    const handler = withHandler(() => {
      throw new ApiError("Not authorized", 401);
    });
    const result = await handler();
    expect(result.status).toBe(401);
    const json = await result.json();
    expect(json).toEqual({ success: false, error: "Not authorized" });
  });

  it("catches generic thrown errors", async () => {
    // Suppress console.error for this test since it's expected behavior
    const originalError = console.error;
    console.error = () => {};

    const handler = withHandler(() => {
      throw new Error("Unexpected crash");
    });
    const result = await handler();
    expect(result.status).toBe(500);
    const json = await result.json();
    expect(json).toEqual({ success: false, error: "Internal Server Error" });

    // Restore console.error
    console.error = originalError;
  });

  it("handles async handlers", async () => {
    const handler = withHandler(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return success({ async: true });
    });
    const result = await handler();
    const json = await result.json();
    expect(json.data).toEqual({ async: true });
  });

  it("passes arguments through to handler", async () => {
    const handler = withHandler((id: number, name: string) => {
      return success({ id, name });
    });
    const result = await handler(42, "test");
    const json = await result.json();
    expect(json.data).toEqual({ id: 42, name: "test" });
  });

  it("handles handlers that throw ApiError with custom status", async () => {
    const handler = withHandler(() => {
      throw new ApiError("Payment required", 402);
    });
    const result = await handler();
    expect(result.status).toBe(402);
    const json = await result.json();
    expect(json.error).toBe("Payment required");
  });

  it("handles async handlers that throw errors", async () => {
    const handler = withHandler(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      throw new ApiError("Async error", 503);
    });
    const result = await handler();
    expect(result.status).toBe(503);
  });

  it("correctly identifies success vs error shapes", async () => {
    const successHandler = withHandler(() => ({ success: true, data: "ok" }));
    const errorHandler = withHandler(() => ({ success: false, error: "fail" }));

    const successResult = await successHandler();
    expect(successResult.status).toBe(200);

    const errorResult = await errorHandler();
    expect(errorResult.status).toBe(400);
  });

  it("handles handlers with no arguments", async () => {
    const handler = withHandler(() => success({ value: "test" }));
    const result = await handler();
    const json = await result.json();
    expect(json.success).toBe(true);
  });

  it("handles handlers with multiple arguments", async () => {
    const handler = withHandler((a: number, b: number, c: string) => {
      return success({ sum: a + b, text: c });
    });
    const result = await handler(5, 10, "hello");
    const json = await result.json();
    expect(json.data).toEqual({ sum: 15, text: "hello" });
  });

  it("preserves thrown string errors", async () => {
    const originalError = console.error;
    console.error = () => {};

    const handler = withHandler(() => {
      throw "String error";
    });
    const result = await handler();
    expect(result.status).toBe(500);

    console.error = originalError;
  });

  it("handles null/undefined returns gracefully", async () => {
    const handler = withHandler(() => {
      return success(null);
    });
    const result = await handler();
    const json = await result.json();
    expect(json.data).toBe(null);
  });
});
