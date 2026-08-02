FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY src/ ./src/

FROM build AS rem
RUN find node_modules -type f \( \
      -iname "*.md" -o -iname "*.markdown" -o -iname "license*" \
      -o -iname "*.map" -o -iname "*.ts" \
    \) -delete \
 && find node_modules -type d \( \
      -iname "test" -o -iname "tests" -o -iname "__tests__" \
      -o -iname ".github" -o -iname "docs" -o -iname "example*" \
    \) -prune -exec rm -rf {} +

FROM gcr.io/distroless/nodejs24-debian12:nonroot
WORKDIR /app
COPY --from=rem --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=build --chown=nonroot:nonroot /app/src ./src
COPY --from=build --chown=nonroot:nonroot /app/package.json ./
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=::
USER nonroot
EXPOSE 8080
CMD ["src/server.js"]
