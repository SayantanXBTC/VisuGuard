import { useState } from 'react';
import ScreenshotGrid from './ScreenshotGrid.jsx';
import { capturedPages, failedPages, pageCountText, isValidHttpUrl } from '../helpers.js';

// "Compare with a new deployment": the current URL form, the capture progress and the current screenshots.
// Only shown after the baseline was captured.
function CurrentCapture({ test, progress, starting, startError, onCapture }) {
  const [currentUrl, setCurrentUrl] = useState(test.current_url || '');
  const [urlError, setUrlError] = useState('');
  const [showPages, setShowPages] = useState(false);

  const pages = test.current_pages || [];
  const captured = capturedPages(pages);
  const failed = failedPages(pages);

  const capturing = test.status === 'capturing_current';
  const canStart = test.status === 'baseline_captured' || test.status === 'failed'; // failed = the last current capture failed
  const finished = captured.length > 0 && !capturing && !canStart;

  function handleSubmit(event) {
    event.preventDefault();
    if (!currentUrl.trim()) return setUrlError('Please enter the current URL.');
    if (!isValidHttpUrl(currentUrl)) return setUrlError('Enter a valid URL that starts with http:// or https://');
    setUrlError('');
    onCapture(currentUrl);
  }

  return (
    <section className="panel">
      <h2>Compare with a new deployment</h2>

      {canStart && (
        <form onSubmit={handleSubmit} noValidate>
          {test.status === 'failed' && (
            <p className="banner banner-error" role="alert">
              <strong>Current capture failed.</strong>
              <br />
              {test.error_message || 'Something went wrong.'}
            </p>
          )}
          {(urlError || startError) && <p className="banner banner-error" role="alert">{urlError || startError}</p>}

          <p className="muted">
            Enter the URL of the newer version of your website. VisuGuard visits the same pages it captured in the
            baseline, on this URL, so the two versions can be compared.
          </p>
          <label className="field">
            Current URL
            <input
              type="url"
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              placeholder="https://staging.example.com"
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={starting}>
            {starting ? 'Starting...' : test.status === 'failed' ? 'Try Again' : 'Capture Current'}
          </button>
        </form>
      )}

      {capturing && (
        <>
          <div className="capturing">
            <span className="spinner" aria-hidden="true" />
            <div>
              <h3>Capturing current deployment...</h3>
              <p className="muted">Playwright is visiting the baseline's pages on {test.current_url}.</p>
              {progress && <p className="progress-text">{progress}</p>}
            </div>
          </div>
          <button className="btn btn-primary" disabled>Capturing...</button>
        </>
      )}

      {finished && (
        <>
          <h3 className="captured-title">Current Deployment Captured ✓</h3>
          <p>
            {captured.length} {captured.length === 1 ? 'page' : 'pages'} captured from{' '}
            <strong>{test.current_url}</strong>
          </p>
          <p className="muted">
            Baseline: {pageCountText(test.baseline_pages)} &middot; Current: {pageCountText(pages)}
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
            {showPages ? 'Hide Current Pages' : 'View Current Pages'}
          </button>
          {showPages && <ScreenshotGrid testId={test.id} pages={captured} />}
        </>
      )}
    </section>
  );
}

export default CurrentCapture;
