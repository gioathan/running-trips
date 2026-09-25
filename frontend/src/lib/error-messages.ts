// Backend returns a stable `code`, never a localized message
// (BACKEND_PLAN.md §10) — this maps that code to a key under the
// "errors" namespace in messages/{locale}.json.
const CODE_TO_KEY: Record<string, string> = {
  INVALID_CREDENTIALS: "invalidCredentials",
  EMAIL_ALREADY_REGISTERED: "emailAlreadyRegistered",
  TRIP_FULL: "tripFull",
  NOT_FOUND: "notFound",
  VALIDATION_ERROR: "validationError",
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  RATE_LIMITED: "rateLimited",
  CONFLICT: "conflict",
};

export function errorMessageKey(code: string): string {
  return CODE_TO_KEY[code] ?? "generic";
}
