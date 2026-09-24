// Text and colour for each test status. Later stages move a test through these.
const statusInfo = {
  created: { label: 'Ready', tone: 'neutral' },
  capturing_baseline: { label: 'Capturing', tone: 'busy' },
  baseline_captured: { label: 'Captured', tone: 'captured' },
  capturing_current: { label: 'Capturing', tone: 'busy' },
  current_captured: { label: 'Captured', tone: 'captured' },
  analyzing: { label: 'Analyzing', tone: 'busy' },
  completed: { label: 'Completed', tone: 'done' },
  failed: { label: 'Failed', tone: 'failed' },
};

export const statusLabel = (status) => statusInfo[status]?.label || status;
export const statusTone = (status) => statusInfo[status]?.tone || 'neutral';

export const formatDate = (isoText) =>
  new Date(isoText).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
export const formatDay = (isoText) => new Date(isoText).toLocaleDateString(undefined, { dateStyle: 'medium' });

// "https://staging.example.com/" -> "staging.example.com"
export function hostOf(url) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

// A capture or analysis is running: the test cannot be deleted right now
export const isRunning = (status) => ['capturing_baseline', 'capturing_current', 'analyzing'].includes(status);

// What the test list offers for a test, from the saved state (never from frontend flags).
// A saved baseline makes a test resumable: it only waits for a current URL.
export function testAction(test) {
  const hasBaseline = test.baseline_page_count > 0;
  const hasCurrent = test.current_page_count > 0;
  if (test.status === 'completed') return 'View report';
  if (hasBaseline && test.status === 'current_captured') return 'Continue';
  if (hasBaseline && !hasCurrent && (test.status === 'baseline_captured' || test.status === 'failed')) return 'Resume';
  return 'Open';
}

export const shortId = (id) => id.slice(0, 8);

// Pages from baseline_pages / current_pages that have a screenshot, and pages that failed
export const capturedPages = (pages) => (pages || []).filter((page) => page.screenshot);
export const failedPages = (pages) => (pages || []).filter((page) => !page.screenshot);

// "5 pages" when everything worked, "4 of 7 pages" when some failed. Numbers come from the real data.
export function pageCountText(pages) {
  const captured = capturedPages(pages).length;
  const tried = (pages || []).length;
  return captured === tried ? `${captured} ${captured === 1 ? 'page' : 'pages'}` : `${captured} of ${tried} pages`;
}

// Same rule as the backend: must be a full http:// or https:// URL
export function isValidHttpUrl(text) {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Reads the server's live progress text. The server sends things like
//   "Visiting http://site/about (page 3 of at most 10)"   baseline crawl: the total is only an upper limit
//   "Visiting /about (page 3 of 6)"                        current capture
//   "Comparing /about (3 of 6)"                            pixel comparison
//   "Asking the AI to describe /about (1 of 4)"            optional AI step (shown as "Analyzing differences")
// Anything else (for example "Starting browser...") has no page: only `text` is set.
export function parseProgress(progress) {
  if (!progress) return null;
  const match = /^(Visiting|Comparing|Asking the AI to describe) (\S+) \((?:page )?(\d+) of (at most )?(\d+)\)$/.exec(progress);
  if (!match) return { text: progress };

  const [, verb, target, index, atMost, total] = match;
  let path = target;
  try {
    path = new URL(target).pathname || '/';
  } catch {
    // already a path such as /about
  }
  return { phase: verb === 'Asking the AI to describe' ? 'ai' : 'main', path, index: Number(index), total: Number(total), atMost: Boolean(atMost) };
}
