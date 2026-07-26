import { config } from '../config.js';

// Fast-fail on Content-Length before spending any CPU/memory on multipart
// parsing. multer's own per-file/per-field limits are the real backstop
// for chunked requests that omit Content-Length.
export function bodySizeGuard(req, res, next) {
  const declaredLength = Number(req.headers['content-length'] || 0);
  if (declaredLength > config.limits.maxBodyBytes) {
    return res.status(413).json({ error: 'Request body too large.' });
  }
  next();
}
