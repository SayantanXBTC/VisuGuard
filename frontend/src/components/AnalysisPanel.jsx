import { AnimatePresence, motion } from 'framer-motion';
import { RotateCw, ScanSearch } from 'lucide-react';
import WorkingScreen from './WorkingScreen.jsx';
import { Badge, Button, FlowStep } from './ui.jsx';
import { capturedPages } from '../helpers.js';

const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 4 }, transition: { duration: 0.22 } };

// Step 3: the analysis. The button, the live state while it runs, a failure, or the one-line result.
// The report itself is shown below the workflow (TestDetail).
function AnalysisPanel({ test, starting, startError, onAnalyze, running, progress }) {
  const canAnalyze = test.status === 'current_captured';
  const failed = test.status === 'failed' && !running; // this step only exists once the current version was captured
  const completed = test.status === 'completed' && !running;

  const mode = running ? 'running' : completed ? 'done' : failed ? 'failed' : 'idle';
  const baselinePaths = capturedPages(test.baseline_pages).map((page) => page.path);

  return (
    <FlowStep
      state={completed ? 'done' : failed ? 'failed' : 'active'}
      title="Analysis"
      badge={completed && <Badge tone="done">Completed</Badge>}
    >
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'running' && <WorkingScreen key="running" kind="analysis" progress={progress} pages={baselinePaths} />}

        {(mode === 'idle' || mode === 'failed') && (canAnalyze || failed) && (
          <motion.div key="idle" {...fade}>
            {failed && (
              <>
                <p className="step-text step-text-error">Analysis failed.</p>
                <p className="step-text">{test.error_message || 'Something went wrong.'}</p>
              </>
            )}
            {!failed && <p className="step-text">Compare the baseline and current screenshots, page by page. Nothing is captured again.</p>}
            {startError && <p className="banner banner-error" role="alert">{startError}</p>}
            <div className="step-actions">
              <Button variant="primary" icon={failed ? RotateCw : ScanSearch} onClick={onAnalyze} loading={starting}>
                {failed ? 'Try Again' : 'Analyze Changes'}
              </Button>
            </div>
          </motion.div>
        )}

        {mode === 'done' && (
          <motion.p key="done" className="step-summary" {...fade}>
            Comparison complete <span className="step-dim">· {test.pages_changed} of {test.pages_tested} pages changed</span>
          </motion.p>
        )}
      </AnimatePresence>
    </FlowStep>
  );
}

export default AnalysisPanel;
