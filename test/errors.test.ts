import { describe, it, expect } from "vitest";
import { ApiError } from "../src/errors";

describe("ApiError", () => {
  it("stores status and message", () => {
    const e = new ApiError("Not allowed", 403);
    expect(e.message).toBe("Not allowed");
    expect(e.status).toBe(403);
  });

  it("is an instance of Error", () => {
    const e = new ApiError("Test", 400);
    expect(e instanceof Error).toBe(true);
    expect(e instanceof ApiError).toBe(true);
  });

  it("has correct name property", () => {
    const e = new ApiError("Test", 400);
    expect(e.name).toBe("ApiError");
  });

  it("handles different HTTP status codes", () => {
    const cases = [
      { status: 400, name: "Bad Request" },
      { status: 401, name: "Unauthorized" },
      { status: 403, name: "Forbidden" },
      { status: 404, name: "Not Found" },
      { status: 422, name: "Unprocessable Entity" },
      { status: 500, name: "Internal Server Error" },
      { status: 503, name: "Service Unavailable" },
    ];

    for (const { status, name } of cases) {
      const e = new ApiError(name, status);
      expect(e.status).toBe(status);
      expect(e.message).toBe(name);
    }
  });

  it("preserves error message with special characters", () => {
    const msg = 'Error: "validation" failed\nDetails: field is required';
    const e = new ApiError(msg, 400);
    expect(e.message).toBe(msg);
  });

  it("handles empty error messages", () => {
    const e = new ApiError("", 400);
    expect(e.message).toBe("");
    expect(e.status).toBe(400);
  });

  it("handles very long error messages", () => {
    const longMsg = "Error: " + "A".repeat(1000);
    const e = new ApiError(longMsg, 400);
    expect(e.message).toBe(longMsg);
    expect(e.message.length).toBeGreaterThan(1000);
  });

  it("can be caught and rethrown", () => {
    try {
      try {
        throw new ApiError("First error", 400);
      } catch (err) {
        if (err instanceof ApiError) {
          throw new ApiError(`Wrapped: ${err.message}`, 500);
        }
      }
    } catch (err) {
      expect(err instanceof ApiError).toBe(true);
      if (err instanceof ApiError) {
        expect(err.message).toBe("Wrapped: First error");
        expect(err.status).toBe(500);
      }
    }
  });

  it("includes stack trace", () => {
    const e = new ApiError("Test", 400);
    expect(e.stack).toBeDefined();
    expect(typeof e.stack).toBe("string");
  });

  it("can be used in throw statements", () => {
    expect(() => {
      throw new ApiError("Test error", 400);
    }).toThrow(ApiError);

    expect(() => {
      throw new ApiError("Test error", 400);
    }).toThrow("Test error");
  });

  it("can be distinguished from generic errors", () => {
    const apiError = new ApiError("API error", 400);
    const genericError = new Error("Generic error");

    expect(apiError instanceof ApiError).toBe(true);
    expect(genericError instanceof ApiError).toBe(false);
    expect(apiError instanceof Error).toBe(true);
    expect(genericError instanceof Error).toBe(true);
  });

  it("handles edge case status codes", () => {
    const e1 = new ApiError("Teapot", 418);
    expect(e1.status).toBe(418);

    const e2 = new ApiError("Early Hints", 103);
    expect(e2.status).toBe(103);

    const e3 = new ApiError("Network Auth Required", 511);
    expect(e3.status).toBe(511);
  });

  it("status property is accessible", () => {
    const e = new ApiError("Test", 404);
    const status = e.status;
    expect(status).toBe(404);
    expect(typeof status).toBe("number");
  });

  it("message property is accessible via Error interface", () => {
    const e = new ApiError("Custom message", 400);
    const msg: string = e.message;
    expect(msg).toBe("Custom message");
  });
});
