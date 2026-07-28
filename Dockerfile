# =============================================================================
#  FormHub — Multi-stage Docker build
#
#  Stage 1 (builder): installs production dependencies on a full Alpine image.
#  Stage 2 (runner):  copies only the artifact into a distroless nonroot image.
#
#  Result: minimal attack surface — no shell, no package manager, no OS tools,
#          runs as UID 65532 (nonroot) — cannot write to / or escalate privs.
# =============================================================================

# ── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package manifests first to exploit Docker layer caching.
# If package.json/package-lock.json don't change, npm ci is skipped.
COPY package*.json ./

# Install ONLY production dependencies.
# --ignore-scripts prevents malicious lifecycle scripts in transitive deps.
# --omit=dev skips devDependencies entirely.
RUN npm ci --omit=dev --ignore-scripts

# Copy application source (everything except what's in .dockerignore)
COPY src/ ./src/

# ── Stage 2: Distroless Runtime ───────────────────────────────────────────────
# gcr.io/distroless/nodejs22-debian12:nonroot ships:
#   - Node.js 22 runtime only (no npm, no shell, no curl, no package managers)
#   - Runs as user 'nonroot' (UID 65532, GID 65532) by default
#   - No writable filesystem except /tmp
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner

WORKDIR /app

# Copy production node_modules from the builder stage
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY --from=builder /app/src ./src

# Copy package.json so Node can resolve "type": "module"
COPY --from=builder /app/package.json ./

# ── Environment defaults ──────────────────────────────────────────────────────
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    FILE_STORAGE=local \
    UPLOAD_DIR=/tmp/uploads

# Expose the application port (overridable via PORT env var)
EXPOSE 3000

# The distroless image's CMD uses the node binary directly.
# We specify the entrypoint as an array (exec form) to ensure SIGTERM is
# delivered directly to the Node process (no intermediate shell).
CMD ["src/server.js"]
