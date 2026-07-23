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
COPY --chown=nonroot:nonroot server.js ./

# Redundant with the image default, but explicit for auditability.
USER nonroot

EXPOSE 8080

# No shell/curl available, so the healthcheck execs node directly.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>{process.exit(r.status===200?0:1)}).catch(()=>process.exit(1))"]

# This image's ENTRYPOINT is already ["/nodejs/bin/node"]; CMD just supplies
# the entry file. No tini/init wrapper needed — the app has no child
# processes, and server.js already handles SIGTERM/SIGINT for graceful
# shutdown (see the bottom of server.js).
CMD ["server.js"]
