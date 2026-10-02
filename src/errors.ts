/** A single field problem reported by the API (FastAPI `detail[]` or Laravel `errors`). */
export interface FieldError {
  field: string | null;
  message: string;
  type: string | null;
}

export class MistaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** The API answered with an error status (or a 200 whose envelope says `"status": "error"`). */
export class APIError extends MistaError {
  readonly status: number;
  readonly body: unknown;
  readonly errors: FieldError[];
  readonly headers: Headers;

  constructor(message: string, status: number, body: unknown, headers: Headers) {
    super(message);
    this.status = status;
    this.body = body;
    this.headers = headers;
    this.errors = parseFieldErrors(body);
  }
}

export class BadRequestError extends APIError {}
export class AuthenticationError extends APIError {}
export class PermissionDeniedError extends APIError {}
export class NotFoundError extends APIError {}
export class ValidationError extends APIError {}
export class RateLimitError extends APIError {
  /** Seconds to wait before retrying, from the `Retry-After` header. */
  get retryAfter(): number | null {
    const value = Number(this.headers.get("retry-after"));
    return Number.isFinite(value) && value > 0 ? value : null;
  }
}
export class ServerError extends APIError {}

export class APIConnectionError extends MistaError {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
  }
}
export class APITimeoutError extends APIConnectionError {}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function parseFieldErrors(body: unknown): FieldError[] {
  if (!isRecord(body)) return [];
  const { detail, errors } = body;
  if (Array.isArray(detail)) {
    return detail.filter(isRecord).map((d) => {
      const loc = Array.isArray(d.loc) ? d.loc : [];
      const last = loc.length > 1 ? loc[loc.length - 1] : null;
      return {
        field: last == null ? null : String(last),
        message: String(d.msg ?? ""),
        type: d.type == null ? null : String(d.type),
      };
    });
  }
  if (isRecord(errors)) {
    return Object.entries(errors).flatMap(([field, messages]) =>
      (Array.isArray(messages) ? messages : [messages]).map((m) => ({
        field,
        message: String(m),
        type: null,
      }))
    );
  }
  return [];
}

export function errorMessage(body: unknown, status: number): string {
  if (isRecord(body)) {
    if (typeof body.message === "string" && body.message.trim()) return body.message;
    if (typeof body.detail === "string" && body.detail.trim()) return body.detail;
    const [first] = parseFieldErrors(body);
    if (first) return first.field ? `${first.field}: ${first.message}` : first.message;
  }
  if (typeof body === "string" && body.trim()) return body.slice(0, 300);
  return `Request failed with status ${status}`;
}

export function errorFromResponse(status: number, body: unknown, headers: Headers): APIError {
  const message = errorMessage(body, status);
  const args = [message, status, body, headers] as const;
  if (status === 400) return new BadRequestError(...args);
  if (status === 401) return new AuthenticationError(...args);
  if (status === 403) return new PermissionDeniedError(...args);
  if (status === 404) return new NotFoundError(...args);
  if (status === 422) return new ValidationError(...args);
  if (status === 429) return new RateLimitError(...args);
  if (status >= 500) return new ServerError(...args);
  return new APIError(...args);
}
