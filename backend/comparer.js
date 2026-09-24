import fs from 'node:fs/promises';
import path from 'node:path';
import compareImages from 'resemblejs/compareImages.js';
import { createCanvas, loadImage } from 'canvas';
import { STORAGE_DIR } from './screenshotter.js';

// A page counts as "changed" when MORE than this percentage of its pixels differ.
export const MISMATCH_THRESHOLD = 0.1;

// Resemble.js settings.
// largeImageThreshold 0: without it Resemble skips pixels on big images, which is not exact for full-page screenshots.
// ignore antialiasing: the soft edges of text differ a little between two captures, and are not real changes.
// Resemble draws every differing pixel in flat red. That red marks which pixels differ (see outlineChanges).
const ERROR_COLOR = { red: 220, green: 38, blue: 38 };
const RESEMBLE_OPTIONS = {
  output: { errorColor: ERROR_COLOR, errorType: 'flat', transparency: 0.3, largeImageThreshold: 0 },
  ignore: 'antialiasing',
};
const TINT = 0.45; // how strongly changed pixels are tinted red over the current screenshot

// Outlines: red pixels close to each other are grouped, and each group gets a box.
const BLOCK_SIZE = 16; // pixels are grouped in blocks of 16 x 16
const JOIN_DISTANCE = 2; // blocks up to 2 blocks apart belong to the same group
const BOX_PADDING = 8;
const MAX_BOXES = 30;

const isErrorPixel = (data, i) =>
  Math.abs(data[i] - ERROR_COLOR.red) <= 12 && Math.abs(data[i + 1] - ERROR_COLOR.green) <= 12 && Math.abs(data[i + 2] - ERROR_COLOR.blue) <= 12;

// Turns Resemble's diff image into a picture that is easy to read: the CURRENT screenshot, with the pixels
// Resemble found different tinted red (the page underneath stays readable) and a box around every group of
// changes. The baseline is shown next to it in the report, so the eye can compare "was" and "is".
// The list of differing pixels still comes from Resemble's diff. Returns the new PNG.
async function outlineChanges(diffPng, currentPng) {
  const diff = await loadImage(diffPng);
  const { width, height } = diff;
  const diffContext = createCanvas(width, height).getContext('2d');
  diffContext.drawImage(diff, 0, 0);
  const { data } = diffContext.getImageData(0, 0, width, height);

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(await loadImage(currentPng), 0, 0);

  // Tint the changed pixels
  const picture = context.getImageData(0, 0, width, height);
  for (let i = 0; i < data.length; i += 4) {
    if (!isErrorPixel(data, i)) continue;
    picture.data[i] = picture.data[i] * (1 - TINT) + ERROR_COLOR.red * TINT;
    picture.data[i + 1] = picture.data[i + 1] * (1 - TINT) + ERROR_COLOR.green * TINT;
    picture.data[i + 2] = picture.data[i + 2] * (1 - TINT) + ERROR_COLOR.blue * TINT;
  }
  context.putImageData(picture, 0, 0);

  // 1. Mark every block that contains a changed pixel
  const columns = Math.ceil(width / BLOCK_SIZE);
  const rows = Math.ceil(height / BLOCK_SIZE);
  const marked = new Uint8Array(columns * rows);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isErrorPixel(data, (y * width + x) * 4)) marked[Math.floor(y / BLOCK_SIZE) * columns + Math.floor(x / BLOCK_SIZE)] = 1;
    }
  }

  // 2. Group marked blocks that are close to each other (flood fill), keep the box of each group
  const boxes = [];
  for (let start = 0; start < marked.length; start++) {
    if (marked[start] !== 1) continue;
    const box = { left: columns, top: rows, right: 0, bottom: 0 };
    const stack = [start];
    marked[start] = 2;
    while (stack.length > 0) {
      const block = stack.pop();
      const column = block % columns;
      const row = Math.floor(block / columns);
      box.left = Math.min(box.left, column);
      box.right = Math.max(box.right, column);
      box.top = Math.min(box.top, row);
      box.bottom = Math.max(box.bottom, row);
      for (let dy = -JOIN_DISTANCE; dy <= JOIN_DISTANCE; dy++) {
        for (let dx = -JOIN_DISTANCE; dx <= JOIN_DISTANCE; dx++) {
          const c = column + dx;
          const r = row + dy;
          if (c < 0 || r < 0 || c >= columns || r >= rows || marked[r * columns + c] !== 1) continue;
          marked[r * columns + c] = 2;
          stack.push(r * columns + c);
        }
      }
    }
    boxes.push(box);
  }

  // 3. Draw the biggest boxes: a dark line under an amber line, visible on any background
  const area = (box) => (box.right - box.left + 1) * (box.bottom - box.top + 1);
  for (const box of boxes.sort((a, b) => area(b) - area(a)).slice(0, MAX_BOXES)) {
    const x = Math.max(box.left * BLOCK_SIZE - BOX_PADDING, 2);
    const y = Math.max(box.top * BLOCK_SIZE - BOX_PADDING, 2);
    const boxWidth = Math.min((box.right + 1) * BLOCK_SIZE + BOX_PADDING, width - 2) - x;
    const boxHeight = Math.min((box.bottom + 1) * BLOCK_SIZE + BOX_PADDING, height - 2) - y;
    context.lineWidth = 5;
    context.strokeStyle = '#111827';
    context.strokeRect(x, y, boxWidth, boxHeight);
    context.lineWidth = 3;
    context.strokeStyle = '#fbbf24';
    context.strokeRect(x, y, boxWidth, boxHeight);
  }
  return canvas.toBuffer('image/png');
}

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
    const mismatch = Number(data.misMatchPercentage); // Resemble gives it as text with 2 decimals, e.g. "2.43"
    // Boxes are only drawn when something changed. A failure here must not fail the comparison: keep the plain diff.
    let diffImage = data.getBuffer();
    if (mismatch > MISMATCH_THRESHOLD) diffImage = await outlineChanges(diffImage, currentImage).catch(() => diffImage);
    await fs.writeFile(path.join(diffDir, diffName), diffImage);

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
