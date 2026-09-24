import { Router } from 'express';
import { sendReportPdf } from '../report.js';

// Old, finished comparisons (history). All routes run after requireUser.
// req.db acts as the signed-in user, so Row Level Security only shows their own comparisons.
const router = Router();

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = (res) => res.status(404).json({ error: 'Comparison not found.' });

// One saved comparison, with the baseline URL of its test
async function findComparison(db, id) {
  const { data, error } = await db.from('comparisons').select('*, tests(baseline_url)').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { tests, ...comparison } = data;
  return { ...comparison, baseline_url: tests.baseline_url };
}

// GET /api/comparisons/:id: a saved report. Nothing is recomputed.
router.get('/:id', async (req, res) => {
  if (!UUID.test(req.params.id)) return notFound(res);
  const comparison = await findComparison(req.db, req.params.id);
  if (!comparison) return notFound(res);
  res.json({ comparison });
});

// GET /api/comparisons/:id/report.pdf
router.get('/:id/report.pdf', async (req, res) => {
  if (!UUID.test(req.params.id)) return notFound(res);
  const comparison = await findComparison(req.db, req.params.id);
  if (!comparison) return notFound(res);

  if (!comparison.results?.pages?.length) {
    return res.status(409).json({ error: 'This report has no pages to export.' });
  }

  await sendReportPdf(
    res,
    {
      testId: comparison.test_id,
      baselineUrl: comparison.baseline_url,
      currentUrl: comparison.current_url,
      results: comparison.results,
    },
    `visuguard-report-${comparison.test_id.slice(0, 8)}-${comparison.id.slice(0, 8)}.pdf`,
  );
});

export default router;
