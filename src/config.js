import 'dotenv/config';

const REQUIRED_ENV = ['SHOPIFY_STORE_DOMAIN', 'SHOPIFY_API_VERSION', 'SHOPIFY_ADMIN_TOKEN'];
const SHOPIFY_DOMAIN_RE = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/i;

export class ConfigError extends Error {}

function parseOrigins(raw) {
  return (raw || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseBool(raw) {
  return String(raw ?? '').trim().toLowerCase() === 'true';
}

function loadConfig() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k] || !String(process.env[k]).trim());
  if (missing.length) {
    throw new ConfigError(`Missing required environment variable(s): ${missing.join(', ')}`);
  }

  // The original Worker re-validated this regex on every single request.
  // There is exactly one process boot per deploy, so we validate the
  // Shopify domain shape ONCE here and refuse to start on a bad value,
  // instead of paying that check (and risking a bad value slipping
  // through inconsistently) on every incoming request.
  const domain = process.env.SHOPIFY_STORE_DOMAIN.trim();
  if (!SHOPIFY_DOMAIN_RE.test(domain)) {
    throw new ConfigError(`SHOPIFY_STORE_DOMAIN "${domain}" is not a valid *.myshopify.com domain`);
  }

  const apiVersion = process.env.SHOPIFY_API_VERSION.trim();

  const allowedOrigins = parseOrigins(process.env.ALLOWED_ORIGINS);
  if (allowedOrigins.length === 0) {
    throw new ConfigError(
      'ALLOWED_ORIGINS must be set to a comma-separated list of allowed origins (or "*" to allow any, not recommended in production)'
    );
  }

  const allowUnverified = parseBool(process.env.ALLOW_UNVERIFIED_SUBMISSIONS);
  if (!process.env.TURNSTILE_SECRET_KEY && !allowUnverified) {
    // Loud warning at boot, not buried per-request in logs.
    console.error(
      '[config] TURNSTILE_SECRET_KEY is not set. Every submission will be REJECTED until it is ' +
        'configured, or ALLOW_UNVERIFIED_SUBMISSIONS=true is set (local/dev only).'
    );
  }

  return Object.freeze({
    port: Number(process.env.PORT) || 8787,
    // 'loopback' is safe-by-default: only trust X-Forwarded-* headers from
    // localhost. Set to the number of trusted proxy hops (e.g. "1") or a
    // specific IP/CIDR when deploying behind Cloudflare/Nginx.
    trustProxy: process.env.TRUST_PROXY || 'loopback',
    shopify: Object.freeze({
      domain,
      apiVersion,
      adminToken: process.env.SHOPIFY_ADMIN_TOKEN,
      // Computed once, reused for every request instead of being rebuilt
      // from string parts on every call.
      graphqlUrl: `https://${domain}/admin/api/${apiVersion}/graphql.json`,
      timeoutMs: Number(process.env.SHOPIFY_TIMEOUT_MS) || 10_000,
    }),
    turnstile: Object.freeze({
      secretKey: process.env.TURNSTILE_SECRET_KEY || null,
      allowUnverified,
      verifyUrl: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      timeoutMs: Number(process.env.TURNSTILE_TIMEOUT_MS) || 5_000,
    }),
    cors: Object.freeze({ allowedOrigins }),
    limits: Object.freeze({
      maxFieldLength: 1000,
      maxFieldBytes: 10 * 1024, // generous ceiling before our own 1000-char slice runs
      maxFileBytes: 10 * 1024 * 1024,
      maxBodyBytes: 10 * 1024 * 1024 + 65536,
      maxFormFields: 40,
    }),
    rateLimit: Object.freeze({
      windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
      max: Number(process.env.RATE_LIMIT_MAX) || 20,
    }),
  });
}

// This runs exactly once, at module load / process boot — every request
// handler downstream imports this same frozen object instead of re-reading
// process.env or re-deriving the Shopify URL / origin list per request.
export let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`[config] ${err.message}`);
  process.exit(1);
}
