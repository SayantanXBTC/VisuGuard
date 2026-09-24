import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Download, GitCompareArrows, Maximize2, RotateCw, X } from 'lucide-react';
import { downloadPdf } from '../api.js';
import { formatDate, hostOf } from '../helpers.js';
import CompareSlider from './CompareSlider.jsx';
import { Badge, Button } from './ui.jsx';

const STATUS_LABEL = {
  changed: 'Changed',
  unchanged: 'Unchanged',
  missing_current: 'Unavailable',
  missing_baseline: 'Unavailable',
  error: 'Unavailable',
};
const STATUS_TONE = { changed: 'changed', unchanged: 'done' }; // unavailable pages use the plain tone
const SEVERITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
const SEVERITY_TONE = { low: 'captured', medium: 'warning', high: 'changed', critical: 'failed' };

const rise = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.2, 0.7, 0.2, 1] } },
};

// Why a page has no comparison
function unavailableReason(page) {
  if (page.status === 'missing_baseline') return `Not captured in the baseline: ${page.error}`;
  if (page.status === 'missing_current') return `Not captured on the current site: ${page.error}`;
  return page.error;
}

// A row of options with an indicator that slides to the chosen one
function Segmented({ id, label, options, value, onChange }) {
  return (
    <div className="segmented" role="tablist" aria-label={label}>
      {options.map(([optionId, text, count]) => (
        <button key={optionId} role="tab" aria-selected={value === optionId} className={value === optionId ? 'seg seg-active' : 'seg'} onClick={() => onChange(optionId)}>
          {value === optionId && <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={{ type: 'spring', stiffness: 520, damping: 42 }} />}
          <span className="seg-text">{text}{count !== undefined && <em>{count}</em>}</span>
        </button>
      ))}
    </div>
  );
}

