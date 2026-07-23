# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Stage 1: install exact, production-only dependencies in an isolated layer.
# --ignore-scripts blocks arbitrary install-time scripts from dependencies
# (supply-chain defense-in-depth). npm ci requires the committed lockfile,
# guaranteeing the versions built are the versions audited.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# ---------------------------------------------------------------------------
# Stage 2: minimal runtime image. Only node_modules + app source are copied
# in — no build tools, no lockfile, no npm cache, no shell history.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS runtime

RUN apk add --no-cache tini \
    && rm -rf /var/cache/apk/*

ENV NODE_ENV=production \
    PORT=8080 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node server.js ./

# Run as the image's built-in unprivileged user (uid 1000), never root.
USER node

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>{process.exit(r.status===200?0:1)}).catch(()=>process.exit(1))"

# tini as PID 1 for correct signal forwarding (SIGTERM) and zombie reaping.
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
