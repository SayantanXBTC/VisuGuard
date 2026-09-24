import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { STORAGE_DIR } from './screenshotter.js';

// "Compare Another URL" keeps every finished report.
//
//   storage/<testId>/baseline/                          shared by all comparisons, never moved or changed
//   storage/<testId>/current/  and  diff/               the comparison in progress (or the latest finished one)
//   storage/<testId>/comparisons/<id>/current/ + diff/  older, finished comparisons
//
// archiveComparison() saves the latest finished comparison as a history entry (a row in the
// `comparisons` table) and moves its current/ and diff/ folders under comparisons/<id>/.
// After that the test's own current/ and diff/ are free for the next comparison.

const MOVED_FOLDERS = ['current', 'diff'];

// /files/<testId>/current/page-001.png  ->  /files/<testId>/comparisons/<id>/current/page-001.png
const newAddress = (address, testId, comparisonId) =>
  address ? address.replace(`/files/${testId}/`, `/files/${testId}/comparisons/${comparisonId}/`) : address;

const foldersOf = (testId, comparisonId) => ({
  test: path.join(STORAGE_DIR, testId),
  archive: path.join(STORAGE_DIR, testId, 'comparisons', comparisonId),
});

// Saves the finished comparison of `test` to history. Returns the new comparison id.
// `test` needs: id, current_url, current_pages, results, pages_tested, pages_changed.
export async function archiveComparison(db, userId, test) {
  const comparisonId = crypto.randomUUID();
  const folders = foldersOf(test.id, comparisonId);

  // The saved report must point to the new folders. The baseline address stays: the baseline is shared.
  const results = {
    ...test.results,
    pages: test.results.pages.map((page) => ({
      ...page,
      current: newAddress(page.current, test.id, comparisonId),
      diff: newAddress(page.diff, test.id, comparisonId),
    })),
  };
  const currentPages = test.current_pages.map((page) =>
    page.screenshot ? { ...page, screenshot: page.screenshot.replace(/^current\//, `comparisons/${comparisonId}/current/`) } : page,
  );

  // 1. Save the history entry
  const { error } = await db.from('comparisons').insert({
    id: comparisonId,
    test_id: test.id,
    user_id: userId,
    current_url: test.current_url,
    current_pages: currentPages,
    results,
    pages_tested: test.pages_tested,
    pages_changed: test.pages_changed,
  });
  if (error) throw error;

  // 2. Move the files. If that fails, undo step 1 so nothing is half saved.
  try {
    await fs.mkdir(folders.archive, { recursive: true });
    for (const name of MOVED_FOLDERS) {
      await fs.rename(path.join(folders.test, name), path.join(folders.archive, name));
    }
  } catch (moveError) {
    await undoArchive(db, test.id, comparisonId);
    throw moveError;
  }

  return comparisonId;
}

// Puts the files back and removes the history entry. Used when something fails after archiving.
export async function undoArchive(db, testId, comparisonId) {
  const folders = foldersOf(testId, comparisonId);
  for (const name of MOVED_FOLDERS) {
    await fs.rename(path.join(folders.archive, name), path.join(folders.test, name)).catch(() => {});
  }
  await fs.rm(folders.archive, { recursive: true, force: true });
  await db.from('comparisons').delete().eq('id', comparisonId);
}
