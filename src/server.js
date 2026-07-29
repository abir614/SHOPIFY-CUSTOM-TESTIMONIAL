import express from "express";
import { connectDb, closeDb } from "./db.js";
import { handleRequest } from "./index.js";
import { getSystemLoadFactor } from "./security.js";

const REQUIRED_ENV = ["MONGODB_URI", "JWT_SECRET", "ENCRYPTION_KEY"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[startup] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || "0.0.0.0";

const app = express();

app.use((req, res, next) => {
  if (getSystemLoadFactor() < 0.4 && req.path !== "/health") {
    res.status(503).setHeader("Retry-After", "30").json({ error: "Server under heavy load. Please retry shortly." });
    return;
  }
  next();
});

app.use(
  express.raw({
    type: "*/*",
    limit: "11mb",
  })
);

app.use(async (req, res) => {
  const proto = req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http");
  const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`;
  const url = `${proto}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const v of value) headers.append(name, v);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  if (req.socket?.remoteAddress && !headers.has("X-Forwarded-For")) {
    headers.set("X-Real-IP", req.socket.remoteAddress);
  }

  const hasBody = req.body instanceof Buffer && req.body.length > 0;
  const webRequest = new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    ...(hasBody ? { duplex: "half" } : {}),
  });

  let webResponse;
  try {
    webResponse = await handleRequest(webRequest);
  } catch (err) {
    console.error("[server] Unhandled error in handleRequest:", err);
    res.status(500).json({ error: "Internal server error." });
    return;
  }

  res.status(webResponse.status);
  for (const [name, value] of webResponse.headers) {
    res.setHeader(name, value);
  }

  const body = await webResponse.arrayBuffer();
  res.end(Buffer.from(body));
});

async function start() {
  try {
    console.info("[startup] Connecting to MongoDB…");
    await connectDb();

    const server = app.listen(PORT, HOST, () => {
      console.info(`[startup] FormHub listening on http://${HOST}:${PORT}`);
    });

    const shutdown = async (signal) => {
      console.info(`[shutdown] Received ${signal}. Closing server…`);
      server.close(async () => {
        await closeDb();
        console.info("[shutdown] Clean exit.");
        process.exit(0);
      });
      setTimeout(() => {
        console.error("[shutdown] Forced exit after timeout.");
        process.exit(1);
      }, 10_000).unref();
    };

    process.once("SIGTERM", () => shutdown("SIGTERM"));
    process.once("SIGINT", () => shutdown("SIGINT"));
  } catch (err) {
    console.error("[startup] Failed to start:", err);
    process.exit(1);
  }
}

start();
