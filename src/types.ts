export type ApiSuccess<T = unknown> = {
  success: true;
  data: T;
};

export type ApiErrorShape = {
  success: false;
  error: string;
};

export type ApiResponse<T = unknown> = ApiSuccess<T> | ApiErrorShape;
