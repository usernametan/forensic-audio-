import { Check } from 'lucide-react';
import { SCREENS } from '../data/mockData';

const STEPS = [
  { key: SCREENS.DASHBOARD, label: 'Case Setup' },
  { key: SCREENS.PREPROCESSING, label: 'Preprocessing' },
  { key: SCREENS.COMPARISON, label: 'Comparison' },
  { key: SCREENS.TRANSCRIPTION, label: 'Transcription' },
  { key: SCREENS.REPORT, label: 'Report' },
];

export default function FlowStepper({ screen, onNavigate }) {
  const activeIndex = STEPS.findIndex((s) => s.key === screen);

  return (
    <div className="stepper no-print">
      {STEPS.map((step, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        return (
          <div className="step-wrap" key={step.key}>
            <button
              className={`step ${done ? 'done' : ''} ${active ? 'active' : ''}`}
              onClick={() => onNavigate(step.key)}
            >
              <span className="step-dot">{done ? <Check size={12} /> : i + 1}</span>
              <span className="step-label">{step.label}</span>
            </button>
            {i < STEPS.length - 1 && <span className={`step-line ${i < activeIndex ? 'done' : ''}`} />}
          </div>
        );
      })}
    </div>
  );
}
