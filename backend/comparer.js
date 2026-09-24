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
// Resemble draws every differing pixel in flat red. That red marks which pixels differ (see markChanges).
const ERROR_COLOR = { red: 220, green: 38, blue: 38 };
const RESEMBLE_OPTIONS = {
  output: { errorColor: ERROR_COLOR, errorType: 'flat', transparency: 0.3, largeImageThreshold: 0 },
  ignore: 'antialiasing',
};
// How the readable diff is drawn (see markChanges)
const DIM = 0.32; // unchanged parts of the page are shown in grey at this brightness, so the changes stand out
const BLOCK_SIZE = 16; // changed pixels are grouped in blocks of 16 x 16
const JOIN_DISTANCE = 3; // blocks up to 3 blocks apart belong to the same change
const BOX_PADDING = 12;
const MERGE_GAP = 28; // boxes closer than this are merged into one, so one change gets one box
const MAX_BOXES = 12;

const isErrorPixel = (data, i) =>
  Math.abs(data[i] - ERROR_COLOR.red) <= 12 && Math.abs(data[i + 1] - ERROR_COLOR.green) <= 12 && Math.abs(data[i + 2] - ERROR_COLOR.blue) <= 12;

// Merges rectangles that overlap or nearly touch, until none do
function mergeBoxes(boxes, gap) {
  const list = boxes.map((box) => ({ ...box }));
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < list.length && !merged; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        if (a.x - gap > b.x + b.w || b.x - gap > a.x + a.w || a.y - gap > b.y + b.h || b.y - gap > a.y + a.h) continue;
        const x = Math.min(a.x, b.x);
        const y = Math.min(a.y, b.y);
        list[i] = { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
        list.splice(j, 1);
        merged = true;
        break;
      }
    }
  }
  return list;
}

// Turns Resemble's diff into a picture that says "here is what changed":
//   - the CURRENT page is shown dimmed and in grey, so it steps back
//   - every changed area is shown in full colour (a spotlight), inside a clear red box with a number
// Which pixels differ still comes from Resemble's diff; only the drawing is ours.
// Returns { png, areas } where areas is how many changed areas were marked.
async function markChanges(diffPng, currentPng) {
  const diff = await loadImage(diffPng);
  const current = await loadImage(currentPng);
  const { width, height } = diff;
  const diffContext = createCanvas(width, height).getContext('2d');
  diffContext.drawImage(diff, 0, 0);
  const { data } = diffContext.getImageData(0, 0, width, height);

  // 1. Mark every block that contains a changed pixel, and group blocks that are close together
  const columns = Math.ceil(width / BLOCK_SIZE);
  const rows = Math.ceil(height / BLOCK_SIZE);
  const marked = new Uint8Array(columns * rows);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isErrorPixel(data, (y * width + x) * 4)) marked[Math.floor(y / BLOCK_SIZE) * columns + Math.floor(x / BLOCK_SIZE)] = 1;
    }
  }
  const groups = [];
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
    groups.push(box);
  }

  // 2. Groups -> padded pixel boxes, merged so one change gets one box, biggest first, then numbered top to bottom
  const pixelBoxes = groups.map((box) => {
    const x = Math.max(box.left * BLOCK_SIZE - BOX_PADDING, 0);
    const y = Math.max(box.top * BLOCK_SIZE - BOX_PADDING, 0);
    return { x, y, w: Math.min((box.right + 1) * BLOCK_SIZE + BOX_PADDING, width) - x, h: Math.min((box.bottom + 1) * BLOCK_SIZE + BOX_PADDING, height) - y };
  });
  const boxes = mergeBoxes(pixelBoxes, MERGE_GAP)
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, MAX_BOXES)
    .sort((a, b) => a.y - b.y || a.x - b.x);

  // 3. The whole page, dimmed and in grey
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(current, 0, 0);
  const picture = context.getImageData(0, 0, width, height);
  const px = picture.data;
  for (let i = 0; i < px.length; i += 4) {
    const grey = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) * DIM + 14;
    px[i] = grey;
    px[i + 1] = grey;
    px[i + 2] = grey + 2;
  }
  context.putImageData(picture, 0, 0);

  // 4. Each changed area: back in full colour, a faint red wash, a crisp red frame and a numbered tag
  const scale = Math.max(1, width / 1280);
  boxes.forEach((box, n) => {
    context.drawImage(current, box.x, box.y, box.w, box.h, box.x, box.y, box.w, box.h);
    context.fillStyle = 'rgba(239, 68, 68, 0.07)';
    context.fillRect(box.x, box.y, box.w, box.h);

    context.lineWidth = 6 * scale;
    context.strokeStyle = 'rgba(239, 68, 68, 0.25)';
    context.strokeRect(box.x - 2 * scale, box.y - 2 * scale, box.w + 4 * scale, box.h + 4 * scale);
    context.lineWidth = 2.5 * scale;
    context.strokeStyle = '#ef4444';
    context.strokeRect(box.x, box.y, box.w, box.h);

    const radius = 13 * scale;
    const cx = Math.min(Math.max(box.x, radius + 2), width - radius - 2);
    const cy = Math.min(Math.max(box.y, radius + 2), height - radius - 2);
    context.beginPath();
    context.arc(cx, cy, radius, 0, Math.PI * 2);
    context.fillStyle = '#ef4444';
    context.fill();
    context.lineWidth = 2 * scale;
    context.strokeStyle = '#ffffff';
    context.stroke();
    context.fillStyle = '#ffffff';
    context.font = `bold ${Math.round(14 * scale)}px sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(String(n + 1), cx, cy + scale);
  });

  return { png: canvas.toBuffer('image/png'), areas: boxes.length };
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
    if (mismatch > MISMATCH_THRESHOLD) {
      const marked = await markChanges(diffImage, currentImage).catch(() => null);
      if (marked) {
        diffImage = marked.png;
        result.changedAreas = marked.areas;
      }
    }
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
