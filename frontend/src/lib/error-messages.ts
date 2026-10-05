// Backend returns a stable `code`, never a localized message
// (BACKEND_PLAN.md §10) — this maps that code to a key under the
// "errors" namespace in messages/{locale}.json.
const CODE_TO_KEY: Record<string, string> = {
  INVALID_CREDENTIALS: "invalidCredentials",
  ADMIN_ACCOUNT: "adminAccount",
  USE_GOOGLE_SIGN_IN: "useGoogleSignIn",
  USE_PASSWORD_SIGN_IN: "usePasswordSignIn",
  GOOGLE_ACCOUNT_NOT_REGISTERED: "googleAccountNotRegistered",
  EMAIL_ALREADY_REGISTERED: "emailAlreadyRegistered",
  TRIP_FULL: "tripFull",
  TRIP_NOT_BOOKABLE: "tripNotBookable",
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
