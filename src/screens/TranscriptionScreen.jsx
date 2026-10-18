import { Languages, Wand2, Loader2, ShieldQuestion, CheckCircle2, ChevronRight, FileText } from 'lucide-react';
import GlassPanel from '../components/GlassPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { useToast } from '../components/Toast.jsx';

function Tokens({ tokens }) {
  return (
    <>
      {tokens.map((tok, i) =>
        tok.u ? (
          <span
            key={i}
            className="uncertain"
            title={`Low-confidence token — mock confidence ${tok.c.toFixed(2)}`}
          >
            {tok.u}
            <sup>{tok.c.toFixed(2)}</sup>
          </span>
        ) : (
          <span key={i}>{tok.t}</span>
        )
      )}
    </>
  );
}

function SegmentList({ segments }) {
  return (
    <div className="seg-list">
      {segments.map((seg) => (
        <div className="seg" key={seg.time}>
          <span className="seg-time mono">{seg.time}</span>
          <span className={`seg-speaker spk-${seg.speaker}`}>{seg.speaker}</span>
          <p className="seg-text">
            <Tokens tokens={seg.tokens} />
          </p>
        </div>
      ))}
    </div>
  );
}

export default function TranscriptionScreen({
  transcript,
  translations,
  language,
  setLanguage,
  appliedLanguage,
  translationStatus,
  onApply,
  onContinue,
}) {
  const notify = useToast();
  const applying = translationStatus === 'translating';
  const applied = translations[appliedLanguage];

  return (
    <div className="stack-xl">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Screen 04 · Linguistics</p>
          <h2 className="h1">Transcription & Translation</h2>
          <p className="muted">
            Auto-generated draft transcript of the separated speaker tracks, with an illustrative translation panel.
          </p>
        </div>
        <div className="heading-badges">
          <StatusBadge tone="amber">
            <ShieldQuestion size={12} /> Requires examiner verification
          </StatusBadge>
        </div>
      </div>

      <GlassPanel
        title="Translation Controls"
        subtitle="Choose the target language for the translated panel"
        actions={
          <span className="mono panel-meta">
            source: {transcript.originalLanguageLabel}
          </span>
        }
      >
        <div className="lang-row">
          <label className="field lang-field">
            <span className="field-label">
              <Languages size={13} /> Target language
            </span>
            <select
              className="input select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="english">English</option>
              <option value="hindi">Hindi</option>
              <option value="marathi">Marathi</option>
            </select>
          </label>
          <button className="btn btn-primary" onClick={onApply} disabled={applying}>
            {applying ? <Loader2 size={15} className="spin" /> : <Wand2 size={15} />}
            {applying ? 'Applying…' : 'Apply Translation'}
          </button>
          <div className="lang-status">
            <StatusBadge tone={applying ? 'amber' : 'green'}>
              {applying ? 'Translating…' : `Showing ${applied.label}`}
            </StatusBadge>
            <span className="muted small">Mock translation engine · segment-synchronous</span>
          </div>
        </div>
        {applied.note && (
          <p className="lang-note">
            <FileText size={13} /> {applied.note}
          </p>
        )}
      </GlassPanel>

      <div className="transcript-grid">
        <GlassPanel
          title="Original Transcript"
          subtitle={`Detected language: ${transcript.originalLanguageLabel} · ${transcript.sourceFormat}`}
          actions={<StatusBadge tone="cyan">confidence {transcript.confidence}</StatusBadge>}
        >
          <SegmentList segments={transcript.segments} />
          <div className="review-strip">
            <span className="review-item">
              <CheckCircle2 size={13} /> Segmentation complete (5 segments)
            </span>
            <span className="review-item warn-item">
              <ShieldQuestion size={13} /> 3 uncertain tokens flagged for review
            </span>
            <span className="review-item muted">WER estimate {transcript.werEstimate}</span>
          </div>
        </GlassPanel>

        <GlassPanel
          title={`Translated Transcript — ${applied.label}`}
          subtitle={`Target language code ${applied.code} · illustrative machine translation`}
          actions={
            <StatusBadge tone="violet">
              {applying ? (
                <>
                  <Loader2 size={12} className="spin" /> updating
                </>
              ) : (
                'up to date'
              )}
            </StatusBadge>
          }
          bodyClass={applying ? 'fade-swap' : 'fade-in-swap'}
        >
          <SegmentList segments={applied.segments} />
          <div className="review-strip">
            <span className="review-item">
              <FileText size={13} /> Draft translation — not certified
            </span>
            <span className="review-item warn-item">
              <ShieldQuestion size={13} /> Uncertain tokens mirrored from source
            </span>
          </div>
        </GlassPanel>
      </div>

      <GlassPanel title="Transcript Review Status" subtitle="Examiner workflow tracking for this draft">
        <div className="review-status-row">
          <div className="review-status-card">
            <p className="mini-stat-label">Auto-transcription</p>
            <p className="label-strong">Draft complete</p>
            <StatusBadge tone="green">engine pass</StatusBadge>
          </div>
          <div className="review-status-card">
            <p className="mini-stat-label">Uncertain tokens</p>
            <p className="label-strong">3 flagged</p>
            <StatusBadge tone="amber">manual check needed</StatusBadge>
          </div>
          <div className="review-status-card">
            <p className="mini-stat-label">Translation</p>
            <p className="label-strong">{applied.label} applied</p>
            <StatusBadge tone="violet">illustrative only</StatusBadge>
          </div>
          <div className="review-status-card">
            <p className="mini-stat-label">Examiner sign-off</p>
            <p className="label-strong">Pending</p>
            <StatusBadge tone="gray">not signed</StatusBadge>
          </div>
        </div>
      </GlassPanel>

      <div className="cta-row">
        <p className="cta-note muted">
          The transcript and translation are attached to the draft forensic report for examiner review.
        </p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => {
            notify('Opening forensic report draft…', 'info');
            onContinue();
          }}
        >
          Review Report <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
