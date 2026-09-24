// Simple in-memory rate limiter, same style as the one already used in routes/chat.js.
// State lives in this one process, which is fine: the app runs as a single backend instance.
export function rateLimit({ limit, windowMs, keyFn, message }) {
  const hits = new Map(); // key -> [timestamps]
  return (req, res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const recent = (hits.get(key) || []).filter((time) => now - time < windowMs);
    recent.push(now);
    hits.set(key, recent);
    if (recent.length > limit) {
      return res.status(429).json({ error: message || 'Too many requests. Please wait a moment and try again.' });
    }
    next();
  };
}

export const byUser = (req) => req.user?.id || req.ip || 'unknown';
export const byIp = (req) => req.ip || 'unknown';
