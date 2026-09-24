import fs from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { createCanvas, loadImage } from 'canvas';
import { STORAGE_DIR } from './screenshotter.js';

// AI-assisted visual diffing: a vision model looks at the baseline, the current screenshot and the Resemble.js
// diff of a CHANGED page and explains in words what changed. It never decides whether a page changed (Resemble.js
// does that) and it never fails a comparison: any problem becomes { status: 'unavailable', reason }.
//
// Only askModel() knows the provider. To use another vision provider, replace that one function.

const MODEL = process.env.AI_MODEL || 'claude-sonnet-5';
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 90_000; // per request. A slow provider must not hang the report
const MAX_IMAGE_EDGE = 2000; // pixels: larger screenshots are scaled down for the model (the files on disk are untouched)
const PARALLEL_REQUESTS = 3;

const SEVERITIES = ['low', 'medium', 'high', 'critical'];
const CATEGORIES = ['layout', 'spacing', 'typography', 'color', 'component', 'content', 'visibility', 'responsive', 'position', 'size', 'alignment'];

const INSTRUCTIONS = `You compare two screenshots of the same web page: the approved BASELINE and the CURRENT version.
You get three images, in this order:
1. BASELINE screenshot.
2. CURRENT screenshot.
3. DIFF image made by a pixel comparison tool: the current screenshot shown dimmed and in grey, with every area that changed shown back in full colour inside a numbered red box. Use it to find where to look. It is not a third version of the page.

Describe what visibly changed between the baseline and the current version: what moved, resized, appeared, disappeared, or changed text, color or spacing, and where on the page.

Rules:
- Only describe what you can actually see in the images. Never invent a difference.
- Be specific (name the element and where it is), not generic.
- Use careful wording such as "appears to" and "looks like". Do not make claims about business impact.
- If you cannot tell what changed, say exactly: "Unable to determine the specific visual change with confidence." as the summary, and give a low confidence.
- severity is how visually significant the change appears to a visitor: low (small or decorative), medium (noticeable), high (large or affects main content or main actions), critical (page looks broken or key content or actions disappeared). The pixel mismatch percentage is given only as context and is not the severity.
- categories: choose the ones that apply from the allowed list.
- observations: 2 to 6 short, concrete statements, each about one visible change.
- confidence: a number from 0 to 1 for how sure you are that the summary and observations match the images.`;

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    severity: { type: 'string', enum: SEVERITIES },
    categories: { type: 'array', items: { type: 'string', enum: CATEGORIES } },
    observations: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'number' },
  },
  required: ['summary', 'severity', 'categories', 'observations', 'confidence'],
  additionalProperties: false,
};

export const aiConfigured = () => Boolean(process.env.AI_API_KEY);

// ---------- Provider: the only place that talks to the AI service ----------

let client = null;

// images: [{ label, base64 }] (JPEG). Returns the model's answer as text (JSON).
async function askModel(images, pagePath, mismatch) {
  client ??= new Anthropic({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || undefined, // only set for local testing against a stand-in server
    timeout: TIMEOUT_MS,
    maxRetries: 1,
  });

  const content = [];
  for (const image of images) {
    content.push({ type: 'text', text: image.label });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image.base64 } });
  }
  content.push({ type: 'text', text: `Page path: ${pagePath}\nPixel mismatch: ${mismatch}% (context only).\nDescribe the visible changes.` });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: INSTRUCTIONS,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: RESPONSE_SCHEMA } },
    messages: [{ role: 'user', content }],
  });

  if (response.stop_reason === 'refusal' || response.stop_reason === 'max_tokens') {
    throw new Error(`The model did not finish (${response.stop_reason}).`);
  }
  return response.content.filter((block) => block.type === 'text').map((block) => block.text).join('');
}

// ---------- Provider independent parts ----------

