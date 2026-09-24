import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import ScreenshotGrid from './ScreenshotGrid.jsx';
import { capturedPages, failedPages, hostOf } from '../helpers.js';

// Once a test has its report, the capture steps are history. Instead of a checklist, one sentence says what was
// done, with the screenshots of both sides one click away.
function RunSummary({ test }) {
  const [open, setOpen] = useState(null); // 'baseline' | 'current' | null
  const baseline = capturedPages(test.baseline_pages);
  const current = capturedPages(test.current_pages);
  const missing = failedPages(test.current_pages).length;

  const toggle = (side) => setOpen((now) => (now === side ? null : side));
  const shots = open === 'baseline' ? baseline : current;

  return (
    <section className="run">
      <p className="run-line">
        <b>{baseline.length} {baseline.length === 1 ? 'page' : 'pages'}</b> of <span className="mono">{hostOf(test.baseline_url)}</span> were
        saved as the baseline and checked against the same pages on <span className="mono">{hostOf(test.current_url)}</span>
        {missing > 0 ? `, where ${missing} couldn't be reached.` : '.'}
      </p>
      <div className="run-links">
        <button className={open === 'baseline' ? 'run-link run-link-on' : 'run-link'} onClick={() => toggle('baseline')} aria-expanded={open === 'baseline'}>
          Baseline screenshots <em>{baseline.length}</em>
          <ChevronDown size={13} aria-hidden="true" />
        </button>
        <button className={open === 'current' ? 'run-link run-link-on' : 'run-link'} onClick={() => toggle('current')} aria-expanded={open === 'current'}>
          New screenshots <em>{current.length}</em>
          <ChevronDown size={13} aria-hidden="true" />
        </button>
      </div>
      <AnimatePresence initial={false} mode="wait">
        {open && (
          <motion.div
            key={open}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <ScreenshotGrid testId={test.id} pages={shots} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export default RunSummary;
