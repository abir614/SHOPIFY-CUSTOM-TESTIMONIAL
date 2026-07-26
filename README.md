# story-intake-api

Node.js/Express port of the original Cloudflare Worker (Turnstile-verified
story submissions written to Shopify metaobjects). Same request/response
contract as the Worker — same field names, same error messages, same
status codes — so your existing frontend form doesn't need to change.

## Setup

```bash
npm install
cp .env.example .env   # then fill in real values
npm start               # or: npm run dev  (auto-restart on change)
```

Requires Node 20+ (uses built-in `fetch`, `AbortSignal.timeout`, and
`undici`'s connection-pooling `Agent`).

## What changed vs. the Worker, and why

**Security**
- Security headers (CSP, HSTS, X-Frame-Options, etc.) are now applied to
  *every* response, including CORS preflights and 404s. The original only
  attached them inside its `jsonResponse()` helper, so preflight responses
  skipped them.
- `multer` 2.x is used instead of 1.x — the 1.x line has known CVEs that
  are fixed in 2.x.
- Uploaded files are still identified by sniffing magic bytes, never by
  the client-supplied `Content-Type` or filename — this is unchanged and
  deliberate.
- JPEG EXIF stripping is a direct, unit-tested port of the original
  byte-level marker-walking logic (no image library dependency, so no
  extra attack surface).
- Turnstile still fails closed: if `TURNSTILE_SECRET_KEY` isn't set, every
  submission is rejected unless you explicitly set
  `ALLOW_UNVERIFIED_SUBMISSIONS=true` (local dev only).
- Config is validated once at boot and the process refuses to start on a
  bad `SHOPIFY_STORE_DOMAIN` or missing secrets — you find out at deploy
  time, not on a user's first request.
- Added a rate limiter (`express-rate-limit`, IP-keyed) on `POST /` — the
  Worker had no equivalent, since Cloudflare's own edge usually absorbs
  that job in front of a Worker. A standalone Node process has no such
  edge in front of it by default, so this fills that gap.
- `X-Powered-By` is disabled; `trust proxy` is explicit and off by default
  (`loopback`) so `req.ip` can't be spoofed via `X-Forwarded-For` unless
  you deliberately configure it for your real proxy setup.

**Resource optimization ("one-time recognition")**
The Worker re-did several things on *every single request* that only ever
need to happen once per process lifetime. This port moves them to boot
time and reuses the result:
- **Outbound HTTP connections**: one pooled, keep-alive `undici.Agent`
  (`src/lib/httpAgent.js`) is created once and reused for every call to
  Turnstile and Shopify, avoiding a fresh TCP+TLS handshake per request.
- **Env parsing & validation**: `SHOPIFY_STORE_DOMAIN` regex validation,
  the derived Shopify GraphQL URL, and the parsed `ALLOWED_ORIGINS` list
  are all computed once in `src/config.js` at startup and frozen, not
  recomputed per request.
- **Middleware/route wiring**: `multer`, the rate limiter, and the Express
  app itself are constructed once at module load, not per request.

**Everything else** — required-field checks, email regex, the
allow-listed field list (prevents mass assignment), the honeypot field,
the pet-story field merging, the testimonial-vs-story_intake branching,
and all response messages/shapes — is a faithful line-for-line port of
the original logic, and was tested against a running instance during
development (health check, CORS allow/deny, honeypot, validation errors,
duplicate/invalid file uploads, rate limiting, and the full Shopify
GraphQL round trip all verified working).

## Project layout

```
src/
  index.js            entry point, graceful shutdown
  app.js              Express app: middleware + route wiring
  config.js            env loading/validation (once, at boot)
  middleware/
    security.js        security headers
    cors.js             origin allow-list + preflight
    bodySizeGuard.js    early Content-Length rejection
    rateLimit.js        per-IP rate limiting
  routes/
    submit.js           POST / handler (the core business logic)
  lib/
    httpAgent.js        shared keep-alive Agent for outbound fetch
    turnstile.js         Cloudflare Turnstile verification
    shopify.js            GraphQL client + staged image upload
    image.js               magic-byte sniffing + JPEG EXIF stripping
    validation.js           allow-listed fields, regexes, sanitizers
    ip.js                    client IP resolution
    logger.js                 timestamped console logger
```

## Deploying

This is a plain Express app — run it with `pm2`, a `systemd` service, or
inside a container, and put it behind Cloudflare or Nginx for TLS
termination. If you do put a reverse proxy in front of it:
- Set `TRUST_PROXY` appropriately (see `.env.example`).
- If not behind Cloudflare, remove reliance on `CF-Connecting-IP` in
  `src/lib/ip.js` — it will fall back to `req.ip` automatically if that
  header isn't present, so it degrades safely, but double check your real
  client IPs show up correctly in logs before relying on rate limiting.

Example minimal `systemd` unit:

```ini
[Unit]
Description=story-intake-api
After=network.target

[Service]
WorkingDirectory=/opt/story-intake-api
ExecStart=/usr/bin/node src/index.js
EnvironmentFile=/opt/story-intake-api/.env
Restart=on-failure
User=nobody

[Install]
WantedBy=multi-user.target
```
