import {
  LayoutDashboard,
  AudioLines,
  Users,
  Languages,
  ScrollText,
  ShieldCheck,
  X,
  CircleDot,
  ChevronRight,
  Leaf,
} from 'lucide-react';
import { SCREENS } from '../data/constants';

const NAV_ITEMS = [
  { key: SCREENS.DASHBOARD, label: 'Case workspace', icon: LayoutDashboard, caption: 'Intake & evidence register' },
  { key: SCREENS.PREPROCESSING, label: 'Audio analysis', icon: AudioLines, caption: 'Processing & signal lab' },
  { key: SCREENS.COMPARISON, label: 'Speaker comparison', icon: Users, caption: 'Questioned vs reference' },
  { key: SCREENS.TRANSCRIPTION, label: 'Transcription', icon: Languages, caption: 'Transcript review' },
  { key: SCREENS.REPORT, label: 'Forensic report', icon: ScrollText, caption: 'Review & export' },
];

export default function Sidebar({ screen, onNavigate, open, onClose, backendStatus, runId }) {
  return (
    <>
      <button
        type="button"
        className={`sidebar-backdrop ${open ? 'show' : ''}`}
        onClick={onClose}
        aria-label="Close navigation"
        tabIndex={open ? 0 : -1}
      />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Primary navigation">
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <AudioLines size={19} />
            </span>
            <span className="brand-text">
              <span className="brand-title">
                Audio Forensics <Leaf size={11} className="brand-leaf" aria-hidden="true" />
              </span>
              <span className="brand-sub">Examination workstation</span>
            </span>
            <button className="sidebar-close" onClick={onClose} aria-label="Close navigation">
              <X size={16} />
            </button>
          </div>

          <p className="nav-section-label">Laboratory workflow</p>

          <nav className="nav" aria-label="Analysis workflow">
            {NAV_ITEMS.map((item, index) => {
              const Icon = item.icon;
              const active = screen === item.key;
              return (
                <button
                  type="button"
                  key={item.key}
                  className={`nav-item ${active ? 'active' : ''}`}
                  onClick={() => {
                    onNavigate(item.key);
                    onClose();
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className="nav-step" aria-hidden="true">
                    {index + 1}
                  </span>
                  <span className="nav-icon" aria-hidden="true">
                    <Icon size={16} />
                  </span>
                  <span className="nav-text">
                    <span className="nav-label">{item.label}</span>
                    <span className="nav-caption">{item.caption}</span>
                  </span>
                  {active && <ChevronRight size={15} className="nav-chevron" aria-hidden="true" />}
                  {active && <span className="nav-active-bar" aria-hidden="true" />}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-connection">
            <span className={`status-dot ${backendStatus === 'online' ? 'online' : backendStatus === 'checking' ? 'checking' : 'offline'}`} />
            <div>
              <p className="sidebar-connection-title">
                {backendStatus === 'online' ? 'Analysis service online' : backendStatus === 'checking' ? 'Checking service…' : 'Analysis service offline'}
              </p>
              <p className="sidebar-connection-sub">
                {runId ? `Run ${runId}` : 'No active pipeline run'}
              </p>
            </div>
            <ChevronRight size={14} className="sidebar-connection-chevron" aria-hidden="true" />
          </div>
          <div className="sidebar-legal">
            <ShieldCheck size={14} aria-hidden="true" />
            <p>Decision support only. Examiner approval is required before any report is treated as certified.</p>
          </div>
          <p className="sidebar-version">
            <CircleDot size={9} aria-hidden="true" /> v1.0 · local workstation
          </p>
        </div>
      </aside>
    </>
  );
}
