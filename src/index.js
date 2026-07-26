import http from 'node:http';
import { createApp } from './app.js';
import { config } from './config.js';
import { closeOutboundAgent } from './lib/httpAgent.js';
import { logger } from './lib/logger.js';

const app = createApp();

const serverV4 = http.createServer(app);
const serverV6 = http.createServer(app);

let ready = 0;
function announceReady() {
  ready += 1;
  if (ready === 1) {
    logger.info(`[server] story-intake-api listening on 0.0.0.0:${config.port} and [::]:${config.port}`);
  }
}

serverV4.listen(config.port, '0.0.0.0', announceReady);

serverV6.listen({ port: config.port, host: '::', ipv6Only: true }, announceReady);

let ipv6Available = true;
serverV6.on('error', (err) => {
  ipv6Available = false;
  logger.error('[server] IPv6 listener failed to start, continuing on IPv4 only:', err?.message || err);
});

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`[server] received ${signal}, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    logger.error('[server] graceful shutdown timed out, forcing exit');
    process.exit(1);
  }, 10_000);
  forceExit.unref();

  const closers = [new Promise((resolve) => serverV4.close(() => resolve()))];
  if (ipv6Available) {
    closers.push(new Promise((resolve) => serverV6.close(() => resolve())));
  }

  try {
    await Promise.all(closers);
  } catch (err) {
    logger.error('[server] error while closing HTTP server(s):', err);
  }
  await closeOutboundAgent();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  logger.error('[uncaughtException]', err?.stack || err);
  process.exit(1);
});
