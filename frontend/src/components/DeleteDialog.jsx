import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from './ui.jsx';

// Confirmation box shown before a test is deleted. Escape or a click outside cancels.
function DeleteDialog({ test, busy, error, onCancel, onConfirm }) {
  useEffect(() => {
    const cancelOnEscape = (event) => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', cancelOnEscape);
    return () => window.removeEventListener('keydown', cancelOnEscape);
  }, [busy, onCancel]);

  return (
    <motion.div className="modal-backdrop" onClick={() => !busy && onCancel()} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}>
      <motion.div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        onClick={(event) => event.stopPropagation()}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2 }}
      >
        <h2 id="delete-title">Delete this test?</h2>
        <p>This removes its captures, reports and comparison history.</p>
        <p className="modal-url mono">{test.baseline_url}</p>

        {error && <p className="banner banner-error" role="alert">{error}</p>}

        <div className="button-row button-row-end">
          <Button variant="ghost" onClick={onCancel} disabled={busy} autoFocus>Cancel</Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>Delete Test</Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default DeleteDialog;
