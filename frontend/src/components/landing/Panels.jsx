import { useState } from 'react';
import { Camera, ScanSearch, FileText, ShieldCheck, Check, Minus } from 'lucide-react';
import { EXAMPLE, formatPercent } from './example.js';

// Every screen of the landing page. The hero is the first one; the navigation links open the others.
// Each one appears in the bottom left, in the same glass and white style as the hero text.
export const PANELS = [
  { id: 'hero', label: 'Home' },
  { id: 'features', label: 'Features' },
  { id: 'how-it-works', label: 'How It Works' },
  { id: 'report', label: 'Diff Report' },
  { id: 'ai', label: 'AI Analysis' },
];

const HEADINGS = {
  hero: {
    badge: 'Visual regression testing',
    title: 'Step Through. Catch Changes Early.',
    text: 'Capture a baseline once. Compare every deployment against it. Resemble.js flags any page over 0.1% different with automated Playwright crawlers.',
  },
  features: {
    badge: 'Features',
    title: 'Catch visual defects before your users do.',
    text: 'Compare a saved baseline with a new version of your site, page by page.',
  },
  'how-it-works': {
    badge: 'How it works',
    title: 'From URL to visual report in three steps.',
    text: 'Playwright takes the screenshots. Resemble.js compares them.',
  },
  report: {
    badge: 'Diff report',
    title: 'Pixel-perfect. Spot every mismatch.',
    text: `A real run on the demo sites: ${EXAMPLE.baseline} against ${EXAMPLE.current}.`,
  },
  ai: {
    badge: 'AI analysis, optional',
    title: 'Findings, not just noisy pixels.',
    text: 'With an API key set, an AI model reads the changed screenshots and describes what changed in plain words.',
  },
};

const FEATURES = [
  { icon: Camera, title: 'Automatic screenshots', text: 'Full-page captures of every page Playwright finds.' },
  { icon: ScanSearch, title: 'Pixel comparison', text: 'Pages over 0.1% different are flagged, with a highlighted diff.' },
  { icon: FileText, title: 'Clear reports', text: 'Page-by-page results online, or as a PDF.' },
  { icon: ShieldCheck, title: 'Your data stays yours', text: 'Sign in with Supabase. Each account sees only its own tests.' },
];

const STEPS = [
  { title: 'Capture the baseline', text: 'Playwright opens your site and takes full-page screenshots of every page it finds.' },
  { title: 'Capture the new version', text: 'After a change, enter the new URL. The same pages are captured again.' },
  { title: 'Compare', text: 'Resemble.js flags pages over 0.1% different. The optional AI step says what changed.' },
];

// Only pages that have real screenshots in /public/landing
const REPORT_PAGES = [
  { file: 'home', path: '/', mismatch: 61.8 },
  { file: 'services', path: '/services', mismatch: 17.38 },
];
const VIEWS = ['diff', 'baseline', 'current', 'split'];

// Fades a block in; `order` staggers the blocks one after another
function Step({ order, className = '', children }) {
  return (
    <div className={`animate-blur-fade-up ${className}`} style={{ animationDelay: `${order * 100}ms` }}>
      {children}
    </div>
  );
}

