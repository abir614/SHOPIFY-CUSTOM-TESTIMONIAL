// Applied to EVERY response (the original Worker only attached these
// headers inside its jsonResponse() helper, which meant the OPTIONS
// preflight path skipped them entirely). Consistency here is the safer
// default for "security at its peak."
export function securityHeaders(req, res, next) {
  res.set({
    'Content-Security-Policy': "default-src 'none'",
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '0',
    'Referrer-Policy': 'no-referrer',
    'Cross-Origin-Resource-Policy': 'same-site',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  });
  next();
}
