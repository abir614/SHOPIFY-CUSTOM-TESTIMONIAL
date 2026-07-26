import express from 'express';
import multer from 'multer';
import { config } from './config.js';
import { securityHeaders } from './middleware/security.js';
import { checkOrigin, handlePreflight } from './middleware/cors.js';
import { bodySizeGuard } from './middleware/bodySizeGuard.js';
import { submitRateLimiter } from './middleware/rateLimit.js';
import { handleSubmit } from './routes/submit.js';
import { logger } from './lib/logger.js';

// multer instance is created once at module load and reused for every
// request — it holds no per-request state itself, so there is no benefit
// (and real cost) to constructing it inside the request handler.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.limits.maxFileBytes,
    files: 1,
    fields: config.limits.maxFormFields,
    fieldNameSize: 100,
    fieldSize: config.limits.maxFieldBytes,
  },
}).single('user_image');

function mapUploadError(err) {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return { status: 400, error: 'The uploaded file is too large.' };
    case 'LIMIT_UNEXPECTED_FILE':
    case 'LIMIT_FILE_COUNT':
      return { status: 400, error: 'Only one image may be uploaded.' };
    case 'LIMIT_FIELD_COUNT':
    case 'LIMIT_FIELD_VALUE':
    case 'LIMIT_FIELD_KEY':
      return { status: 400, error: 'Invalid form submission.' };
    default:
      return { status: 400, error: 'Invalid form submission.' };
  }
}

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // Global — applied to every response, including preflights and 404s.
  app.use(securityHeaders);

  // Global OPTIONS preflight handling, regardless of path (matches the
  // original Worker's behavior).
  app.options('*', handlePreflight);

  app.get('/health', (req, res) => {
    res.status(200).json({ ok: true });
  });

  app.post(
    '/',
    (req, res, next) => {
      const { allowed, headers } = checkOrigin(req);
      res.set(headers);
      if (!allowed) return res.status(403).json({ error: 'Forbidden' });
      next();
    },
    bodySizeGuard,
    submitRateLimiter,
    (req, res, next) => {
      upload(req, res, (err) => {
        if (!err) return next();
        if (err instanceof multer.MulterError) {
          const { status, error } = mapUploadError(err);
          return res.status(status).json({ error });
        }
        logger.error('[upload]', err?.message || err);
        return res.status(400).json({ error: 'Invalid form submission.' });
      });
    },
    handleSubmit
  );

  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  // Final safety net for anything thrown/rejected in a handler above.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    logger.error('[unhandled]', err?.stack || err);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
  });

  return app;
}
