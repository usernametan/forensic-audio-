import { useRef, useState } from 'react';
import {
  UploadCloud,
  FileAudio,
  ShieldCheck,
  Clock3,
  HardDrive,
  Fingerprint,
  CalendarClock,
  Radio,
  ChevronRight,
  X,
} from 'lucide-react';
import GlassPanel from '../components/GlassPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Waveform from '../components/Waveform.jsx';
import { EXAMPLE_EVIDENCE } from '../data/mockData';
import { useToast } from '../components/Toast.jsx';
import { computeSHA256 } from '../services/api';

function readFileMeta(file) {
  const mb = file.size / (1024 * 1024);
  return {
    ref: `EV-${String(Math.floor(Math.random() * 900) + 100)}`,
    name: file.name,
    sizeMB: Number(mb.toFixed(1)),
    duration: EXAMPLE_EVIDENCE.duration,
    format: file.name.toLowerCase().endsWith('.wav')
      ? 'WAV · PCM'
      : file.name.toLowerCase().endsWith('.mp3')
        ? 'MP3 · compressed'
        : 'Audio (assumed)',
    sampleRate: EXAMPLE_EVIDENCE.sampleRate,
    channels: EXAMPLE_EVIDENCE.channels,
    bitrate: EXAMPLE_EVIDENCE.bitrate,
    hash: 'calculating SHA-256…',
    captured: 'Uploaded just now · local session',
    source: 'User-supplied exhibit (browser upload)',
    custom: true,
    file,
  };
}

