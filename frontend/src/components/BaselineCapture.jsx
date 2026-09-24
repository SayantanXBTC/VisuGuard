import { useState } from 'react';
import ScreenshotGrid from './ScreenshotGrid.jsx';
import { capturedPages, failedPages } from '../helpers.js';

// The "Baseline Capture" card. What it shows depends on the test status.
function BaselineCapture({ test, progress, starting, startError, onCapture }) {
  const [showPages, setShowPages] = useState(false);

  const captured = capturedPages(test.baseline_pages);
  const failed = failedPages(test.baseline_pages);
  const baselineReady = captured.length > 0; // stays true through the later steps

  return (
    <section className="panel">
      <h2>Baseline</h2>

      {startError && test.status === 'created' && <p className="banner banner-error" role="alert">{startError}</p>}

      {test.status === 'created' && (
        <>
          <p className="muted">No screenshots captured yet.</p>
          <button className="btn btn-primary" onClick={onCapture} disabled={starting}>
            {starting ? 'Starting...' : 'Capture Baseline'}
          </button>
        </>
      )}

      {test.status === 'capturing_baseline' && (
        <>
          <div className="capturing">
            <span className="spinner" aria-hidden="true" />
            <div>
              <h3>Capturing baseline...</h3>
              <p className="muted">Playwright is visiting your website and capturing its pages. Please wait.</p>
              {progress && <p className="progress-text">{progress}</p>}
            </div>
          </div>
          <button className="btn btn-primary" disabled>Capturing...</button>
        </>
      )}

      {test.status === 'failed' && !baselineReady && (
        <>
          <p className="banner banner-error" role="alert">
            <strong>Baseline capture failed.</strong>
            <br />
            {test.error_message || 'Something went wrong.'}
          </p>
          <button className="btn btn-primary" onClick={onCapture} disabled={starting}>
            {starting ? 'Starting...' : 'Try Again'}
          </button>
        </>
      )}

      {baselineReady && (
        <>
          <h3 className="captured-title">Baseline Captured ✓</h3>
          <p>
            {captured.length} {captured.length === 1 ? 'page' : 'pages'} captured
          </p>

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

          <button className="btn btn-primary" onClick={() => setShowPages(!showPages)}>
            {showPages ? 'Hide Baseline' : 'View Baseline'}
          </button>
          {showPages && <ScreenshotGrid testId={test.id} pages={captured} />}
        </>
      )}
    </section>
  );
}

export default BaselineCapture;