// The optional AI part of one page. The pixel result comes from Resemble.js; this is the AI's description of it.
function Findings({ page }) {
  const ai = page.ai_analysis;

  if (page.status === 'unchanged') return null;
  if (page.status !== 'changed') return null;
  if (!ai) return <p className="findings-note">AI findings were not run for this report.</p>;

  if (ai.status !== 'done') {
    const reason = {
      not_configured: 'AI findings are off. Set an AI provider key in the backend to enable them.',
      timeout: 'AI findings unavailable. The AI service took too long to answer.',
    }[ai.reason] || 'AI findings unavailable. They could not be completed.';
    return <p className="findings-note">{reason}</p>;
  }

  return (
    <div className="findings">
      <div className="findings-head">
        <strong>Findings</strong>
        <Badge tone={SEVERITY_TONE[ai.severity] || 'neutral'}>{SEVERITY_LABEL[ai.severity]} severity</Badge>
        {ai.categories.map((category) => <span key={category} className="chip">{category}</span>)}
      </div>
      <p className="findings-summary">{ai.summary}</p>
      {ai.observations.length > 0 && (
        <ul className="findings-list">
          {ai.observations.map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}
      <p className="findings-foot">
        Described by an AI model from the screenshots, confidence {Math.round(ai.confidence * 100)}%. It can be wrong; the pixel result comes from Resemble.js.
      </p>
    </div>
  );
}

// One screenshot in a dark frame. Tall pages scroll inside the frame. Click (or the button) to see it full screen.
// A shimmering skeleton fills the frame until the image has actually loaded, so switching between
// Baseline / Current / Diff never shows a blank or half-drawn frame.
function Frame({ label, src, onOpen }) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [src]); // reset when the tab (baseline/current/diff) changes

  if (!src) return <div className="frame-empty">No {label.toLowerCase()} image</div>;
  return (
    <div className="frame-wrap">
      <span className="frame-label">{label}</span>
      <div className="frame" style={loaded ? undefined : { minHeight: 320, position: 'relative' }}>
        {!loaded && (
          <div className="screenshot-skeleton">
            <span className="skeleton-shimmer" aria-hidden="true" />
          </div>
        )}
        <img
          src={src}
          alt={label}
          loading="lazy"
          onClick={() => onOpen(src, label)}
          style={{ opacity: loaded ? 1 : 0 }}
          onLoad={() => setLoaded(true)}
        />
      </div>
      <button className="frame-open" onClick={() => onOpen(src, label)} aria-label={`Enlarge ${label}`} title="Enlarge">
        <Maximize2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

// The full-screen view of one screenshot. Closes with the button, a click outside, or the Escape key.
function Lightbox({ image, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <motion.div className="lightbox-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
      <motion.div className="lightbox" onClick={(event) => event.stopPropagation()} initial={{ scale: 0.98 }} animate={{ scale: 1 }} exit={{ scale: 0.98 }} transition={{ duration: 0.2 }}>
        <div className="lightbox-bar">
          <span>{image.label}</span>
          <Button size="sm" variant="ghost" icon={X} onClick={onClose} autoFocus>Close</Button>
        </div>
        <div className="lightbox-scroll">
          <img src={image.src} alt={`${image.label}, full size`} />
        </div>
      </motion.div>
    </motion.div>
  );
}

// One page of the report: result, the screenshots in five views, and the optional AI findings.
function PageCard({ page, onOpen }) {
  const compared = page.status === 'changed' || page.status === 'unchanged';
  const [open, setOpen] = useState(page.status === 'changed'); // unchanged pages start closed to keep the report short
  const [view, setView] = useState(page.status === 'changed' ? 'diff' : 'current');
  const hasImages = Boolean(page.baseline && page.current);

  const shown = {
    baseline: <Frame label="Baseline" src={page.baseline} onOpen={onOpen} />,
    current: <Frame label="Current" src={page.current} onOpen={onOpen} />,
    diff: <Frame label="Diff (changes tinted red and boxed)" src={page.diff} onOpen={onOpen} />,
    slider: <CompareSlider before={page.baseline} after={page.current} />,
    all: (
      <div className="frames-three">
        <Frame label="Baseline" src={page.baseline} onOpen={onOpen} />
        <Frame label="Current" src={page.current} onOpen={onOpen} />
        <Frame label="Diff" src={page.diff} onOpen={onOpen} />
      </div>
    ),
  };

  return (
    <motion.article className="rp" variants={rise} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.08 }}>
      <header className="rp-head">
        <span className="rp-path mono">{page.path}</span>
        <Badge tone={STATUS_TONE[page.status] || 'neutral'}>{STATUS_LABEL[page.status]}</Badge>
        {compared && (
          <span className="rp-mismatch">
            <strong>{page.mismatchPercentage.toFixed(2)}%</strong>
            <span className="meter"><span style={{ transform: `scaleX(${Math.min(1, Math.max(0.02, page.mismatchPercentage / 100))})` }} /></span>
          </span>
        )}
      </header>

      {compared && page.sameSize === false && <p className="rp-note">The page height differs between baseline and current.</p>}
      {!compared && <p className="banner banner-warning"><AlertTriangle size={14} aria-hidden="true" /> {unavailableReason(page)}</p>}

      {hasImages && (
        <>
          <div className="rp-tools">
            {compared && (
              <Segmented
                id={`view-${page.index}`}
                label="Screenshot view"
                value={view}
                onChange={(id) => { setView(id); setOpen(true); }}
                options={[['baseline', 'Baseline'], ['current', 'Current'], ['diff', 'Diff'], ['slider', 'Slider'], ['all', 'All three']]}
              />
            )}
            <button className="link-button rp-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
              {open ? 'Hide screenshots' : 'Show screenshots'}
              <ChevronDown size={14} aria-hidden="true" className={open ? 'flip' : ''} />
            </button>
          </div>

          <AnimatePresence initial={false}>
            {open && (
              <motion.div className="rp-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={view} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                    {shown[view]}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <Findings page={page} />
    </motion.article>
  );
}

// Visual regression report. Every number comes from the saved results.
// pdfPath: the API address of this report's PDF. onCompareAnother / onRetryAi: only given for the latest report.
function ComparisonReport({ baselineUrl, currentUrl, results, pdfPath, onCompareAnother, onRetryAi }) {
  const [zoomed, setZoomed] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [retryingAi, setRetryingAi] = useState(false);
  const [aiError, setAiError] = useState('');
  const [filter, setFilter] = useState('all');

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

  async function retryAi() {
    setRetryingAi(true);
    setAiError('');
    try {
      await onRetryAi();
    } catch (err) {
      console.error(err);
      setAiError(err.message || 'Unable to run the analysis.');
    } finally {
      setRetryingAi(false);
    }
  }

  if (!results) return null;
  const { threshold, pages } = results;

  const changed = pages.filter((page) => page.status === 'changed').length;
  const unchanged = pages.filter((page) => page.status === 'unchanged').length;
  const compared = changed + unchanged;
  const unavailable = pages.length - compared;
  // Changed pages where the AI failed or timed out: worth asking again (nothing is captured or compared again)
  const canRetryAi = Boolean(onRetryAi) && pages.some((page) => page.status === 'changed' && page.ai_analysis && page.ai_analysis.status !== 'done' && page.ai_analysis.reason !== 'not_configured');

  const counts = { all: pages.length, changed, unchanged, unavailable };
  const visiblePages = pages.filter((page) => {
    if (filter === 'all') return true;
    if (filter === 'unavailable') return page.status !== 'changed' && page.status !== 'unchanged';
    return page.status === filter;
  });

  return (
    <motion.section className="report" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.08 } } }}>
      <motion.header className="report-head panel" variants={rise}>
        <div className="report-meta">
          <div className="meta-item"><small>Baseline</small><span className="mono" title={baselineUrl}>{hostOf(baselineUrl)}</span></div>
          <ArrowRight size={15} aria-hidden="true" className="meta-arrow" />
          <div className="meta-item"><small>Compared with</small><span className="mono" title={currentUrl}>{hostOf(currentUrl)}</span></div>
          <div className="meta-item"><small>Status</small><span><Badge tone="done">Completed</Badge></span></div>
          {results.analyzedAt && <div className="meta-item"><small>Analyzed</small><span>{formatDate(results.analyzedAt)}</span></div>}
        </div>

        <div className="report-actions">
          <Button variant="primary" size="sm" icon={Download} onClick={exportPdf} loading={exporting}>Export PDF</Button>
          {canRetryAi && <Button size="sm" icon={RotateCw} onClick={retryAi} loading={retryingAi} disabled={exporting}>Retry analysis</Button>}
          {onCompareAnother && <Button size="sm" icon={GitCompareArrows} onClick={onCompareAnother} disabled={exporting || retryingAi}>Compare another URL</Button>}
        </div>
      </motion.header>

      {exportError && <p className="banner banner-error" role="alert">{exportError}</p>}
      {aiError && <p className="banner banner-error" role="alert">{aiError}</p>}

      <motion.div className="summary" variants={rise}>
        <span className={changed > 0 ? 'verdict verdict-changed' : 'verdict verdict-clean'}>
          {changed > 0 ? <AlertTriangle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
          {changed > 0 ? 'Visual changes detected' : 'No visual changes detected'}
        </span>
        <ul className="summary-stats">
          <li><b>{compared}</b><span>compared</span></li>
          <li className={changed > 0 ? 'stat-changed' : ''}><b>{changed}</b><span>changed</span></li>
          <li><b>{unchanged}</b><span>unchanged</span></li>
          <li><b>{unavailable}</b><span>unavailable</span></li>
        </ul>
        <span className="summary-note">Changed means more than {threshold}% of pixels differ.</span>
      </motion.div>

      <motion.div variants={rise}>
        <Segmented
          id="filter"
          label="Filter pages"
          value={filter}
          onChange={setFilter}
          options={[['all', 'All'], ['changed', 'Changed'], ['unchanged', 'Unchanged'], ['unavailable', 'Unavailable']].filter(([id]) => counts[id] > 0 || id === 'all').map(([id, text]) => [id, text, counts[id]])}
        />
      </motion.div>

      <div className="report-pages">
        {visiblePages.map((page) => <PageCard key={page.index} page={page} onOpen={(src, label) => setZoomed({ src, label })} />)}
      </div>

      <AnimatePresence>{zoomed && <Lightbox image={zoomed} onClose={() => setZoomed(null)} />}</AnimatePresence>
    </motion.section>
  );
}

export default ComparisonReport;
