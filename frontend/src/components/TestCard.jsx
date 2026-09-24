import { motion } from 'framer-motion';
import { ArrowRight, Trash2 } from 'lucide-react';
import { formatDay, hostOf, isRunning, statusTone, testAction } from '../helpers.js';
import { StatusBadge } from './ui.jsx';

// One test in the list: the address, its status, and one quiet line of facts. The whole row opens the test;
// the small trash button deletes it. Only saved facts are shown.
function TestCard({ test, onOpen, onDelete }) {
  const running = isRunning(test.status);
  const pages = test.baseline_page_count;

  return (
    <motion.li
      className={`test-card tone-${statusTone(test.status)}`}
      variants={{
        hidden: { opacity: 0, y: 16, filter: 'blur(8px)' },
        visible: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.6, ease: 'easeOut' } },
      }}
    >
      <button className="test-card-main" onClick={() => onOpen(test)} title={`Test ${test.id}`}>
        <span className="test-dot" aria-hidden="true" />

        <span className="test-card-body">
          <span className="test-card-top">
            <span className="test-url">{test.baseline_url}</span>
            <StatusBadge status={test.status} />
          </span>

          <span className="test-line">
            {pages > 0 && <span>{pages} {pages === 1 ? 'page' : 'pages'}</span>}
            {test.pages_tested !== null && (
              <span className={test.pages_changed > 0 ? 'test-changed' : ''}>
                {test.pages_changed > 0 ? `${test.pages_changed} of ${test.pages_tested} changed` : 'No changes'}
              </span>
            )}
            {test.current_url && <span>vs {hostOf(test.current_url)}</span>}
            <span>{formatDay(test.created_at)}</span>
          </span>
        </span>

        <span className="test-open">
          {testAction(test)} <ArrowRight size={15} aria-hidden="true" />
        </span>
      </button>

      <button
        className="icon-button"
        onClick={() => onDelete(test)}
        disabled={running}
        title={running ? 'Wait for the running job to finish' : 'Delete test'}
        aria-label={`Delete ${test.baseline_url}`}
      >
        <Trash2 size={15} aria-hidden="true" />
      </button>
    </motion.li>
  );
}

export default TestCard;
