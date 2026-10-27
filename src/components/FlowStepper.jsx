import { Check } from 'lucide-react';
import { SCREENS } from '../data/constants';

const STEPS = [
  { key: SCREENS.DASHBOARD, label: 'Intake' },
  { key: SCREENS.PREPROCESSING, label: 'Analysis' },
  { key: SCREENS.COMPARISON, label: 'Comparison' },
  { key: SCREENS.TRANSCRIPTION, label: 'Transcript' },
  { key: SCREENS.REPORT, label: 'Report' },
];

export default function FlowStepper({ screen, onNavigate }) {
  const activeIndex = STEPS.findIndex((step) => step.key === screen);

  return (
    <nav className="stepper no-print" aria-label="Examination steps">
      {STEPS.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        return (
          <div className="step-wrap" key={step.key}>
            <button
              type="button"
              className={`step ${done ? 'done' : ''} ${active ? 'active' : ''}`.trim()}
              onClick={() => onNavigate(step.key)}
              aria-current={active ? 'step' : undefined}
            >
              <span className="step-dot" aria-hidden="true">
                {done ? <Check size={12} /> : index + 1}
              </span>
              <span className="step-label">{step.label}</span>
            </button>
            {index < STEPS.length - 1 && <span className={`step-line ${done ? 'done' : ''}`} aria-hidden="true" />}
          </div>
        );
      })}
    </nav>
  );
}
