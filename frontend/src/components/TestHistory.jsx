import TestCard from './TestCard.jsx';

// A list of tests with loading, error and empty states. Used on Home (recent) and Test History (all).
function TestHistory({ tests, loading, error, onRetry, onOpen, onDelete }) {
  if (loading) return <p className="muted">Loading tests...</p>;

  if (error) {
    return (
      <div>
        <p className="banner banner-error" role="alert">{error}</p>
        <button className="btn btn-outline" onClick={onRetry}>Try again</button>
      </div>
    );
  }

  if (tests.length === 0) {
    return (
      <div className="empty-state empty-state-box">
        <h2>No tests yet.</h2>
        <p>Start your first visual regression test to see your results here.</p>
      </div>
    );
  }

  return (
    <ul className="test-list">
      {tests.map((test) => (
        <TestCard key={test.id} test={test} onOpen={onOpen} onDelete={onDelete} />
      ))}
    </ul>
  );
}

export default TestHistory;
