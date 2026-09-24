import { useState, useEffect } from 'react';
import {
  X,
  Camera,
  ScanSearch,
  FileText,
  ShieldCheck,
  Database,
  Globe,
  FileDown,
  Check,
  Minus,
  GitCommitVertical,
  Sparkles,
  ArrowRight,
  Layers,
  Split,
  Eye,
  History,
  Workflow
} from 'lucide-react';
import { EXAMPLE, formatPercent } from './example.js';

const TABS = [
  { id: 'features', label: 'Features', icon: Layers },
  { id: 'how-it-works', label: 'How It Works', icon: Workflow },
  { id: 'report', label: 'Diff Report', icon: Split },
  { id: 'ai', label: 'AI Analysis', icon: Sparkles },
  { id: 'history', label: 'History', icon: History },
];

const FEATURES_LIST = [
  { icon: Camera, title: 'Automatic screenshots', text: 'Full-page captures of every page Playwright finds automatically.' },
  { icon: ScanSearch, title: 'Pixel-perfect comparison', text: 'Resemble.js flags any page over 0.1% different with highlighted diff maps.' },
  { icon: FileText, title: 'Clear reports', text: 'Page-by-page visual results online, or exported as shareable PDF reports.' },
  { icon: ShieldCheck, title: 'Your data, your control', text: 'Supabase authentication. Only you and your team access your test suites.' },
];

const FACTS = [
  { icon: Database, text: 'Saved baselines per branch & release' },
  { icon: Globe, text: 'Any staging or production URL' },
  { icon: FileDown, text: 'Instant audit-ready PDF exports' },
];

