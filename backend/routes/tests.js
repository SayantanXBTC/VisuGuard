import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { captureBaseline, captureCurrent, STORAGE_DIR } from '../screenshotter.js';

// All routes here run after requireUser, so req.user and req.db are set.
// req.db acts as the signed-in user: Row Level Security only lets it see their own rows.
const router = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Captures that are running right now: testId -> latest progress text.
// It lives in memory only, so it is empty again after a server restart.
const runningCaptures = new Map();

// Returns a clean http/https URL, or null if the input is not one.
function cleanUrl(input) {
  let url;
  try {
    url = new URL(String(input ?? '').trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  return url.pathname === '/' && !url.search ? url.origin : url.href;
}

const notFound = (res) => res.status(404).json({ error: 'Test not found.' });

// True once the baseline capture produced at least one screenshot
const hasBaseline = (test) => Array.isArray(test.baseline_pages) && test.baseline_pages.some((page) => page.screenshot);

async function updateTest(db, id, fields) {
  const { error } = await db.from('tests').update(fields).eq('id', id);
  if (error) throw error;
}

async function markFailed(db, id, message) {
  console.error(`[Capture] Error: ${message}`);
  try {
    await updateTest(db, id, { status: 'failed', error_message: message });
  } catch (error) {
    console.error('[Capture] Could not save the failed status:', error);
  }
}

// Runs in the background after the HTTP response was sent.
// Whatever happens, the test ends as 'baseline_captured' or 'failed', never stuck on 'capturing_baseline'.
async function runBaselineCapture(db, test) {
  runningCaptures.set(test.id, 'Starting browser...');
  console.log(`[Capture] Starting baseline for test ${test.id}`);

  let failure = null;
  try {
    const pages = await captureBaseline(test.id, test.baseline_url, (text) => runningCaptures.set(test.id, text));
    const capturedCount = pages.filter((page) => page.screenshot).length;

    if (capturedCount === 0) {
      failure = pages[0]?.error || 'No pages could be captured.';
    } else {
      // Partly failed crawls are kept: failed pages stay in the list with their error
      await updateTest(db, test.id, { status: 'baseline_captured', baseline_pages: pages, error_message: null });
      console.log(`[Capture] Completed: ${capturedCount} pages`);
    }
  } catch (error) {
    console.error(`[Capture] Failed for test ${test.id}:`, error);
    failure = 'Baseline capture failed because of a server error.';
  }

  if (failure) await markFailed(db, test.id, failure);
  runningCaptures.delete(test.id);
}

// Same idea for the current version: visit the baseline's pages on the current site.
// Only current fields change here. baseline_pages and the baseline files are never touched.
async function runCurrentCapture(db, test, currentUrl) {
  runningCaptures.set(test.id, 'Starting browser...');
  console.log(`[Capture] Starting current capture for test ${test.id}: ${currentUrl}`);

  let failure = null;
  try {
    const pages = await captureCurrent(test.id, currentUrl, test.baseline_pages, (text) => runningCaptures.set(test.id, text));
    const capturedCount = pages.filter((page) => page.screenshot).length;

    if (capturedCount === 0) {
      failure = `None of the ${pages.length} pages could be captured. ${pages[0]?.error || ''}`.trim();
    } else {
      // Pages that failed stay in the list with their error, so the user can see what is missing
      await updateTest(db, test.id, { status: 'current_captured', current_pages: pages, error_message: null });
      console.log(`[Capture] Completed: ${capturedCount} of ${pages.length} current pages`);
    }
  } catch (error) {
    console.error(`[Capture] Failed for test ${test.id}:`, error);
    failure = 'Current capture failed because of a server error.';
  }

  if (failure) await markFailed(db, test.id, failure);
  runningCaptures.delete(test.id);
}

// GET /api/tests: my tests, newest first (summary columns only)
router.get('/', async (req, res) => {
  const { data, error } = await req.db
    .from('tests')
    .select('id, baseline_url, current_url, status, error_message, pages_tested, pages_changed, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  res.json({ tests: data });
});

// POST /api/tests { baselineUrl }: create a test. Capturing is a separate step.
router.post('/', async (req, res) => {
  const baselineUrl = cleanUrl(req.body?.baselineUrl);
  if (!baselineUrl) {
    return res.status(400).json({ error: 'Enter a valid URL that starts with http:// or https://' });
  }

  // user_id comes from the verified token. Anything the client sends as user_id is ignored.
  const { data, error } = await req.db
    .from('tests')
    .insert({ user_id: req.user.id, baseline_url: baselineUrl, status: 'created' })
    .select()
    .single();
  if (error) throw error;
  res.status(201).json({ test: data });
});

// GET /api/tests/:id: one test, plus live progress while a capture runs.
// Another user's test looks the same as a missing one.
router.get('/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) return notFound(res);

  const { data, error } = await req.db.from('tests').select('*').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!data) return notFound(res);
  let test = data;

  // A capture that was running when the server restarted is gone. Mark it failed so the user can retry.
  const looksRunning = test.status === 'capturing_baseline' || test.status === 'capturing_current';
  if (looksRunning && !runningCaptures.has(test.id)) {
    const { data: healed, error: healError } = await req.db
      .from('tests')
      .update({ status: 'failed', error_message: 'The capture was interrupted (the server restarted). Please try again.' })
      .eq('id', test.id)
      .eq('status', test.status)
      .select()
      .maybeSingle();
    if (healError) throw healError;
    if (healed) test = healed;
  }

  res.json({ test, progress: runningCaptures.get(test.id) ?? null });
});

// POST /api/tests/:id/capture-baseline: start the Playwright capture in the background.
router.post('/:id/capture-baseline', async (req, res) => {
  const id = req.params.id;
  if (!UUID.test(id)) return notFound(res);

  // 1. Find the test. RLS returns nothing for someone else's test, so ownership is checked here.
  const { data: test, error } = await req.db
    .from('tests')
    .select('id, baseline_url, status, baseline_pages')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!test) return notFound(res);

  // 2. Check that a capture makes sense right now
  if (!test.baseline_url) return res.status(400).json({ error: 'This test has no baseline URL.' });
  if (test.status === 'capturing_baseline') {
    return res.status(409).json({ error: 'Baseline capture is already running.' });
  }
  if (test.status === 'capturing_current') {
    return res.status(409).json({ error: 'A current-version capture is running. Wait for it to finish.' });
  }
  // A test that failed AFTER its baseline was captured (a failed current capture) keeps its baseline.
  // Only a test that has no baseline yet may capture one.
  const canCaptureBaseline = test.status === 'created' || (test.status === 'failed' && !hasBaseline(test));
  if (!canCaptureBaseline) {
    return res.status(409).json({ error: 'The baseline was already captured for this test.' });
  }

  // 3. Claim the test. The update only works if the status is still what we just read,
  //    so two quick clicks cannot start two captures.
  const { data: claimed, error: claimError } = await req.db
    .from('tests')
    .update({ status: 'capturing_baseline', error_message: null })
    .eq('id', id)
    .eq('status', test.status)
    .select('id');
  if (claimError) throw claimError;
  if (claimed.length === 0) {
    return res.status(409).json({ error: 'Baseline capture is already running.' });
  }

  // 4. Start the capture without waiting for it, and answer right away.
  runBaselineCapture(req.db, test);
  res.status(202).json({ testId: id, status: 'capturing_baseline' });
});

