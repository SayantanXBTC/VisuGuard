import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import { STORAGE_DIR } from './screenshotter.js';

// Builds the PDF version of a visual regression report.
// It uses only saved data: the results from the database and the PNG files on disk.
// No browser, no Resemble.js, no recapturing.

const MARGIN = 40;
const IMAGE_WIDTH = 165; // three images side by side fit the A4 width (3 x 165 + 2 x 10 + 2 x 40 margin)
const IMAGE_HEIGHT = 250;
const IMAGE_GAP = 10;
const TEXT_WIDTH = 595.28 - 2 * MARGIN; // A4 width minus the margins

const STATUS_TEXT = {
  changed: 'CHANGED',
  unchanged: 'UNCHANGED',
  missing_current: 'MISSING CURRENT',
  missing_baseline: 'MISSING BASELINE',
  error: 'COULD NOT BE COMPARED',
};

// Why a page has no comparison, in plain words
function unavailableReason(page) {
  if (page.status === 'missing_current') {
    return `This page could not be captured on the current site, so it was not compared. Reason: ${page.error}`;
  }
  if (page.status === 'missing_baseline') {
    return `This page could not be captured in the baseline, so it was not compared. Reason: ${page.error}`;
  }
  return 'The screenshots of this page could not be compared.';
}

