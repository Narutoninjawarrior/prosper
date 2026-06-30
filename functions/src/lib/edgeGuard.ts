import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

let freezeCache = {
  isFrozen: false,
  reason: 'unknown',
  lastCheck: 0,
};

export async function applyGlobalFreeze(
  req: functions.Request,
  res: functions.Response
): Promise<boolean> {
  const now = Date.now();
  if (now - freezeCache.lastCheck > 60000) {
    try {
      const doc = await admin.firestore().collection('system').doc('flags').get();
      if (doc.exists) {
        const data = doc.data() || {};
        freezeCache.isFrozen = data.global_freeze === true;
        freezeCache.reason = data.freeze_reason || 'Manual operator freeze active.';
      } else {
        freezeCache.isFrozen = false;
      }
      freezeCache.lastCheck = now;
    } catch (err) {
      // If we cannot read the freeze state, fail closed to be safe?
      // "Failure policy: if freeze state cannot be read: fail open for public read-only routes; fail closed only on routes where we explicitly apply this middleware"
      // Wait, we are explicitly applying this to write routes, so we SHOULD fail closed.
      freezeCache.isFrozen = true;
      freezeCache.reason = 'Cannot read system state. Failing closed for safety.';
      // We don't update lastCheck so it tries again next time
    }
  }

  if (freezeCache.isFrozen) {
    res.status(503).json({
      error: 'system_frozen',
      reason: freezeCache.reason,
      note: 'Write and execution routes are temporarily paused by operator control.'
    });
    return false;
  }

  return true;
}

type WindowCounter = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  bucket: string;
  windowMs: number;
  max: number;
};

const counters = new Map<string, WindowCounter>();
let requestSerial = 0;

function pruneCounters(now: number): void {
  for (const [key, value] of counters.entries()) {
    if (value.resetAt <= now) counters.delete(key);
  }
}

export function getClientIp(req: functions.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0 && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.ip || 'unknown';
}

export function applyRateLimit(
  req: functions.Request,
  res: functions.Response,
  options: RateLimitOptions,
): boolean {
  const now = Date.now();
  requestSerial += 1;
  if (requestSerial % 250 === 0 || counters.size > 5000) {
    pruneCounters(now);
  }

  const ip = getClientIp(req);
  const key = `${options.bucket}:${ip}`;
  const existing = counters.get(key);
  const entry =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + options.windowMs };

  entry.count += 1;
  counters.set(key, entry);

  const remaining = Math.max(0, options.max - entry.count);
  res.set('X-RateLimit-Limit', String(options.max));
  res.set('X-RateLimit-Remaining', String(remaining));
  res.set('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

  if (entry.count > options.max) {
    const retryAfter = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
    res.set('Retry-After', String(retryAfter));
    res.status(429).json({
      error: 'rate_limit',
      bucket: options.bucket,
      limit: options.max,
      window_seconds: Math.ceil(options.windowMs / 1000),
      retry_after_seconds: retryAfter,
      note: 'Public edge throttled to protect uptime and billing.',
    });
    return false;
  }

  return true;
}

export function applyBodyLimit(
  req: functions.Request,
  res: functions.Response,
  maxBytes: number,
): boolean {
  const rawBody = (req as functions.Request & { rawBody?: Buffer }).rawBody;
  if (rawBody && rawBody.length > maxBytes) {
    res.status(413).json({
      error: 'payload_too_large',
      max_bytes: maxBytes,
    });
    return false;
  }
  return true;
}
