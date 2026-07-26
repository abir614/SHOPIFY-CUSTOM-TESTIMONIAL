import { createApp } from './app.js';
import { config } from './config.js';
import { closeOutboundAgent } from './lib/httpAgent.js';
import { logger } from './lib/logger.js';

const app = createApp();

// Explicit 0.0.0.0 bind: relying on Node's implicit default here is a
// common source of "Fly proxy can't reach the Machine" failures — Fly's
// own docs call this out specifically (must be 0.0.0.0, not localhost).
const server = app.listen(config.port, '0.0.0.0', () => {
  logger.info(`[server] story-intake-api listening on 0.0.0.0:${config.port}`);
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

  server.close(async (err) => {
    if (err) logger.error('[server] error while closing HTTP server:', err);
    await closeOutboundAgent();
    process.exit(err ? 1 : 0);
  });
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
