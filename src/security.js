import os from "node:os";
export const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; frame-src https://challenges.cloudflare.com; img-src 'self' data: https:; connect-src 'self' https:;",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "0",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
};
export function jsonResponse(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
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
  if (!isAllowed) return new Response(null, { status: 403, headers: SECURITY_HEADERS });
  return new Response(null, {
    status: 204,
    headers: {
      ...SECURITY_HEADERS,
      "Access-Control-Allow-Origin": allowedOrigins.includes("*") ? "*" : origin,
      "Access-Control-Allow-Methods": allowMethods,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
}
export function getSystemLoadFactor() {
  const memUsage = process.memoryUsage();
  const heapRatio = memUsage.heapUsed / (memUsage.heapTotal || 1);
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const osRatio = totalMem > 0 ? (totalMem - freeMem) / totalMem : 0;
  const maxPressure = Math.max(heapRatio, osRatio);
  if (maxPressure > 0.85) return 0.4;
  if (maxPressure > 0.70) return 0.7;
  return 1.0;
}
const rateLimitStore = new Map();
setInterval(() => {
  const now = Math.floor(Date.now() / 1000);
  const loadFactor = getSystemLoadFactor();
  const maxAge = loadFactor < 0.5 ? 60 : 120;
  for (const [key, entry] of rateLimitStore) {
    if (now - entry.windowIndex * 60 > maxAge) rateLimitStore.delete(key);
  }
}, 60 * 1000).unref();
export function checkRateLimit(_env, key, baseLimit = 20, windowSeconds = 60) {
  const loadFactor = getSystemLoadFactor();
  const effectiveLimit = Math.max(5, Math.floor(baseLimit * loadFactor));
  const windowIndex = Math.floor(Date.now() / 1000 / windowSeconds);
  const storeKey = `rl:${key}:${windowIndex}`;
  const entry = rateLimitStore.get(storeKey);
  if (entry && entry.count >= effectiveLimit) return false;
  rateLimitStore.set(storeKey, { count: (entry?.count ?? 0) + 1, windowIndex });
  return true;
}
export function clientIp(request) {
  const xff = request.headers.get("X-Forwarded-For");
  if (xff) return xff.split(",")[0].trim();
  return request.headers.get("X-Real-IP") || request.headers.get("CF-Connecting-IP") || "unknown";
}
export async function verifyPlatformTurnstile(token, ip) {
  const secret = process.env.PLATFORM_TURNSTILE_SECRET_KEY;
  if (!secret) return true; 
  if (!token) return false;
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    console.error("[turnstile] platform verification failed:", err);
    return false;
  }
}
