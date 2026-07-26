import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { getClientIp } from '../lib/ip.js';

// Created once at module load and reused for the life of the process —
// express-rate-limit keeps its counters in memory internally, so this
// single instance is the "resource" backing every request's rate check.
export const submitRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many submissions. Please try again later.' });
  },
});
