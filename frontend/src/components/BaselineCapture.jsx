import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Camera, RotateCw } from 'lucide-react';
import ScreenshotGrid from './ScreenshotGrid.jsx';
import WorkingScreen from './WorkingScreen.jsx';
import { Badge, Button, FlowStep } from './ui.jsx';
import { capturedPages, failedPages } from '../helpers.js';

const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 4 }, transition: { duration: 0.22 } };

// Step 1 of the workflow: capture the baseline. Idle, running (live state), failed, or done (what was saved).
function BaselineCapture({ test, starting, startError, onCapture, running, progress }) {
  const [showPages, setShowPages] = useState(false);

  const captured = capturedPages(test.baseline_pages);
  const failed = failedPages(test.baseline_pages);
  const baselineReady = captured.length > 0; // stays true through the later steps
  const failedCapture = test.status === 'failed' && !baselineReady;

  const mode = running ? 'running' : baselineReady ? 'done' : failedCapture ? 'failed' : 'idle';
  const state = mode === 'done' ? 'done' : mode === 'failed' ? 'failed' : 'active';

  return (
    <FlowStep state={state} title="Baseline" badge={mode === 'done' && <Badge tone="done">Saved</Badge>}>
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'running' && <WorkingScreen key="running" kind="baseline" progress={progress} />}

        {mode === 'idle' && (
          <motion.div key="idle" {...fade}>
            <p className="step-text">Capture the current website as the approved reference.</p>
            {startError && <p className="banner banner-error" role="alert">{startError}</p>}
            <div className="step-actions">
              <Button variant="primary" icon={Camera} onClick={onCapture} loading={starting}>Capture Baseline</Button>
              <span className="step-note mono">{test.baseline_url}</span>
            </div>
          </motion.div>
        )}

        {mode === 'failed' && (
          <motion.div key="failed" {...fade}>
            <p className="step-text step-text-error">Capture failed.</p>
            <p className="step-text">{test.error_message || 'The page could not be reached.'}</p>
            {startError && <p className="banner banner-error" role="alert">{startError}</p>}
            <div className="step-actions">
              <Button variant="primary" icon={RotateCw} onClick={onCapture} loading={starting}>Try Again</Button>
            </div>
          </motion.div>
        )}

        {mode === 'done' && (
          <motion.div key="done" {...fade}>
            <p className="step-summary">
              Baseline captured <span className="step-dim">· {captured.length} {captured.length === 1 ? 'page' : 'pages'} saved</span>
            </p>
            <p className="step-note">Saved until you delete the test. It is never captured again.</p>

            {failed.length > 0 && (
              <div className="banner banner-warning">
                {failed.length} {failed.length === 1 ? 'page' : 'pages'} could not be captured:
                <ul>
                  {failed.map((page) => (
                    <li key={page.index}>
                      <span className="mono">{page.path}</span>: {page.error}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="step-actions">
              <Button size="sm" onClick={() => setShowPages(!showPages)} aria-expanded={showPages}>
                {showPages ? 'Hide baseline' : 'View baseline'}
              </Button>
            </div>
            {showPages && <ScreenshotGrid testId={test.id} pages={captured} />}
          </motion.div>
        )}
      </AnimatePresence>
    </FlowStep>
  );
}

export default BaselineCapture;
