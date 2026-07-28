export const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "no-referrer",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
};

export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...SECURITY_HEADERS,
      ...extraHeaders,
    },
  });
}

function parseOriginList(raw) {
  return (raw || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Check whether the request's Origin header is allowed, given a list of
 * allowed origins (may include "*"). Returns { allowed, headers }.
 * If the request has no Origin header at all (e.g. server-to-server, curl),
 * it's treated as allowed with no CORS headers added.
 */
export function checkOrigin(request, allowedOriginsRaw) {
  const origin = request.headers.get("Origin");
  if (!origin) return { allowed: true, headers: {} };
  const allowedOrigins = Array.isArray(allowedOriginsRaw) ? allowedOriginsRaw : parseOriginList(allowedOriginsRaw);
  if (allowedOrigins.includes("*")) {
    return { allowed: true, headers: { "Access-Control-Allow-Origin": "*", Vary: "Origin" } };
  }
  if (allowedOrigins.includes(origin)) {
    return { allowed: true, headers: { "Access-Control-Allow-Origin": origin, Vary: "Origin" } };
  }
  return { allowed: false, headers: { Vary: "Origin" } };
}

export function handlePreflight(request, allowedOriginsRaw, allowMethods = "POST, OPTIONS") {
  const origin = request.headers.get("Origin");
  const allowedOrigins = Array.isArray(allowedOriginsRaw) ? allowedOriginsRaw : parseOriginList(allowedOriginsRaw);
  const isAllowed = origin && (allowedOrigins.includes("*") || allowedOrigins.includes(origin));
  if (!isAllowed) return new Response(null, { status: 403 });
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": allowedOrigins.includes("*") ? "*" : origin,
      "Access-Control-Allow-Methods": allowMethods,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
}

// ---------------------------------------------------------------------------
// In-memory fixed-window rate limiter (replaces Cloudflare KV-backed limiter).
// Suitable for single-process deployments. For multi-instance, swap for Redis.
// ---------------------------------------------------------------------------

/** @type {Map<string, { count: number; windowIndex: number }>} */
const rateLimitStore = new Map();

// Purge stale windows every 5 minutes to prevent unbounded memory growth.
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  for (const [key, entry] of rateLimitStore) {
    // Remove entries whose window is clearly in the past (>2 windows old).
    if (now - entry.windowIndex * 60 > 120) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000).unref(); // .unref() so the timer doesn't block process exit

/**
 * Simple fixed-window rate limiter.
 * Returns true if the request is allowed, false if it should be rejected.
 *
 * @param {*} _env   Ignored (kept for API compatibility with Worker version)
 * @param {string} key
 * @param {number} limit
 * @param {number} windowSeconds
 */
export function checkRateLimit(_env, key, limit = 20, windowSeconds = 60) {
  const windowIndex = Math.floor(Date.now() / 1000 / windowSeconds);
  const storeKey = `rl:${key}:${windowIndex}`;
  const entry = rateLimitStore.get(storeKey);
  if (entry && entry.count >= limit) return false;
  rateLimitStore.set(storeKey, { count: (entry?.count ?? 0) + 1, windowIndex });
  return true;
}

/**
 * Extract the real client IP from the request, honouring X-Forwarded-For
 * (set by load balancers / reverse proxies) and falling back to the direct
 * socket address.
 */
export function clientIp(request) {
  // X-Forwarded-For: client, proxy1, proxy2 — take the first (leftmost) hop.
  const xff = request.headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0].trim();
  // Express sets request.socket?.remoteAddress via the adapter.
  return request.headers.get("X-Real-IP") || request.headers.get("CF-Connecting-IP") || "unknown";
}
