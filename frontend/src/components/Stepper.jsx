import { Check, X } from 'lucide-react';
import { capturedPages } from '../helpers.js';

// The four stages of a test, worked out from what is saved. Nothing here is guessed:
//   Baseline: done when the baseline has screenshots
//   Current:  done when the current version has screenshots
//   Analysis: done when the report exists
//   Report:   done when the report exists
function stageStates(test) {
  const hasBaseline = capturedPages(test.baseline_pages).length > 0;
  const hasCurrent = capturedPages(test.current_pages).length > 0;
  const completed = test.status === 'completed';
  const failed = test.status === 'failed';

  const states = {
    baseline: hasBaseline ? 'done' : test.status === 'capturing_baseline' ? 'active' : failed ? 'failed' : 'active',
    current: hasCurrent ? 'done' : !hasBaseline ? 'waiting' : test.status === 'capturing_current' ? 'active' : failed ? 'failed' : 'active',
    analysis: completed ? 'done' : !hasCurrent ? 'waiting' : test.status === 'analyzing' ? 'active' : failed ? 'failed' : 'active',
    report: completed ? 'done' : 'waiting',
  };
  return states;
}

const STAGES = [
  { id: 'baseline', label: 'Baseline' },
  { id: 'current', label: 'Current' },
  { id: 'analysis', label: 'Analysis' },
  { id: 'report', label: 'Report' },
];

// A compact lifecycle bar. Only the first unfinished stage is "active": later ones wait for it.
function Stepper({ test }) {
  const raw = stageStates(test);
  let seenActive = false;
  const states = {};
  for (const stage of STAGES) {
    let state = raw[stage.id];
    if ((state === 'active' || state === 'failed') && seenActive) state = 'waiting';
    if (state === 'active' || state === 'failed') seenActive = true;
    states[stage.id] = state;
  }
  const running = ['capturing_baseline', 'capturing_current', 'analyzing'].includes(test.status);

  return (
    <ol className="lifecycle" aria-label="Progress">
      {STAGES.map((stage, index) => {
        const state = states[stage.id];
        const live = running && state === 'active';
        return (
          <li key={stage.id} className={`step step-${state}${live ? ' step-live' : ''}`} aria-current={state === 'active' ? 'step' : undefined}>
            <span className="step-dot">
              {state === 'done' ? <Check size={12} strokeWidth={3} aria-hidden="true" /> : state === 'failed' ? <X size={12} strokeWidth={3} aria-hidden="true" /> : <i />}
            </span>
            <span className="step-label">{stage.label}</span>
            {index < STAGES.length - 1 && <span className="step-line" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}

export default Stepper;
