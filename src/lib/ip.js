// CF-Connecting-IP is only trustworthy if the request truly came through
// Cloudflare (i.e. this process sits behind Cloudflare, or behind a proxy
// that itself strips/re-sets this header for untrusted clients). If you
// are NOT behind Cloudflare, unset this expectation and rely on
// `req.ip`, which honors Express's `trust proxy` setting instead.
export function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) return cfIp.trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}
