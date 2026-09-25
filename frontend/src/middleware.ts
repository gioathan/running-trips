import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip API routes, admin (no locale prefix — internal tool, per
  // BACKEND_PLAN.md's separate admin auth path), and static assets.
  matcher: ["/((?!api|admin|_next|favicon.ico|.*\\..*).*)"],
};