function ReportCard() {
  const [page, setPage] = useState(REPORT_PAGES[0]);
  const [view, setView] = useState('diff');
  const [split, setSplit] = useState(50);
  const src = (kind) => `/landing/${kind}-${page.file}.jpg`;

  return (
    <div className="liquid-glass rounded-2xl p-3 sm:p-4 grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-center max-w-3xl">
      <div className="relative aspect-video rounded-xl overflow-hidden bg-black/50">
        {view !== 'split' && <img src={src(view)} alt={`${view} of ${page.path}`} className="absolute inset-0 w-full h-full object-contain" />}
        {view === 'split' && (
          <>
            <img src={src('baseline')} alt="Baseline" className="absolute inset-0 w-full h-full object-contain" />
            <img
              src={src('current')}
              alt="Current"
              className="absolute inset-0 w-full h-full object-contain"
              style={{ clipPath: `inset(0 0 0 ${split}%)` }}
            />
            <div className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none" style={{ left: `${split}%` }} />
          </>
        )}
      </div>

      <div className="space-y-3 text-sm">
        <div className="flex flex-wrap gap-1.5">
          {REPORT_PAGES.map((p) => (
            <button
              key={p.file}
              type="button"
              onClick={() => setPage(p)}
              className={`px-3 py-1 rounded-full font-mono text-xs cursor-pointer transition-colors ${
                page.file === p.file ? 'bg-white text-black' : 'bg-white/10 text-gray-200 hover:bg-white/20'
              }`}
            >
              {p.path}
            </button>
          ))}
        </div>
        <p className="text-gray-200">
          <span className="text-2xl font-medium text-white">{formatPercent(page.mismatch)}</span> mismatch
        </p>
        <div className="flex flex-wrap gap-1.5">
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-full text-xs capitalize cursor-pointer transition-colors ${
                view === v ? 'bg-white text-black' : 'bg-white/10 text-gray-200 hover:bg-white/20'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        {view === 'split' && (
          <input
            type="range"
            min="0"
            max="100"
            value={split}
            onChange={(event) => setSplit(Number(event.target.value))}
            aria-label="Move between baseline and current"
            className="w-full accent-white cursor-pointer"
          />
        )}
      </div>
    </div>
  );
}

function Body({ id }) {
  if (id === 'features') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 max-w-5xl">
        {FEATURES.map(({ icon: Icon, title, text }) => (
          <div key={title} className="liquid-glass rounded-2xl p-4 space-y-2">
            <Icon size={20} className="text-white" />
            <h3 className="text-base font-medium text-white">{title}</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (id === 'how-it-works') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-5xl">
        {STEPS.map(({ title, text }, index) => (
          <div key={title} className="liquid-glass rounded-2xl p-4 space-y-2">
            <span className="w-7 h-7 rounded-full bg-white text-black text-xs font-semibold flex items-center justify-center">{index + 1}</span>
            <h3 className="text-base font-medium text-white">{title}</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    );
  }

  if (id === 'report') return <ReportCard />;

  if (id === 'ai') {
    return (
      <ul className="liquid-glass rounded-2xl p-3 sm:p-4 space-y-2 max-w-2xl list-none m-0">
        {EXAMPLE.findings.map((finding) => (
          <li key={finding.text} className="flex items-center gap-3 text-sm text-white">
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                finding.status === 'changed' ? 'bg-amber-400/20 text-amber-300' : 'bg-emerald-400/20 text-emerald-300'
              }`}
            >
              {finding.status === 'changed' ? <Minus size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}
            </span>
            <span className="flex-1">{finding.text}</span>
          </li>
        ))}
      </ul>
    );
  }

  return null;
}

export default function Panel({ id }) {
  const { badge, title, text } = HEADINGS[id];
  const isHero = id === 'hero';

  return (
    <div className="max-w-5xl">
      <Step order={0} className="mb-4 md:mb-6">
        <span className="inline-block text-[10px] tracking-wider uppercase font-semibold px-2.5 py-1 rounded-full bg-white/10 text-gray-200">
          {badge}
        </span>
      </Step>
      <Step order={1} className="mb-3 md:mb-4">
        <h1
          className={`font-normal tracking-[-0.04em] text-white leading-tight ${
            isHero ? 'text-4xl sm:text-5xl md:text-6xl lg:text-7xl max-w-4xl' : 'text-3xl sm:text-4xl lg:text-5xl max-w-3xl'
          }`}
        >
          {title}
        </h1>
      </Step>
      <Step order={2} className={isHero ? '' : 'mb-5 md:mb-6'}>
        <p className="text-base sm:text-lg text-gray-300 max-w-2xl leading-relaxed">{text}</p>
      </Step>
      {!isHero && (
        <Step order={3}>
          <Body id={id} />
        </Step>
      )}
    </div>
  );
}
