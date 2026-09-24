import { useEffect, useState } from 'react';
import { getTest, captureBaseline, captureCurrent, analyzeTest, listComparisons, getComparison } from '../api.js';
import { capturedPages, formatDate, statusLabel, statusTone } from '../helpers.js';
import BaselineCapture from '../components/BaselineCapture.jsx';
import CurrentCapture from '../components/CurrentCapture.jsx';
import AnalysisPanel from '../components/AnalysisPanel.jsx';
import ComparisonHistory from '../components/ComparisonHistory.jsx';
import ComparisonReport from '../components/ComparisonReport.jsx';

const POLL_INTERVAL_MS = 1500;

// Details of one test: baseline, current capture, analysis, the report, and older comparisons of the same baseline.
function TestDetail({ testId, notice, onBack, onDelete }) {
  const [test, setTest] = useState(null);
  const [progress, setProgress] = useState(null); // live text from the server while capturing
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  // Compare Another URL
  const [anotherMode, setAnotherMode] = useState(false); // showing the form for another deployment
  const [autoAnalyze, setAutoAnalyze] = useState(false); // analyze by itself once the capture is done
  const [comparisons, setComparisons] = useState([]); // older, saved comparisons of this baseline
  const [viewing, setViewing] = useState(null); // an older comparison opened for viewing
  const [viewingId, setViewingId] = useState(null); // id of the older comparison being loaded
  const [historyError, setHistoryError] = useState('');

  // Load the test when this screen opens
  useEffect(() => {
    let ignore = false; // ignore the answer if the user already left this screen
    setLoading(true);
    setError('');

    getTest(testId)
      .then((data) => {
        if (ignore) return;
        setTest(data.test);
        setProgress(data.progress);
      })
      .catch((err) => {
        console.error(err);
        if (!ignore) setError(err.message || 'Unable to load the test.');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [testId]);

  // The list of older comparisons
  function loadComparisons() {
    listComparisons(testId)
      .then((data) => setComparisons(data.comparisons))
      .catch((err) => console.error(err));
  }
  useEffect(loadComparisons, [testId]);

  // While a capture or the analysis is running, ask the server for news every 1.5 seconds
  useEffect(() => {
    if (!['capturing_baseline', 'capturing_current', 'analyzing'].includes(test?.status)) return;

    let ignore = false;
    const timer = setInterval(() => {
      getTest(testId)
        .then((data) => {
          if (ignore) return;
          setTest(data.test);
          setProgress(data.progress);
        })
        .catch((err) => console.error(err)); // try again on the next tick
    }, POLL_INTERVAL_MS);

    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, [test?.status, testId]);

  async function startCapture() {
    setStarting(true);
    setStartError('');
    try {
      await captureBaseline(testId);
      // The server accepted the job. Show the capturing state now, polling takes over from here.
      setTest((current) => ({ ...current, status: 'capturing_baseline', error_message: null }));
      setProgress(null);
    } catch (err) {
      console.error(err);
      setStartError(err.message || 'Unable to start the capture.');
    } finally {
      setStarting(false);
    }
  }

  async function startCurrentCapture(currentUrl) {
    setStarting(true);
    setStartError('');
    try {
      await captureCurrent(testId, currentUrl);
      setTest((current) => ({
        ...current,
        status: 'capturing_current',
        current_url: currentUrl,
        current_pages: null,
        results: null,
        error_message: null,
      }));
      setProgress(null);
      if (anotherMode) setAutoAnalyze(true); // "Capture & Compare": analyze as soon as the capture is done
      setAnotherMode(false);
      loadComparisons(); // the server may have saved the previous report to history
      window.scrollTo({ top: 0 });
    } catch (err) {
      console.error(err);
      setStartError(err.message || 'Unable to start the capture.');
    } finally {
      setStarting(false);
    }
  }

  async function startAnalysis() {
    setStarting(true);
    setStartError('');
    try {
      await analyzeTest(testId);
      setTest((current) => ({ ...current, status: 'analyzing', results: null, error_message: null }));
      setProgress(null);
    } catch (err) {
      console.error(err);
      setStartError(err.message || 'Unable to start the analysis.');
    } finally {
      setStarting(false);
    }
  }

  // After "Capture & Compare", start the analysis when the current capture has finished
  useEffect(() => {
    if (autoAnalyze && test?.status === 'current_captured') {
      setAutoAnalyze(false);
      startAnalysis();
    }
  }, [autoAnalyze, test?.status]);

  async function viewComparison(comparisonId) {
    setViewingId(comparisonId);
    setHistoryError('');
    try {
      const data = await getComparison(comparisonId);
      setViewing(data.comparison);
      window.scrollTo({ top: 0 });
    } catch (err) {
      console.error(err);
      setHistoryError(err.message || 'Unable to open the report.');
    } finally {
      setViewingId(null);
    }
  }

  return (
    <div className="content">
      <button className="link-button back-link" onClick={onBack}>&larr; Back to Test History</button>

      {loading && <p className="muted">Loading test...</p>}
      {error && <p className="banner banner-error" role="alert">{error}</p>}

      {test && (
        <>
          {notice && test.status === 'created' && <p className="banner banner-success">{notice}</p>}

          <div className="detail-header">
            <div>
              <h1 className="test-url">{test.baseline_url}</h1>
              <span className={`badge badge-${statusTone(test.status)}`}>{statusLabel(test.status)}</span>
            </div>
            <button className="btn btn-outline" onClick={() => onDelete(test)}>Delete Test</button>
          </div>

          <dl className="detail-list panel">
            <dt>Test ID</dt>
            <dd className="mono">{test.id}</dd>
            <dt>Baseline URL</dt>
            <dd>{test.baseline_url}</dd>
            <dt>Current URL</dt>
            <dd>{test.current_url || 'Not set yet'}</dd>
            <dt>Status</dt>
            <dd>{statusLabel(test.status)}</dd>
            <dt>Created</dt>
            <dd>{formatDate(test.created_at)}</dd>
          </dl>

          {viewing ? (
            // An older, saved report. Nothing is recomputed.
            <>
              <button className="link-button back-link" onClick={() => setViewing(null)}>&larr; Back to the latest comparison</button>
              <ComparisonReport
                baselineUrl={test.baseline_url}
                currentUrl={viewing.current_url}
                results={viewing.results}
                pdfPath={`/comparisons/${viewing.id}/report.pdf`}
              />
            </>
          ) : (
            <>
              <BaselineCapture
                test={test}
                progress={progress}
                starting={starting}
                startError={startError}
                onCapture={startCapture}
              />

              {/* Only after the baseline exists. The baseline stays visible above while this runs. */}
              {capturedPages(test.baseline_pages).length > 0 && (
                <CurrentCapture
                  key={anotherMode ? 'another' : 'main'}
                  test={test}
                  progress={progress}
                  starting={starting}
                  startError={startError}
                  onCapture={startCurrentCapture}
                  another={anotherMode}
                  onCancel={() => setAnotherMode(false)}
                />
              )}

              {/* Only after both captures exist. Analyze, then the report. Hidden while the form for another URL is open. */}
              {!anotherMode && capturedPages(test.current_pages).length > 0 && (
                <AnalysisPanel
                  test={test}
                  progress={progress}
                  starting={starting}
                  startError={startError}
                  onAnalyze={startAnalysis}
                  onCompareAnother={() => setAnotherMode(true)}
                />
              )}

              {comparisons.length > 0 && (
                <ComparisonHistory
                  baselineUrl={test.baseline_url}
                  comparisons={comparisons}
                  loadingId={viewingId}
                  error={historyError}
                  onView={viewComparison}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default TestDetail;