// POST /api/tests/:id/capture-current { currentUrl }: screenshot the baseline's pages on the current site.
router.post('/:id/capture-current', async (req, res) => {
  const id = req.params.id;
  if (!UUID.test(id)) return notFound(res);

  // 1. Find the test. RLS returns nothing for someone else's test, so ownership is checked here.
  const { data: test, error } = await req.db
    .from('tests')
    .select('id, status, baseline_pages')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!test) return notFound(res);

  // 2. The current URL must be a valid http/https URL
  const currentUrl = cleanUrl(req.body?.currentUrl);
  if (!currentUrl) {
    return res.status(400).json({ error: 'Enter a valid URL that starts with http:// or https://' });
  }

  // 3. The test must be in a state where capturing the current version makes sense
  if (test.status === 'capturing_current' || runningCaptures.has(id)) {
    return res.status(409).json({ error: 'Current capture is already running.' });
  }
  if (test.status === 'capturing_baseline') {
    return res.status(409).json({ error: 'Wait for the baseline capture to finish first.' });
  }
  if (!hasBaseline(test)) {
    return res.status(409).json({ error: 'Capture the baseline first.' });
  }
  // baseline_captured is the normal start. failed (with a baseline) means an earlier current capture failed: retry.
  if (test.status !== 'baseline_captured' && test.status !== 'failed') {
    return res.status(409).json({ error: 'The current version was already captured for this test.' });
  }

  // 4. Claim the test and reset the current data. The update only works if the status is still
  //    what we just read, so two quick clicks cannot start two captures.
  const { data: claimed, error: claimError } = await req.db
    .from('tests')
    .update({ status: 'capturing_current', current_url: currentUrl, current_pages: null, error_message: null })
    .eq('id', id)
    .eq('status', test.status)
    .select('id');
  if (claimError) throw claimError;
  if (claimed.length === 0) {
    return res.status(409).json({ error: 'Current capture is already running.' });
  }

  // 5. Start the capture without waiting for it, and answer right away.
  runCurrentCapture(req.db, test, currentUrl);
  res.status(202).json({ testId: id, status: 'capturing_current' });
});

// DELETE /api/tests/:id: removes the row and the test's screenshot folder
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  if (!UUID.test(id)) return notFound(res);

  if (runningCaptures.has(id)) {
    return res.status(409).json({ error: 'A capture is running. Wait for it to finish, then delete the test.' });
  }

  const { data, error } = await req.db.from('tests').delete().eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) return notFound(res);

  // The row is gone, so the id was valid and belonged to this user. It is also a UUID, so the path is safe.
  await fs.rm(path.join(STORAGE_DIR, id), { recursive: true, force: true });
  res.json({ ok: true });
});

export default router;
