import { useEffect, useState } from 'react';
import { getTest, captureBaseline, captureCurrent } from '../api.js';
import { capturedPages, formatDate, statusLabel, statusTone } from '../helpers.js';
import BaselineCapture from '../components/BaselineCapture.jsx';
import CurrentCapture from '../components/CurrentCapture.jsx';

const POLL_INTERVAL_MS = 1500;

// Details of one test, and the capture flow. Later stages add current capture and the report here.
function TestDetail({ testId, notice, onBack, onDelete }) {
  const [test, setTest] = useState(null);
  const [progress, setProgress] = useState(null); // live text from the server while capturing
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

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

  // While a capture is running, ask the server for news every 1.5 seconds
  useEffect(() => {
    if (test?.status !== 'capturing_baseline' && test?.status !== 'capturing_current') return;

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
        error_message: null,
      }));
      setProgress(null);
    } catch (err) {
      console.error(err);
      setStartError(err.message || 'Unable to start the capture.');
    } finally {
      setStarting(false);
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
              test={test}
              progress={progress}
              starting={starting}
              startError={startError}
              onCapture={startCurrentCapture}
            />
          )}
        </>
      )}
    </div>
  );
}

export default TestDetail;