// /files/<testId>/baseline/page-001.png -> the file on disk (only inside this test's folder)
function fileOnDisk(testId, address) {
  if (!address) return null;
  const file = path.join(STORAGE_DIR, address.replace(/^\/files\//, ''));
  return file.startsWith(path.join(STORAGE_DIR, testId) + path.sep) ? file : null;
}

// Scales a screenshot down when it is very large and returns it as a JPEG in base64
async function prepareImage(file) {
  const image = await loadImage(await fs.readFile(file));
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
  const canvas = createCanvas(Math.round(image.width * scale), Math.round(image.height * scale));
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toBuffer('image/jpeg', { quality: 0.85 }).toString('base64');
}

const text = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

// Checks the model's answer. Returns the clean analysis, or null when the answer is not usable.
function validate(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const summary = text(data.summary, 600);
  const severity = typeof data.severity === 'string' ? data.severity.toLowerCase() : '';
  const confidence = Number(data.confidence);
  if (!summary || !SEVERITIES.includes(severity) || !Array.isArray(data.categories) || !Array.isArray(data.observations) || !Number.isFinite(confidence)) {
    return null;
  }

  return {
    status: 'done',
    summary,
    severity,
    categories: [...new Set(data.categories.map((name) => String(name).toLowerCase()).filter((name) => CATEGORIES.includes(name)))],
    observations: data.observations.map((line) => text(line, 300)).filter(Boolean).slice(0, 6),
    confidence: Math.min(1, Math.max(0, confidence)),
  };
}

// Analyses one changed page. Never throws.
// Returns { status: 'done', summary, severity, categories, observations, confidence }
//      or { status: 'unavailable', reason: 'not_configured' | 'timeout' | 'failed' }.
export async function analyzeVisualDifference({ testId, page }) {
  if (!aiConfigured()) return { status: 'unavailable', reason: 'not_configured' };

  try {
    const files = [
      ['Image 1: BASELINE screenshot', fileOnDisk(testId, page.baseline)],
      ['Image 2: CURRENT screenshot', fileOnDisk(testId, page.current)],
      ['Image 3: DIFF image (page dimmed to grey, changed areas in full colour inside numbered red boxes)', fileOnDisk(testId, page.diff)],
    ];
    if (files.some(([, file]) => !file)) throw new Error('A screenshot file is missing.');

    const images = [];
    for (const [label, file] of files) images.push({ label, base64: await prepareImage(file) });

    const analysis = validate(await askModel(images, page.path, page.mismatchPercentage));
    if (!analysis) throw new Error('The answer had an unexpected format.');
    return analysis;
  } catch (error) {
    // Only the kind of problem is logged: no screenshots, no keys, no request details
    const timedOut = error instanceof Anthropic.APIConnectionTimeoutError;
    console.error(`[AI] ${page.path}: ${timedOut ? 'timed out' : `${error.constructor.name}: ${String(error.message).split('\n')[0].slice(0, 160)}`}`);
    return { status: 'unavailable', reason: timedOut ? 'timeout' : 'failed' };
  }
}

// Adds ai_analysis to the pages of a comparison result that need it: changed pages that have no finished
// analysis yet. Unchanged, missing and failed pages are never sent to the AI. Works on results.pages in place.
// Returns how many pages were analysed successfully.
export async function addAiAnalysis(testId, results, onProgress = () => {}) {
  const pages = results.pages.filter((page) => page.status === 'changed' && page.ai_analysis?.status !== 'done');
  if (pages.length === 0) return 0;

  if (!aiConfigured()) {
    for (const page of pages) page.ai_analysis = { status: 'unavailable', reason: 'not_configured' };
    return 0;
  }

  let finished = 0;
  let succeeded = 0;
  const queue = [...pages];
  const worker = async () => {
    while (queue.length > 0) {
      const page = queue.shift();
      onProgress(`Asking the AI to describe ${page.path} (${finished + 1} of ${pages.length})`);
      page.ai_analysis = await analyzeVisualDifference({ testId, page });
      finished++;
      if (page.ai_analysis.status === 'done') succeeded++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL_REQUESTS, pages.length) }, worker));
  return succeeded;
}
