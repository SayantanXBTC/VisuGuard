import { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';
import { EXAMPLE, STATUS_LABEL, formatPercent } from './example.js';
import Logo from './Logo.jsx';
import { useMediaQuery } from './scroll.js';

const ease = [0.2, 0.7, 0.2, 1];

// The product preview in the hero: a small copy of a real report that builds itself in a fixed order
// (baseline, current, diff, findings, percentage, status) when it comes into view, and once more each time it
// comes back into view. It does not loop. The numbers and images are the real example from example.js.
function HeroDemo() {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduce = useReducedMotion();
  const fineDesktop = useMediaQuery('(min-width: 1024px) and (hover: hover) and (pointer: fine)');
  const play = reduce ? true : inView;

  // Every part has its own start time (seconds). With "reduce motion" everything just appears.
  const part = (delay, hidden, shown) => ({
    initial: false,
    animate: play ? { ...shown, transition: reduce ? { duration: 0 } : { duration: 0.8, delay, ease } } : { ...hidden, transition: { duration: 0 } },
  });

  // The percentage counts up to the real value
  const home = EXAMPLE.pages[0].mismatch;
  const [percent, setPercent] = useState(0);
  useEffect(() => {
    if (!play) {
      setPercent(0);
      return undefined;
    }
    if (reduce) {
      setPercent(home);
      return undefined;
    }
    const controls = animate(0, home, { duration: 1.6, delay: 2.5, ease: 'easeOut', onUpdate: (value) => setPercent(value) });
    return () => controls.stop();
  }, [play, reduce, home]);

  // A very small tilt that follows the mouse (large screens with a mouse only)
  const tiltX = useSpring(useMotionValue(0), { stiffness: 90, damping: 20 });
  const tiltY = useSpring(useMotionValue(0), { stiffness: 90, damping: 20 });
  const onMove = (event) => {
    if (!fineDesktop || reduce) return;
    const box = event.currentTarget.getBoundingClientRect();
    tiltY.set(((event.clientX - box.left) / box.width - 0.5) * 5);
    tiltX.set((0.5 - (event.clientY - box.top) / box.height) * 4);
  };
  const onLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  return (
    <div className="hd" ref={ref} onPointerMove={onMove} onPointerLeave={onLeave}>
      <div className="hd-float">
        <motion.div
          className="hd-window"
          style={{ rotateX: tiltX, rotateY: tiltY }}
          {...part(0, { opacity: 0, y: 36, filter: 'blur(10px)' }, { opacity: 1, y: 0, filter: 'blur(0px)' })}
          role="img"
          aria-label="Example VisuGuard report: baseline, current and diff of one page, with the result of each page"
        >
          <div className="hd-inner">
            <header className="hd-bar">
              <span className="hd-brand"><Logo size={14} /> VisuGuard</span>
              <span className="hd-urls">{EXAMPLE.baseline} <i aria-hidden="true">&rarr;</i> {EXAMPLE.current}</span>
              <motion.span className="hd-pill" {...part(3.6, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1 })}>Completed</motion.span>
            </header>

            <div className="hd-shots">
              <motion.figure {...part(0.5, { opacity: 0, y: 14 }, { opacity: 1, y: 0 })}>
                <figcaption>Baseline</figcaption>
                <img src="/landing/baseline-home.jpg" alt="" draggable="false" />
              </motion.figure>
              <motion.figure {...part(1.2, { opacity: 0, x: 36 }, { opacity: 1, x: 0 })}>
                <figcaption>Current</figcaption>
                <img src="/landing/current-home.jpg" alt="" draggable="false" />
              </motion.figure>
              <motion.figure {...part(1.9, { opacity: 0, clipPath: 'inset(0 100% 0 0)' }, { opacity: 1, clipPath: 'inset(0 0% 0 0)' })}>
                <figcaption>Diff</figcaption>
                <img src="/landing/diff-home.jpg" alt="" draggable="false" />
              </motion.figure>
              {!reduce && (
                <motion.span
                  className="hd-scan"
                  aria-hidden="true"
                  initial={false}
                  animate={play ? { left: ['-6%', '106%'], opacity: [0, 1, 1, 0] } : { left: '-6%', opacity: 0 }}
                  transition={play ? { duration: 1.8, delay: 3.8, ease: 'easeInOut' } : { duration: 0 }}
                />
              )}
            </div>

            <div className="hd-lower">
              <ul className="hd-rows">
                {EXAMPLE.pages.map((page, index) => (
                  <motion.li key={page.path} {...part(2.5 + index * 0.16, { opacity: 0, x: -12 }, { opacity: 1, x: 0 })}>
                    <span className={`hd-tag hd-tag-${page.status}`}>{STATUS_LABEL[page.status]}</span>
                    <span className="hd-path">{page.path}</span>
                    <span className="hd-num">{formatPercent(page.mismatch)}</span>
                  </motion.li>
                ))}
              </ul>
              <motion.div className="hd-meter" {...part(2.3, { opacity: 0, y: 12 }, { opacity: 1, y: 0 })}>
                <small>Home page difference</small>
                <strong>{percent.toFixed(2)}%</strong>
                <span className="hd-bar-track">
                  <motion.span
                    initial={false}
                    animate={{ scaleX: play ? home / 100 : 0 }}
                    transition={play && !reduce ? { duration: 1.6, delay: 2.5, ease: 'easeOut' } : { duration: 0 }}
                  />
                </span>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
      <p className="hd-note">A real report from the demo sites in this project.</p>
    </div>
  );
}

export default HeroDemo;
