import { useState, useEffect } from 'react';
import { Search, X, Globe, ArrowRight, Play, CheckCircle2 } from 'lucide-react';

export default function SearchModal({ isOpen, onClose, onLaunchTest, onOpenFeature }) {
  const [query, setQuery] = useState('');
  const [baselineUrl, setBaselineUrl] = useState('http://localhost:4100');
  const [currentUrl, setCurrentUrl] = useState('http://localhost:4101');

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md select-none animate-fade-in">
      <div
        className="relative w-full max-w-lg rounded-2xl bg-neutral-950/95 border border-white/10 shadow-2xl overflow-hidden p-6 space-y-6"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(255, 255, 255, 0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <Search className="w-5 h-5 text-gray-300" />
            <h3 className="text-base font-semibold text-white">Visual QA &amp; Feature Search</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full liquid-glass flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Quick URL Test Trigger */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Instant Visual Regression Test</p>
          <div className="space-y-2">
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">Baseline Origin URL</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-xs">
                <Globe size={14} className="text-emerald-400 shrink-0" />
                <input
                  type="text"
                  value={baselineUrl}
                  onChange={(e) => setBaselineUrl(e.target.value)}
                  placeholder="https://production.your-site.com"
                  className="bg-transparent text-white w-full outline-none font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-gray-400 mb-1 block">Comparison / Staging URL</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/50 border border-white/10 text-xs">
                <Globe size={14} className="text-blue-400 shrink-0" />
                <input
                  type="text"
                  value={currentUrl}
                  onChange={(e) => setCurrentUrl(e.target.value)}
                  placeholder="https://staging.your-site.com"
                  className="bg-transparent text-white w-full outline-none font-mono"
                />
              </div>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              if (onOpenFeature) onOpenFeature('report');
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-white text-black font-semibold text-xs flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors cursor-pointer"
          >
            <Play size={14} fill="black" />
            <span>Scan &amp; Generate Diff (Open Demo Report)</span>
          </button>
        </div>

        {/* Feature quick links */}
        <div className="space-y-2 pt-2 border-t border-white/10">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Quick Navigation</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => { onClose(); onOpenFeature('report'); }}
              className="p-2.5 rounded-lg liquid-glass text-left text-gray-300 hover:text-white flex items-center justify-between"
            >
              <span>Interactive Diff</span>
              <ArrowRight size={12} className="text-gray-500" />
            </button>
            <button
              onClick={() => { onClose(); onOpenFeature('ai'); }}
              className="p-2.5 rounded-lg liquid-glass text-left text-gray-300 hover:text-white flex items-center justify-between"
            >
              <span>AI Semantic Analysis</span>
              <ArrowRight size={12} className="text-gray-500" />
            </button>
            <button
              onClick={() => { onClose(); onOpenFeature('how-it-works'); }}
              className="p-2.5 rounded-lg liquid-glass text-left text-gray-300 hover:text-white flex items-center justify-between"
            >
              <span>Crawler Pipeline</span>
              <ArrowRight size={12} className="text-gray-500" />
            </button>
            <button
              onClick={() => { onClose(); onOpenFeature('history'); }}
              className="p-2.5 rounded-lg liquid-glass text-left text-gray-300 hover:text-white flex items-center justify-between"
            >
              <span>Saved Baselines</span>
              <ArrowRight size={12} className="text-gray-500" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
