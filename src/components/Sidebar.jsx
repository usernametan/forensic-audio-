import {
  LayoutDashboard,
  AudioLines,
  Users,
  Languages,
  ScrollText,
  ShieldCheck,
  X,
} from 'lucide-react';
import { SCREENS } from '../data/mockData';

const NAV_ITEMS = [
  { key: SCREENS.DASHBOARD, label: 'Dashboard', icon: LayoutDashboard, caption: 'Case & evidence intake' },
  { key: SCREENS.PREPROCESSING, label: 'Audio Analysis', icon: AudioLines, caption: 'Preprocessing lab' },
  { key: SCREENS.COMPARISON, label: 'Speaker Comparison', icon: Users, caption: 'Questioned vs reference' },
  { key: SCREENS.TRANSCRIPTION, label: 'Transcription', icon: Languages, caption: 'Transcript & translation' },
  { key: SCREENS.REPORT, label: 'Reports', icon: ScrollText, caption: 'Forensic report preview' },
];

export default function Sidebar({ screen, onNavigate, open, onClose }) {
  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-mark">
              <AudioLines size={20} />
            </span>
            <span className="brand-text">
              <span className="brand-title">AUDIO FORENSICS</span>
              <span className="brand-sub">Evidence Analysis Suite</span>
            </span>
            <button className="sidebar-close" onClick={onClose} aria-label="Close menu">
              <X size={16} />
            </button>
          </div>

          <p className="nav-section-label">Laboratory Modules</p>

          <nav className="nav">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = screen === item.key;
              return (
                <button
                  key={item.key}
                  className={`nav-item ${active ? 'active' : ''}`}
                  onClick={() => {
                    onNavigate(item.key);
                    onClose();
                  }}
                >
                  <span className="nav-icon">
                    <Icon size={17} />
                  </span>
                  <span className="nav-text">
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-caption">{item.caption}</span>
                  </span>
                  {active && <span className="nav-active-bar" />}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-badge">
            <ShieldCheck size={14} />
            <div>
              <p className="sidebar-badge-title">Prototype Build</p>
              <p className="sidebar-badge-sub">Experiment No. 5 · Demo data only</p>
            </div>
          </div>
          <p className="sidebar-version">v1.0.0 · local build</p>
        </div>
      </aside>
    </>
  );
}
