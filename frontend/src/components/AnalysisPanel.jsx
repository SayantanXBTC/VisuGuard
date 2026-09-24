import ComparisonReport from './ComparisonReport.jsx';

// The "Analyze Changes" step. What it shows depends on the test status.
// Only shown after both captures are finished.
function AnalysisPanel({ test, progress, starting, startError, onAnalyze, onCompareAnother }) {
  const canAnalyze = test.status === 'current_captured';
  const analysisFailed = test.status === 'failed'; // this panel only exists once the current version was captured

  return (
    <>
      {(canAnalyze || analysisFailed) && (
        <section className="panel">
          <h2>Analyze Changes</h2>

          {analysisFailed && (
            <p className="banner banner-error" role="alert">
              <strong>Analysis failed.</strong>
              <br />
              {test.error_message || 'Something went wrong.'}
            </p>
          )}
          {startError && <p className="banner banner-error" role="alert">{startError}</p>}

          <p className="muted">
            Compare the baseline screenshots with the current screenshots, page by page. Nothing is captured again.
          </p>
          <button className="btn btn-primary" onClick={onAnalyze} disabled={starting}>
            {starting ? 'Starting...' : analysisFailed ? 'Try Again' : 'Analyze Changes'}
          </button>
        </section>
      )}

      {test.status === 'analyzing' && (
        <section className="panel">
          <div className="capturing">
            <span className="spinner" aria-hidden="true" />
            <div>
              <h3>Analyzing Visual Changes</h3>
              <p className="muted">Comparing your baseline and current screenshots...</p>
              <p className="muted">Generating visual difference images...</p>
              {progress && <p className="progress-text">{progress}</p>}
            </div>
          </div>
        </section>
      )}

      {test.status === 'completed' && (
        <ComparisonReport
          baselineUrl={test.baseline_url}
          currentUrl={test.current_url}
          results={test.results}
          pdfPath={`/tests/${test.id}/report.pdf`}
          onCompareAnother={onCompareAnother}
        />
      )}
    </>
  );
}

export default AnalysisPanel;