export default function DashboardScreen({ caseInfo, setCaseInfo, evidence, setEvidence, onBegin }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const notify = useToast();

  const acceptFile = async (file) => {
    if (!file) return;
    const ok = /\.(wav|mp3|flac|m4a|ogg|aac|webm)$/i.test(file.name);
    if (!ok) {
      notify('Unsupported file type — select WAV, MP3, FLAC, M4A or OGG', 'warn');
      return;
    }
    const meta = readFileMeta(file);
    setEvidence(meta);
    notify(`Calculating SHA-256 fingerprint for ${file.name}…`, 'info');

    // Real browser-side SHA-256 calculation
    try {
      const sha = await computeSHA256(file);
      meta.hash = sha;
      setEvidence((prev) => (prev ? { ...prev, hash: sha } : meta));
      notify(`SHA-256 locked: ${sha.slice(0, 16)}…`, 'success');
    } catch (err) {
      console.warn('SHA error', err);
    }

    // Audio duration probe
    try {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.src = url;
      audio.onloadedmetadata = () => {
        const sec = Math.round(audio.duration);
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        const dur = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        setEvidence((prev) => (prev ? { ...prev, duration: dur } : prev));
        URL.revokeObjectURL(url);
      };
    } catch {}
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    acceptFile(e.dataTransfer.files?.[0]);
  };

  return (
    <div className="stack-xl">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Screen 01 · Intake</p>
          <h2 className="h1">Case Dashboard & Evidence Upload</h2>
          <p className="muted">
            Register the case reference, stage the questioned audio exhibit and lock it into the analysis pipeline.
          </p>
        </div>
        <div className="heading-badges">
          <StatusBadge tone="green">
            <ShieldCheck size={12} /> Chain-of-custody demo
          </StatusBadge>
          <StatusBadge tone="cyan">
            <Radio size={12} /> Local session · no cloud
          </StatusBadge>
        </div>
      </div>

      <div className="grid-2">
        <GlassPanel title="Case Registration" subtitle="Reference details printed on every report page">
          <div className="field-grid">
            <label className="field">
              <span className="field-label">Case ID</span>
              <input
                className="input mono"
                value={caseInfo.id}
                onChange={(e) => setCaseInfo((c) => ({ ...c, id: e.target.value }))}
                placeholder="CEP-2026-AF-0000"
              />
            </label>
            <label className="field">
              <span className="field-label">Case Title</span>
              <input
                className="input"
                value={caseInfo.title}
                onChange={(e) => setCaseInfo((c) => ({ ...c, title: e.target.value }))}
                placeholder="Short exhibit description"
              />
            </label>
            <label className="field">
              <span className="field-label">Source / Custody Origin</span>
              <input
                className="input"
                value={caseInfo.source || ''}
                onChange={(e) => setCaseInfo((c) => ({ ...c, source: e.target.value }))}
                placeholder="PS Special Cell / Crime Branch (optional)"
              />
            </label>
            <label className="field">
              <span className="field-label">Seizing Officer / Examiner</span>
              <input
                className="input"
                value={caseInfo.collector || ''}
                onChange={(e) => setCaseInfo((c) => ({ ...c, collector: e.target.value }))}
                placeholder="IO / Examiner name (optional)"
              />
            </label>
          </div>

          <div className="mini-stats">
            <div className="mini-stat">
              <Clock3 size={14} />
              <div>
                <p className="mini-stat-label">Session opened</p>
                <p className="mini-stat-value">18 Oct 2026 · 10:30 IST</p>
              </div>
            </div>
            <div className="mini-stat">
              <ShieldCheck size={14} />
              <div>
                <p className="mini-stat-label">Custody mode</p>
                <p className="mini-stat-value">Academic demonstration</p>
              </div>
            </div>
            <div className="mini-stat">
              <Fingerprint size={14} />
              <div>
                <p className="mini-stat-label">Examiner</p>
                <p className="mini-stat-value">Trainee · Lab Batch B</p>
              </div>
            </div>
            <div className="mini-stat">
              <CalendarClock size={14} />
              <div>
                <p className="mini-stat-label">Exhibit count</p>
                <p className="mini-stat-value">1 questioned · 1 reference</p>
              </div>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel
          title="Audio Evidence Upload"
          subtitle="Drag & drop or browse — file never leaves your browser"
          actions={
            evidence ? (
              <StatusBadge tone="green">
                <FileAudio size={12} /> File staged
              </StatusBadge>
            ) : (
              <StatusBadge tone="gray">Awaiting file</StatusBadge>
            )
          }
        >
          <div
            className={`upload-zone ${dragging ? 'dragging' : ''} ${evidence ? 'has-file' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') inputRef.current?.click();
            }}
          >
            <span className="upload-icon">
              <UploadCloud size={26} />
            </span>
            <p className="upload-title">
              {evidence ? evidence.name : 'Drop questioned audio exhibit here'}
            </p>
            <p className="upload-hint">
              {evidence
                ? `${evidence.sizeMB} MB staged · click to replace with another file`
                : 'or click to browse · WAV / MP3 / FLAC / M4A / OGG · demo prototype'}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="audio/*,.wav,.mp3,.flac,.m4a,.ogg"
              hidden
              onChange={(e) => acceptFile(e.target.files?.[0])}
            />
          </div>

          {evidence && (
            <div className="file-chip-row">
              <div className="file-chip">
                <FileAudio size={14} />
                <span className="mono truncate">{evidence.name}</span>
                <span className="file-chip-size">{evidence.sizeMB} MB</span>
                <button
                  className="chip-x"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEvidence(null);
                    notify('Staged exhibit cleared', 'info');
                  }}
                  aria-label="Remove file"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )}
        </GlassPanel>
      </div>

      <GlassPanel
        title="Reference Exhibit Card"
        subtitle="Illustrative evidence record loaded into the case file"
        actions={<StatusBadge tone="cyan">EV-001 · registered</StatusBadge>}
      >
        <div className="evidence-card">
          <div className="evidence-wave">
            <Waveform seed={42} count={150} height={110} color="#2dd4bf" animated />
            <div className="wave-ruler">
              <span>00:00</span>
              <span>01:08</span>
              <span>02:16</span>
              <span>03:24</span>
              <span>04:32</span>
            </div>
          </div>

          <div className="evidence-meta">
            <div className="evidence-title-row">
              <div>
                <h4 className="evidence-name">{evidence ? evidence.name : EXAMPLE_EVIDENCE.name}</h4>
                <p className="muted small">{evidence ? evidence.source : EXAMPLE_EVIDENCE.source}</p>
              </div>
              <StatusBadge tone="violet">{evidence ? evidence.ref : EXAMPLE_EVIDENCE.ref}</StatusBadge>
            </div>

            <div className="meta-grid">
              <div className="meta-item">
                <Clock3 size={13} />
                <span className="meta-key">Duration</span>
                <span className="meta-val mono">{evidence ? evidence.duration : EXAMPLE_EVIDENCE.duration}</span>
              </div>
              <div className="meta-item">
                <FileAudio size={13} />
                <span className="meta-key">Format</span>
                <span className="meta-val">{evidence ? evidence.format : EXAMPLE_EVIDENCE.format}</span>
              </div>
              <div className="meta-item">
                <Radio size={13} />
                <span className="meta-key">Sample rate</span>
                <span className="meta-val mono">{evidence ? evidence.sampleRate : EXAMPLE_EVIDENCE.sampleRate}</span>
              </div>
              <div className="meta-item">
                <HardDrive size={13} />
                <span className="meta-key">Channels</span>
                <span className="meta-val">{evidence ? evidence.channels : EXAMPLE_EVIDENCE.channels}</span>
              </div>
              <div className="meta-item">
                <CalendarClock size={13} />
                <span className="meta-key">Captured</span>
                <span className="meta-val">{evidence ? evidence.captured : EXAMPLE_EVIDENCE.captured}</span>
              </div>
              <div className="meta-item">
                <Fingerprint size={13} />
                <span className="meta-key">SHA-256</span>
                <span className="meta-val mono">{evidence ? evidence.hash : EXAMPLE_EVIDENCE.hash}</span>
              </div>
            </div>
          </div>
        </div>
      </GlassPanel>

      <div className="cta-row">
        <p className="cta-note muted">
          Proceeding locks the exhibit into the preprocessing pipeline and records the case reference on the report.
        </p>
        <button className="btn btn-primary btn-lg" onClick={onBegin}>
          Begin Analysis <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
