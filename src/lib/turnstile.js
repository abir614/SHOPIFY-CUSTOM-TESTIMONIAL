import { outboundAgent } from './httpAgent.js';
import { config } from '../config.js';
import { logger } from './logger.js';

export async function verifyTurnstile(token, remoteIp) {
  const { secretKey, allowUnverified, verifyUrl, timeoutMs } = config.turnstile;

  if (!secretKey) {
    if (allowUnverified) {
      logger.warn(
        '[turnstile] TURNSTILE_SECRET_KEY not set — allowing unverified submission because ALLOW_UNVERIFIED_SUBMISSIONS=true'
      );
      return true;
    }
    logger.error(
      '[turnstile] TURNSTILE_SECRET_KEY not set — rejecting submission (set ALLOW_UNVERIFIED_SUBMISSIONS=true to intentionally bypass, e.g. for local dev)'
    );
    return false;
  }

  if (!token || typeof token !== 'string') return false;

  const body = new URLSearchParams();
  body.set('secret', secretKey);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const res = await fetch(verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      dispatcher: outboundAgent,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    logger.error('[turnstile] verification request failed:', err?.message || String(err));
    return false;
  }
}
