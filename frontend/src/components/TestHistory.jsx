import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import TestCard from './TestCard.jsx';
import { Button, EmptyState, ErrorState, SkeletonRows } from './ui.jsx';

// A list of tests with loading, error and empty states. Used on Dashboard (recent) and Test History (all).
function TestHistory({ tests, loading, error, onRetry, onOpen, onDelete, onNewTest }) {
  if (loading) return <SkeletonRows label="Loading tests" />;

  if (error) return <ErrorState title="Unable to load your tests." text={error} onRetry={onRetry} />;

  if (tests.length === 0) {
    return (
      <EmptyState
        title="No visual tests yet."
        text="Create a test to capture your first baseline."
        action={<Button variant="primary" icon={Plus} onClick={onNewTest}>New Test</Button>}
      />
    );
  }

  return (
    <motion.ul className="test-list" initial="hidden" animate="visible" transition={{ staggerChildren: 0.09, delayChildren: 0.25 }}>
      {tests.map((test) => (
        <TestCard key={test.id} test={test} onOpen={onOpen} onDelete={onDelete} />
      ))}
    </motion.ul>
  );
}

export default TestHistory;
