import { useState } from 'react';
import {
  Download,
  Printer,
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  FileText,
  Clock3,
  Fingerprint,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Users,
  Award,
} from 'lucide-react';
import GlassPanel from '../components/GlassPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { REPORT_META, STAGE_META, STAGE_ORDER, SPEAKER_TRACKS } from '../data/mockData';
import { buildReportData, exportReportPdf } from '../utils/pdfExport';
import { useToast } from '../components/Toast.jsx';

function SegLines({ segments }) {
  if (!segments || !segments.length) {
    return <p className="rpt-para muted-line">No speech segments recorded.</p>;
  }
  return (
    <div className="rpt-segs">
      {segments.map((seg, idx) => {
        const time = seg.time || (typeof seg.start === 'number'
          ? `${String(Math.floor(seg.start / 60)).padStart(2, '0')}:${String(Math.floor(seg.start % 60)).padStart(2, '0')}`
          : '00:00');
        const spk = seg.speaker || 'SPK-01';
        return (
          <p className="rpt-seg" key={seg.time || idx}>
            <span className="rpt-seg-time">{time}</span>
            <span className={`rpt-seg-spk spk-${spk}`}>{spk}</span>
            <span>
              {seg.tokens ? (
                seg.tokens.map((tok, i) =>
                  tok.u ? (
                    <mark className="rpt-uncertain" key={i}>
                      {tok.u}
                    </mark>
                  ) : (
                    <span key={i}>{tok.t}</span>
                  )
                )
              ) : (
                <span>{seg.text || seg.text_src || '—'}</span>
              )}
            </span>
          </p>
        );
      })}
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
  runId,
  reviewData,
  backendConnected,
  onApproveRun,
  isApproved,
}) {
  const notify = useToast();
  const applied = translations[appliedLanguage];
  const result = comparison.result;

  const [examinerName, setExaminerName] = useState(
    reviewData?.approved_by || caseInfo?.collector || 'Dr. R. Sharma, Forensic Audio Examiner'
  );
  const [conclusionText, setConclusionText] = useState(
    reviewData?.conclusion ||
      'Forensic audio examination completed in ordinary course. Auditory and acoustic-phonetic characteristics analyzed. Output verified under chain of custody.'
  );
  const [submittingApproval, setSubmittingApproval] = useState(false);

  const approved = isApproved || reviewData?.status === 'approved';

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
        reportMeta: {
          ...REPORT_META,
          examiner: examinerName,
          reviewStatus: approved ? 'Examiner Approved & Certified' : REPORT_META.reviewStatus,
        },
      });
      exportReportPdf(data);
      notify('PDF exported — check your downloads folder', 'success');
    } catch (err) {
      console.error(err);
      notify('PDF export failed — use Print Report instead', 'warn');
    }
  };

  const handleApprove = async () => {
    if (!examinerName.trim()) {
      notify('Please enter the examiner name before certifying', 'warn');
      return;
    }
    setSubmittingApproval(true);
    try {
      if (onApproveRun) {
        await onApproveRun({ examiner: examinerName, conclusion: conclusionText });
      }
      notify('Report approved & Section 65B/63 Certificate unlocked!', 'success');
    } catch (err) {
      notify(`Approval error: ${err.message}`, 'warn');
    } finally {
      setSubmittingApproval(false);
    }
  };

  return (
    <div className="stack-xl">
      <div className="page-heading no-print">
        <div>
          <p className="eyebrow">Screen 05 · Reporting</p>
          <h2 className="h1">Forensic Report</h2>
          <p className="muted">
            Consolidated court-ready examination report assembled from every module of the analysis pipeline.
          </p>
        </div>
        <div className="heading-badges">
          {approved ? (
            <StatusBadge tone="green">
              <ShieldCheck size={12} /> Certified u/s 65B / 63 BSA
            </StatusBadge>
          ) : (
            <StatusBadge tone="amber">
              <ShieldAlert size={12} /> Pending examiner approval
            </StatusBadge>
          )}
        </div>
      </div>

      <div className="report-actions no-print">
        {runId && backendConnected && approved && (
          <>
            <a
              href={`/export/${runId}?fmt=pdf`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ textDecoration: 'none' }}
            >
              <Download size={15} /> Download Official PDF Report
            </a>
            <a
              href={`/export/${runId}?fmt=html`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ textDecoration: 'none' }}
            >
              <FileText size={15} /> View HTML Report
            </a>
          </>
        )}
        <button className="btn btn-secondary" onClick={handleExport}>
          <Download size={15} /> Export Client PDF
        </button>
        <button className="btn btn-secondary" onClick={() => window.print()}>
          <Printer size={15} /> Print Report
        </button>
        <button className="btn btn-ghost" onClick={onReturn}>
          <ArrowLeft size={15} /> Return to Dashboard
        </button>
        <span className="muted small report-actions-note">
          Official court export requires examiner sign-off below
        </span>
      </div>

      <article className="report-doc">
        <div className="rpt-watermark">{approved ? 'COURT REPORT' : 'DRAFT REVIEW'}</div>

        <header className="rpt-header">
          <div className="rpt-brand">
            <span className="rpt-brand-mark">
              <FileText size={18} />
            </span>
            <div>
              <h1 className="rpt-brand-title">AUDIO FORENSICS</h1>
              <p className="rpt-brand-sub">Digital Forensics Laboratory · Forensic Audio Division</p>
            </div>
          </div>
          <div className="rpt-ids">
            <p>
              <span className="rpt-id-key">CASE</span>
              <span className="rpt-id-val">{caseInfo.id}</span>
            </p>
            <p>
              <span className="rpt-id-key">REPORT</span>
              <span className="rpt-id-val">{runId ? `RPT-${runId.toUpperCase()}` : REPORT_META.id}</span>
            </p>
            <p>
              <span className="rpt-id-key">GENERATED</span>
              <span className="rpt-id-val">{REPORT_META.generated}</span>
            </p>
          </div>
        </header>

        {!approved ? (
          <div className="rpt-demo-banner">
            <ShieldAlert size={16} />
            <div>
              <p className="rpt-demo-title">EXAMINER APPROVAL REQUIRED BEFORE COURT SUBMISSION</p>
              <p className="rpt-demo-sub">
                Automated audio processing tools provide decision support only. Certified examiner review, verification of
                intermediate hashes, and signature are required before export under Section 65B IEA / 63 BSA 2023.
              </p>
            </div>
          </div>
        ) : (
          <div className="rpt-demo-banner" style={{ background: 'rgba(52, 211, 153, 0.08)', borderColor: 'rgba(52, 211, 153, 0.4)' }}>
            <ShieldCheck size={16} style={{ color: '#34d399' }} />
            <div>
              <p className="rpt-demo-title" style={{ color: '#34d399' }}>EXAMINER CERTIFIED · SECTION 65B / 63 BSA ADMISSIBLE</p>
              <p className="rpt-demo-sub" style={{ color: '#a7f3d0' }}>
                Examiner approval and cryptographic hashes verified. Admissible as electronic evidence under Section 65B Indian Evidence Act / Section 63 Bharatiya Sakshya Adhiniyam 2023.
              </p>
            </div>
          </div>
        )}

        <Section num="1" title="Case Reference & Chain of Custody">
          <div className="rpt-kv-grid">
            <div className="rpt-kv">
              <span className="rpt-kv-key">Case title</span>
              <span className="rpt-kv-val">{caseInfo.title}</span>
            </div>
            <div className="rpt-kv">
              <span className="rpt-kv-key">Custody source</span>
              <span className="rpt-kv-val">{caseInfo.source || evidence.source || 'PS Special Cell (exhibit companion)'}</span>
            </div>
            <div className="rpt-kv">
              <span className="rpt-kv-key">Examiner</span>
              <span className="rpt-kv-val">{examinerName}</span>
            </div>
            <div className="rpt-kv">
              <span className="rpt-kv-key">Review status</span>
              <span className="rpt-kv-val">{approved ? 'Certified & Approved' : 'Pending Examiner Approval'}</span>
            </div>
          </div>
        </Section>

        <Section num="2" title="Evidence File Details & SHA-256 Verification">
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
                  SHA-256 <b className="rpt-mono">{reference.hash}</b>
                </li>
                <li>
                  Quality / SNR <b>{reference.quality} · {reference.snr || '31.2 dB'}</b>
                </li>
              </ul>
            </div>
          </div>
        </Section>

        <Section num="3" title="Audio Preprocessing & Enhancement Steps">
          <table className="rpt-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Stage</th>
                <th>Configuration / Model</th>
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

        <Section num="4" title="Speaker Separation & Diarization Summary">
          <p className="rpt-para">
            Voice-activity and diarization partitioned the recording into distinct speaker tracks:
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
        </Section>

        <Section num="5" title="Comparison Methodology & Speaker Verification">
          <p className="rpt-para">
            <b>Methodology.</b> Combined acoustic-phonetic (F0 pitch, formants, MFCC distance) and automated
            deep speaker embedding cosine similarity (ECAPA-TDNN).
          </p>
          {result ? (
            <>
              <table className="rpt-table">
                <thead>
                  <tr>
                    <th>Metric / Index</th>
                    <th>Score</th>
                    <th>Interpretation Band</th>
                  </tr>
                </thead>
                <tbody>
                  {result.metrics.map((m) => (
                    <tr key={m.name}>
                      <td>{m.name}</td>
                      <td className="rpt-mono">{m.value.toFixed(2)}</td>
                      <td>acoustic-phonetic</td>
                    </tr>
                  ))}
                  <tr className="rpt-highlight-row">
                    <td>
                      <b>Composite Forensic Index</b>
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
                <b>Decision Support Statement:</b> {result.verdictBand}. State only what the acoustic examination supports.
              </div>
            </>
          ) : (
            <div className="rpt-alert">Comparison module was not run for this exhibit.</div>
          )}
        </Section>

        <Section num="6" title={`Original Transcript (${transcript.originalLanguageLabel || 'Source'})`}>
          <p className="rpt-para muted-line">
            Speaker-aligned Whisper draft · Original language
          </p>
          <SegLines segments={transcript.segments} />
        </Section>

        <Section num="7" title={`Translation (${applied.label})`}>
          {applied.note && <p className="rpt-para muted-line">{applied.note}</p>}
          <SegLines segments={applied.segments} />
        </Section>

        <Section num="8" title="Forensic Limitations & Technical Notes">
          <ul className="rpt-bullets">
            {REPORT_META.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Section>

        <Section num="9" title="Examiner Review & Conclusion">
          <div className="rpt-kv-grid">
            <div className="rpt-kv">
              <span className="rpt-kv-key">Examiner name</span>
              <span className="rpt-kv-val">{examinerName}</span>
            </div>
            <div className="rpt-kv">
              <span className="rpt-kv-key">Certification status</span>
              <span className="rpt-kv-val">{approved ? 'Certified & Signed' : 'Awaiting Sign-off'}</span>
            </div>
            <div className="rpt-kv" style={{ gridColumn: '1 / -1' }}>
              <span className="rpt-kv-key">Examiner conclusion</span>
              <span className="rpt-kv-val">{conclusionText}</span>
            </div>
          </div>

          {/* Examiner approval form (visible in review phase) */}
          <div className="approval-form no-print">
            <p className="label-strong small">
              <Award size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              Certified Examiner Approval Gate (Required for Court Certificate)
            </p>
            <label className="field">
              <span className="field-label">Examiner Full Name & Title</span>
              <input
                className="input"
                value={examinerName}
                onChange={(e) => setExaminerName(e.target.value)}
                placeholder="Dr. Full Name, Certified Forensic Audio Examiner"
              />
            </label>
            <label className="field">
              <span className="field-label">Conservative Forensic Conclusion</span>
              <textarea
                className="input"
                rows={3}
                value={conclusionText}
                onChange={(e) => setConclusionText(e.target.value)}
                placeholder="Enter conservative, legally admissible conclusion..."
              />
            </label>
            <div className="btn-row">
              <button
                className="btn btn-primary"
                onClick={handleApprove}
                disabled={submittingApproval}
              >
                {submittingApproval ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />}
                {approved ? 'Update Approval & Certificate' : 'Approve & Certify Report (Section 65B / 63 BSA)'}
              </button>
            </div>
          </div>
        </Section>

        {/* Section 10: Section 65B Indian Evidence Act / Section 63 BSA 2023 */}
        <Section num="10" title="Certificate under Section 65B Indian Evidence Act / Section 63 BSA 2023">
          <div className="court-cert-box">
            <div className="court-cert-title">
              <Award size={16} /> Certificate of Electronic Record Admissibility
            </div>
            <p className="rpt-para" style={{ fontSize: '11px', lineHeight: 1.6 }}>
              <b>Part-A (Hash & Integrity Verification):</b> I hereby certify that the electronic record marked as Exhibit{' '}
              <b>{evidence.ref}</b> ({evidence.name}) was hashed immediately upon receipt with SHA-256 hash value{' '}
              <span className="rpt-mono">{evidence.hash}</span>. The original record was preserved read-only without
              modification. All filtering and acoustic analysis were performed on verified working copies.
            </p>
            <p className="rpt-para" style={{ fontSize: '11px', lineHeight: 1.6 }}>
              <b>Part-B (System & Ordinary Course Certification):</b> I, <b>{examinerName}</b>, certify that this electronic
              output was produced by the automated forensic computer system during the period over which the computer was
              used regularly to store or process information in ordinary course. The system was operating properly throughout,
              and an immutable cryptographically-hashed audit log has been maintained for every operation.
            </p>
            <div className="rpt-kv-grid" style={{ marginTop: '12px' }}>
              <div className="rpt-kv">
                <span className="rpt-kv-key">Certifying Examiner</span>
                <span className="rpt-kv-val">{examinerName}</span>
              </div>
              <div className="rpt-kv">
                <span className="rpt-kv-key">Date & Seal</span>
                <span className="rpt-kv-val">{REPORT_META.generated}</span>
              </div>
            </div>
          </div>
        </Section>

        <footer className="rpt-footer">
          <p>
            Forensic Audio Examination Suite · Certified Report · {REPORT_META.generated}
          </p>
        </footer>
      </article>
    </div>
  );
}
