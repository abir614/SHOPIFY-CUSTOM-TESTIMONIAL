FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY src/ ./src/
#--------------------------MAIN DOCKER----------------------------
FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
COPY --from=build --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=build --chown=nonroot:nonroot /app/src ./src
COPY --from=build --chown=nonroot:nonroot /app/package.json ./
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    FILE_STORAGE=local \
    UPLOAD_DIR=/tmp/uploads
USER nonroot
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/health').then(r=>{process.exit(r.status===200?0:1)}).catch(()=>process.exit(1))"]
CMD ["src/server.js"]
