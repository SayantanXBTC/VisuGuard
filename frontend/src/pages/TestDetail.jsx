import { useEffect, useState } from 'react';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { getTest, captureBaseline, captureCurrent, analyzeTest, retryAi, listComparisons, getComparison } from '../api.js';
import { capturedPages, formatDate, isRunning } from '../helpers.js';
import BaselineCapture from '../components/BaselineCapture.jsx';
import CurrentCapture from '../components/CurrentCapture.jsx';
import AnalysisPanel from '../components/AnalysisPanel.jsx';
import ComparisonHistory from '../components/ComparisonHistory.jsx';
import ComparisonReport from '../components/ComparisonReport.jsx';
import Stepper from '../components/Stepper.jsx';
import { Button, ErrorState, SkeletonRows, StatusBadge } from '../components/ui.jsx';

const POLL_INTERVAL_MS = 1500;

// Details of one test: baseline, current capture, analysis, the report, and older comparisons of the same baseline.
function TestDetail({ testId, notice, onBack, onDelete }) {
  const [test, setTest] = useState(null);
  const [progress, setProgress] = useState(null); // live text from the server while capturing
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');
  const [connectionLost, setConnectionLost] = useState(false); // polling keeps failing
  const [reloadKey, setReloadKey] = useState(0); // bumped by "Retry" after a failed load

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
  }, [testId, reloadKey]);

  // The list of older comparisons
  function loadComparisons() {
    listComparisons(testId)
      .then((data) => setComparisons(data.comparisons))
      .catch((err) => console.error(err));
  }
  useEffect(loadComparisons, [testId]);

  // While a capture or the analysis is running, ask the server for news every 1.5 seconds
  useEffect(() => {
    if (!isRunning(test?.status)) return;

    let ignore = false;
    let failures = 0;
    const timer = setInterval(() => {
      getTest(testId)
        .then((data) => {
          if (ignore) return;
          failures = 0;
          setConnectionLost(false);
          setTest(data.test);
          setProgress(data.progress);
        })
        .catch((err) => {
          console.error(err); // try again on the next tick
          if (ignore) return;
          if (err.message === 'Test not found.') {
            // deleted elsewhere (another tab): nothing left to poll
            setError('This test no longer exists.');
            setTest(null);
          } else if (++failures >= 3) {
            setConnectionLost(true); // the job may still be running on the server
          }
        });
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
      setAutoAnalyze(true); // "Capture & Compare": analyze as soon as the capture is done
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

  // Ask the AI again for the changed pages that have no AI analysis. Throws if the server refuses.
  async function retryAiAnalysis() {
    const data = await retryAi(testId);
    setTest((current) => ({ ...current, results: data.results }));
  }

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

  // What is running right now, if anything. After "Capture & Compare" the analysis starts by itself, so the
  // short moment between the two is shown as the analysis too (no flash of the Analyze button).
  const workKind =
    test?.status === 'capturing_baseline' ? 'baseline'
    : test?.status === 'capturing_current' ? 'current'
    : test?.status === 'analyzing' || (autoAnalyze && test?.status === 'current_captured') ? 'analysis'
    : null;
  const baselineReady = capturedPages(test?.baseline_pages).length > 0;
  const currentReady = capturedPages(test?.current_pages).length > 0;

  const analysisVisible = !anotherMode && (currentReady || workKind === 'analysis');
  const showReport = test?.status === 'completed' && !workKind && !anotherMode && !viewing;

  return (
    <div className="detail">
      <button className="back-link" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" /> Test History</button>

      {loading && !test && <SkeletonRows count={2} label="Loading test" />}
      {error && (
        <ErrorState
          title="Unable to load this test."
          text={error}
          onRetry={error === 'This test no longer exists.' ? onBack : () => setReloadKey((value) => value + 1)}
          retryLabel={error === 'This test no longer exists.' ? 'Back to tests' : 'Retry'}
        />
      )}

      {test && (
        <>
          {notice && test.status === 'created' && <p className="banner banner-success">{notice}</p>}

          <header className="detail-head">
            <div className="detail-title">
              <h1 className="detail-url">{test.baseline_url}</h1>
              <div className="detail-meta">
                <StatusBadge status={test.status} />
                <span>Created {formatDate(test.created_at)}</span>
                {test.current_url && <span>Current: <span className="mono">{test.current_url}</span></span>}
              </div>
            </div>
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              onClick={() => onDelete(test)}
              disabled={isRunning(test.status)}
              title={isRunning(test.status) ? 'Wait for the running job to finish' : undefined}
            >
              Delete
            </Button>
          </header>

          {connectionLost && isRunning(test.status) && (
            <p className="banner banner-warning" role="alert">
              Lost contact with the server. The job may still be running. Trying again...
            </p>
          )}

          <Stepper test={test} />

          {viewing ? (
            // An older, saved report. Nothing is recomputed.
            <>
              <button className="back-link" onClick={() => setViewing(null)}><ArrowLeft size={15} aria-hidden="true" /> Latest comparison</button>
              <ComparisonReport
                baselineUrl={test.baseline_url}
                currentUrl={viewing.current_url}
                results={viewing.results}
                pdfPath={`/comparisons/${viewing.id}/report.pdf`}
              />
            </>
          ) : (
            <>
              {/* One connected workflow: baseline, then the current deployment, then the analysis */}
              <div className={showReport ? 'flow flow-compact' : 'flow'}>
                <BaselineCapture
                  test={test}
                  starting={starting}
                  startError={startError}
                  onCapture={startCapture}
                  running={workKind === 'baseline'}
                  progress={progress}
                />

                {baselineReady && (
                  <CurrentCapture
                    key={anotherMode ? 'another' : 'main'}
                    test={test}
                    starting={starting}
                    startError={startError}
                    onCapture={startCurrentCapture}
                    another={anotherMode}
                    onCancel={() => setAnotherMode(false)}
                    running={workKind === 'current'}
                    progress={progress}
                  />
                )}

                {analysisVisible && (
                  <AnalysisPanel
                    test={test}
                    starting={starting}
                    startError={startError}
                    onAnalyze={startAnalysis}
                    running={workKind === 'analysis'}
                    progress={progress}
                  />
                )}
              </div>

              {showReport && (
                <ComparisonReport
                  baselineUrl={test.baseline_url}
                  currentUrl={test.current_url}
                  results={test.results}
                  pdfPath={`/tests/${test.id}/report.pdf`}
                  onCompareAnother={() => { setAnotherMode(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  onRetryAi={retryAiAnalysis}
                />
              )}

              {comparisons.length > 0 && !anotherMode && !workKind && (
                <ComparisonHistory
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