// /files/<testId>/baseline/page-001.png  ->  the file on disk.
// Returns null if the file is missing or is not inside this test's own folder.
function fileOnDisk(testId, address) {
  if (!address) return null;
  const file = path.join(STORAGE_DIR, address.replace(/^\/files\//, ''));
  const testFolder = path.join(STORAGE_DIR, testId) + path.sep;
  return file.startsWith(testFolder) && fs.existsSync(file) ? file : null;
}

// The built-in PDF font only has Latin-1 characters. Typographic characters from the AI text are replaced
// by plain ones, anything else that does not exist in the font becomes "?".
const pdfSafe = (text) =>
  String(text)
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

// What the PDF says about the AI analysis of one changed page: { title, summary, bullets }, or null for other pages
function aiSection(page) {
  if (page.status !== 'changed') return null;
  const ai = page.ai_analysis;
  if (ai?.status !== 'done') return { title: 'AI analysis unavailable.' };
  return {
    title: `AI analysis - Severity: ${ai.severity.toUpperCase()}${ai.categories.length ? ` - Categories: ${ai.categories.join(', ')}` : ''}`,
    summary: pdfSafe(ai.summary),
    bullets: ai.observations.map(pdfSafe),
  };
}

// Height the AI text needs, so a page section is not split between two PDF pages
function aiHeight(doc, section) {
  if (!section) return 0;
  doc.font('Helvetica-Bold').fontSize(10);
  let height = doc.heightOfString(section.title, { width: TEXT_WIDTH }) + 6;
  doc.font('Helvetica');
  if (section.summary) height += doc.heightOfString(section.summary, { width: TEXT_WIDTH }) + 6;
  for (const bullet of section.bullets || []) height += doc.heightOfString(`- ${bullet}`, { width: TEXT_WIDTH - 12 }) + 2;
  return height;
}

function writeAiSection(doc, section) {
  if (!section) return;
  doc.moveDown(0.4).font('Helvetica-Bold').fontSize(10).fillColor('#3730a3').text(section.title, MARGIN, doc.y, { width: TEXT_WIDTH });
  doc.font('Helvetica').fillColor('#000000');
  if (section.summary) doc.text(section.summary, MARGIN, doc.y, { width: TEXT_WIDTH });
  for (const bullet of section.bullets || []) doc.text(`- ${bullet}`, MARGIN + 12, doc.y, { width: TEXT_WIDTH - 12 });
  doc.x = MARGIN;
}

// "2026-09-24 14:05 UTC". Plain ASCII, because the built-in PDF font has no other characters.
const formatTime = (date) => new Date(date).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

// "Label: value" on one line, label in bold
function labelledLine(doc, label, value) {
  doc.font('Helvetica-Bold').fontSize(10).text(`${label}: `, { continued: true });
  doc.font('Helvetica').text(String(value));
}

// Height of the frame for one row of images: as tall as the tallest image once scaled to the box width,
// but never taller than IMAGE_HEIGHT. A short page then does not leave a big empty frame.
function rowHeight(doc, testId, addresses) {
  let height = 40;
  for (const address of addresses) {
    const file = fileOnDisk(testId, address);
    if (!file) continue;
    const image = doc.openImage(file);
    height = Math.max(height, Math.min(IMAGE_HEIGHT, (image.height * IMAGE_WIDTH) / image.width));
  }
  return Math.ceil(height) + 2;
}

// One screenshot in a framed box, with a label above it
function drawImage(doc, testId, label, address, x, y, boxHeight) {
  doc.font('Helvetica-Bold').fontSize(9).fillColor('#475569').text(label, x, y, { width: IMAGE_WIDTH });
  const top = y + 14;
  doc.rect(x, top, IMAGE_WIDTH, boxHeight).lineWidth(0.5).stroke('#cbd5e1');

  const file = fileOnDisk(testId, address);
  if (file) {
    // fit = the whole page is shown, scaled down to fit the box
    doc.image(file, x + 1, top + 1, { fit: [IMAGE_WIDTH - 2, boxHeight - 2], align: 'center', valign: 'top' });
  } else {
    doc.font('Helvetica').fontSize(9).fillColor('#94a3b8').text(address ? 'Image file not found' : 'No image', x, top + boxHeight / 2 - 5, { width: IMAGE_WIDTH, align: 'center' });
  }
  doc.fillColor('#000000');
}

function writeReport(doc, { testId, baselineUrl, currentUrl, results, generatedAt }) {
  const pages = results.pages;
  const changed = pages.filter((page) => page.status === 'changed').length;
  const unchanged = pages.filter((page) => page.status === 'unchanged').length;
  const compared = changed + unchanged;
  const unavailable = pages.length - compared;

  // ---- Header ----
  doc.font('Helvetica-Bold').fontSize(20).text('VISUAL REGRESSION REPORT');
  doc.moveDown(0.4);
  doc.fontSize(13).fillColor(changed > 0 ? '#b91c1c' : '#166534').text(changed > 0 ? 'VISUAL CHANGES DETECTED' : 'NO VISUAL CHANGES DETECTED');
  doc.fillColor('#000000').moveDown(0.6);

  labelledLine(doc, 'Baseline URL', baselineUrl);
  labelledLine(doc, 'Current URL', currentUrl);
  if (results.analyzedAt) labelledLine(doc, 'Analyzed', formatTime(results.analyzedAt));
  labelledLine(doc, 'Generated', formatTime(generatedAt));

  // ---- Summary ----
  doc.moveDown(1).font('Helvetica-Bold').fontSize(13).text('SUMMARY');
  doc.moveDown(0.3);
  labelledLine(doc, 'Pages Compared', compared);
  labelledLine(doc, 'Changed', changed);
  labelledLine(doc, 'Unchanged', unchanged);
  labelledLine(doc, 'Unavailable', unavailable);
  doc.moveDown(0.3).font('Helvetica').fontSize(9).fillColor('#475569')
    .text(`A page counts as changed when more than ${results.threshold}% of its pixels differ (Resemble.js image comparison).`)
    .fillColor('#000000');

  // ---- One section per page ----
  for (const page of pages) {
    const hasImages = Boolean(page.baseline || page.current || page.diff);
    const images = [['Baseline', page.baseline], ['Current', page.current], ['Diff (changes tinted red)', page.diff]];
    const boxHeight = hasImages ? rowHeight(doc, testId, images.map(([, address]) => address)) : 0;
    const ai = aiSection(page);
    const neededHeight = (hasImages ? boxHeight + 110 : 120) + aiHeight(doc, ai); // 110 = the text above the images
    if (doc.y + neededHeight > doc.page.height - doc.page.margins.bottom) doc.addPage();
    doc.moveDown(1.2);

    doc.font('Helvetica-Bold').fontSize(13).text(`Page ${String(page.index).padStart(2, '0')}`);
    labelledLine(doc, 'Path', page.path);
    labelledLine(doc, 'Status', STATUS_TEXT[page.status] || page.status);
    labelledLine(doc, 'Mismatch', page.mismatchPercentage === null ? 'not available' : `${page.mismatchPercentage.toFixed(2)}%`);

    if (page.sameSize === false) {
      doc.font('Helvetica').fontSize(9).fillColor('#475569').text('The page height differs between baseline and current.').fillColor('#000000');
    }

    writeAiSection(doc, ai);

    // Unavailable pages: explain, and do not try to draw a screenshot that does not exist
    if (page.status !== 'changed' && page.status !== 'unchanged') {
      doc.moveDown(0.3).font('Helvetica').fontSize(10).fillColor('#92400e').text(unavailableReason(page)).fillColor('#000000');
      if (!hasImages) continue;
    }

    doc.moveDown(0.5);
    const y = doc.y;
    images.forEach(([label, address], i) => drawImage(doc, testId, label, address, MARGIN + i * (IMAGE_WIDTH + IMAGE_GAP), y, boxHeight));
    doc.x = MARGIN;
    doc.y = y + 14 + boxHeight + 6;
  }
}

// Returns the finished PDF as a Buffer.
function buildReportPdf(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: MARGIN, info: { Title: 'VisuGuard Visual Regression Report' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      writeReport(doc, { ...report, generatedAt: new Date() });
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// Builds the PDF and sends it as a download. A failure is logged and answered with a short message.
export async function sendReportPdf(res, report, fileName) {
  let pdf;
  try {
    pdf = await buildReportPdf(report);
  } catch (error) {
    console.error('[PDF] Could not build the report:', error);
    return res.status(500).json({ error: 'The PDF could not be created. Please try again.' });
  }
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Length': pdf.length,
  });
  res.send(pdf);
}
