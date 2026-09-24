// The example shown on the home page. It is one real run of VisuGuard on the demo sites in /demo-sites
// (baseline site on port 4100, changed site on port 4101). The images in /public/landing are the real
// baseline, current and diff screenshots of that run's Home page.
export const EXAMPLE = {
  baseline: 'localhost:4100',
  current: 'localhost:4101',
  summary: { compared: 5, changed: 4, unchanged: 1, unavailable: 1 },
  pages: [
    { path: '/', status: 'changed', mismatch: 61.8 },
    { path: '/about', status: 'changed', mismatch: 2.15 },
    { path: '/services', status: 'changed', mismatch: 17.38 },
    { path: '/contact', status: 'changed', mismatch: 1.57 },
    { path: '/team', status: 'unchanged', mismatch: 0 },
    { path: '/careers', status: 'unavailable', mismatch: null },
  ],
  // What differs on the Home page of the demo sites (visible in the two screenshots)
  findings: [
    { status: 'changed', text: 'Hero heading and spacing changed' },
    { status: 'changed', text: 'Primary button moved from the right to lower left' },
    { status: 'changed', text: 'Hero and button colours differ' },
    { status: 'unchanged', text: 'Footer content unchanged' },
  ],
  // The second comparison of that baseline compared it with itself
  history: [
    { url: 'localhost:4101', text: '4 changed, 1 unchanged, 1 unavailable' },
    { url: 'localhost:4100', text: '0 changed, 6 unchanged' },
  ],
};

export const STATUS_LABEL = { changed: 'Changed', unchanged: 'Unchanged', unavailable: 'Unavailable' };
export const formatPercent = (value) => (value === null ? 'not found' : `${value.toFixed(2)}%`);
