// Text and colour for each test status. Later stages move a test through these.
const statusInfo = {
  created: { label: 'Ready for baseline capture', tone: 'neutral' },
  capturing_baseline: { label: 'Capturing baseline', tone: 'busy' },
  baseline_captured: { label: 'Baseline captured', tone: 'neutral' },
  capturing_current: { label: 'Capturing current version', tone: 'busy' },
  current_captured: { label: 'Current version captured', tone: 'neutral' },
  analyzing: { label: 'Analyzing', tone: 'busy' },
  completed: { label: 'Completed', tone: 'done' },
  failed: { label: 'Failed', tone: 'failed' },
};

export const statusLabel = (status) => statusInfo[status]?.label || status;
export const statusTone = (status) => statusInfo[status]?.tone || 'neutral';

export const formatDate = (isoText) =>
  new Date(isoText).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

// A capture or analysis is running: the test cannot be deleted right now
export const isRunning = (status) => ['capturing_baseline', 'capturing_current', 'analyzing'].includes(status);

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
