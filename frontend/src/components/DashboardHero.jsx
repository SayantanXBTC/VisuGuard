import { useEffect } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import { ChevronLeft, ChevronRight, FileText, Image, LayoutGrid, Sparkles } from 'lucide-react';

// The dashboard's hero: a browser window with two made-up versions of a website, built in HTML so every
// part can move. The compare slider sweeps across on its own, turning the baseline into the new deployment
// and back, while a halo circles the window and amber boxes light up on everything that changed.

const TILES = [
  { icon: Image, className: 'dash-tile-a', delay: 0 },
  { icon: LayoutGrid, className: 'dash-tile-b', delay: 0.8 },
  { icon: FileText, className: 'dash-tile-c', delay: 0.4 },
  { icon: Sparkles, className: 'dash-tile-d', delay: 1.2 },
];

const MAX_MISMATCH = 23.4; // what the counter reaches when the slider has revealed the whole new version

function Bars({ widths }) {
  return widths.map((width, n) => <i key={n} className="ms-bar" style={{ width }} />);
}

// Version A: the approved baseline. Cool slate and indigo.
function BaselineSite() {
  return (
    <div className="ms-site ms-a">
      <div className="ms-nav">
        <span className="ms-logo"><b />Lumen</span>
        <span className="ms-links"><em>Product</em><em>Docs</em><em>Blog</em></span>
        <span className="ms-nav-btn">Sign in</span>
      </div>
      <div className="ms-hero">
        <div className="ms-copy">
          <h4>Ship with confidence</h4>
          <Bars widths={['92%', '74%']} />
          <span className="ms-btn">Get started</span>
        </div>
        <div className="ms-card">
          <span className="ms-chart"><i style={{ height: '40%' }} /><i style={{ height: '65%' }} /><i style={{ height: '50%' }} /><i style={{ height: '80%' }} /></span>
        </div>
      </div>
      <div className="ms-features">
        {[0, 1, 2].map((n) => <div key={n} className="ms-feature"><b /><Bars widths={['80%', '55%']} /></div>)}
      </div>
    </div>
  );
}

// Version B: the new deployment. Warm colours, new copy, a moved button, a new link, one card gone.
function ChangedSite() {
  return (
    <div className="ms-site ms-b">
      <div className="ms-nav">
        <span className="ms-logo"><b />Lumen</span>
        <span className="ms-links"><em>Product</em><em>Docs</em><em className="ms-new">Pricing</em></span>
        <span className="ms-nav-btn">Try free</span>
      </div>
      <div className="ms-hero">
        <div className="ms-copy">
          <h4>Ship faster, safer</h4>
          <Bars widths={['92%', '60%']} />
          <span className="ms-btn">Start free trial</span>
        </div>
        <div className="ms-card">
          <span className="ms-chart"><i style={{ height: '70%' }} /><i style={{ height: '35%' }} /><i style={{ height: '85%' }} /><i style={{ height: '55%' }} /></span>
        </div>
      </div>
      <div className="ms-features">
        {[0, 1].map((n) => <div key={n} className="ms-feature"><b /><Bars widths={['80%', '55%']} /></div>)}
      </div>

      {/* What the pixel diff would flag, revealed together with this version */}
      <span className="ms-diff" style={{ left: '52%', top: '4%', width: '30%', height: '11%' }} />
      <span className="ms-diff" style={{ left: '5%', top: '23%', width: '46%', height: '13%' }} />
      <span className="ms-diff" style={{ left: '4%', top: '45%', width: '28%', height: '12%' }} />
      <span className="ms-diff" style={{ left: '58%', top: '23%', width: '38%', height: '42%' }} />
      <span className="ms-diff ms-diff-missing" style={{ left: '68%', top: '69%', width: '28%', height: '22%' }} />
    </div>
  );
}

function DashboardHero() {
  const reduceMotion = useReducedMotion();
  const split = useMotionValue(reduceMotion ? 55 : 12); // percent from the left where the slider sits
  const clip = useTransform(split, (value) => `inset(0 ${100 - value}% 0 0)`);
  const left = useTransform(split, (value) => `${value}%`);
  const mismatch = useTransform(split, (value) => `${((Math.max(0, value - 10) / 80) * MAX_MISMATCH).toFixed(1)}%`);
  const status = useTransform(split, (value) => (value < 28 ? 'Baseline' : value < 72 ? 'Comparing…' : '5 changes found'));

  useEffect(() => {
    if (reduceMotion) return undefined;
    const controls = animate(split, [12, 90, 90, 12, 12], {
      duration: 8,
      times: [0, 0.42, 0.55, 0.92, 1], // sweep across, hold on the changes, sweep back, rest
      ease: 'easeInOut',
      repeat: Infinity,
    });
    return () => controls.stop();
  }, [reduceMotion, split]);

  return (
    <div className="dash-hero-art" aria-hidden="true">
      <svg className="dash-hero-lines" viewBox="0 0 520 300" preserveAspectRatio="none">
        <defs>
          <linearGradient id="dash-line" x1="0" x2="1">
            <stop offset="0" stopColor="#ff9d6e" stopOpacity="0" />
            <stop offset="0.5" stopColor="#ff9d6e" stopOpacity="0.85" />
            <stop offset="1" stopColor="#ff9d6e" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path className="dash-line dash-line-1" d="M0 210 C 120 140, 220 250, 330 150 S 480 60, 520 90" />
        <path className="dash-line dash-line-2" d="M0 90 C 90 150, 200 40, 300 120 S 460 250, 520 200" />
        <path className="dash-line dash-line-3" d="M20 260 C 160 220, 260 280, 380 230 S 500 180, 520 170" />
      </svg>

      <span className="dash-aura" />

      {TILES.map(({ icon: Icon, className, delay }) => (
        <motion.span
          key={className}
          className={`dash-tile ${className}`}
          animate={reduceMotion ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 4.2, delay, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Icon size={17} />
        </motion.span>
      ))}

      <div className="dash-halo">
        <span className="dash-halo-spin" />
        <div className="dash-window">
          <div className="dash-window-bar">
            <i /><i /><i />
            <span className="dash-window-url">lumen.app</span>
            <motion.span className="dash-mismatch">{mismatch}</motion.span>
          </div>
          <div className="dash-window-body">
            <BaselineSite />
            <motion.div className="ms-layer" style={{ clipPath: clip }}>
              <ChangedSite />
            </motion.div>
            <motion.span className="dash-glow" style={{ width: left }} />
            <span className="dash-label dash-label-left">New</span>
            <span className="dash-label dash-label-right">Baseline</span>
            <motion.div className="dash-slider" style={{ left }}>
              <span className="dash-slider-line" />
              <span className="dash-slider-handle">
                <ChevronLeft size={13} strokeWidth={2.6} />
                <ChevronRight size={13} strokeWidth={2.6} />
              </span>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.span className="dash-status">{status}</motion.span>
    </div>
  );
}

export default DashboardHero;
