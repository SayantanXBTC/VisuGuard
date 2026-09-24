import { useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Check, Minus } from 'lucide-react';
import { EXAMPLE, formatPercent } from './example.js';
import { Reveal, stagger, item } from './Reveal.jsx';
import { useMediaQuery } from './scroll.js';

const STAGES = ['Baseline', 'Current', 'Diff', 'Findings', 'Summary'];
// Where in the scroll (0 to 1) each stage starts
const STARTS = [0, 0.14, 0.42, 0.6, 0.86];
const HOME = EXAMPLE.pages[0];

const Heading = () => (
  <div className="lp-head">
    <p className="lp-eyebrow">Example report</p>
    <h2 className="lp-title">See exactly what changed.</h2>
    <p className="lp-sub">The same page before and after, from a real run on the demo sites.</p>
  </div>
);

function FindingRow({ finding }) {
  return (
    <>
      <span className={`ls-mark ls-mark-${finding.status}`}>{finding.status === 'changed' ? <Minus size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />}</span>
      <span className="ls-find-text">{finding.text}</span>
    </>
  );
}

// One finding that appears at its own point of the scroll
function PinnedFinding({ finding, progress, index }) {
  const start = 0.6 + index * 0.06;
  const opacity = useTransform(progress, [start, start + 0.06], [0, 1]);
  const y = useTransform(progress, [start, start + 0.06], [12, 0]);
  return (
    <motion.li style={{ opacity, y }}>
      <FindingRow finding={finding} />
    </motion.li>
  );
}

