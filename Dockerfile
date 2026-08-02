FROM 0abir/minimum:node AS build
WORKDIR /app/src
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY . .
ENV INPUT_DIR=/app/src
ENV OUTPUT_DIR=/app/src
RUN /opt/minimum/scripts/optimize.sh

FROM gcr.io/distroless/nodejs24-debian12:nonroot
WORKDIR /app
COPY --from=build --chown=nonroot:nonroot /app/src /app
ENV NODE_ENV=production \
    PORT=8080 \
    HOST=::
USER nonroot
EXPOSE 8080
CMD ["src/server.js"]
