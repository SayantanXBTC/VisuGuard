import express from 'express';
import fs from 'node:fs';
import { supabaseConfigured } from './supabase.js';
import { requireUser } from './auth.js';
import { STORAGE_DIR } from './screenshotter.js';
import { rateLimit, byIp } from './rateLimit.js';
import testsRouter from './routes/tests.js';
import comparisonsRouter from './routes/comparisons.js';
import chatRouter from './routes/chat.js';

const PORT = process.env.PORT || 3001;

// Screenshots live in STORAGE_DIR: <testId>/baseline | current | diff
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const app = express();
app.set('trust proxy', 1); // Railway/Render sit behind a proxy: req.ip must read the real client IP
app.use(express.json());

// Basic hardening headers. No templated HTML is ever served here (the frontend is a separate app),
// so this is mostly about not letting the API responses be framed, sniffed or leaked cross-origin.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// A generous, first line of defense against scripted abuse, ahead of auth and the per-route limits below.
app.use('/api', rateLimit({ limit: 300, windowMs: 5 * 60_000, keyFn: byIp, message: 'Too many requests from this address. Please slow down.' }));

// Serve screenshot PNGs, for example /files/<testId>/baseline/home.png
app.use('/files', express.static(STORAGE_DIR));

app.get('/api/health', (req, res) => {
  res.json({ ok: true, supabaseConfigured });
});

// Edith, the in-app assistant (public: the home and sign-in screens use it too)
app.use('/api/chat', chatRouter);

// Test management. requireUser rejects requests without a valid Supabase token.
app.use('/api/tests', requireUser, testsRouter);
app.use('/api/comparisons', requireUser, comparisonsRouter);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// Any error thrown in a route ends up here. Details go to the server log, not to the user.
app.use((err, req, res, next) => {
  console.error(err);
  if (err.status && err.status < 500) {
    return res.status(err.status).json({ error: 'Invalid request.' });
  }
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

// While a browser is open, Playwright installs its own SIGTERM handler, and that stops Node
// from exiting. Exit explicitly so `kill` and `node --watch` restarts work during a capture.
// (Chromium closes by itself when the server process ends.)
process.on('SIGTERM', () => process.exit(0));

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
