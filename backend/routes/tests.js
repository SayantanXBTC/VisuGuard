import fs from 'node:fs/promises';
import path from 'node:path';
import { Router } from 'express';
import { captureBaseline, captureCurrent, STORAGE_DIR } from '../screenshotter.js';
import { compareScreenshots } from '../comparer.js';
import { addAiAnalysis, aiConfigured } from '../aiAnalyzer.js';
import { archiveComparison, undoArchive } from '../comparisons.js';
import { sendReportPdf } from '../report.js';

// All routes here run after requireUser, so req.user and req.db are set.
// req.db acts as the signed-in user: Row Level Security only lets it see their own rows.
const router = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Captures and analyses that are running right now: testId -> latest progress text.
// It lives in memory only, so it is empty again after a server restart.
const runningJobs = new Map();

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

// True once the current capture produced at least one screenshot
const hasCurrent = (test) => Array.isArray(test.current_pages) && test.current_pages.some((page) => page.screenshot);

const RUNNING_STATUSES = ['capturing_baseline', 'capturing_current', 'analyzing'];

// A job that was running when the server restarted is gone, but its test still says "running".
// This marks such a test as failed, so the user can retry instead of waiting forever.
// A job that really runs is in runningJobs, so it is left alone.
async function healInterruptedTest(db, test) {
  if (!RUNNING_STATUSES.includes(test.status) || runningJobs.has(test.id)) return test;

  const job = test.status === 'analyzing' ? 'analysis' : 'capture';
  const { data, error } = await db
    .from('tests')
    .update({ status: 'failed', error_message: `The ${job} was interrupted (the server restarted). Please try again.` })
    .eq('id', test.id)
    .eq('status', test.status) // only if nothing changed in the meantime
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? { ...test, ...data } : test;
}

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
  runningJobs.set(test.id, 'Starting browser...');
  console.log(`[Capture] Starting baseline for test ${test.id}`);

  let failure = null;
  try {
    const pages = await captureBaseline(test.id, test.baseline_url, (text) => runningJobs.set(test.id, text));
    const capturedCount = pages.filter((page) => page.screenshot).length;

    if (capturedCount === 0) {
      failure = `No page could be captured from this website. ${pages[0]?.error || ''}`.trim();
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
  runningJobs.delete(test.id);
}

// Same idea for the current version: visit the baseline's pages on the current site.
// Only current fields change here. baseline_pages and the baseline files are never touched.
async function runCurrentCapture(db, test, currentUrl) {
  runningJobs.set(test.id, 'Starting browser...');
  console.log(`[Capture] Starting current capture for test ${test.id}: ${currentUrl}`);

  let failure = null;
  try {
    const pages = await captureCurrent(test.id, currentUrl, test.baseline_pages, (text) => runningJobs.set(test.id, text));
    const capturedCount = pages.filter((page) => page.screenshot).length;

    if (capturedCount === 0) {
      failure = `None of the ${pages.length} baseline pages could be captured from this URL. ${pages[0]?.error || ''}`.trim();
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
  runningJobs.delete(test.id);
}

// Compares the saved baseline and current screenshots with Resemble.js.
// Only results and the summary numbers are written. Captures, screenshots and URLs are never touched.
async function runAnalysis(db, test) {
  runningJobs.set(test.id, 'Starting comparison...');
  console.log(`[Analyze] Starting analysis for test ${test.id}`);

  let failure = null;
  try {
    const results = await compareScreenshots(test.id, test.baseline_pages, test.current_pages, (text) => runningJobs.set(test.id, text));
    results.analyzedAt = new Date().toISOString(); // shown in the comparison history and the PDF
    const changed = results.pages.filter((page) => page.status === 'changed').length;
    const compared = changed + results.pages.filter((page) => page.status === 'unchanged').length;

    if (compared === 0) {
      failure = `None of the ${results.pages.length} pages could be compared.`;
    } else {
      // The AI describes the changed pages. It cannot fail the analysis: a page it cannot handle is marked unavailable.
      await addAiAnalysis(test.id, results, (text) => runningJobs.set(test.id, text));
      // pages_tested = pages that were really compared, pages_changed = the ones above the threshold
      await updateTest(db, test.id, { status: 'completed', results, pages_tested: compared, pages_changed: changed, error_message: null });
      console.log(`[Analyze] Completed: ${compared} pages compared, ${changed} changed`);
    }
  } catch (error) {
    console.error(`[Analyze] Failed for test ${test.id}:`, error);
    failure = 'Analysis failed because of a server error.';
  }

  if (failure) await markFailed(db, test.id, failure);
  runningJobs.delete(test.id);
}

const countCaptured = (pages) => (Array.isArray(pages) ? pages.filter((page) => page.screenshot).length : 0);

// GET /api/tests: my tests, newest first. Summary columns, plus what the list needs to show whether a test
// can be resumed: how many baseline / current pages are saved and how many older comparisons exist.
// The page lists themselves stay out of the answer.
router.get('/', async (req, res) => {
  const { data, error } = await req.db
    .from('tests')
    .select('id, baseline_url, current_url, status, error_message, pages_tested, pages_changed, created_at, baseline_pages, current_pages')
    .order('created_at', { ascending: false });
  if (error) throw error;

  const { data: history, error: historyError } = await req.db.from('comparisons').select('test_id');
  if (historyError) throw historyError;

  const tests = await Promise.all(data.map((test) => healInterruptedTest(req.db, test)));
  res.json({
    tests: tests.map(({ baseline_pages, current_pages, ...test }) => ({
      ...test,
      baseline_page_count: countCaptured(baseline_pages),
      current_page_count: countCaptured(current_pages),
      comparison_count: history.filter((row) => row.test_id === test.id).length,
    })),
  });
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

  const test = await healInterruptedTest(req.db, data);
  res.json({ test, progress: runningJobs.get(test.id) ?? null });
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
  if (test.status === 'capturing_baseline' || runningJobs.has(id)) {
    return res.status(409).json({ error: 'Baseline capture is already running.' });
  }
  if (test.status === 'capturing_current' || test.status === 'analyzing') {
    return res.status(409).json({ error: 'Another job is running for this test. Wait for it to finish.' });
  }
  // A test that failed AFTER its baseline was captured (a failed current capture) keeps its baseline.
  // Only a test that has no baseline yet may capture one.
  const canCaptureBaseline = test.status === 'created' || (test.status === 'failed' && !hasBaseline(test));
  if (!canCaptureBaseline) {
    return res.status(409).json({ error: 'The baseline was already captured for this test.' });
  }

  // 3. Claim the test. The update only works if the status is still what we just read,
  //    so two quick clicks cannot start two captures. The job is registered in memory first, so a poll
  //    that already sees the new status does not mistake it for an interrupted job (see healInterruptedTest).
  runningJobs.set(id, 'Starting browser...');
  const { data: claimed, error: claimError } = await req.db
    .from('tests')
    .update({ status: 'capturing_baseline', error_message: null })
    .eq('id', id)
    .eq('status', test.status)
    .select('id');
  if (claimError || claimed.length === 0) {
    runningJobs.delete(id);
    if (claimError) throw claimError;
    return res.status(409).json({ error: 'Baseline capture is already running.' });
  }

  // 4. Start the capture without waiting for it, and answer right away.
  runBaselineCapture(req.db, test);
  res.status(202).json({ testId: id, status: 'capturing_baseline' });
});

// POST /api/tests/:id/capture-current { currentUrl }: screenshot the baseline's pages on the current site.
// This is also "Compare Another URL": if the test already has a finished report, that report is saved
// to history first (see comparisons.js). The baseline is reused and never changes.
router.post('/:id/capture-current', async (req, res) => {
  const id = req.params.id;
  if (!UUID.test(id)) return notFound(res);

  // 1. Find the test. RLS returns nothing for someone else's test, so ownership is checked here.
  const { data: test, error } = await req.db
    .from('tests')
    .select('id, status, baseline_pages, current_pages, current_url, results, pages_tested, pages_changed')
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
  if (test.status === 'capturing_current' || runningJobs.has(id)) {
    return res.status(409).json({ error: 'Current capture is already running.' });
  }
  if (test.status === 'capturing_baseline') {
    return res.status(409).json({ error: 'Wait for the baseline capture to finish first.' });
  }
  if (!hasBaseline(test)) {
    return res.status(409).json({ error: 'Capture the baseline first.' });
  }
  // Ways to start:
  //   baseline_captured       the first comparison
  //   failed, no current      an earlier current capture failed: retry
  //   completed               Compare Another URL: the finished report is saved to history first
  // Anything else (a current version that is not analyzed yet, a failed analysis) is kept as it is.
  const isAnotherComparison = test.status === 'completed';
  const canStart = isAnotherComparison || test.status === 'baseline_captured' || (test.status === 'failed' && !hasCurrent(test));
  if (!canStart) {
    return res.status(409).json({ error: 'The current version was already captured for this test.' });
  }

  // 4. Register the job in memory first (a second click gets a 409, and a poll does not mistake it for an
  //    interrupted job). Compare Another URL: then save the finished report before its folders are reused.
  runningJobs.set(id, isAnotherComparison ? 'Saving the finished report...' : 'Starting browser...');
  let archivedId = null;
  if (isAnotherComparison) {
    try {
      archivedId = await archiveComparison(req.db, req.user.id, test);
    } catch (archiveError) {
      runningJobs.delete(id);
      throw archiveError;
    }
  }

  // 5. Claim the test and reset the current data. The update only works if the status is still
  //    what we just read, so two quick clicks cannot start two captures.
  const { data: claimed, error: claimError } = await req.db
    .from('tests')
    .update({ status: 'capturing_current', current_url: currentUrl, current_pages: null, results: null, pages_tested: null, pages_changed: null, error_message: null })
    .eq('id', id)
    .eq('status', test.status)
    .select('id');
  if (claimError || claimed.length === 0) {
    runningJobs.delete(id);
    if (archivedId) await undoArchive(req.db, id, archivedId); // the test did not change, so the history entry must not stay
    if (claimError) throw claimError;
    return res.status(409).json({ error: 'Current capture is already running.' });
  }

  // 6. Start the capture without waiting for it, and answer right away.
  runCurrentCapture(req.db, test, currentUrl);
  res.status(202).json({ testId: id, status: 'capturing_current' });
});

// GET /api/tests/:id/comparisons: the older, saved comparisons of this test, newest first.
// The comparison in progress (or the latest finished one) is the test itself.
router.get('/:id/comparisons', async (req, res) => {
  if (!UUID.test(req.params.id)) return notFound(res);

  const { data: test, error } = await req.db.from('tests').select('id').eq('id', req.params.id).maybeSingle();
  if (error) throw error;
  if (!test) return notFound(res);

  const { data, error: listError } = await req.db
    .from('comparisons')
    .select('id, current_url, pages_tested, pages_changed, created_at, results')
    .eq('test_id', test.id)
    .order('created_at', { ascending: false });
  if (listError) throw listError;

  // The list only needs a summary, not the whole results
  const comparisons = data.map((row) => ({
    id: row.id,
    current_url: row.current_url,
    pages_tested: row.pages_tested,
    pages_changed: row.pages_changed,
    analyzed_at: row.results?.analyzedAt || row.created_at,
  }));
  res.json({ comparisons });
});

// GET /api/tests/:id/report.pdf: the finished report as a PDF, built from the saved results and screenshots.
// No browser, no Resemble.js, nothing is recaptured.
router.get('/:id/report.pdf', async (req, res) => {
  if (!UUID.test(req.params.id)) return notFound(res);

  const { data: test, error } = await req.db
    .from('tests')
    .select('id, status, baseline_url, current_url, results')
    .eq('id', req.params.id)
    .maybeSingle();
  if (error) throw error;
  if (!test) return notFound(res);
  if (test.status !== 'completed' || !test.results) {
    return res.status(409).json({ error: 'The analysis is not finished yet, so there is no report to export.' });
  }
  if (!test.results.pages?.length) {
    return res.status(409).json({ error: 'This report has no pages to export.' });
  }

  await sendReportPdf(
    res,
    { testId: test.id, baselineUrl: test.baseline_url, currentUrl: test.current_url, results: test.results },
    `visuguard-report-${test.id.slice(0, 8)}.pdf`,
  );
});

// POST /api/tests/:id/analyze: compare the saved screenshots in the background.
router.post('/:id/analyze', async (req, res) => {
  const id = req.params.id;
  if (!UUID.test(id)) return notFound(res);

  // 1. Find the test. RLS returns nothing for someone else's test, so ownership is checked here.
  const { data: test, error } = await req.db
    .from('tests')
    .select('id, status, baseline_pages, current_pages')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!test) return notFound(res);

  // 2. Both captures must be finished, and no other job may be running
  if (test.status === 'analyzing' || runningJobs.has(id)) {
    return res.status(409).json({ error: 'Analysis is already running.' });
  }
  if (test.status === 'capturing_baseline' || test.status === 'capturing_current') {
    return res.status(409).json({ error: 'Wait for the capture to finish first.' });
  }
  if (!hasBaseline(test)) return res.status(409).json({ error: 'Capture the baseline first.' });
  if (!hasCurrent(test)) return res.status(409).json({ error: 'Capture the current version first.' });
  if (test.status === 'completed') return res.status(409).json({ error: 'The analysis is already complete.' });
  // What is left is 'current_captured', or 'failed' after an analysis that failed: both may run the analysis.

  // 3. Claim the test and clear old results (needed for a retry). The update only works if the status
  //    is still what we just read, so two quick clicks cannot start two analyses.
  runningJobs.set(id, 'Starting comparison...'); // registered first, see healInterruptedTest
  const { data: claimed, error: claimError } = await req.db
    .from('tests')
    .update({ status: 'analyzing', results: null, pages_tested: null, pages_changed: null, avg_mismatch: null, error_message: null })
    .eq('id', id)
    .eq('status', test.status)
    .select('id');
  if (claimError || claimed.length === 0) {
    runningJobs.delete(id);
    if (claimError) throw claimError;
    return res.status(409).json({ error: 'Analysis is already running.' });
  }

  // 4. Start the analysis without waiting for it, and answer right away.
  runAnalysis(req.db, test);
  res.status(202).json({ testId: id, status: 'analyzing' });
});

// POST /api/tests/:id/retry-ai: ask the AI again for the changed pages of the finished report that have no AI
// analysis yet. Nothing is captured or compared again: screenshots and Resemble.js results stay as they are.
router.post('/:id/retry-ai', async (req, res) => {
  const id = req.params.id;
  if (!UUID.test(id)) return notFound(res);

  const { data: test, error } = await req.db.from('tests').select('id, status, results').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!test) return notFound(res);

  if (runningJobs.has(id)) return res.status(409).json({ error: 'Another job is running for this test. Wait for it to finish.' });
  if (test.status !== 'completed' || !test.results?.pages) return res.status(409).json({ error: 'There is no finished report to analyze.' });
  if (!aiConfigured()) return res.status(409).json({ error: 'AI analysis is not configured on the server.' });
  if (!test.results.pages.some((page) => page.status === 'changed' && page.ai_analysis?.status !== 'done')) {
    return res.status(409).json({ error: 'Every changed page already has an AI analysis.' });
  }

  runningJobs.set(id, 'Asking the AI...'); // blocks a second click, a capture and a delete meanwhile
  try {
    const results = test.results;
    await addAiAnalysis(id, results, (text) => runningJobs.set(id, text));
    const { data: saved, error: saveError } = await req.db.from('tests').update({ results }).eq('id', id).eq('status', 'completed').select('id');
    if (saveError) throw saveError;
    if (saved.length === 0) return notFound(res);
    res.json({ results });
  } finally {
    runningJobs.delete(id);
  }
});

// DELETE /api/tests/:id: removes the row and the test's screenshot folder
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  if (!UUID.test(id)) return notFound(res);

  if (runningJobs.has(id)) {
    return res.status(409).json({ error: 'A capture or analysis is running. Wait for it to finish, then delete the test.' });
  }

  const { data, error } = await req.db.from('tests').delete().eq('id', id).select('id');
  if (error) throw error;
  if (data.length === 0) return notFound(res);

  // The row is gone, so the id was valid and belonged to this user. It is also a UUID, so the path is safe.
  await fs.rm(path.join(STORAGE_DIR, id), { recursive: true, force: true });
  res.json({ ok: true });
});

export default router;
