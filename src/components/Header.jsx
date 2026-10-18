import { Menu, Bell, ChevronRight } from 'lucide-react';
import { SCREENS } from '../data/mockData';

const STATUS_BY_SCREEN = {
  [SCREENS.DASHBOARD]: { label: 'Case Intake', tone: 'status-intake' },
  [SCREENS.PREPROCESSING]: { label: 'Processing', tone: 'status-processing' },
  [SCREENS.COMPARISON]: { label: 'Comparison', tone: 'status-compare' },
  [SCREENS.TRANSCRIPTION]: { label: 'Transcription', tone: 'status-transcribe' },
  [SCREENS.REPORT]: { label: 'Report Draft', tone: 'status-report' },
};

const CRUMB = {
  [SCREENS.DASHBOARD]: 'Case Dashboard',
  [SCREENS.PREPROCESSING]: 'Audio Preprocessing',
  [SCREENS.COMPARISON]: 'Speaker Comparison',
  [SCREENS.TRANSCRIPTION]: 'Transcription & Translation',
  [SCREENS.REPORT]: 'Forensic Report',
};

export default function Header({ screen, caseInfo, onMenu }) {
  const status = STATUS_BY_SCREEN[screen] || STATUS_BY_SCREEN[SCREENS.DASHBOARD];

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="menu-btn" onClick={onMenu} aria-label="Open navigation">
          <Menu size={18} />
        </button>
        <div className="topbar-titles">
          <h1 className="app-name">
            AUDIO FORENSICS
            <span className="app-name-tag">LAB</span>
          </h1>
          <p className="app-subtitle">
            Intelligent Audio Evidence Analysis Platform
            <span className="crumb-sep">
              <ChevronRight size={11} />
            </span>
            <span className="crumb">{CRUMB[screen]}</span>
          </p>
        </div>
      </div>

      <div className="topbar-right">
        <div className={`case-status ${status.tone}`}>
          <span className="pulse-dot" />
          <span className="case-status-label">Case Status</span>
          <span className="case-status-value">{status.label}</span>
        </div>

        <div className="case-id-pill" title="Active case reference">
          <span className="case-id-label">CASE</span>
          <span className="mono">{caseInfo.id || '—'}</span>
        </div>

        <button className="icon-btn" aria-label="Notifications">
          <Bell size={16} />
          <span className="icon-btn-dot" />
        </button>

        <div className="user-chip">
          <span className="avatar">TE</span>
          <span className="user-text">
            <span className="user-name">Trainee Examiner</span>
            <span className="user-role">Lab Batch B · Demo</span>
          </span>
        </div>
      </div>
    </header>
  );
}
