// Headers that let the backend see the real end user behind this server
// (backend `client_ip()` in core/dependencies.py). Without them every
// proxied call looks like it came from this server's IP, so the backend's
// per-IP rate limits would collapse into one shared bucket for all users.
// The IP is only trusted alongside the shared secret. Takes a plain
// `Headers` so both route handlers and Edge middleware can use it.
export function proxyHeaders(incoming: Headers): Record<string, string> {
  const secret = process.env.BACKEND_PROXY_SECRET;
  const ip = incoming.get("x-forwarded-for")?.split(",")[0]?.trim() || incoming.get("x-real-ip")?.trim();
  const userAgent = incoming.get("user-agent");

  return {
    ...(secret && ip ? { "X-Proxy-Secret": secret, "X-Client-IP": ip } : {}),
    ...(userAgent ? { "User-Agent": userAgent } : {}),
  };
}
