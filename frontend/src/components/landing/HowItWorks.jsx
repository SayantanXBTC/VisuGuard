import { useRef, useState } from 'react';
import { motion, useMotionValueEvent, useScroll } from 'framer-motion';

const STEPS = [
  { title: 'Enter your website', text: 'One URL: the approved version.' },
  { title: 'Capture baseline', text: 'Full-page screenshots, saved until you delete them.' },
  { title: 'Capture deployment', text: 'The same pages, opened on the new URL.' },
  { title: 'Compare changes', text: 'Pixel by pixel. Over 0.1% counts as changed.' },
  { title: 'Analyze differences', text: 'Diff images, and optional AI findings.' },
  { title: 'Generate report', text: 'Read it online or export a PDF.' },
];

// The six steps as one pipeline. While the list scrolls through the screen the line fills and the current step is
// highlighted, earlier steps stay lit and later ones stay dim.
function HowItWorks() {
  const listRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 65%', 'end 60%'] });
  const [active, setActive] = useState(-1);

  useMotionValueEvent(scrollYProgress, 'change', (value) => {
    const next = value <= 0.001 ? -1 : Math.min(STEPS.length - 1, Math.floor(value * STEPS.length));
    setActive((current) => (current === next ? current : next));
  });

  return (
    <ol className="lt-list" ref={listRef}>
      <span className="lt-line" aria-hidden="true"><motion.span style={{ scaleY: scrollYProgress }} /></span>
      {STEPS.map((step, index) => (
        <li key={step.title} className={index < active ? 'is-done' : index === active ? 'is-active' : ''}>
          <span className="lt-number">{String(index + 1).padStart(2, '0')}</span>
          <div>
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

export default HowItWorks;
