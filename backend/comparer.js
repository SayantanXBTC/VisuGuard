import fs from 'node:fs/promises';
import path from 'node:path';
import compareImages from 'resemblejs/compareImages.js';
import { STORAGE_DIR } from './screenshotter.js';

// A page counts as "changed" when MORE than this percentage of its pixels differ.
export const MISMATCH_THRESHOLD = 0.1;

// Resemble.js settings.
// largeImageThreshold 0: without it Resemble skips pixels on big images, which is not exact for full-page screenshots.
// ignore antialiasing: the soft edges of text differ a little between two captures, and are not real changes.
const RESEMBLE_OPTIONS = { output: { largeImageThreshold: 0 }, ignore: 'antialiasing' };

// The address the browser uses to load a saved screenshot, e.g. /files/<testId>/baseline/page-001.png
const fileUrl = (testId, relativePath) => `/files/${testId}/${relativePath}`;

// Compares one page. Never throws: a problem with one page becomes that page's status.
async function comparePage(testId, diffDir, baselinePage, currentPage) {
  const result = {
    index: baselinePage.index,
    path: baselinePage.path,
    title: baselinePage.title || '',
    baseline: null,
    current: null,
    diff: null,
    mismatchPercentage: null,
    status: '',
  };

  // The baseline page was never captured, so there is nothing to compare against
  if (!baselinePage.screenshot) {
    return { ...result, status: 'missing_baseline', error: baselinePage.error || 'The page could not be captured in the baseline.' };
  }
  result.baseline = fileUrl(testId, baselinePage.screenshot);

  // The page was not captured on the current site (404, timeout, redirect...)
  if (!currentPage?.screenshot) {
    return { ...result, status: 'missing_current', error: currentPage?.error || 'The page was not captured on the current site.' };
  }
  result.current = fileUrl(testId, currentPage.screenshot);

  try {
    const baselineImage = await fs.readFile(path.join(STORAGE_DIR, testId, baselinePage.screenshot));
    const currentImage = await fs.readFile(path.join(STORAGE_DIR, testId, currentPage.screenshot));

    // Resemble.js does the comparison and draws the difference image
    const data = await compareImages(baselineImage, currentImage, RESEMBLE_OPTIONS);

    // The diff file has the same name as the baseline file: diff/page-001.png
    const diffName = path.basename(baselinePage.screenshot);
    await fs.writeFile(path.join(diffDir, diffName), data.getBuffer());

    const mismatch = Number(data.misMatchPercentage); // Resemble gives it as text with 2 decimals, e.g. "2.43"
    result.diff = fileUrl(testId, `diff/${diffName}`);
    result.mismatchPercentage = mismatch;
    result.sameSize = data.isSameDimensions; // false when the two pages have different heights
    result.status = mismatch > MISMATCH_THRESHOLD ? 'changed' : 'unchanged';
  } catch (error) {
    console.error(`[Analyze] Could not compare ${baselinePage.path}:`, error.message);
    result.status = 'error';
    result.error = 'These screenshots could not be compared.';
  }

  return result;
}

// Compares every baseline page with the current page that has the same index.
// Works only on the screenshots that already exist on disk. No browser, no crawling.
// Returns { threshold, pages: [ one result per baseline page ] }.
export async function compareScreenshots(testId, baselinePages, currentPages, onProgress = () => {}) {
  const diffDir = path.join(STORAGE_DIR, testId, 'diff');
  await fs.rm(diffDir, { recursive: true, force: true }); // a retry starts without old diff images
  await fs.mkdir(diffDir, { recursive: true });

  const pages = [];
  for (const [position, baselinePage] of baselinePages.entries()) {
    console.log(`[Analyze] Comparing ${baselinePage.path}`);
    onProgress(`Comparing ${baselinePage.path} (${position + 1} of ${baselinePages.length})`);

    const currentPage = currentPages.find((page) => page.index === baselinePage.index);
    pages.push(await comparePage(testId, diffDir, baselinePage, currentPage));
  }

  return { threshold: MISMATCH_THRESHOLD, pages };
}
