export type ValidationRule =
  | "string"
  | "number"
  | "boolean"
  | "object"
  | "array"
  | "string?"
  | "number?"
  | "boolean?"
  | "object?"
  | "array?"
  | "email"
  | "email?"
  | "url"
  | "url?"
  | { min: number }
  | { max: number }
  | { minLength: number }
  | { maxLength: number }
  | { pattern: RegExp }
  | { enum: any[] }
  | { custom: (value: any) => boolean | string };

export type ValidationSchema = Record<
  string,
  ValidationRule | ValidationRule[]
>;

export class ValidationError extends Error {
  public fields: Record<string, string[]>;

  constructor(message: string, fields: Record<string, string[]> = {}) {
    super(message);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

function isEmail(value: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

function isUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function validateRule(
  key: string,
  value: any,
  rule: ValidationRule,
  errors: Record<string, string[]>
): void {
  if (!errors[key]) errors[key] = [];

  if (typeof rule === "string") {
    const optional = rule.endsWith("?");
    const baseType = optional ? rule.slice(0, -1) : rule;

    if (value === undefined || value === null) {
      if (!optional) {
        errors[key].push(`is required`);
      }
      return;
    }

    switch (baseType) {
      case "string":
        if (typeof value !== "string") {
          errors[key].push(`must be a string`);
        }
        break;
      case "number":
        if (typeof value !== "number" || isNaN(value)) {
          errors[key].push(`must be a number`);
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          errors[key].push(`must be a boolean`);
        }
        break;
      case "object":
        if (
          typeof value !== "object" ||
          Array.isArray(value) ||
          value === null
        ) {
          errors[key].push(`must be an object`);
        }
        break;
      case "array":
        if (!Array.isArray(value)) {
          errors[key].push(`must be an array`);
        }
        break;
      case "email":
        if (typeof value !== "string" || !isEmail(value)) {
          errors[key].push(`must be a valid email`);
        }
        break;
      case "url":
        if (typeof value !== "string" || !isUrl(value)) {
          errors[key].push(`must be a valid URL`);
        }
        break;
    }
  } else if (typeof rule === "object") {
    if ("min" in rule) {
      if (typeof value !== "number" || value < rule.min) {
        errors[key].push(`must be at least ${rule.min}`);
      }
    }
    if ("max" in rule) {
      if (typeof value !== "number" || value > rule.max) {
        errors[key].push(`must be at most ${rule.max}`);
      }
    }
    if ("minLength" in rule) {
      if (typeof value === "string" && value.length < rule.minLength) {
        errors[key].push(`must be at least ${rule.minLength} characters`);
      } else if (Array.isArray(value) && value.length < rule.minLength) {
        errors[key].push(`must have at least ${rule.minLength} items`);
      }
    }
    if ("maxLength" in rule) {
      if (typeof value === "string" && value.length > rule.maxLength) {
        errors[key].push(`must be at most ${rule.maxLength} characters`);
      } else if (Array.isArray(value) && value.length > rule.maxLength) {
        errors[key].push(`must have at most ${rule.maxLength} items`);
      }
    }
    if ("pattern" in rule) {
      if (typeof value === "string" && !rule.pattern.test(value)) {
        errors[key].push(`does not match required pattern`);
      }
    }
    if ("enum" in rule) {
      if (!rule.enum.includes(value)) {
        errors[key].push(`must be one of: ${rule.enum.join(", ")}`);
      }
    }
    if ("custom" in rule) {
      const result = rule.custom(value);
      if (result === false) {
        errors[key].push(`failed custom validation`);
      } else if (typeof result === "string") {
        errors[key].push(result);
      }
    }
  }
}

export function validate<T = any>(data: unknown, schema: ValidationSchema): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ValidationError("Data must be an object");
  }

  const obj = data as Record<string, any>;
  const errors: Record<string, string[]> = {};

  for (const [key, rules] of Object.entries(schema)) {
    const value = obj[key];
    const ruleArray = Array.isArray(rules) ? rules : [rules];

    for (const rule of ruleArray) {
      validateRule(key, value, rule, errors);
    }
  }

  // Filter out keys with no errors
  const fieldErrors = Object.fromEntries(
    Object.entries(errors).filter(([_, errs]) => errs.length > 0)
  );

  if (Object.keys(fieldErrors).length > 0) {
    const errorMessage = Object.entries(fieldErrors)
      .map(([key, errs]) => `${key}: ${errs.join(", ")}`)
      .join("; ");
    throw new ValidationError(errorMessage, fieldErrors);
  }

  return obj as T;
}

// Helper for partial validation (useful for PATCH requests)
export function validatePartial<T = any>(
  data: unknown,
  schema: ValidationSchema
): Partial<T> {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ValidationError("Data must be an object");
  }

  const obj = data as Record<string, any>;
  const errors: Record<string, string[]> = {};

  // Only validate fields that are present in the data
  for (const [key, rules] of Object.entries(schema)) {
    if (!(key in obj)) continue; // Skip fields not in data

    const value = obj[key];
    const ruleArray = Array.isArray(rules) ? rules : [rules];

    for (const rule of ruleArray) {
      validateRule(key, value, rule, errors);
    }
  }

  const fieldErrors = Object.fromEntries(
    Object.entries(errors).filter(([_, errs]) => errs.length > 0)
  );

  if (Object.keys(fieldErrors).length > 0) {
    const errorMessage = Object.entries(fieldErrors)
      .map(([key, errs]) => `${key}: ${errs.join(", ")}`)
      .join("; ");
    throw new ValidationError(errorMessage, fieldErrors);
  }

  return obj as Partial<T>;
}

// Helper to sanitize input (removes unknown fields)
export function sanitize<T = any>(data: unknown, schema: ValidationSchema): T {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ValidationError("Data must be an object");
  }

  const obj = data as Record<string, any>;
  const sanitized: Record<string, any> = {};

  for (const key of Object.keys(schema)) {
    if (key in obj) {
      sanitized[key] = obj[key];
    }
  }

  return sanitized as T;
}

// Combined validate and sanitize
export function validateAndSanitize<T = any>(
  data: unknown,
  schema: ValidationSchema
): T {
  const sanitized = sanitize(data, schema);
  return validate<T>(sanitized, schema);
}
