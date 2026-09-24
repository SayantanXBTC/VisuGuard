import { formatDate, shortId, statusLabel, statusTone } from '../helpers.js';

// One row in the test list. Click the row to open the test.
function TestCard({ test, onOpen, onDelete }) {
  return (
    <li className="test-card">
      <button className="test-card-main" onClick={() => onOpen(test)}>
        <span className="test-url">{test.baseline_url}</span>
        <span className="test-meta">
          <span className={`badge badge-${statusTone(test.status)}`}>{statusLabel(test.status)}</span>
          <span>Created {formatDate(test.created_at)}</span>
          {test.pages_tested !== null && <span>{test.pages_changed} of {test.pages_tested} pages changed</span>}
          <span>ID {shortId(test.id)}</span>
        </span>
        {test.current_url && <span className="test-meta">Current: {test.current_url}</span>}
      </button>
      <button className="btn btn-outline btn-small" onClick={() => onDelete(test)}>Delete</button>
    </li>
  );
}

export default TestCard;
