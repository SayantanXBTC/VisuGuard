import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check } from 'lucide-react';
import { parseProgress } from '../helpers.js';
import { ProgressBar } from './ui.jsx';

const TITLE = {
  baseline: 'Capturing baseline',
  current: 'Capturing current deployment',
  analysis: 'Comparing pages',
};

const clock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

// A small browser window with a slow scan line: "VisuGuard is looking at the page"
function BrowserScan({ path }) {
  return (
    <div className="scan-window">
      <div className="scan-bar"><i /><i /><i /><span className="mono">{path || '/'}</span></div>
      <div className="scan-page">
        <span className="scan-line scan-line-lg" />
        <span className="scan-line" />
        <span className="scan-line scan-line-sm" />
        <div className="scan-blocks"><span /><span /><span /></div>
        <span className="scan-beam" />
      </div>
    </div>
  );
}

// Baseline -> pixel comparison -> differences, drawn with three small frames and moving lines
function CompareFlow() {
  return (
    <div className="flow-viz">
      {['Baseline', 'Pixel comparison', 'Differences'].map((label, index) => (
        <div className="flow-viz-item" key={label}>
          <div className={`viz-frame viz-frame-${index}`}>
            <span /><span /><span />
            {index === 1 && <i className="viz-scan" />}
            {index === 2 && <><b className="viz-hit viz-hit-a" /><b className="viz-hit viz-hit-b" /></>}
          </div>
          <small>{label}</small>
          {index < 2 && <span className="viz-link" aria-hidden="true" />}
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

  const title = analyzingDifferences ? 'Analyzing differences' : TITLE[kind];
  const value = info?.index && !info.atMost ? (info.index - 1) / info.total : null;

  return (
    <motion.div className="work" role="status" aria-live="polite" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.25 }}>
      <div className="work-visual" aria-hidden="true">
        {kind === 'analysis' ? <CompareFlow /> : <BrowserScan path={path} />}
      </div>

      <div className="work-info">
        <p className="work-title">{title}</p>

        <div className="work-current">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={path || progress || 'starting'}
              className={path ? 'mono' : ''}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.18 }}
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
            {rows.map((row) => (
              <li key={row.path} className={`work-page work-page-${row.state}`}>
                <span className="work-page-mark">{row.state === 'done' ? <Check size={11} strokeWidth={3} aria-hidden="true" /> : <i />}</span>
                <span className="mono">{row.path}</span>
              </li>
            ))}
          </ul>
        )}

        <p className="work-hint">This runs on the server. You can leave and open the test again from Test History.</p>
      </div>
    </motion.div>
  );
}

export default WorkingScreen;
