import { useState } from 'react';
import { Globe, ArrowRight, ShieldCheck, X } from 'lucide-react';
import { createTest } from '../api.js';
import { isValidHttpUrl } from '../helpers.js';
import { Button, Field } from './ui.jsx';

// "Create a visual test": asks for the baseline URL and creates the test record.
function TestForm({ onCreated, onCancel }) {
  const [baselineUrl, setBaselineUrl] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!baselineUrl.trim()) return setError('Enter the URL of your website.');
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
    <form className="create panel liquid-glass-panel" onSubmit={handleSubmit} noValidate>
      <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white/10 text-white flex items-center justify-center border border-white/20">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Create Visual Test</h1>
            <p className="text-xs text-gray-400">Establish an approved visual reference for regression testing</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-8 h-8 rounded-full liquid-glass flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Cancel"
        >
          <X size={16} />
        </button>
      </div>

      <div className="space-y-4">
        <Field
          label="Baseline Website URL"
          icon={Globe}
          type="url"
          value={baselineUrl}
          onChange={(event) => {
            setBaselineUrl(event.target.value);
            if (error) setError('');
          }}
          placeholder="https://your-website.com"
          error={error}
          valid={isValidHttpUrl(baselineUrl)}
          autoFocus
          hint="VisuGuard will capture a full-page screenshot of every page it finds, up to 10."
        />
      </div>

      <div className="button-row pt-5 mt-4 border-t border-white/10 flex items-center justify-end gap-3">
        <Button variant="ghost" onClick={onCancel} disabled={creating}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={creating} icon={ArrowRight}>
          Create Test &amp; Launch
        </Button>
      </div>
    </form>
  );
}

export default TestForm;
