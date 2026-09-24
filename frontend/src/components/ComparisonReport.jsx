import { useEffect, useState } from 'react';
import { downloadPdf } from '../api.js';
import { formatDate } from '../helpers.js';

const STATUS_LABEL = {
  changed: 'CHANGED',
  unchanged: 'UNCHANGED',
  missing_current: 'UNAVAILABLE',
  missing_baseline: 'UNAVAILABLE',
  error: 'UNAVAILABLE',
};
const STATUS_BADGE = { changed: 'badge-failed', unchanged: 'badge-done' }; // unavailable pages use the plain badge

// Why a page has no comparison
function unavailableReason(page) {
  if (page.status === 'missing_baseline') return `Not captured in the baseline: ${page.error}`;
  if (page.status === 'missing_current') return `Not captured on the current site: ${page.error}`;
  return page.error;
}

// One screenshot. Click it to see it larger.
function Shot({ label, src, onOpen }) {
  return (
    <div className="shot">
      <h4>{label}</h4>
      {src ? (
        <button className="shot-button" onClick={() => onOpen(src)} title="Click to enlarge">
          <img src={src} alt={label} loading="lazy" />
        </button>
      ) : (
        <div className="shot-empty">No image</div>
      )}
    </div>
  );
}

// The big view of one screenshot. Closes with the button, a click outside, or the Escape key.
function Lightbox({ src, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <div className="lightbox" onClick={(event) => event.stopPropagation()}>
        <button className="btn btn-outline btn-small" onClick={onClose}>Close</button>
        <img src={src} alt="Full-size screenshot" />
      </div>
    </div>
  );
}

// Visual regression report. Every number comes from the saved results.
// pdfPath: the API address of this report's PDF. onCompareAnother: only given for the latest report.
function ComparisonReport({ baselineUrl, currentUrl, results, pdfPath, onCompareAnother }) {
  const [zoomedSrc, setZoomedSrc] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');

  async function exportPdf() {
    setExporting(true);
    setExportError('');
    try {
      await downloadPdf(pdfPath);
    } catch (err) {
      console.error(err);
      setExportError(err.message || 'Unable to export the PDF.');
    } finally {
      setExporting(false);
    }
  }

  if (!results) return null;
  const { threshold, pages } = results;

  const changed = pages.filter((page) => page.status === 'changed').length;
  const unchanged = pages.filter((page) => page.status === 'unchanged').length;
  const compared = changed + unchanged;
  const unavailable = pages.length - compared;

  return (
    <section className="panel report">
      <h2>VISUAL REGRESSION REPORT</h2>

      <p className={changed > 0 ? 'verdict verdict-changed' : 'verdict verdict-clean'}>
        {changed > 0 ? 'VISUAL CHANGES DETECTED' : 'NO VISUAL CHANGES DETECTED'}
      </p>

      <dl className="detail-list">
        <dt>Baseline URL</dt>
        <dd>{baselineUrl}</dd>
        <dt>Current URL</dt>
        <dd>{currentUrl}</dd>
        {results.analyzedAt && (
          <>
            <dt>Analyzed</dt>
            <dd>{formatDate(results.analyzedAt)}</dd>
          </>
        )}
      </dl>

      <div className="summary">
        <div><strong>{compared}</strong><span>Pages Compared</span></div>
        <div><strong>{changed}</strong><span>Changed</span></div>
        <div><strong>{unchanged}</strong><span>Unchanged</span></div>
        <div><strong>{unavailable}</strong><span>Unavailable</span></div>
      </div>
      <p className="muted">A page counts as changed when more than {threshold}% of its pixels differ.</p>

      {exportError && <p className="banner banner-error" role="alert">{exportError}</p>}
      <div className="report-actions">
        <button className="btn btn-primary" onClick={exportPdf} disabled={exporting}>
          {exporting ? 'Generating PDF...' : 'Export PDF'}
        </button>
        {onCompareAnother && (
          <button className="btn btn-outline" onClick={onCompareAnother} disabled={exporting}>Compare Another URL</button>
        )}
      </div>

      {pages.map((page) => (
        <article className="report-page" key={page.index}>
          <header>
            <div>
              <h3>Page {String(page.index).padStart(2, '0')}</h3>
              <p className="mono">{page.path}</p>
            </div>
            <span className={`badge ${STATUS_BADGE[page.status] || ''}`}>{STATUS_LABEL[page.status]}</span>
          </header>

          <p>
            Mismatch: <strong>{page.mismatchPercentage === null ? 'not available' : `${page.mismatchPercentage.toFixed(2)}%`}</strong>
          </p>
          {page.sameSize === false && <p className="muted">The page height differs between baseline and current.</p>}
          {!STATUS_BADGE[page.status] && <p className="banner banner-warning">{unavailableReason(page)}</p>}

          <div className="shots">
            <Shot label="Baseline" src={page.baseline} onOpen={setZoomedSrc} />
            <Shot label="Current" src={page.current} onOpen={setZoomedSrc} />
            <Shot label="Diff" src={page.diff} onOpen={setZoomedSrc} />
          </div>
        </article>
      ))}

      {zoomedSrc && <Lightbox src={zoomedSrc} onClose={() => setZoomedSrc(null)} />}
    </section>
  );
}

export default ComparisonReport;