export default function FeatureModal({ isOpen, onClose, initialTab = 'features', onGetStarted, loggedIn, onGoDashboard }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [selectedPage, setSelectedPage] = useState(EXAMPLE.pages[0].path);
  const [viewMode, setViewMode] = useState('diff'); // 'diff' | 'baseline' | 'current' | 'split'
  const [sliderPos, setSliderPos] = useState(50);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentPageData = EXAMPLE.pages.find((p) => p.path === selectedPage) || EXAMPLE.pages[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-fade-in select-none">
      <div
        className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-neutral-950/95 border border-white/10 shadow-2xl overflow-hidden"
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 40px rgba(255, 255, 255, 0.05)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-base sm:text-lg font-semibold text-white tracking-wide flex items-center gap-2">
              <span>VisuGuard</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-gray-300 font-normal">Interactive Showcase</span>
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full liquid-glass flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 sm:gap-2 px-4 sm:px-6 pt-3 border-b border-white/5 overflow-x-auto scrollbar-none bg-black/40">
          {TABS.map(({ id, label, icon: TabIcon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-t-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap border-b-2 ${
                  isActive
                    ? 'border-white text-white bg-white/[0.06]'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-white/[0.02]'
                }`}
              >
                <TabIcon size={15} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 text-gray-300 space-y-6">
          {/* TAB: FEATURES */}
          {activeTab === 'features' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Automated QA Architecture</p>
                <h3 className="text-xl sm:text-2xl font-bold text-white">Full-Stack Visual Regression Testing</h3>
                <p className="text-sm text-gray-400 max-w-xl">
                  Catch every visual defect across your application before it reaches your users. Compare baselines against pull requests with pixel-level precision.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {FEATURES_LIST.map(({ icon: Icon, title, text }) => (
                  <div key={title} className="p-4 rounded-xl liquid-glass border border-white/5 space-y-2 hover:bg-white/[0.03] transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white">
                      <Icon size={20} />
                    </div>
                    <h4 className="text-base font-semibold text-white">{title}</h4>
                    <p className="text-xs sm:text-sm text-gray-400 leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-wrap items-center justify-around gap-4 text-xs sm:text-sm text-gray-300">
                {FACTS.map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2">
                    <Icon size={16} className="text-emerald-400" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: HOW IT WORKS */}
          {activeTab === 'how-it-works' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">3-Step Pipeline</p>
                <h3 className="text-xl sm:text-2xl font-bold text-white">From URL to Comprehensive Visual Report</h3>
                <p className="text-sm text-gray-400">
                  VisuGuard orchestrates headless Playwright crawlers and high-throughput image comparison.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl liquid-glass border border-white/5 space-y-3">
                  <div className="w-7 h-7 rounded-full bg-white text-black font-bold text-xs flex items-center justify-center">1</div>
                  <h4 className="text-base font-semibold text-white">Crawl & Baseline</h4>
                  <p className="text-xs sm:text-sm text-gray-400">
                    Playwright navigates your staging or production origin, following internal links to capture pristine full-page screenshots.
                  </p>
                  <div className="text-[11px] font-mono px-2.5 py-1.5 rounded bg-black/60 text-emerald-400 border border-emerald-500/20">
                    Baseline: localhost:4100
                  </div>
                </div>

                <div className="p-5 rounded-xl liquid-glass border border-white/5 space-y-3">
                  <div className="w-7 h-7 rounded-full bg-white text-black font-bold text-xs flex items-center justify-center">2</div>
                  <h4 className="text-base font-semibold text-white">Deploy & Re-test</h4>
                  <p className="text-xs sm:text-sm text-gray-400">
                    When you deploy a new commit or branch, VisuGuard crawls the updated pages in parallel under matching viewport dimensions.
                  </p>
                  <div className="text-[11px] font-mono px-2.5 py-1.5 rounded bg-black/60 text-blue-400 border border-blue-500/20">
                    Current: localhost:4101
                  </div>
                </div>

                <div className="p-5 rounded-xl liquid-glass border border-white/5 space-y-3">
                  <div className="w-7 h-7 rounded-full bg-white text-black font-bold text-xs flex items-center justify-center">3</div>
                  <h4 className="text-base font-semibold text-white">Diff & Semantic AI</h4>
                  <p className="text-xs sm:text-sm text-gray-400">
                    Resemble.js flags every shifted pixel over 0.1%. The AI engine interprets which elements shifted, changed color, or disappeared.
                  </p>
                  <div className="text-[11px] font-mono px-2.5 py-1.5 rounded bg-black/60 text-amber-400 border border-amber-500/20">
                    Status: 61.80% Mismatch
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB: REPORT SHOWCASE */}
          {activeTab === 'report' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-white/5">
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Live Comparison Inspector</span>
                    <span className="text-xs font-mono font-normal px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {formatPercent(currentPageData.mismatch)} mismatch
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    Baseline: <span className="font-mono text-gray-200">{EXAMPLE.baseline}</span> &rarr; Current: <span className="font-mono text-gray-200">{EXAMPLE.current}</span>
                  </p>
                </div>

                {/* View Mode Switcher */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-black/60 border border-white/10 text-xs">
                  {['diff', 'baseline', 'current', 'split'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-2.5 py-1 rounded capitalize font-medium transition-colors cursor-pointer ${
                        viewMode === mode ? 'bg-white text-black' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Page Selector Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
                {EXAMPLE.pages.map((p) => {
                  const isSel = selectedPage === p.path;
                  return (
                    <button
                      key={p.path}
                      onClick={() => setSelectedPage(p.path)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSel
                          ? 'bg-blue-600 text-white font-semibold shadow-md'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-200'
                      }`}
                    >
                      <span>{p.path}</span>
                      <span className={`text-[10px] px-1 rounded ${p.status === 'changed' ? 'bg-rose-500/30 text-rose-200' : 'bg-emerald-500/30 text-emerald-200'}`}>
                        {p.mismatch !== null ? `${p.mismatch}%` : 'N/A'}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Image Preview Canvas */}
              <div className="relative w-full h-[320px] sm:h-[380px] rounded-xl overflow-hidden bg-neutral-900 border border-white/10 flex items-center justify-center">
                {viewMode === 'diff' && (
                  <img
                    src="/landing/diff-home.jpg"
                    alt="Visual Diff"
                    className="w-full h-full object-contain"
                  />
                )}
                {viewMode === 'baseline' && (
                  <img
                    src="/landing/baseline-home.jpg"
                    alt="Baseline Version"
                    className="w-full h-full object-contain"
                  />
                )}
                {viewMode === 'current' && (
                  <img
                    src="/landing/current-home.jpg"
                    alt="Current Version"
                    className="w-full h-full object-contain"
                  />
                )}
                {viewMode === 'split' && (
                  <div className="relative w-full h-full select-none">
                    <img
                      src="/landing/baseline-home.jpg"
                      alt="Baseline"
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                    <div
                      className="absolute inset-0 overflow-hidden"
                      style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
                    >
                      <img
                        src="/landing/current-home.jpg"
                        alt="Current"
                        className="absolute inset-0 w-full h-full object-contain"
                      />
                    </div>
                    {/* Slider divider line */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_white]"
                      style={{ left: `${sliderPos}%` }}
                    >
                      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white text-black text-[10px] font-bold flex items-center justify-center shadow-lg">
                        &harr;
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {viewMode === 'split' && (
                <div className="flex items-center gap-3 px-2">
                  <span className="text-xs text-gray-400">Baseline (Left)</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={sliderPos}
                    onChange={(e) => setSliderPos(Number(e.target.value))}
                    className="flex-1 accent-white cursor-pointer"
                  />
                  <span className="text-xs text-gray-400">Current (Right)</span>
                </div>
              )}
            </div>
          )}

          {/* TAB: AI ANALYSIS */}
          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={14} /> Semantic Findings Engine
                </p>
                <h3 className="text-xl sm:text-2xl font-bold text-white">Findings, Not Just Noisy Pixels</h3>
                <p className="text-sm text-gray-400">
                  VisuGuard passes captured visual diffs to multimodal vision models to explain layout shifts in plain developer English.
                </p>
              </div>

              <div className="p-4 rounded-xl liquid-glass border border-white/5 space-y-4">
                <div className="flex items-center justify-between text-xs text-gray-400 border-b border-white/5 pb-2">
                  <span className="font-semibold text-white">Page: / (Home page demo)</span>
                  <span>4 Detected Changes</span>
                </div>

                <ul className="space-y-2.5">
                  {EXAMPLE.findings.map((finding) => (
                    <li
                      key={finding.text}
                      className="flex items-start gap-3 p-3 rounded-lg bg-black/40 border border-white/5 text-xs sm:text-sm text-gray-200"
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${finding.status === 'changed' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {finding.status === 'changed' ? <Minus size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
                      </span>
                      <span className="flex-1 font-medium">{finding.text}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-semibold ${finding.status === 'changed' ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                        {finding.status}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="text-[11px] text-gray-400 italic">
                  Note: The optional AI step writes these human-readable findings automatically from screenshots.
                </p>
              </div>
            </div>
          )}

          {/* TAB: HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Audit Trail</p>
                <h3 className="text-xl sm:text-2xl font-bold text-white">One Baseline. Every Deployment.</h3>
                <p className="text-sm text-gray-400">
                  Every test run is stored securely in Supabase with full comparison metrics and exportable artifacts.
                </p>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-xl liquid-glass border border-emerald-500/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <GitCommitVertical size={18} />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">Baseline Reference</h4>
                      <p className="text-xs text-gray-400 font-mono">{EXAMPLE.baseline} &middot; 6 pages crawled &amp; saved</p>
                    </div>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 font-medium">Active Base</span>
                </div>

                {EXAMPLE.history.map((row, idx) => (
                  <div key={idx} className="p-4 rounded-xl liquid-glass border border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                        <GitCommitVertical size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-white">Comparison &middot; <span className="font-mono text-gray-300">{row.url}</span></h4>
                        <p className="text-xs text-gray-400">{row.text}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300">Report</span>
                      <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-300">PDF</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer CTA */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex items-center justify-between">
          <p className="text-xs text-gray-400 hidden sm:block">
            Powered by Playwright, Resemble.js &amp; Supabase.
          </p>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-full text-xs font-medium text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
              Close
            </button>
            {loggedIn ? (
              <button
                onClick={() => { onClose(); onGoDashboard(); }}
                className="px-5 py-2 rounded-full text-xs font-semibold bg-white text-black hover:bg-gray-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Go to Dashboard</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={(e) => { onClose(); onGetStarted(e); }}
                className="px-5 py-2 rounded-full text-xs font-semibold bg-white text-black hover:bg-gray-200 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span>Start Testing Free</span>
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
