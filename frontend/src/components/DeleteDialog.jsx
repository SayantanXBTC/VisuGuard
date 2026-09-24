// Confirmation box shown before a test is deleted.
function DeleteDialog({ test, busy, error, onCancel, onConfirm }) {
  return (
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-title">
        <h2 id="delete-title">Delete this test?</h2>
        <p className="muted">This will remove the test and its stored test data.</p>
        <p className="modal-url">{test.baseline_url}</p>

        {error && <p className="banner banner-error" role="alert">{error}</p>}

        <div className="button-row">
          <button className="btn btn-outline" onClick={onCancel} disabled={busy}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            {busy ? 'Deleting test...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteDialog;
