import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { AlertTriangle, ArrowRight, ChevronLeft, ChevronRight, Download, GitCompareArrows, Maximize2, RotateCw, Sparkles, X } from 'lucide-react';
import { downloadPdf } from '../api.js';
import { formatDate, hostOf } from '../helpers.js';
import { useImageLoad } from '../useImageLoad.js';
import CompareSlider from './CompareSlider.jsx';
import ImageFailed from './ImageFailed.jsx';
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
const EASE = [0.2, 0.7, 0.2, 1];

const rise = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } },
};

const popIn = {
  hidden: { opacity: 0, x: -14, scale: 0.96 },
  visible: { opacity: 1, x: 0, scale: 1, transition: { type: 'spring', stiffness: 360, damping: 26 } },
};

const kindOf = (page) => (page.status === 'changed' ? 'changed' : page.status === 'unchanged' ? 'unchanged' : 'unavailable');

// Why a page has no comparison
function unavailableReason(page) {
  if (page.status === 'missing_baseline') return `Not captured in the baseline: ${page.error}`;
  if (page.status === 'missing_current') return `Not captured on the current site: ${page.error}`;
  return page.error;
}

// A number that counts up from 0 when it appears
function CountUp({ value, decimals = 0, delay = 0, suffix = '' }) {
  const reduce = useReducedMotion();
  const count = useMotionValue(reduce ? value : 0);
  const text = useTransform(count, (v) => `${v.toFixed(decimals)}${suffix}`);
  useEffect(() => {
    if (reduce) {
      count.set(value);
      return undefined;
    }
    const controls = animate(count, value, { duration: 1.1, delay, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [value, delay, reduce, count]);
  return <motion.span>{text}</motion.span>;
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

// "Assembling your report": each page's result flips in, one after another. Shown once, right after a live analysis.
function ReportIntro({ pages, onDone }) {
  const reduce = useReducedMotion();
  const shown = pages.slice(0, 12);
  useEffect(() => {
    const total = reduce ? 0 : 450 + shown.length * 190 + 900;
    const timer = setTimeout(onDone, total);
    return () => clearTimeout(timer);
  }, [reduce, shown.length, onDone]);

  return (
    <motion.div
      className="report-intro panel"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)', transition: { duration: 0.4 } }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <span className="report-intro-glow" aria-hidden="true" />
      <div className="report-intro-head">
        <Sparkles size={18} className="report-intro-icon" aria-hidden="true" />
        <div>
          <strong>Assembling your report</strong>
          <span>Every page, checked pixel by pixel.</span>
        </div>
        <button className="link-button" onClick={onDone}>Skip</button>
      </div>
      <div className="report-intro-grid">
        {shown.map((page, n) => (
          <motion.div
            key={page.index}
            className={`intro-tile intro-tile-${kindOf(page)}`}
            initial={{ opacity: 0, rotateX: -80, y: 16 }}
            animate={{ opacity: 1, rotateX: 0, y: 0 }}
            transition={{ delay: 0.3 + n * 0.19, type: 'spring', stiffness: 260, damping: 20 }}
          >
            <span className="mono">{page.path}</span>
            <strong>{kindOf(page) === 'unavailable' ? 'N/A' : `${page.mismatchPercentage.toFixed(2)}%`}</strong>
            <em>{STATUS_LABEL[page.status]}</em>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// The optional AI part of one page. The pixel result comes from Resemble.js; this is the AI's description of it.
function Findings({ page }) {
  const ai = page.ai_analysis;

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
    <motion.div className="findings" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.4, ease: EASE }}>
      <div className="findings-head">
        <Sparkles size={15} className="findings-spark" aria-hidden="true" />
        <strong>AI findings</strong>
        <Badge tone={SEVERITY_TONE[ai.severity] || 'neutral'}>{SEVERITY_LABEL[ai.severity]} severity</Badge>
        {ai.categories.map((category) => <span key={category} className="chip">{category}</span>)}
      </div>
      <p className="findings-summary">{ai.summary}</p>
      {ai.observations.length > 0 && (
        <ul className="findings-list">
          {ai.observations.map((line, i) => (
            <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.06 }}>{line}</motion.li>
          ))}
        </ul>
      )}
      <p className="findings-foot">
        Described by an AI model from the screenshots, confidence {Math.round(ai.confidence * 100)}%. It can be wrong; the pixel result comes from Resemble.js.
      </p>
    </motion.div>
  );
}

// One screenshot in a dark frame. Tall pages scroll inside the frame. Click (or the button) to see it full screen.
// A shimmering skeleton fills the frame until the image has actually loaded.
function Frame({ label, src, onOpen }) {
  const { loaded, failed, retry, imgProps } = useImageLoad(src);

  if (!src) return <div className="frame-empty">No {label.toLowerCase()} image</div>;
  return (
    <div className="frame-wrap">
      <span className="frame-label">{label}</span>
      <div className="frame" style={loaded ? undefined : { minHeight: 320, position: 'relative' }}>
        {!loaded && (
          <div className="screenshot-skeleton">
            {failed ? (
              <ImageFailed onRetry={retry} />
            ) : (
              <span className="skeleton-shimmer" aria-hidden="true" />
            )}
          </div>
        )}
        <img
          {...imgProps}
          alt={label}
          onClick={() => onOpen(src, label)}
          style={{ opacity: loaded ? 1 : 0 }}
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
      <motion.div className="lightbox" onClick={(event) => event.stopPropagation()} initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97 }} transition={{ duration: 0.22, ease: EASE }}>
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

const VIEWS = [['diff', 'Diff'], ['slider', 'Slider'], ['baseline', 'Baseline'], ['current', 'Current'], ['all', 'Side by side']];

// The selected page: its result, the screenshots in five views, and the optional AI findings.
function PageDetail({ page, view, onView, onOpen, position, total, onPrev, onNext }) {
  const compared = page.status === 'changed' || page.status === 'unchanged';
  const hasImages = Boolean(page.baseline && page.current);

  const shown = {
    baseline: <Frame label="Baseline" src={page.baseline} onOpen={onOpen} />,
    current: <Frame label="Current" src={page.current} onOpen={onOpen} />,
    diff: <Frame label="Changes (numbered in red)" src={page.diff} onOpen={onOpen} />,
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
    <article className={`rd rd-${kindOf(page)}`}>
      <header className="rd-head">
        <div className="rd-title">
          <small>Page {position} of {total}</small>
          <h3 className="mono">{page.path}</h3>
          {page.title && <span className="rd-page-title">{page.title}</span>}
        </div>
        <div className="rd-score">
          {compared ? (
            <>
              <strong><CountUp value={page.mismatchPercentage} decimals={2} suffix="%" /></strong>
              <span>{page.changedAreas ? `in ${page.changedAreas} ${page.changedAreas === 1 ? 'area' : 'areas'}` : 'of pixels differ'}</span>
              <span className="meter meter-lg">
                <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: Math.min(1, Math.max(0.02, page.mismatchPercentage / 100)) }} transition={{ duration: 0.9, ease: EASE }} />
              </span>
            </>
          ) : (
            <strong className="rd-na">N/A</strong>
          )}
          <Badge tone={STATUS_TONE[page.status] || 'neutral'}>{STATUS_LABEL[page.status]}</Badge>
        </div>
        <div className="rd-nav">
          <button className="rd-nav-btn" onClick={onPrev} disabled={position <= 1} aria-label="Previous page"><ChevronLeft size={16} /></button>
          <button className="rd-nav-btn" onClick={onNext} disabled={position >= total} aria-label="Next page"><ChevronRight size={16} /></button>
        </div>
      </header>

      {compared && page.sameSize === false && <p className="rp-note">The page height differs between baseline and current.</p>}
      {!compared && <p className="banner banner-warning"><AlertTriangle size={14} aria-hidden="true" /> {unavailableReason(page)}</p>}

      <Findings page={page} />

      {hasImages && (
        <>
          <div className="rd-tools">
            <Segmented id="view" label="Screenshot view" value={view} onChange={onView} options={VIEWS} />
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={view}
              className="rd-view"
              initial={{ opacity: 0, y: 8, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: EASE }}
            >
              {shown[view]}
            </motion.div>
          </AnimatePresence>
        </>
      )}
    </article>
  );
}

// Visual regression report. Every number comes from the saved results.
// pdfPath: the API address of this report's PDF. onCompareAnother / onRetryAi: only given for the latest report.
// fresh: the analysis just finished while the user watched, so the "assembling" intro plays first.
function ComparisonReport({ baselineUrl, currentUrl, results, pdfPath, onCompareAnother, onRetryAi, fresh = false, onIntroDone }) {
  const [intro, setIntro] = useState(Boolean(fresh));
  const [zoomed, setZoomed] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [retryingAi, setRetryingAi] = useState(false);
  const [aiError, setAiError] = useState('');
  const [filter, setFilter] = useState('all');
  const pages = useMemo(() => results?.pages || [], [results]);
  const [selected, setSelected] = useState(() => (pages.find((page) => page.status === 'changed') || pages[0])?.index);
  const [view, setView] = useState(pages.some((page) => page.status === 'changed') ? 'diff' : 'current');
  const [direction, setDirection] = useState(1);
  const detailRef = useRef(null);

  const finishIntro = useRef(() => {});
  finishIntro.current = () => {
    setIntro(false);
    onIntroDone?.();
  };
  const endIntro = useCallback(() => finishIntro.current(), []);

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

  const changed = pages.filter((page) => page.status === 'changed').length;
  const unchanged = pages.filter((page) => page.status === 'unchanged').length;
  const compared = changed + unchanged;
  const unavailable = pages.length - compared;
  const largest = pages.reduce((max, page) => (page.status === 'changed' && page.mismatchPercentage > max ? page.mismatchPercentage : max), 0);
  const largestPage = pages.find((page) => page.status === 'changed' && page.mismatchPercentage === largest);
  const unchangedPaths = pages.filter((page) => page.status === 'unchanged').map((page) => page.path);
  const context = [
    changed > 0 && largestPage && `The biggest shift is on ${largestPage.path} (${largest.toFixed(1)}%).`,
    changed === 0 && `Every page is within ${results.threshold}% of the baseline.`,
    changed > 0 && unchangedPaths.length === 1 && `${unchangedPaths[0]} is untouched.`,
    changed > 0 && unchangedPaths.length > 1 && `${unchangedPaths.length} pages are untouched.`,
    unavailable > 0 && `${unavailable} ${unavailable === 1 ? "page couldn't" : "pages couldn't"} be captured.`,
    changed > 0 && `Anything past ${results.threshold}% counts as a change.`,
  ].filter(Boolean).join(' ');
  // Changed pages where the AI failed or timed out: worth asking again (nothing is captured or compared again)
  const canRetryAi = Boolean(onRetryAi) && pages.some((page) => page.status === 'changed' && page.ai_analysis && page.ai_analysis.status !== 'done' && page.ai_analysis.reason !== 'not_configured');

  const counts = { all: pages.length, changed, unchanged, unavailable };
  const visiblePages = pages.filter((page) => filter === 'all' || kindOf(page) === filter);
  const current = visiblePages.find((page) => page.index === selected) || visiblePages[0];
  const position = current ? visiblePages.indexOf(current) + 1 : 0;

  function select(page) {
    if (!page || page.index === current?.index) return;
    if (!visiblePages.includes(page)) setFilter('all');
    setDirection(visiblePages.indexOf(page) > visiblePages.indexOf(current) ? 1 : -1);
    setSelected(page.index);
    if (window.innerWidth < 900) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Up/down arrows move through the page list while it has focus
  function onRailKey(event) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const next = visiblePages[position - 1 + (event.key === 'ArrowDown' ? 1 : -1)];
    if (next) select(next);
  }

  if (!results) return null;

  return (
    <section className="report">
      <AnimatePresence mode="wait">
        {intro ? (
          <ReportIntro key="intro" pages={pages} onDone={endIntro} />
        ) : (
          <motion.div key="body" className="report-body" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.1 } } }}>
            <motion.header className="mast panel" variants={rise}>
              <div className="mast-top">
                <span className="mast-route">
                  <span className="mono" title={baselineUrl}>{hostOf(baselineUrl)}</span>
                  <ArrowRight size={13} aria-hidden="true" />
                  <span className="mono" title={currentUrl}>{hostOf(currentUrl)}</span>
                  {results.analyzedAt && <span className="mast-date">{formatDate(results.analyzedAt)}</span>}
                </span>
                <div className="report-actions">
                  <Button variant="primary" size="sm" icon={Download} onClick={exportPdf} loading={exporting}>Export PDF</Button>
                  {canRetryAi && <Button size="sm" icon={RotateCw} onClick={retryAi} loading={retryingAi} disabled={exporting}>Retry analysis</Button>}
                  {onCompareAnother && <Button size="sm" icon={GitCompareArrows} onClick={onCompareAnother} disabled={exporting || retryingAi}>Compare another URL</Button>}
                </div>
              </div>

              <h2 className="mast-title">
                {changed > 0 ? (
                  <><em><CountUp value={changed} delay={0.15} /></em> of {compared} {compared === 1 ? 'page' : 'pages'} changed</>
                ) : (
                  <>Nothing moved. All <em>{compared}</em> {compared === 1 ? 'page matches' : 'pages match'}.</>
                )}
              </h2>
              <p className="mast-sub">{context}</p>

              <div className="mast-strip" aria-label="Change per page">
                {pages.map((page, n) => {
                  const kind = kindOf(page);
                  const height = kind === 'changed' ? 0.14 + 0.86 * Math.sqrt(page.mismatchPercentage / Math.max(largest, 0.01)) : kind === 'unchanged' ? 0.05 : 0;
                  const label = kind === 'unavailable' ? 'not captured' : `${page.mismatchPercentage.toFixed(1)}%`;
                  return (
                    <button
                      key={page.index}
                      className={`strip-col strip-${kind}${page.index === current?.index ? ' strip-active' : ''}`}
                      onClick={() => select(page)}
                      title={`${page.path}: ${label}`}
                      aria-label={`${page.path}, ${label}`}
                    >
                      <span className="strip-value">{label}</span>
                      <span className="strip-bar">
                        <motion.span
                          className="strip-fill"
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: height }}
                          transition={{ delay: 0.35 + n * 0.07, duration: 0.7, ease: EASE }}
                        />
                      </span>
                      <span className="strip-label mono">{page.path}</span>
                    </button>
                  );
                })}
              </div>
            </motion.header>

            {exportError && <p className="banner banner-error" role="alert">{exportError}</p>}
            {aiError && <p className="banner banner-error" role="alert">{aiError}</p>}

            <div className="report-split">
              <motion.aside className="report-rail panel" variants={rise}>
                <Segmented
                  id="filter"
                  label="Filter pages"
                  value={filter}
                  onChange={setFilter}
                  options={[['all', 'All'], ['changed', 'Changed'], ['unchanged', 'Same'], ['unavailable', 'N/A']].filter(([id]) => counts[id] > 0 || id === 'all').map(([id, text]) => [id, text, counts[id]])}
                />
                <motion.ul
                  key={filter}
                  className="rail-list"
                  role="listbox"
                  aria-label="Pages"
                  tabIndex={0}
                  onKeyDown={onRailKey}
                  initial="hidden"
                  animate="visible"
                  variants={{ visible: { transition: { staggerChildren: 0.07, delayChildren: 0.25 } } }}
                >
                  {visiblePages.map((page) => {
                    const kind = kindOf(page);
                    const active = page.index === current?.index;
                    return (
                      <motion.li key={page.index} variants={popIn}>
                        <button className={active ? 'rail-item rail-item-active' : 'rail-item'} onClick={() => select(page)} role="option" aria-selected={active}>
                          {active && <motion.span layoutId="rail-active" className="rail-active-bg" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
                          <span className={`rail-dot rail-dot-${kind}`} />
                          <span className="rail-path mono">{page.path}</span>
                          <span className="rail-pct">{kind === 'unavailable' ? 'N/A' : `${page.mismatchPercentage.toFixed(1)}%`}</span>
                          <span className="rail-meter">
                            <motion.span
                              className={`rail-meter-fill rail-meter-${kind}`}
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: kind === 'unavailable' ? 0 : Math.min(1, Math.max(0.03, page.mismatchPercentage / Math.max(largest, 1))) }}
                              transition={{ delay: 0.5, duration: 0.8, ease: EASE }}
                            />
                          </span>
                        </button>
                      </motion.li>
                    );
                  })}
                </motion.ul>
                <p className="rail-hint">Tip: use ↑ ↓ to move between pages.</p>
              </motion.aside>

              <motion.div className="report-detail panel" variants={rise} ref={detailRef}>
                <AnimatePresence mode="wait" initial={false} custom={direction}>
                  {current && (
                    <motion.div
                      key={current.index}
                      custom={direction}
                      initial={{ opacity: 0, x: 26 * direction }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -18 * direction }}
                      transition={{ duration: 0.28, ease: EASE }}
                    >
                      <PageDetail
                        page={current}
                        view={view}
                        onView={setView}
                        onOpen={(src, label) => setZoomed({ src, label })}
                        position={position}
                        total={visiblePages.length}
                        onPrev={() => select(visiblePages[position - 2])}
                        onNext={() => select(visiblePages[position])}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{zoomed && <Lightbox image={zoomed} onClose={() => setZoomed(null)} />}</AnimatePresence>
    </section>
  );
}

export default ComparisonReport;
