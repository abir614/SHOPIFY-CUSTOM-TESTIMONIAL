# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Stage 1: install exact, production-only dependencies with --ignore-scripts
# (blocks arbitrary install-time scripts from deps — supply-chain defense).
# Built on the same Debian release (trixie) as the distroless runtime below,
# so glibc/ABI stay aligned if a native addon is ever added later.
# ---------------------------------------------------------------------------
FROM node:24-trixie-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
# ---------------------------------------------------------------------------
# Stage 2: distroless runtime. No shell, no package manager, no coreutils —
# an attacker who gets code execution inside the app has no `sh`, `curl`,
# `apt`, etc. to pivot with. Runs as the image's built-in "nonroot" user
# (uid 65532) by default.
# ---------------------------------------------------------------------------
FROM gcr.io/distroless/nodejs24-debian13:nonroot AS runtime
ENV NODE_ENV=production \
    PORT=8080
WORKDIR /app
COPY --from=deps --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --chown=nonroot:nonroot package.json ./
# Entry point is src/index.js, which pulls in the rest of the app (config,
# middleware/, routes/, lib/) via relative ESM imports — so the whole src/
# tree has to ship, not a single server.js file. No secrets live in this
# tree: SHOPIFY_ADMIN_TOKEN, TURNSTILE_SECRET_KEY, etc. are read from the
# environment at runtime (docker run --env-file) and are never baked into
# the image or the build context.
COPY --chown=nonroot:nonroot src ./src
# Redundant with the image default, but explicit for auditability.
USER nonroot
EXPOSE 8080
# No shell/curl available, so the healthcheck execs node directly and hits
# the app's own GET /health route.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>{process.exit(r.status===200?0:1)}).catch(()=>process.exit(1))"]
# This image's ENTRYPOINT is already ["/nodejs/bin/node"]; CMD just supplies
# the entry file, resolved relative to WORKDIR (/app/src/index.js). No
# tini/init wrapper needed — the app has no child processes, and
# src/index.js already handles SIGTERM/SIGINT for graceful shutdown
# (closes the HTTP server and the outbound keep-alive Agent before exit).
CMD ["src/index.js"]
