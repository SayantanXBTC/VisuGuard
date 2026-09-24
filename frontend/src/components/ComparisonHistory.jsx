import { formatDate } from '../helpers.js';

// Older comparisons of the same baseline. Each one is a saved report: opening it recomputes nothing.
function ComparisonHistory({ baselineUrl, comparisons, loadingId, error, onView }) {
  return (
    <section className="panel">
      <h2>Comparison History</h2>
      <p className="muted">
        Baseline: <strong>{baselineUrl}</strong>. Every comparison uses this same baseline. The comparison above is
        the latest.
      </p>
      {error && <p className="banner banner-error" role="alert">{error}</p>}

      <ol className="history-list">
        {comparisons.map((comparison) => (
          <li key={comparison.id}>
            <div>
              <strong className="test-url">{comparison.current_url}</strong>
              <span className="muted">
                {comparison.pages_changed} changed / {comparison.pages_tested} pages &middot; {formatDate(comparison.analyzed_at)}
              </span>
            </div>
            <button className="btn btn-outline btn-small" onClick={() => onView(comparison.id)} disabled={loadingId !== null}>
              {loadingId === comparison.id ? 'Loading...' : 'View Report'}
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default ComparisonHistory;
