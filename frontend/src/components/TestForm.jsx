import { useState } from 'react';
import { Globe, ArrowRight, ShieldCheck, Sparkles, X } from 'lucide-react';
import { createTest } from '../api.js';
import { isValidHttpUrl } from '../helpers.js';
import { Button, Field } from './ui.jsx';

const DEMO_URL = 'https://demobaseline.vercel.app';

// "Create a visual test": asks for the baseline URL and creates the test record.
function TestForm({ onCreated, onCancel }) {
  const [baselineUrl, setBaselineUrl] = useState('');
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  function useDemoUrl() {
    setBaselineUrl(DEMO_URL);
    setError('');
  }

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
      <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/15 shadow-[0_8px_20px_-8px_rgba(255,150,110,0.5)]" style={{ background: 'linear-gradient(155deg, rgba(255,196,173,0.28), rgba(230,118,63,0.14))' }}>
            <ShieldCheck size={19} className="text-[#ffc4ad]" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">Create Visual Test</h1>
            <p className="text-xs text-gray-400">Establish an approved visual reference for regression testing</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="w-8 h-8 rounded-full bg-white/[0.06] border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
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

        <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-gray-500">
          <span className="h-px flex-1 bg-white/10" />
          or
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <button
          type="button"
          onClick={useDemoUrl}
          className="w-full flex items-center gap-3 rounded-xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-[#ffc4ad]/40 hover:bg-white/[0.06] cursor-pointer"
        >
          <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,196,173,0.14)' }}>
            <Sparkles size={15} className="text-[#ffc4ad]" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-white">Don't have a site to test?</span>
            <span className="block text-xs text-gray-400 truncate">Try our demo baseline instead</span>
          </span>
        </button>
      </div>

      <div className="button-row pt-5 mt-5 border-t border-white/10 flex items-center justify-end gap-3">
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
