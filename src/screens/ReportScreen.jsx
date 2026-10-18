import {
  Download,
  Printer,
  ArrowLeft,
  ShieldAlert,
  FileText,
  Clock3,
  Fingerprint,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Users,
} from 'lucide-react';
import GlassPanel from '../components/GlassPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { REPORT_META, STAGE_META, STAGE_ORDER, SPEAKER_TRACKS } from '../data/mockData';
import { buildReportData, exportReportPdf } from '../utils/pdfExport';
import { useToast } from '../components/Toast.jsx';

function SegLines({ segments }) {
  return (
    <div className="rpt-segs">
      {segments.map((seg) => (
        <p className="rpt-seg" key={seg.time}>
          <span className="rpt-seg-time">{seg.time}</span>
          <span className={`rpt-seg-spk spk-${seg.speaker}`}>{seg.speaker}</span>
          <span>
            {seg.tokens.map((tok, i) =>
              tok.u ? (
                <mark className="rpt-uncertain" key={i}>
                  {tok.u}
                </mark>
              ) : (
                <span key={i}>{tok.t}</span>
              )
            )}
          </span>
        </p>
      ))}
    </div>
  );
}

function Section({ num, title, children }) {
  return (
    <section className="rpt-section">
      <h3 className="rpt-section-title">
        <span className="rpt-num">{num}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export default function ReportScreen({
  caseInfo,
  evidence,
  reference,
  stages,
  comparison,
  transcript,
  translations,
  appliedLanguage,
  onReturn,
}) {
  const notify = useToast();
  const applied = translations[appliedLanguage];
  const result = comparison.result;

  const handleExport = () => {
    try {
      const data = buildReportData({
        caseInfo,
        evidence,
        reference,
        stages,
        comparison,
        transcript,
        translations,
        appliedLanguage,
        reportMeta: REPORT_META,
      });
      exportReportPdf(data);
      notify('PDF exported — check your downloads folder', 'success');
    } catch (err) {
      console.error(err);
      notify('PDF export failed — use Print Report instead', 'warn');
    }
  };

  return (
    <div className="stack-xl">
      <div className="page-heading no-print">
        <div>
          <p className="eyebrow">Screen 05 · Reporting</p>
          <h2 className="h1">Forensic Report</h2>
          <p className="muted">
            Consolidated draft report assembled from every module of the analysis pipeline.
          </p>
        </div>
        <div className="heading-badges">
          <StatusBadge tone="amber">
            <ShieldAlert size={12} /> Prototype document
          </StatusBadge>
        </div>
      </div>

      <div className="report-actions no-print">
        <button className="btn btn-primary" onClick={handleExport}>
          <Download size={15} /> Export PDF
        </button>
        <button className="btn btn-secondary" onClick={() => window.print()}>
          <Printer size={15} /> Print Report
        </button>
        <button className="btn btn-ghost" onClick={onReturn}>
          <ArrowLeft size={15} /> Return to Dashboard
        </button>
        <span className="muted small report-actions-note">
          Export uses jsPDF · Print opens your browser dialog (choose “Save as PDF”)
        </span>
      </div>

      <article className="report-doc">
        <div className="rpt-watermark">PROTOTYPE · DEMO</div>

        <header className="rpt-header">
          <div className="rpt-brand">
            <span className="rpt-brand-mark">
              <FileText size={18} />
            </span>
            <div>
              <h1 className="rpt-brand-title">AUDIO FORENSICS</h1>
              <p className="rpt-brand-sub">Digital Forensics Laboratory · Academic Demo Cell</p>
            </div>
          </div>
          <div className="rpt-ids">
            <p>
              <span className="rpt-id-key">CASE</span>
              <span className="rpt-id-val">{caseInfo.id}</span>
            </p>
            <p>
              <span className="rpt-id-key">REPORT</span>
              <span className="rpt-id-val">{REPORT_META.id}</span>
            </p>
            <p>
              <span className="rpt-id-key">GENERATED</span>
              <span className="rpt-id-val">{REPORT_META.generated}</span>
            </p>
          </div>
        </header>

        <div className="rpt-demo-banner">
          <ShieldAlert size={16} />
          <div>
            <p className="rpt-demo-title">PROTOTYPE / DEMO REPORT — REQUIRES EXPERT VALIDATION BEFORE ANY LEGAL USE</p>
            <p className="rpt-demo-sub">
              All analysis outputs below are simulated mock data produced by a frontend prototype built for Experiment
              No. 5. This document is not a forensic opinion and must not be used in any legal proceeding.
            </p>
          </div>
        </div>

        <Section num="1" title="Case Reference">
          <div className="rpt-kv-grid">
            <div className="rpt-kv">
              <span className="rpt-kv-key">Case title</span>
              <span className="rpt-kv-val">{caseInfo.title}</span>
            </div>
            <div className="rpt-kv">
              <span className="rpt-kv-key">Examiner</span>
              <span className="rpt-kv-val">{REPORT_META.examiner}</span>
            </div>
            <div className="rpt-kv">
              <span className="rpt-kv-key">Laboratory</span>
              <span className="rpt-kv-val">{REPORT_META.lab}</span>
            </div>
            <div className="rpt-kv">
              <span className="rpt-kv-key">Review status</span>
              <span className="rpt-kv-val">{REPORT_META.reviewStatus}</span>
            </div>
          </div>
        </Section>

        <Section num="2" title="Evidence File Details">
          <div className="rpt-two-col">
            <div className="rpt-file-card">
              <p className="rpt-file-role">Questioned exhibit</p>
              <p className="rpt-file-name">{evidence.name}</p>
              <ul className="rpt-file-meta">
                <li>
                  <Fingerprint size={11} /> Ref <b>{evidence.ref}</b>
                </li>
                <li>
                  <Clock3 size={11} /> Duration <b>{evidence.duration}</b>
                </li>
                <li>
                  <FileText size={11} /> Format <b>{evidence.format}</b>
                </li>
                <li>
                  Sample rate <b>{evidence.sampleRate}</b> · Channels <b>{evidence.channels}</b>
                </li>
                <li>
                  SHA-256 <b className="rpt-mono">{evidence.hash}</b>
                </li>
                <li>
                  Captured <b>{evidence.captured}</b>
                </li>
              </ul>
            </div>
            <div className="rpt-file-card">
              <p className="rpt-file-role">Reference voice sample</p>
              <p className="rpt-file-name">{reference.name}</p>
              <ul className="rpt-file-meta">
                <li>
                  <Fingerprint size={11} /> Ref <b>{reference.ref}</b>
                </li>
                <li>
                  <Clock3 size={11} /> Duration <b>{reference.duration}</b>
                </li>
                <li>
                  <FileText size={11} /> Format <b>{reference.format}</b>
                </li>
                <li>
                  Origin <b>{reference.origin}</b>
                </li>
                <li>
                  Quality <b>{reference.quality}</b> · SNR <b>{reference.snr}</b>
                </li>
                <li>
                  Captured <b>{reference.captured}</b>
                </li>
              </ul>
            </div>
          </div>
        </Section>

        <Section num="3" title="Audio Preprocessing Steps">
          <table className="rpt-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Stage</th>
                <th>Configuration</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {STAGE_ORDER.map((key, i) => {
                const stage = stages[key];
                const meta = STAGE_META[key];
                return (
                  <tr key={key}>
                    <td>{i + 1}</td>
                    <td>
                      <b>{meta.label}</b>
                    </td>
                    <td>{meta.detail}</td>
                    <td>
                      <span className={`rpt-status ${stage.status}`}>
                        {stage.status === 'complete' ? (
                          <>
                            <CheckCircle2 size={11} /> Complete ({stage.progress}%)
                          </>
                        ) : stage.status === 'running' ? (
                          <>
                            <Loader2 size={11} className="spin" /> Running ({stage.progress}%)
                          </>
                        ) : (
                          <>
                            <CircleDashed size={11} /> Pending
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section num="4" title="Speaker Separation Summary">
          <p className="rpt-para">
            VAD-based diarization partitioned the exhibit into <b>47 speech segments</b> across two talker tracks:
          </p>
          <table className="rpt-table">
            <thead>
              <tr>
                <th>Track</th>
                <th>Active duration</th>
                <th>Talk time</th>
                <th>Segments</th>
                <th>Pitch band</th>
              </tr>
            </thead>
            <tbody>
              {SPEAKER_TRACKS.map((t) => (
                <tr key={t.id}>
                  <td>
                    <b>
                      {t.label} ({t.id})
                    </b>
                  </td>
                  <td className="rpt-mono">{t.duration}</td>
                  <td className="rpt-mono">{t.talkTime}</td>
                  <td className="rpt-mono">{t.segments}</td>
                  <td className="rpt-mono">{t.pitch}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rpt-para">
            <Users size={11} className="rpt-inline-icon" /> Speaker 01 (SPK-01) was selected as the questioned voice
            segment for comparison against the reference sample.
          </p>
        </Section>

        <Section num="5" title="Comparison Methodology & Illustrative Observations">
          <p className="rpt-para">
            <b>Methodology.</b> Both samples were processed by a <i>simulated</i> feature pipeline: voice-activity
            segmentation → MFCC feature extraction → pitch and prosody statistics → illustrative index scoring. No
            validated forensic audio engine, trained speaker-recognition model or reference database was used.
          </p>
          {result ? (
            <>
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Illustrative index</th>
                    <th>Mock score</th>
                    <th>Band</th>
                  </tr>
                </thead>
                <tbody>
                  {result.metrics.map((m) => (
                    <tr key={m.name}>
                      <td>{m.name}</td>
                      <td className="rpt-mono">{m.value.toFixed(2)}</td>
                      <td>simulated</td>
                    </tr>
                  ))}
                  <tr className="rpt-highlight-row">
                    <td>
                      <b>Composite illustrative index</b>
                    </td>
                    <td className="rpt-mono">
                      <b>{result.composite.toFixed(2)}</b>
                    </td>
                    <td>
                      <b>{result.verdictBand}</b>
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="rpt-alert">
                <b>No identification conclusion is claimed.</b> The composite index falls inside the inconclusive band.
                These simulated figures do <b>not</b> indicate that the questioned and reference samples were produced
                by the same person or by different persons.
              </div>
              <ul className="rpt-bullets">
                {result.observations.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </>
          ) : (
            <div className="rpt-alert">Comparison pipeline was not executed in this session.</div>
          )}
        </Section>

        <Section num="6" title={`Original Transcript (${transcript.originalLanguageLabel})`}>
          <p className="rpt-para muted-line">
            {transcript.sourceFormat} · confidence {transcript.confidence} · WER estimate {transcript.werEstimate} ·
            uncertain tokens highlighted
          </p>
          <SegLines segments={transcript.segments} />
        </Section>

        <Section num={`7`} title={`Translation (${applied.label})`}>
          {applied.note && <p className="rpt-para muted-line">{applied.note}</p>}
          <SegLines segments={applied.segments} />
        </Section>

        <Section num="8" title="Limitations">
          <ul className="rpt-bullets">
            {REPORT_META.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Section>

        <Section num="9" title="Examiner Review Status">
          <div className="rpt-kv-grid">
            <div className="rpt-kv">
              <span className="rpt-kv-key">Status</span>
              <span className="rpt-kv-val">{REPORT_META.reviewStatus}</span>
            </div>
            <div className="rpt-kv">
              <span className="rpt-kv-key">Uncertain tokens</span>
              <span className="rpt-kv-val">3 flagged for manual verification</span>
            </div>
            <div className="rpt-kv">
              <span className="rpt-kv-key">Examiner signature</span>
              <span className="rpt-kv-val rpt-sign-line">__________________________</span>
            </div>
            <div className="rpt-kv">
              <span className="rpt-kv-key">Date</span>
              <span className="rpt-kv-val rpt-sign-line">__________________________</span>
            </div>
          </div>
        </Section>

        <footer className="rpt-footer">
          <p>
            Generated by the AUDIO FORENSICS academic prototype · {REPORT_META.generated} · Not valid for legal or
            forensic use · Experiment No. 5
          </p>
        </footer>
      </article>

      <GlassPanel title="Next Steps" subtitle="After examiner review, what a real laboratory workflow would do" className="no-print">
        <div className="review-status-row">
          <div className="review-status-card">
            <p className="mini-stat-label">1 · Verify transcript</p>
            <p className="label-strong">Check uncertain tokens</p>
          </div>
          <div className="review-status-card">
            <p className="mini-stat-label">2 · Expert review</p>
            <p className="label-strong">Certified examiner sign-off</p>
          </div>
          <div className="review-status-card">
            <p className="mini-stat-label">3 · Re-run with validated tools</p>
            <p className="label-strong">Real MFCC / i-vector pipeline</p>
          </div>
          <div className="review-status-card">
            <p className="mini-stat-label">4 · Seal the report</p>
            <p className="label-strong">Hash, sign, archive exhibit</p>
          </div>
        </div>
      </GlassPanel>
    </div>
  );
}
