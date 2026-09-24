import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Globe, RotateCw, Sparkles } from 'lucide-react';
import ScreenshotGrid from './ScreenshotGrid.jsx';
import WorkingScreen from './WorkingScreen.jsx';
import { Badge, Button, Field, FlowStep } from './ui.jsx';
import { capturedPages, failedPages, pageCountText, isValidHttpUrl } from '../helpers.js';

const fade = { initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 4 }, transition: { duration: 0.22 } };
const DEMO_URL = 'https://demochanged.vercel.app';

// Step 2: the new deployment. "Capture & Compare" captures it, analyzes it and opens the report, in one go.
// another: "Compare Another URL": the same form for a further deployment. The baseline is only shown, never asked for.
function CurrentCapture({ test, starting, startError, onCapture, another = false, onCancel, running, progress }) {
  const [currentUrl, setCurrentUrl] = useState(another ? '' : test.current_url || '');
  const [urlError, setUrlError] = useState('');
  const [showPages, setShowPages] = useState(false);
  const isDemoBaseline = test.baseline_url?.includes('demobaseline.vercel.app');

  function useDemoUrl() {
    setCurrentUrl(DEMO_URL);
    setUrlError('');
  }

  const pages = test.current_pages || [];
  const captured = capturedPages(pages);
  const failed = failedPages(pages);
  const baselinePaths = capturedPages(test.baseline_pages).map((page) => page.path);

  // failed with no current screenshots = the last current capture failed. (failed WITH them = the analysis failed.)
  const canStart = another || test.status === 'baseline_captured' || (test.status === 'failed' && captured.length === 0);
  const finished = captured.length > 0 && !canStart && !running;
  const retry = test.status === 'failed' && !another;

  const mode = running ? 'running' : canStart ? 'form' : 'done';
  const state = finished ? 'done' : retry && !running ? 'failed' : 'active';

  function handleSubmit(event) {
    event.preventDefault();
    if (!currentUrl.trim()) return setUrlError('Enter the URL of the new deployment.');
    if (!isValidHttpUrl(currentUrl)) return setUrlError('Enter a valid URL that starts with http:// or https://');
    setUrlError('');
    onCapture(currentUrl);
  }

  return (
    <FlowStep
      state={state}
      title={another ? 'Compare another deployment' : 'Current deployment'}
      badge={finished && <Badge tone="done">Captured</Badge>}
    >
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'running' && <WorkingScreen key="running" kind="current" progress={progress} pages={baselinePaths} />}

        {mode === 'form' && (
          <motion.form key="form" onSubmit={handleSubmit} noValidate {...fade}>
            {retry && (
              <>
                <p className="step-text step-text-error">Capture failed.</p>
                <p className="step-text">{test.error_message || 'The page could not be reached.'}</p>
              </>
            )}
            {!retry && (
              <p className="step-text">
                {another
                  ? 'The baseline stays as it is. Enter another deployment to compare against it. The previous report is kept in the comparison history.'
                  : `Ready for a new deployment? The same ${pageCountText(test.baseline_pages)} saved from ${test.baseline_url} are captured on the new URL. Your baseline is not modified.`}
              </p>
            )}
            {startError && <p className="banner banner-error" role="alert">{startError}</p>}

            <Field
              label="Current URL"
              icon={Globe}
              type="url"
              value={currentUrl}
              onChange={(event) => {
                setCurrentUrl(event.target.value);
                if (urlError) setUrlError('');
              }}
              placeholder="https://staging.example.com"
              error={urlError}
              valid={isValidHttpUrl(currentUrl)}
            />

            {isDemoBaseline && !currentUrl && (
              <button type="button" className="demo-fill-hint" onClick={useDemoUrl}>
                <Sparkles size={13} aria-hidden="true" />
                Use the matching demo deployment ({DEMO_URL.replace('https://', '')})
              </button>
            )}

            <div className="step-actions">
              <Button type="submit" variant="primary" icon={retry ? RotateCw : undefined} loading={starting}>
                {retry ? 'Try Again' : <>Capture &amp; Compare <ArrowRight size={15} aria-hidden="true" /></>}
              </Button>
              {another && <Button variant="ghost" onClick={onCancel} disabled={starting}>Cancel</Button>}
              <span className="step-chain" aria-label="Capture, then analyze, then report">Capture <i /> Analyze <i /> Report</span>
            </div>
          </motion.form>
        )}

        {mode === 'done' && (
          <motion.div key="done" {...fade}>
            <p className="step-summary">
              Deployment captured <span className="step-dim">· {captured.length} {captured.length === 1 ? 'page' : 'pages'} from <span className="mono">{test.current_url}</span></span>
            </p>
            <p className="step-note">Baseline: {pageCountText(test.baseline_pages)} · Current: {pageCountText(pages)}</p>

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
                {showPages ? 'Hide current pages' : 'View current pages'}
              </Button>
            </div>
            {showPages && <ScreenshotGrid testId={test.id} pages={captured} />}
          </motion.div>
        )}
      </AnimatePresence>
    </FlowStep>
  );
}

export default CurrentCapture;
