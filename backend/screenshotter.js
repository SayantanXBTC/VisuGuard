import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

// Screenshots are saved here: storage/<testId>/baseline/page-001.png, storage/<testId>/current/page-001.png, ...
export const STORAGE_DIR = path.join(import.meta.dirname, 'storage');

// Settings. Baseline and current capture share them, so their screenshots can be compared later.
const VIEWPORT = { width: 1280, height: 720 };
const NAVIGATION_TIMEOUT_MS = 30_000; // give up on a page after this long
const LOAD_WAIT_MS = 10_000; // extra wait for the page "load" event (best effort)
const IDLE_WAIT_MS = 3_000; // extra wait for network activity to stop (best effort)
const MAX_SCROLL_STEPS = 20; // stops endless-scroll pages from running forever
const FILE_EXTENSIONS = /\.(pdf|zip|gz|png|jpe?g|gif|svg|webp|ico|mp3|mp4|mov|css|js|json|xml|txt|docx?|xlsx?|pptx?)$/i;

// ---------- Helpers shared by baseline and current capture ----------

// Makes two spellings of the same page identical:
// https://example.com and https://example.com/ match, and #fragments are dropped.
// Query strings are kept because ?id=1 and ?id=2 can be different pages.
function normalizeUrl(href) {
  const url = new URL(href);
  url.hash = '';
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.slice(0, -1);
  }
  return url.href;
}

// The part after the host, e.g. "/about" or "/search?q=1".
// The current capture reuses this against a different host.
function pathOf(href) {
  const url = new URL(href);
  return url.pathname + url.search;
}

// page-001.png, page-002.png, ... The index comes from the baseline crawl,
// so baseline/page-002.png and current/page-002.png are always the same page.
const fileNameFor = (index) => `page-${String(index).padStart(3, '0')}.png`;

// An error whose text is already written for the user (we throw these ourselves)
const pageError = (text) => Object.assign(new Error(text), { friendly: true });

// Playwright / Chromium error codes -> plain words
const NETWORK_ERRORS = [
  ['ERR_NAME_NOT_RESOLVED', 'Unable to reach this website. Check that the address is correct.'],
  ['ERR_CONNECTION_REFUSED', 'The website refused the connection. Check that it is running.'],
  ['ERR_CONNECTION_RESET', 'The website closed the connection without answering.'],
  ['ERR_CONNECTION_CLOSED', 'The website closed the connection without answering.'],
  ['ERR_EMPTY_RESPONSE', 'The website closed the connection without answering.'],
  ['ERR_CONNECTION_TIMED_OUT', 'The website did not answer in time.'],
  ['ERR_TIMED_OUT', 'The website did not answer in time.'],
  ['ERR_CERT', 'The website has an invalid security certificate.'],
  ['ERR_SSL', 'The website has an invalid security certificate.'],
  ['ERR_TOO_MANY_REDIRECTS', 'The page keeps redirecting and never loads.'],
  ['ERR_ABORTED', 'The capture was interrupted. Please try again.'],
  ['has been closed', 'The capture was interrupted. Please try again.'],
];

// Short, readable text for the user. The full error goes to the server log, never to the user.
function describeError(error) {
  const message = error.message || String(error);
  if (error.friendly) return message;
  if (message.includes('Timeout')) return 'The page took too long to load (over 30 seconds).';
  const known = NETWORK_ERRORS.find(([code]) => message.includes(code));
  return known ? known[1] : 'The page could not be loaded.';
}

// Starts Chromium with the one viewport and timeouts used for every screenshot.
async function launchBrowser() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  page.setDefaultTimeout(NAVIGATION_TIMEOUT_MS);
  page.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
  return { browser, page };
}

