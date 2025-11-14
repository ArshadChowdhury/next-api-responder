import { ApiError } from "./errors";
import type { ApiResponse, ApiSuccess, ApiErrorShape } from "./types";

export const formatError = (message: string): ApiErrorShape => ({
  success: false,
  error: message,
});

export const toResponse = (obj: ApiResponse, status = 200): Response => {
  // JSON stringify using stable formatting
  const body = JSON.stringify(obj);
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

// Helper that accepts either a data object (for success) or an ApiError
export const success = <T = unknown>(data: T, status = 200) =>
  toResponse(formatSuccess(data), status);

export const error = (message: string, status = 400) =>
  toResponse(formatError(message), status);

export const formatSuccess = <T = unknown>(data: T): ApiSuccess<T> => ({
  success: true,
  data,
});

// convenience shortcuts
export const created = <T = unknown>(data: T) => success(data, 201);
export const unauthorized = (message = "Unauthorized") => error(message, 401);
export const forbidden = (message = "Forbidden") => error(message, 403);
export const notFound = (message = "Not Found") => error(message, 404);

// Wrapper to be used in route handlers (so you can throw ApiError and let withHandler convert it)
export const withHandler = <
  TArgs extends any[],
  TResult extends Response | ApiResponse | Promise<Response | ApiResponse>
>(
  handler: (...args: TArgs) => TResult
) => {
  return async (...args: TArgs): Promise<Response> => {
    try {
      const result = await handler(...args);

      if (result instanceof Response) return result;

      // result is an ApiResponse object
      // If it's a success shape, default 200; if error shape, choose 400
      if ((result as any).success === false) {
        // error shape
        return toResponse(result as ApiErrorShape, 400);
      }

      return toResponse(result as ApiSuccess, 200);
    } catch (err: any) {
      if (err instanceof ApiError) {
        return error(err.message, err.status);
      }

      // Unknown error
      console.error("Unhandled error in API handler", err);
      return error("Internal Server Error", 500);
    }
  };
};
