import { useState } from 'react';
import { createTest } from '../api.js';
import { isValidHttpUrl } from '../helpers.js';

// "New Visual Regression Test": asks for the baseline URL and creates the test record.
function TestForm({ onCreated, onCancel }) {
  const [baselineUrl, setBaselineUrl] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!baselineUrl.trim()) return setError('Please enter a baseline URL.');
    if (!isValidHttpUrl(baselineUrl)) {
      return setError('Enter a valid URL that starts with http:// or https://');
    }

    setCreating(true);
    setError('');
    try {
      const data = await createTest(baselineUrl);
      onCreated(data.test);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to create the test.');
      setCreating(false);
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit} noValidate>
      <h1>New Visual Regression Test</h1>

      {error && <p className="banner banner-error" role="alert">{error}</p>}

      <label className="field">
        Baseline URL
        <input
          type="url"
          value={baselineUrl}
          onChange={(e) => setBaselineUrl(e.target.value)}
          placeholder="https://example.com"
          autoFocus
        />
      </label>
      <p className="muted">
        The baseline is the approved version of your website that future deployments will be compared against.
      </p>

      <div className="button-row">
        <button type="submit" className="btn btn-primary" disabled={creating}>
          {creating ? 'Creating test...' : 'Create Baseline'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel} disabled={creating}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export default TestForm;