// Opens a page and waits until it is reasonably ready, without waiting forever.
async function loadPage(page, url) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  if (response && response.status() >= 400) {
    const status = response.status();
    if (status === 404) throw pageError('The page was not found (HTTP 404).');
    if (status >= 500) throw pageError(`The website had a server error (HTTP ${status}).`);
    throw pageError(`The page returned HTTP ${status}.`);
  }
  // Some sites never finish loading, so these two waits are allowed to time out
  await page.waitForLoadState('load', { timeout: LOAD_WAIT_MS }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: IDLE_WAIT_MS }).catch(() => {});
}

// Scroll down and back up so lazy-loaded images appear in the full-page screenshot.
async function scrollThroughPage(page) {
  await page.evaluate(async (maxSteps) => {
    const step = window.innerHeight;
    for (let i = 0; i < maxSteps && window.scrollY + step < document.documentElement.scrollHeight; i++) {
      window.scrollBy(0, step);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    window.scrollTo(0, 0);
  }, MAX_SCROLL_STEPS);
}

// Takes the full-page screenshot of the page that is open. Same steps for baseline and current.
async function screenshotPage(page, filePath) {
  await scrollThroughPage(page);
  await page.evaluate(() => document.fonts.ready).catch(() => {}); // wait for web fonts
  await page.screenshot({ path: filePath, fullPage: true, animations: 'disabled' });
}

// Start empty, so screenshots from an earlier try are never mixed with new ones.
async function makeEmptyFolder(folder) {
  await fs.rm(folder, { recursive: true, force: true });
  await fs.mkdir(folder, { recursive: true });
}

// ---------- Baseline capture: crawl the site ----------

// Links on the current page that lead to other pages of the same website.
async function findSameSiteLinks(page, siteOrigin) {
  // Read the raw href and resolve it in the browser, which also handles <base href> and relative links
  const hrefs = await page.$$eval('a[href]', (anchors) =>
    anchors.map((a) => {
      try {
        return new URL(a.getAttribute('href'), document.baseURI).href;
      } catch {
        return null;
      }
    }),
  );

  const links = [];
  for (const href of hrefs) {
    if (!href) continue;
    const url = new URL(href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') continue; // mailto:, tel:, javascript:
    if (url.origin !== siteOrigin) continue; // a different website
    if (FILE_EXTENSIONS.test(url.pathname)) continue; // a file, not a page
    links.push(normalizeUrl(href));
  }
  return links;
}

// Crawls the site starting at startUrl (breadth first) and screenshots every page found.
// Returns one entry per page tried:
//   { index, url, path, title, screenshot: 'baseline/page-001.png' }          captured
//   { index, url, path, title: '', screenshot: null, error: '...' }           failed
// onProgress(text) is called with a short message as the crawl moves along.
export async function captureBaseline(testId, startUrl, onProgress = () => {}) {
  const maxPages = Number(process.env.MAX_PAGES) || 10;
  const outputDir = path.join(STORAGE_DIR, testId, 'baseline');
  await makeEmptyFolder(outputDir); // a retry starts clean

  const { browser, page } = await launchBrowser();
  try {
    const start = normalizeUrl(startUrl);
    const queue = [start]; // pages waiting to be visited
    const seen = new Set([start]); // every URL ever queued, so nothing is visited twice
    const pages = []; // one entry for each page we tried
    let siteOrigin = new URL(start).origin;

    while (queue.length > 0 && pages.length < maxPages) {
      const url = queue.shift();
      const index = pages.length + 1;
      console.log(`[Capture] Visiting ${url}`);
      onProgress(`Visiting ${url} (page ${index} of at most ${maxPages})`);

      try {
        await loadPage(page, url);

        // The page may have redirected. Trust the address we actually landed on.
        const finalUrl = normalizeUrl(page.url());
        if (index === 1) {
          siteOrigin = new URL(finalUrl).origin; // e.g. example.com may redirect to www.example.com
          seen.add(finalUrl);
        } else if (new URL(finalUrl).origin !== siteOrigin) {
          throw pageError('The page redirected to another website.');
        } else if (finalUrl !== url) {
          if (seen.has(finalUrl)) {
            console.log(`[Capture] Skipped ${url}: it redirects to ${finalUrl}, which is already known`);
            continue;
          }
          seen.add(finalUrl);
        }

        const title = await page.title().catch(() => '');
        const fileName = fileNameFor(index);
        await screenshotPage(page, path.join(outputDir, fileName));
        console.log(`[Capture] Saved ${fileName}`);
        pages.push({ index, url: finalUrl, path: pathOf(finalUrl), title, screenshot: `baseline/${fileName}` });

        // Queue links to pages we have not seen yet
        for (const link of await findSameSiteLinks(page, siteOrigin)) {
          if (!seen.has(link)) {
            seen.add(link);
            queue.push(link);
          }
        }
      } catch (error) {
        // One broken page must not stop the whole capture
        console.error(`[Capture] Failed: ${url}`);
        console.error(`[Capture] Error: ${error.message.split('\n')[0]}`);
        pages.push({ index, url, path: pathOf(url), title: '', screenshot: null, error: describeError(error) });
      }
    }

    return pages;
  } finally {
    await browser.close(); // always close Chromium, even after an error
  }
}

// ---------- Current capture: NO crawling, only the baseline's pages ----------

// https://staging.example.com + /about?x=1  ->  https://staging.example.com/about?x=1
// Only the host of the current URL is used. The path comes from the baseline.
function buildCurrentUrl(currentUrl, pagePath) {
  return new URL(pagePath, new URL(currentUrl).origin).href;
}

// The page we landed on must be the page we asked for.
// A different trailing slash is fine. Anything else (another path, another site) counts as a failure,
// so unrelated pages are never compared with each other.
function checkNoRedirect(requestedUrl, landedUrl, expectedPath) {
  const requested = new URL(requestedUrl);
  const landed = new URL(landedUrl);
  if (landed.origin !== requested.origin) {
    throw pageError(`The page redirected to another website (${landed.origin}).`);
  }
  if (normalizeUrl(landed.href) !== normalizeUrl(requested.href)) {
    throw pageError(`Expected ${expectedPath} but the page redirected to ${pathOf(landed.href)}.`);
  }
}

// Visits the SAME page paths that the baseline found, on the current site, and screenshots them.
// The baseline page map decides which pages are visited. Links on the current site are never followed,
// and MAX_PAGES does not apply here.
// Returns one entry per baseline page, in the same shape as captureBaseline. Each entry keeps the
// baseline's index, so current/page-002.png is the partner of baseline/page-002.png.
export async function captureCurrent(testId, currentUrl, baselinePages, onProgress = () => {}) {
  const outputDir = path.join(STORAGE_DIR, testId, 'current'); // never the baseline folder
  await makeEmptyFolder(outputDir); // a retry starts clean

  // A page without a baseline screenshot has nothing to be compared with, so it is skipped
  const targets = baselinePages.filter((page) => page.screenshot);

  const { browser, page } = await launchBrowser();
  try {
    const pages = [];

    for (const [position, target] of targets.entries()) {
      const url = buildCurrentUrl(currentUrl, target.path);
      console.log(`[Capture] Visiting ${url}`);
      onProgress(`Visiting ${target.path} (page ${position + 1} of ${targets.length})`);

      try {
        await loadPage(page, url);
        checkNoRedirect(url, page.url(), target.path);

        const title = await page.title().catch(() => '');
        const fileName = fileNameFor(target.index);
        await screenshotPage(page, path.join(outputDir, fileName));
        console.log(`[Capture] Saved ${fileName}`);
        pages.push({ index: target.index, url, path: target.path, title, screenshot: `current/${fileName}` });
      } catch (error) {
        // One missing page must not stop the others
        console.error(`[Capture] Failed: ${url}`);
        console.error(`[Capture] Error: ${error.message.split('\n')[0]}`);
        pages.push({ index: target.index, url, path: target.path, title: '', screenshot: null, error: describeError(error) });
      }
    }

    return pages;
  } finally {
    await browser.close(); // always close Chromium, even after an error
  }
}
