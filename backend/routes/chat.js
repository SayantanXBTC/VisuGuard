import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { EDITH_PROMPT } from '../edithKnowledge.js';

// Edith, the in-app assistant. Public (the home and sign-in screens use it too), so it is limited:
// short messages, a few turns of history, and a per-address request limit. Uses the same Anthropic
// key (AI_API_KEY) as the AI visual analysis and is the only provider — no fallback chain needed.
const router = Router();

const MODEL = process.env.EDITH_MODEL || 'claude-haiku-4-5-20251001';
const MAX_MESSAGES = 10; // turns of history sent to the model
const MAX_LENGTH = 500; // characters per message
const LIMIT = 20; // requests per address per minute
const REQUEST_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 30_000;
const hits = new Map(); // address -> [timestamps]

function tooMany(address) {
  const now = Date.now();
  const recent = (hits.get(address) || []).filter((time) => now - time < 60_000);
  recent.push(now);
  hits.set(address, recent);
  return recent.length > LIMIT;
}

let client = null;
const askClient = () => (client ??= new Anthropic({
  apiKey: process.env.AI_API_KEY,
  baseURL: process.env.AI_BASE_URL || undefined,
  timeout: REQUEST_TIMEOUT_MS,
  maxRetries: 1,
}));

const startStream = (res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.flushHeaders();
};

router.post('/', async (req, res) => {
  if (!process.env.AI_API_KEY) return res.status(503).json({ error: 'Edith is not set up yet. Add AI_API_KEY to backend/.env and restart the backend.' });
  if (tooMany(req.ip || 'unknown')) return res.status(429).json({ error: 'Too many messages. Please wait a moment.' });

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const turns = incoming
    .filter((message) => (message?.role === 'user' || message?.role === 'assistant') && typeof message.content === 'string' && message.content.trim())
    .slice(-MAX_MESSAGES)
    .map((message) => ({ role: message.role, content: message.content.trim().slice(0, MAX_LENGTH) }));

  // The conversation must start with the user and end with the user
  while (turns.length && turns[0].role !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].role !== 'user') return res.status(400).json({ error: 'Send a question first.' });

  const clientGone = new AbortController();
  res.on('close', () => !res.writableFinished && clientGone.abort()); // the person closed the chat or cleared it: stop asking

  try {
    const stream = askClient().messages.stream(
      { model: MODEL, max_tokens: 600, system: EDITH_PROMPT, messages: turns },
      { signal: clientGone.signal },
    );
    for await (const event of stream) {
      if (event.type !== 'content_block_delta' || event.delta.type !== 'text_delta') continue;
      if (!res.headersSent) {
        startStream(res);
        console.log(`[Edith] answering with ${MODEL}`);
      }
      res.write(event.delta.text);
    }
    if (res.headersSent) return res.end();
    console.error('[Edith] empty answer');
  } catch (err) {
    if (clientGone.signal.aborted) return;
    const timedOut = err instanceof Anthropic.APIConnectionTimeoutError;
    console.error(`[Edith] ${timedOut ? 'timed out' : `${err.constructor.name}: ${String(err.message).split('\n')[0].slice(0, 160)}`}`);
    if (res.headersSent) return res.end(); // the answer stops here, the person keeps what was already sent
  }

  if (clientGone.signal.aborted || res.headersSent) return;
  res.status(502).json({ error: 'Edith could not answer right now. Please try again.' });
});

export default router;