// Desktop: the report stays in place while the section scrolls, and builds up in five stages.
// The section is a fixed number of screens long (see .ls-track in landing.css), so the page scrolls on normally afterwards.
function Pinned() {
  const trackRef = useRef(null);
  const { scrollYProgress: p } = useScroll({ target: trackRef, offset: ['start 60px', 'end end'] });
  const [stage, setStage] = useState(0);
  useMotionValueEvent(p, 'change', (value) => {
    let next = 0;
    STARTS.forEach((start, index) => {
      if (value >= start) next = index;
    });
    setStage((current) => (current === next ? current : next));
  });

  const wipe = useTransform(p, [0.14, 0.38], ['inset(0 100% 0 0)', 'inset(0 0% 0 0)']);
  const currentOpacity = useTransform(p, [0.12, 0.16], [0, 1]);
  const diffOpacity = useTransform(p, [0.42, 0.56], [0, 1]);
  const railOpacity = useTransform(p, [0.58, 0.64], [0, 1]);
  const skelOpacity = useTransform(p, [0.5, 0.64], [1, 0]);
  const summaryOpacity = useTransform(p, [0.86, 0.94], [0, 1]);
  const summaryLift = useTransform(p, [0.86, 0.94], [14, 0]);
  const number = useTransform(p, [0.86, 0.95], [0, HOME.mismatch]);
  const numberText = useTransform(number, (value) => `${value.toFixed(2)}%`);
  const barScale = useTransform(p, [0.86, 0.95], [0, HOME.mismatch / 100]);
  const progressLine = useTransform(p, [0, 1], [0, 1]);

  const layer = stage >= 2 ? 'Diff' : stage >= 1 ? 'Current' : 'Baseline';

  return (
    <div className="ls-track" ref={trackRef} data-anchor>
      <div className="ls-sticky">
        <div className="lp-container ls-grid">
          <div className="ls-text">
            <Heading />
            <ol className="ls-stages" aria-label="Stages of the example">
              <span className="ls-stage-line" aria-hidden="true"><motion.span style={{ scaleY: progressLine }} /></span>
              {STAGES.map((label, index) => (
                <li key={label} className={index < stage ? 'is-done' : index === stage ? 'is-active' : ''}>
                  <span className="ls-dot" aria-hidden="true" />
                  {label}
                </li>
              ))}
            </ol>
          </div>

          <div className="ls-window">
            <header className="ls-bar">
              <span className="ls-urls">{EXAMPLE.baseline} <i aria-hidden="true">&rarr;</i> {EXAMPLE.current}</span>
              <span className="ls-layer">{layer}</span>
            </header>
            <div className="ls-body">
              <div className="ls-view">
                <img className="ls-layer-img" src="/landing/baseline-home.jpg" alt="Baseline screenshot of the demo site home page" draggable="false" />
                <motion.img className="ls-layer-img" style={{ clipPath: wipe, opacity: currentOpacity }} src="/landing/current-home.jpg" alt="Current screenshot" draggable="false" />
                <motion.img className="ls-layer-img" style={{ opacity: diffOpacity }} src="/landing/diff-home.jpg" alt="Diff: changes tinted red and boxed" draggable="false" />
              </div>

              <aside className="ls-rail">
                <motion.div className="ls-skel" style={{ opacity: skelOpacity }} aria-hidden="true">
                  <div><i /><i /><i /><i /><i /><i /><i /></div>
                  <div><i /><i /><i /></div>
                </motion.div>
                <motion.div style={{ opacity: railOpacity }}>
                  <p className="ls-rail-title">Findings <span>Home page</span></p>
                  <ul className="ls-findings">
                    {EXAMPLE.findings.map((finding, index) => (
                      <PinnedFinding key={finding.text} finding={finding} progress={p} index={index} />
                    ))}
                  </ul>
                </motion.div>

                <motion.div className="ls-summary" style={{ opacity: summaryOpacity, y: summaryLift }}>
                  <small>Home page difference</small>
                  <motion.strong>{numberText}</motion.strong>
                  <span className="ls-track-bar"><motion.span style={{ scaleX: barScale }} /></span>
                  <p className="ls-counts">
                    <span><b>{EXAMPLE.summary.compared}</b> compared</span>
                    <span><b>{EXAMPLE.summary.changed}</b> changed</span>
                    <span><b>{EXAMPLE.summary.unchanged}</b> unchanged</span>
                    <span><b>{EXAMPLE.summary.unavailable}</b> unavailable</span>
                  </p>
                </motion.div>
              </aside>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Phones, tablets and "reduce motion": the same report as a plain vertical layout
function Stacked() {
  return (
    <div className="lp-container ls-stacked" data-anchor>
      <Heading />
      <motion.div className="ls-stack-shots" variants={stagger(0.12)} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.15 }}>
        {[['Baseline', 'baseline'], ['Current', 'current'], ['Diff', 'diff']].map(([label, file]) => (
          <motion.figure key={label} variants={item} className="lp-glass">
            <figcaption>{label}</figcaption>
            <img src={`/landing/${file}-home.jpg`} alt={`${label} screenshot of the demo site home page`} loading="lazy" draggable="false" />
          </motion.figure>
        ))}
      </motion.div>
      <Reveal className="lp-glass ls-stack-panel">
        <p className="ls-rail-title">Findings <span>Home page</span></p>
        <ul className="ls-findings">
          {EXAMPLE.findings.map((finding) => (
            <li key={finding.text}><FindingRow finding={finding} /></li>
          ))}
        </ul>
        <div className="ls-summary">
          <small>Home page difference</small>
          <strong>{formatPercent(HOME.mismatch)}</strong>
          <span className="ls-track-bar"><span style={{ transform: `scaleX(${HOME.mismatch / 100})` }} /></span>
          <p className="ls-counts">
            <span><b>{EXAMPLE.summary.compared}</b> compared</span>
            <span><b>{EXAMPLE.summary.changed}</b> changed</span>
            <span><b>{EXAMPLE.summary.unchanged}</b> unchanged</span>
            <span><b>{EXAMPLE.summary.unavailable}</b> unavailable</span>
          </p>
        </div>
      </Reveal>
    </div>
  );
}

function ReportShowcase() {
  const wide = useMediaQuery('(min-width: 1024px)');
  const reduce = useReducedMotion();
  return wide && !reduce ? <Pinned /> : <Stacked />;
}

export default ReportShowcase;
