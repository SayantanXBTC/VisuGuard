import { Router } from 'express';
import { EDITH_PROMPT } from '../edithKnowledge.js';

// Edith, the in-app assistant. Public (the home and sign-in screens use it too), so it is limited:
// short messages, a few turns of history, and a per-address request limit. The Gemini key stays here in the backend.
const router = Router();

// Models are tried in this order. Each has its own quota, and any of them can be refused or busy at times
// (404 / 429 / 503), so a failure moves on to the next one.
const MODELS = [
  process.env.GEMINI_MODEL,
  'gemini-3.6-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.5-flash-lite',
  'gemma-4-31b-it', // Gemma takes no system instruction: the prompt goes into the first message instead
  'gemma-4-26b-a4b-it',
].filter(Boolean);

const MAX_MESSAGES = 10; // turns of history sent to the model
const MAX_LENGTH = 500; // characters per message
const LIMIT = 20; // requests per address per minute
const FIRST_ANSWER_MS = 6_000; // a model that has not started answering after this long is skipped
const TOTAL_WAIT_MS = 20_000; // Edith gives up after this long, however many models are left
const hits = new Map(); // address -> [timestamps]

function tooMany(address) {
  const now = Date.now();
  const recent = (hits.get(address) || []).filter((time) => now - time < 60_000);
  recent.push(now);
  hits.set(address, recent);
  return recent.length > LIMIT;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The request body for one model
function bodyFor(model, contents) {
  const generationConfig = { temperature: 0.3, maxOutputTokens: 1024 }; // answers are about 100 words
  if (!model.startsWith('gemma')) {
    return JSON.stringify({ systemInstruction: { parts: [{ text: EDITH_PROMPT }] }, contents, generationConfig });
  }
  const first = { role: 'user', parts: [{ text: `${EDITH_PROMPT}\n\nThe conversation starts now.\n\nUser: ${contents[0].parts[0].text}` }] };
  return JSON.stringify({ contents: [first, ...contents.slice(1)], generationConfig });
}

router.post('/', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(503).json({ error: 'Edith is not set up yet. Add GEMINI_API_KEY to backend/.env and restart the backend.' });
  if (tooMany(req.ip || 'unknown')) return res.status(429).json({ error: 'Too many messages. Please wait a moment.' });

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const turns = incoming
    .filter((message) => (message?.role === 'user' || message?.role === 'assistant') && typeof message.content === 'string' && message.content.trim())
    .slice(-MAX_MESSAGES)
    .map((message) => ({ text: message.content.trim().slice(0, MAX_LENGTH), from: message.role }));

  // The conversation must start with the user and end with the user
  while (turns.length && turns[0].from !== 'user') turns.shift();
  if (!turns.length || turns[turns.length - 1].from !== 'user') return res.status(400).json({ error: 'Send a question first.' });

  const contents = turns.map((turn) => ({ role: turn.from === 'user' ? 'user' : 'model', parts: [{ text: turn.text }] }));
  const deadline = Date.now() + TOTAL_WAIT_MS;
  let busy = false;
  let streaming = false; // true once the first piece of an answer was sent: after that, no other model can take over
  const clientGone = new AbortController();
  res.on('close', () => clientGone.abort()); // the person closed the chat or cleared it: stop asking Gemini

  // Two rounds over the models: Gemini is often "busy" for a moment, and a short wait usually clears it
  for (let round = 0; round < 2 && !clientGone.signal.aborted && Date.now() < deadline; round++) {
    if (round > 0) await wait(1000);

    for (const model of [...new Set(MODELS)]) {
      if (clientGone.signal.aborted) return;
      const left = deadline - Date.now();
      if (left <= 0) break;
      // A model that has not started answering in time is skipped. Once it streams, the timer is off.
      const slow = new AbortController();
      const giveUp = setTimeout(() => slow.abort(), Math.min(FIRST_ANSWER_MS, left));
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: bodyFor(model, contents),
          signal: AbortSignal.any([slow.signal, clientGone.signal]),
        });

        if (!response.ok) {
          console.error(`[Edith] ${model} answered ${response.status}`);
          if (response.status === 429) busy = true;
          if ([404, 429, 500, 503].includes(response.status)) continue; // try the next model
          return res.status(502).json({ error: 'Edith could not answer right now. Please try again.' }); // 400 / 403: request or key is wrong
        }

        // Server-sent events: "data: {json}" lines. Each one carries the next piece of the answer.
        const decoder = new TextDecoder();
        let pending = '';
        for await (const chunk of response.body) {
          pending += decoder.decode(chunk, { stream: true });
          const lines = pending.split('\n');
          pending = lines.pop();
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            let event;
            try {
              event = JSON.parse(line.slice(5));
            } catch {
              continue;
            }
            const piece = event.candidates?.[0]?.content?.parts?.filter((part) => !part.thought).map((part) => part.text || '').join('') ?? '';
            if (!piece) continue;
            if (!streaming) {
              clearTimeout(giveUp);
              streaming = true;
              res.setHeader('Content-Type', 'text/plain; charset=utf-8');
              res.setHeader('Cache-Control', 'no-cache');
              res.flushHeaders();
              console.log(`[Edith] answering with ${model}`);
            }
            res.write(piece);
          }
        }
        if (streaming) return res.end();
        console.error(`[Edith] ${model} gave an empty answer`);
      } catch (err) {
        if (clientGone.signal.aborted) return;
        console.error(`[Edith] ${model} failed: ${err.message}`); // timeout or network
        if (streaming) return res.end(); // the answer stops here, the person keeps what was already sent
      } finally {
        clearTimeout(giveUp);
      }
    }
  }

  if (res.headersSent) return res.end();
  res.status(busy ? 429 : 502).json({
    error: busy ? 'Edith is busy right now. Please try again in a minute.' : 'Edith could not answer right now. Please try again.',
  });
});

export default router;
