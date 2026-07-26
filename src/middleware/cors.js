import { config } from '../config.js';

const { allowedOrigins } = config.cors;

function isAllowedOrigin(origin) {
  return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
}

// Non-browser requests (curl, server-to-server, health checks) carry no
// Origin header at all — CORS is a browser concept, so those are always
// structurally "allowed" and get no CORS headers added.
export function checkOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return { allowed: true, headers: {} };
  if (isAllowedOrigin(origin)) {
    return { allowed: true, headers: { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } };
  }
  return { allowed: false, headers: { Vary: 'Origin' } };
}

// Global OPTIONS preflight handler — mirrors the original Worker, which
// answered every OPTIONS request the same way regardless of path.
export function handlePreflight(req, res) {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.set({
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '600',
      Vary: 'Origin',
    });
    return res.status(204).end();
  }
  return res.status(403).end();
}
