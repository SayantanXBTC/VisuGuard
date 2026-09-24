import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Sparkles } from 'lucide-react';
import { parseProgress } from '../helpers.js';
import { ProgressBar } from './ui.jsx';

const TITLE = {
  baseline: 'Capturing baseline',
  current: 'Capturing current deployment',
  analysis: 'Comparing pages',
};

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// Each new page "renders" into the window piece by piece
const piece = {
  hidden: { opacity: 0, y: 5, scaleX: 0.55 },
  shown: { opacity: 1, y: 0, scaleX: 1, transition: { duration: 0.35, ease: [0.2, 0.7, 0.2, 1] } },
};

// A small browser window: the page loads in, the camera flashes, a scan line sweeps it,
// and every captured page drops into the filmstrip underneath.
function BrowserScan({ path, captured }) {
  const recent = captured.slice(-5);
  return (
    <div className="scan-stage">
      <div className="scan-window">
        <div className="scan-bar">
          <i /><i /><i />
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={path || 'start'}
              className="mono"
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ duration: 0.18 }}
            >
              {path || '/'}
            </motion.span>
          </AnimatePresence>
          <span className="scan-rec"><b />REC</span>
        </div>
        <div className="scan-page">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={path || 'start'}
              className="scan-content"
              initial="hidden"
              animate="shown"
              exit={{ opacity: 0, transition: { duration: 0.15 } }}
              variants={{ shown: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }}
            >
              <motion.span variants={piece} className="scan-line scan-line-lg" />
              <motion.span variants={piece} className="scan-line" />
              <motion.span variants={piece} className="scan-line scan-line-sm" />
              <motion.div variants={piece} className="scan-blocks"><span /><span /><span /></motion.div>
            </motion.div>
          </AnimatePresence>
          <span className="scan-beam" />
          <span className="scan-corner scan-corner-tl" />
          <span className="scan-corner scan-corner-tr" />
          <span className="scan-corner scan-corner-bl" />
          <span className="scan-corner scan-corner-br" />
          {path && <span key={`flash-${path}`} className="scan-flash" />}
        </div>
      </div>

      <div className="scan-film" aria-hidden="true">
        <AnimatePresence initial={false}>
          {recent.map((shotPath) => (
            <motion.span
              key={shotPath}
              layout
              className="scan-shot"
              title={shotPath}
              initial={{ opacity: 0, y: -26, scale: 0.5, rotate: -14 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
              transition={{ type: 'spring', stiffness: 320, damping: 20 }}
            >
              <i /><i /><i />
            </motion.span>
          ))}
        </AnimatePresence>
        {captured.length > recent.length && <span className="scan-film-more">+{captured.length - recent.length}</span>}
      </div>
    </div>
  );
}

// Baseline -> pixel comparison -> differences. Particles flow along the links; during the AI step,
// sparkles orbit the last frame while the model reads the changes.
function CompareFlow({ ai }) {
  return (
    <div className={ai ? 'flow-viz flow-viz-ai' : 'flow-viz'}>
      {['Baseline', ai ? 'AI reading' : 'Pixel comparison', 'Differences'].map((label, index) => (
        <div className="flow-viz-item" key={index}>
          <div className={`viz-frame viz-frame-${index}`}>
            <span /><span /><span />
            {index === 1 && !ai && <i className="viz-scan" />}
            {index === 1 && ai && <Sparkles size={16} className="viz-ai" />}
            {index === 2 && <><b className="viz-hit viz-hit-a" /><b className="viz-hit viz-hit-b" /></>}
          </div>
          <small>{label}</small>
          {index < 2 && (
            <span className="viz-link" aria-hidden="true">
              <b className="viz-dot" />
              <b className="viz-dot" style={{ animationDelay: '0.45s' }} />
              <b className="viz-dot" style={{ animationDelay: '0.9s' }} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// The live state of a capture or of the analysis, shown inside its step.
// kind: 'baseline' | 'current' | 'analysis'. progress: the live text from the server, or null.
// pages: the page paths of the baseline (for current / analysis the same pages are visited, so the list is known).
function WorkingScreen({ kind, progress, pages }) {
  const [seconds, setSeconds] = useState(0);
  const [seen, setSeen] = useState([]); // baseline only: paths visited so far (the crawl finds pages as it goes)
  const info = parseProgress(progress);
  const path = info?.path;
  const analyzingDifferences = info?.phase === 'ai';

  useEffect(() => {
    setSeconds(0);
    setSeen([]);
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [kind]);

  useEffect(() => {
    if (kind === 'baseline' && path) setSeen((list) => (list.includes(path) ? list : [...list, path]));
  }, [kind, path]);

  // The rows shown under the progress bar: [{ path, state: done | active | waiting }]
  let rows = [];
  if (kind === 'baseline') {
    rows = seen.slice(-6).map((seenPath, i, list) => ({ path: seenPath, state: i === list.length - 1 ? 'active' : 'done' }));
  } else if (!analyzingDifferences && pages?.length) {
    rows = pages.map((pagePath, i) => ({ path: pagePath, state: !info?.index ? 'waiting' : i + 1 < info.index ? 'done' : i + 1 === info.index ? 'active' : 'waiting' }));
  }

  // Pages already photographed, for the filmstrip
  const captured = kind === 'baseline' ? seen.slice(0, -1) : rows.filter((row) => row.state === 'done').map((row) => row.path);

  const title = analyzingDifferences ? 'Analyzing differences' : TITLE[kind];
  const value = info?.index && !info.atMost ? (info.index - 1) / info.total : null;

  return (
    <motion.div className="work" role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.25 }}>
      <span className="work-activity" aria-hidden="true" />
      <div className="work-visual" aria-hidden="true">
        {kind === 'analysis' ? <CompareFlow ai={analyzingDifferences} /> : <BrowserScan path={path} captured={captured} />}
      </div>

      <div className="work-info">
        <p className="work-title">
          <span className="work-live" aria-hidden="true" />
          {title}
        </p>

        <div className="work-current">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={path || progress || 'starting'}
              className={path ? 'mono' : ''}
              initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
              transition={{ duration: 0.22 }}
            >
              {path || progress || 'Starting...'}
            </motion.span>
          </AnimatePresence>
        </div>

        <div className="work-meter">
          <ProgressBar value={value} />
          <span className="work-count">
            {info?.index ? `Page ${info.index}${info.atMost ? '' : ` of ${info.total}`}` : ' '}
          </span>
          <span className="work-clock mono">{clock(seconds)}</span>
        </div>

        {rows.length > 0 && (
          <ul className="work-pages">
            <AnimatePresence initial={false}>
              {rows.map((row) => (
                <motion.li
                  key={row.path}
                  layout
                  className={`work-page work-page-${row.state}`}
                  initial={{ opacity: 0, y: 8, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 26 }}
                >
                  <span className="work-page-mark">
                    <AnimatePresence mode="wait" initial={false}>
                      {row.state === 'done' ? (
                        <motion.span key="done" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 16 }}>
                          <Check size={11} strokeWidth={3} aria-hidden="true" />
                        </motion.span>
                      ) : (
                        <motion.i key="dot" exit={{ scale: 0 }} />
                      )}
                    </AnimatePresence>
                  </span>
                  <span className="mono">{row.path}</span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}

        <p className="work-hint">This runs on the server. You can leave and open the test again from Test History.</p>
      </div>
    </motion.div>
  );
}

export default WorkingScreen;
