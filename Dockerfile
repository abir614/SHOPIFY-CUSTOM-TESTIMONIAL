FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src/ ./src/
#------------------------MAIN DOCKER------------------------
FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    FILE_STORAGE=local \
    UPLOAD_DIR=/tmp/uploads
EXPOSE 8080
CMD ["src/server.js"]
