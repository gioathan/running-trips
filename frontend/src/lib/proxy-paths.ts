import "server-only";

/** True if any path segment could change where the request lands once the
 * backend URL is assembled ("..", an encoded slash, …). */
function hasUnsafeSegment(path: string[]): boolean {
  return path.some((segment) => segment === "" || segment === "." || segment === ".." || /[\\/]/.test(segment));
}

// Reached only through their dedicated route handlers, which put the tokens
// into httpOnly cookies. Through the generic proxy the same calls would
// hand the raw tokens to page JavaScript.
const TOKEN_ISSUING_AUTH = new Set(["login", "signup", "google", "refresh", "logout"]);

/** What the signed-in *user* proxy (/api/backend/*) may forward. */
export function isAllowedUserProxyPath(path: string[]): boolean {
  if (hasUnsafeSegment(path)) return false;
  if (path[0] === "admin") return false; // admin API has its own proxy and session
  if (path[0] === "auth" && TOKEN_ISSUING_AUTH.has(path[1])) return false;
  if (path[0] === "payments" && path[1] === "webhook") return false; // Stripe → backend only
  return true;
}

/** What the *admin* proxy (/api/admin-backend/*) may forward. */
export function isAllowedAdminProxyPath(path: string[]): boolean {
  if (hasUnsafeSegment(path)) return false;
  // The admin session is only ever needed for /admin/*. Token-issuing admin
  // auth calls go through /api/admin-auth/* instead.
  return path[0] === "admin" && path[1] !== "auth";
}
