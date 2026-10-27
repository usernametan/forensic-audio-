import { useEffect, useState } from 'react';
import { Menu, ChevronRight, Clock3, FolderOpen } from 'lucide-react';
import { SCREENS } from '../data/constants';

const CRUMB = {
  [SCREENS.DASHBOARD]: 'Case workspace',
  [SCREENS.PREPROCESSING]: 'Audio analysis',
  [SCREENS.COMPARISON]: 'Speaker comparison',
  [SCREENS.TRANSCRIPTION]: 'Transcription & review',
  [SCREENS.REPORT]: 'Forensic report',
};

export default function Header({
  screen,
  caseInfo,
  onMenu,
  backendStatus,
  backendCheckedAt,
  runId,
  evidence,
}) {
  const statusLabel =
    backendStatus === 'online' ? 'Analysis service online' : backendStatus === 'checking' ? 'Checking analysis service' : 'Analysis service offline';

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const clock = now
    .toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    .toLowerCase();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="menu-btn" onClick={onMenu} aria-label="Open navigation">
          <Menu size={18} />
        </button>
        <div className="topbar-titles">
          <div className="topbar-crumb">
            <span>Audio Forensics</span>
            <ChevronRight size={12} aria-hidden="true" />
            <strong>{CRUMB[screen]}</strong>
          </div>
          <p className="topbar-context">
            <span>
              <FolderOpen size={12} aria-hidden="true" />
              {caseInfo?.id ? caseInfo.id : 'Case not registered'}
            </span>
            <span className="context-divider" aria-hidden="true" />
            <span className="truncate">
              {evidence?.name ? evidence.name : 'No evidence staged'}
            </span>
          </p>
        </div>
      </div>

      <div className="topbar-right">
        {runId && (
          <div className="run-pill" title={`Active pipeline run ${runId}`}>
            <span className="run-pill-label">RUN</span>
            <span className="mono">{runId}</span>
          </div>
        )}
        <span
          className={`backend-pill ${backendStatus}`}
          title={
            backendStatus === 'online'
              ? 'FastAPI analysis service is responding.'
              : backendStatus === 'checking'
                ? 'Checking the local analysis service.'
                : 'The analysis service is unreachable. Start the FastAPI backend to run the pipeline.'
          }
        >
          <span className={`status-dot ${backendStatus === 'online' ? 'online' : backendStatus === 'checking' ? 'checking' : 'offline'}`} />
          {statusLabel}
        </span>
        <span className="topbar-time" title={backendCheckedAt ? `Live workstation clock · last health check ${backendCheckedAt}` : 'Live workstation clock'}>
          <Clock3 size={13} aria-hidden="true" />
          <span className="mono">{clock}</span>
        </span>
      </div>
    </header>
  );
}
