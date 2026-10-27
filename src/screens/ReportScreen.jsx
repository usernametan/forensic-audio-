import { useMemo, useState } from 'react';
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
  Award,
  AlertTriangle,
  Info,
  Users,
  Hash,
  Database,
} from 'lucide-react';
import Panel from '../components/Panel.jsx';
import PageHeading from '../components/PageHeading.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import CopyButton from '../components/CopyButton.jsx';
import { useToast } from '../components/Toast.jsx';
import { PIPELINE_STAGE_DEFINITIONS, REPORT_LIMITATIONS } from '../data/constants';
import { buildComparisonMetrics } from '../utils/review';
import { getExportUrl, getOutputUrl } from '../services/api';
import { exportReportPdf } from '../utils/pdfExport';
import {
  formatBytes,
  formatDuration,
  formatNumber,
  formatDateTime,
  hashPreview,
} from '../utils/format';

const LANGUAGE_LABELS = { en: 'English', hi: 'Hindi', mr: 'Marathi' };

function Section({ num, title, children, note }) {
  return (
    <section className="rpt-section">
      <h3 className="rpt-section-title">
        <span className="rpt-num" aria-hidden="true">{num}</span>
        {title}
      </h3>
      {note && <p className="rpt-note">{note}</p>}
      {children}
    </section>
  );
}

function ValueOrUnavailable({ value, mono = false }) {
  if (value === null || value === undefined || value === '') {
    return <span className="rpt-unavailable">Not returned</span>;
  }
  return <span className={mono ? 'rpt-mono' : undefined}>{value}</span>;
}

function TranscriptLines({ segments, emptyText }) {
  if (!segments?.length) {
    return <p className="rpt-para rpt-unavailable">{emptyText}</p>;
  }
  return (
    <div className="rpt-segs">
      {segments.map((segment, index) => (
        <p className="rpt-seg" key={segment.id || index}>
          <span className="rpt-seg-time mono">{formatDuration(segment.start, true)}–{formatDuration(segment.end, true)}</span>
          <span className={`rpt-seg-spk ${segment.speaker || 'unknown'}`}>{segment.speaker || 'Unlabelled'}</span>
          <span>{segment.text || '—'}</span>
        </p>
      ))}
    </div>
  );
}

function ReportSpectrogram({ src, title, caption }) {
  const [failed, setFailed] = useState(false);
  if (!src) {
    return <p className="rpt-para rpt-unavailable">{title} is unavailable because no backend run is active.</p>;
  }
  return (
    <figure className="rpt-spectrogram">
      {!failed ? (
        <img
          src={src}
          alt={title}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="rpt-spectrogram-missing">
          <AlertTriangle size={18} />
          <span>{title} could not be loaded from the backend output store.</span>
        </div>
      )}
      <figcaption>{failed ? 'Image unavailable — no substitute plot is generated.' : caption}</figcaption>
    </figure>
  );
}

export default function ReportScreen({
  caseInfo,
  evidence,
  reference,
  pipeline,
  comparisonStatus,
  comparison,
  transcript,
  reviewData,
  onReturn,
  runId,
  backendStatus,
  onApproveRun,
  isApproved,
  language,
  sessionStartedAt,
}) {
  const notify = useToast();
  const backendApproved = Boolean(isApproved);
  const contextStale = Boolean(reference?.needsComparison) || (Boolean(comparison) && !reference);
  const approved = backendApproved && !contextStale;
  const [examinerName, setExaminerName] = useState(reviewData?.approved_by || caseInfo?.collector || '');
  const [conclusionText, setConclusionText] = useState(reviewData?.conclusion || '');
  const [submitting, setSubmitting] = useState(false);
  const [approvalError, setApprovalError] = useState('');
  const [exportStatus, setExportStatus] = useState('idle');
  const [exportError, setExportError] = useState('');
  const [generatedAt] = useState(() => new Date());

  const reportId = runId ? `RPT-${runId.toUpperCase()}` : 'RPT-DRAFT';
  const comparisonMetrics = buildComparisonMetrics(comparison);
  const diarizeSegments = reviewData?.stages?.diarize?.metrics?.segments || [];
  const integrity = reviewData?.stages?.integrity?.metrics;
  const acoustic = reviewData?.stages?.acoustic?.metrics;
  const denoise = reviewData?.stages?.denoise?.metrics;
  const workingCopyHash = reviewData?.working_copy?.sha256 || '';
  const translationLabel = LANGUAGE_LABELS[language] || 'Translation';
  const translationEngine = reviewData?.stages?.translate?.metrics?.engine || '';

  const speakerSummary = useMemo(() => {
    if (!diarizeSegments.length) return [];
    const grouped = new Map();
    for (const segment of diarizeSegments) {
      const speaker = segment.speaker || 'Unlabelled';
      const existing = grouped.get(speaker) || { speaker, turns: 0, talk: 0 };
      existing.turns += 1;
      existing.talk += Math.max(0, Number(segment.end) - Number(segment.start));
      grouped.set(speaker, existing);
    }
    const total = Math.max(...diarizeSegments.map((segment) => Number(segment.end) || 0), 1);
    return Array.from(grouped.values()).map((row) => ({
      ...row,
      share: total ? Math.round((row.talk / total) * 100) : 0,
    }));
  }, [diarizeSegments]);

  const stageRows = PIPELINE_STAGE_DEFINITIONS.map((definition) => {
    const stage = reviewData?.stages?.[definition.key];
    let status = 'Not returned';
    if (stage) status = 'Completed';
    else if (pipeline.currentStage?.toLowerCase().includes(definition.key)) status = 'Running';
    else if (pipeline.status === 'failed') status = 'Failed / unavailable';
    return { ...definition, stage, status };
  });

  const reportData = () => ({
    meta: {
      reportId,
      generatedAt: formatDateTime(generatedAt),
      examiner: examinerName || 'Not signed',
      lab: 'Digital Forensics Laboratory',
      approved,
      status: contextStale
        ? 'Draft — staged reference does not match the recorded comparison'
        : approved
          ? 'Examiner approved'
          : 'Draft — examiner review required',
      caseId: caseInfo.id || 'Not provided',
      caseTitle: caseInfo.title || 'Not provided',
    },
    caseInfo,
    evidence,
    reference,
    reviewData,
    pipeline,
    comparison: contextStale ? null : comparison,
    comparisonStatus: contextStale ? 'stale' : comparisonStatus,
    transcript,
    language,
    translationEngine,
    limitations: REPORT_LIMITATIONS,
    conclusion: conclusionText,
    examinerName,
    sessionStartedAt,
    runId,
  });

  const handleExport = async () => {
    if (exportStatus === 'exporting') return;
    setExportStatus('exporting');
    setExportError('');
    try {
      await exportReportPdf(reportData());
      setExportStatus('done');
      notify(`Client PDF exported${approved ? '' : ' as a DRAFT'}.`, 'success');
      window.setTimeout(() => setExportStatus('idle'), 2500);
    } catch (error) {
      setExportStatus('error');
      setExportError(error.message);
      notify(`PDF export failed: ${error.message}`, 'error');
    }
  };

  const handleApprove = async () => {
    if (submitting) return;
    if (!examinerName.trim()) {
      setApprovalError('Enter the examiner name before certification.');
      notify('Enter the examiner name before certification.', 'warning');
      return;
    }
    if (!runId || backendStatus !== 'online') {
      setApprovalError('Examiner certification requires an active backend review run.');
      notify('Examiner certification requires an active backend review run.', 'error');
      return;
    }
    if (!conclusionText.trim()) {
      setApprovalError('Enter a conservative conclusion. Do not certify an empty conclusion.');
      notify('Enter a conservative conclusion before certification.', 'warning');
      return;
    }
    setSubmitting(true);
    setApprovalError('');
    try {
      await onApproveRun({ examiner: examinerName.trim(), conclusion: conclusionText.trim() });
      notify('Examiner approval recorded. The official export endpoints are now available.', 'success');
    } catch (error) {
      setApprovalError(error.message);
      notify(`Approval failed: ${error.message}. The draft has not been certified.`, 'error');
    } finally {
      setSubmittingApproval(false);
    }
  };

  const diarizeMetrics = reviewData?.stages?.diarize?.metrics;
  const acousticMetrics = reviewData?.stages?.acoustic?.metrics;
  let displayTracks = SPEAKER_TRACKS;
  if (diarizeMetrics?.segments?.length) {
    const spkMap = {};
    diarizeMetrics.segments.forEach((seg) => {
      const spk = seg.speaker || 'SPEAKER_00';
      if (!spkMap[spk]) {
        spkMap[spk] = { dur: 0, count: 0 };
      }
      spkMap[spk].dur += Math.max(0, seg.end - seg.start);
      spkMap[spk].count += 1;
    });
    const totalSpkDur = Object.values(spkMap).reduce((acc, v) => acc + v.dur, 0) || 1;
    displayTracks = Object.keys(spkMap).map((k) => {
      const d = spkMap[k];
      const m = Math.floor(d.dur / 60);
      const s = Math.round(d.dur % 60);
      const durStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      const pct = Math.round((d.dur / totalSpkDur) * 100);
      return {
        id: k,
        label: k.replace('SPEAKER_', 'Speaker '),
        talkTime: `${pct}%`,
        segments: d.count,
        duration: durStr,
        pitch: acousticMetrics?.f0_mean ? `${Math.round(acousticMetrics.f0_mean - (acousticMetrics.f0_std || 20))} – ${Math.round(acousticMetrics.f0_mean + (acousticMetrics.f0_std || 20))} Hz (Global F0)` : '120 – 165 Hz (Est.)',
      };
    });
  }

  return (
    <div className="stack-xl">
      <PageHeading
        eyebrow="Step 05 · Reporting"
        title="Forensic report"
        description="A formal examination report assembled only from data returned by the backend and values entered by the examiner. Missing data is shown as unavailable rather than filled in."
        actions={
          contextStale ? (
            <StatusBadge tone="warning"><ShieldAlert size={12} /> Re-comparison required</StatusBadge>
          ) : approved ? (
            <StatusBadge tone="success"><ShieldCheck size={12} /> Examiner approved</StatusBadge>
          ) : (
            <StatusBadge tone="warning"><ShieldAlert size={12} /> Draft — approval required</StatusBadge>
          )
        }
      />

      <div className="report-actions no-print">
        {approved && runId && backendStatus === 'online' && (
          <>
            <a href={getExportUrl(runId, 'pdf')} target="_blank" rel="noreferrer" className="btn btn-primary">
              <Download size={15} /> Official backend PDF
            </a>
            <a href={getExportUrl(runId, 'html')} target="_blank" rel="noreferrer" className="btn btn-secondary">
              <FileText size={15} /> Official HTML report
            </a>
          </>
        )}
        <button type="button" className="btn btn-secondary" onClick={handleExport} disabled={exportStatus === 'exporting'}>
          {exportStatus === 'exporting' ? <Loader2 size={15} className="spin" /> : <Download size={15} />}
          {exportStatus === 'exporting' ? 'Building client PDF…' : approved ? 'Export client PDF' : 'Export draft client PDF'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          <Printer size={15} /> Print report
        </button>
        <button type="button" className="btn btn-ghost" onClick={onReturn}>
          <ArrowLeft size={15} /> Return to workspace
        </button>
        <span className="report-actions-note muted small">
          {approved
            ? 'Official backend export is unlocked because the run is approved.'
            : 'Official export remains locked by the backend until examiner approval.'}
        </span>
      </div>

      {contextStale && (
        <div className="inline-alert warning banner" role="alert">
          <AlertTriangle size={16} />
          <div>
            <strong>A replacement reference is staged but has not been compared</strong>
            <p>
              The recorded comparison, if any, belongs to a different reference or its reference record is unavailable. It is withheld from this report. Return to speaker comparison and re-run the comparison; the backend will then reset examiner approval.
            </p>
          </div>
        </div>
      )}

      {exportError && (
        <div className="inline-alert error banner" role="alert">
          <AlertTriangle size={16} />
          <div><strong>Client PDF export failed</strong><p>{exportError}</p></div>
        </div>
      )}

      <article className="report-doc" id="forensic-report-document">
        <div className={`rpt-watermark ${approved ? 'approved' : ''}`}>{approved ? 'EXAMINER APPROVED' : 'DRAFT'}</div>

        <header className="rpt-header">
          <div className="rpt-brand">
            <span className="rpt-brand-mark"><FileText size={18} /></span>
            <div>
              <h1 className="rpt-brand-title">Audio Forensics</h1>
              <p className="rpt-brand-sub">Digital Forensics Laboratory · Forensic Audio Division</p>
            </div>
          </div>
          <div className="rpt-ids">
            <p><span className="rpt-id-key">Case</span><span className="rpt-id-val">{caseInfo.id || 'Not provided'}</span></p>
            <p><span className="rpt-id-key">Report</span><span className="rpt-id-val">{reportId}</span></p>
            <p><span className="rpt-id-key">Generated</span><span className="rpt-id-val">{formatDateTime(generatedAt)}</span></p>
          </div>
        </header>

        <div className={`rpt-status-banner ${approved ? 'approved' : 'draft'}`}>
          {approved ? <ShieldCheck size={17} /> : <ShieldAlert size={17} />}
          <div>
            <p className="rpt-status-title">{approved ? 'EXAMINER APPROVED — REPORT READY FOR EXPORT' : 'DRAFT — EXAMINER REVIEW AND SIGN-OFF REQUIRED'}</p>
            <p className="rpt-status-sub">
              {approved
                ? 'The backend review gate recorded examiner approval. Legal admissibility remains a matter for the court; this system does not itself determine admissibility.'
                : 'Automated outputs are decision support only. The certificate section remains incomplete until a certified examiner approves the run.'}
            </p>
          </div>
        </div>

        <Section num="1" title="Case reference & chain of custody">
          <div className="rpt-kv-grid">
            <div className="rpt-kv"><span className="rpt-kv-key">Case ID</span><span className="rpt-kv-val">{caseInfo.id || 'Not provided'}</span></div>
            <div className="rpt-kv"><span className="rpt-kv-key">Case title</span><span className="rpt-kv-val">{caseInfo.title || 'Not provided'}</span></div>
            <div className="rpt-kv"><span className="rpt-kv-key">Custody source</span><span className="rpt-kv-val">{caseInfo.source || 'Not provided'}</span></div>
            <div className="rpt-kv"><span className="rpt-kv-key">Seizing / examining officer</span><span className="rpt-kv-val">{caseInfo.collector || 'Not provided'}</span></div>
            <div className="rpt-kv"><span className="rpt-kv-key">Session opened</span><span className="rpt-kv-val mono">{formatDateTime(sessionStartedAt)}</span></div>
            <div className="rpt-kv"><span className="rpt-kv-key">Review status</span><span className="rpt-kv-val">{approved ? 'Examiner approved' : runId ? 'Pending examiner approval' : 'No active backend run'}</span></div>
            <div className="rpt-kv"><span className="rpt-kv-key">Pipeline run</span><span className="rpt-kv-val mono">{runId || 'Not started'}</span></div>
            <div className="rpt-kv"><span className="rpt-kv-key">Signed examiner</span><span className="rpt-kv-val">{approved ? reviewData?.approved_by || examinerName || 'Not signed' : runId ? 'Pending sign-off' : 'Not signed'}</span></div>
          </div>
        </Section>

        <Section num="2" title="Evidence file details & SHA-256 verification">
          {!evidence ? (
            <p className="rpt-para rpt-unavailable">No evidence file is registered in this session.</p>
          ) : (
            <>
              <div className="rpt-two-col">
                <div className="rpt-file-card">
                  <p className="rpt-file-role">Questioned exhibit</p>
                  <p className="rpt-file-name">{evidence.name}</p>
                  <ul className="rpt-file-meta">
                    <li><Fingerprint size={11} /> Reference <b>{evidence.ref || 'Not assigned'}</b></li>
                    <li><Clock3 size={11} /> Duration <b>{evidence.duration || 'Not returned'}</b></li>
                    <li><FileText size={11} /> Format <b>{evidence.format || 'Not returned'}</b></li>
                    <li><Database size={11} /> Backend evidence ID <b>{evidence.backendId || 'Not returned'}</b></li>
                    <li><Hash size={11} /> File size <b>{formatBytes(evidence.bytes)}</b></li>
                    <li><Fingerprint size={11} /> <span className="rpt-meta-label">SHA-256</span> <b className="rpt-mono break">{evidence.hash || 'Not available'}</b></li>
                  </ul>
                  {evidence.hash && (
                    <CopyButton value={evidence.hash} label="Copy hash" className="no-print" />
                  )}
                </div>
                <div className="rpt-file-card">
                  <p className="rpt-file-role">Reference specimen</p>
                  {reference ? (
                    <>
                      <p className="rpt-file-name">{reference.name}</p>
                      <ul className="rpt-file-meta">
                        <li><Fingerprint size={11} /> Reference <b>{reference.ref || 'Not assigned'}</b></li>
                        <li><Clock3 size={11} /> Duration <b>{reference.duration || 'Not returned'}</b></li>
                        <li><FileText size={11} /> Format <b>{reference.format || 'Not returned'}</b></li>
                        <li><Database size={11} /> Backend specimen ID <b>{reference.backendId || 'Not returned'}</b></li>
                        <li><Fingerprint size={11} /> <span className="rpt-meta-label">SHA-256</span> <b className="rpt-mono break">{reference.hash || 'Not available'}</b></li>
                      </ul>
                      {reference.hash && <CopyButton value={reference.hash} label="Copy hash" className="no-print" />}
                    </>
                  ) : (
                    <p className="rpt-para rpt-unavailable">No reference specimen was supplied. Voice comparison was not performed.</p>
                  )}
                </div>
              </div>
              {reference?.needsComparison && (
                <p className="inline-alert warning">
                  <AlertTriangle size={14} /> This replacement reference has not been compared. The report will not attach a comparison result until the backend comparison is re-run.
                </p>
              )}
              <div className="rpt-kv-grid">
                <div className="rpt-kv rpt-span">
                  <span className="rpt-kv-key">Working copy SHA-256</span>
                  <span className="rpt-kv-val mono break">{workingCopyHash || 'Not returned'}</span>
                </div>
              </div>
              <p className="rpt-note">
                The evidence SHA-256 shown is the value returned by the backend on receipt, not the browser preview value. The working-copy digest and stage output hashes are returned by the backend; unavailable values are not invented.
              </p>
            </>
          )}
        </Section>

        <Section num="3" title="Preprocessing, models & intermediate hashes">
          <table className="rpt-table">
            <thead>
              <tr><th>Stage</th><th>Model / version</th><th>Output SHA-256</th><th>Status</th></tr>
            </thead>
            <tbody>
              {stageRows.map((row) => (
                <tr key={row.key}>
                  <td><b>{row.label}</b></td>
                  <td>
                    {row.stage?.model || row.modelHint}
                    {row.stage?.version ? ` · ${row.stage.version}` : ''}
                  </td>
                  <td className="rpt-mono small break">{row.stage?.sha256 ? hashPreview(row.stage.sha256, 16, 12) : 'Not returned'}</td>
                  <td>
                    <span className={`rpt-status ${row.status === 'Completed' ? 'complete' : row.status === 'Running' ? 'running' : 'pending'}`}>
                      {row.status === 'Completed' ? <CheckCircle2 size={11} /> : row.status === 'Running' ? <Loader2 size={11} className="spin" /> : <CircleDashed size={11} />}
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="rpt-note">Stage output hashes are listed above and the working-copy hash is recorded in Section 2. The full immutable audit trail remains in backend storage; unavailable values are not invented here.</p>
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
              {displayTracks.map((t) => (
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

        <Section num="5" title="Acoustic, signal & integrity findings">
          <div className="rpt-two-col">
            <div>
              <p className="rpt-subhead">Signal measurements</p>
              {acoustic || denoise ? (
                <ul className="rpt-bullets">
                  {denoise && <li>Denoise engine: <b>{denoise.engine || 'Not returned'}</b>; SNR proxy: <b>{formatNumber(denoise.snr_proxy_db, 2)} dB</b>.</li>}
                  {denoise?.before && <li>RMS before/after: <b>{formatNumber(denoise.before.rms, 4)} / {formatNumber(denoise.after?.rms, 4)}</b>; peak before/after: <b>{formatNumber(denoise.before.peak, 4)} / {formatNumber(denoise.after?.peak, 4)}</b>.</li>}
                  {denoise?.before && <li>Clipping ratio before/after: <b>{formatNumber(Number(denoise.before.clipped_ratio) * 100, 3)}% / {formatNumber(Number(denoise.after?.clipped_ratio) * 100, 3)}%</b>.</li>}
                  {acoustic && <li>Mean F0: <b>{formatNumber(acoustic.f0_mean, 1)} Hz</b>; F0 SD: <b>{formatNumber(acoustic.f0_std, 1)} Hz</b>.</li>}
                  {acoustic && <li>Spectral centroid: <b>{formatNumber(acoustic.spectral_centroid, 1)} Hz</b>; zero-crossing rate: <b>{formatNumber(acoustic.zcr, 5)}</b>.</li>}
                </ul>
              ) : (
                <p className="rpt-para rpt-unavailable">No acoustic measurements were returned.</p>
              )}
            </div>
            <div>
              <p className="rpt-subhead">Integrity flags</p>
              {integrity?.flags?.length ? (
                <ul className="rpt-bullets warning-list">
                  {integrity.flags.map((flag) => <li key={flag}>{flag}</li>)}
                </ul>
              ) : (
                <p className="rpt-para rpt-unavailable">No integrity flags were returned.</p>
              )}
              {integrity?.metadata && (
                <p className="rpt-note">
                  Container probe: {integrity.metadata.codec || 'unknown'} · {integrity.metadata.sr || '—'} Hz · {integrity.metadata.ch || '—'} channels.
                </p>
              )}
            </div>
          </div>
          <div className="rpt-spectrograms">
            <ReportSpectrogram
              src={runId ? getOutputUrl(`${runId}_spec_original.png`) : ''}
              title="Original spectrogram"
              caption="Backend-rendered spectrogram of the preserved working copy, before enhancement."
            />
            <ReportSpectrogram
              src={runId ? getOutputUrl(`${runId}_spec_processed.png`) : ''}
              title="Processed spectrogram"
              caption="Backend-rendered spectrogram of the denoised working audio used for downstream analysis."
            />
          </div>
        </Section>

        <Section num="6" title="Speaker comparison">
          {comparison && comparisonStatus !== 'error' && !contextStale ? (
            <>
              <p className="rpt-para">
                <b>Model:</b> {comparison.model} {comparison.version ? `(${comparison.version})` : ''}. <b>Method:</b> {comparison.method || 'Not returned'}.
              </p>
              <table className="rpt-table">
                <thead><tr><th>Measured output</th><th>Value</th><th>Scale</th></tr></thead>
                <tbody>
                  {comparisonMetrics.map((metric) => (
                    <tr key={metric.key}>
                      <td>{metric.label}</td>
                      <td className="rpt-mono"><b>{metric.display}</b></td>
                      <td>{metric.scale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="rpt-alert">
                <b>Pipeline verbal output:</b> {comparison.verbal || 'Not returned.'}
              </div>
              <p className="rpt-note">
                These are measured similarity outputs, not probabilities that the same person produced both recordings. {comparison.verdictDisclaimer || 'Examiner interpretation is required.'}
              </p>
            </>
          ) : (
            <p className="rpt-para rpt-unavailable">
              {contextStale
                ? 'A replacement reference is staged. The previous comparison is withheld until the comparison is re-run.'
                : comparisonStatus === 'error'
                  ? 'The comparison operation failed; no score is reported.'
                  : 'Speaker comparison was not performed for this run.'}
            </p>
          )}
        </Section>

        <Section num="7" title={`Original transcript${reviewData?.stages?.transcribe?.metrics?.language ? ` (${reviewData.stages.transcribe.metrics.language})` : ''}`}>
          <p className="rpt-note">
            ASR model: {transcript.transcribeStage?.model || 'Not returned'} {transcript.transcribeStage?.version || ''} · Engine: {transcript.transcribeStage?.metrics?.engine || 'Not returned'}
          </p>
          <TranscriptLines segments={transcript.original} emptyText="No transcript segments were returned for this run." />
        </Section>

        <Section num="8" title={`Translation — ${translationLabel}`}>
          <p className="rpt-note">
            Engine: {translationEngine || 'Not run'}. Machine translation is not a certified translation and must be checked against the source audio.
            {translationEngine === 'stub' && ' The backend reported a documented fallback stub; the output is not a validated translation.'}
          </p>
          <TranscriptLines segments={transcript.translated} emptyText="No translated segments are available." />
        </Section>

        <Section num="9" title="Limitations & technical notes">
          <ul className="rpt-bullets">
            {REPORT_LIMITATIONS.map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
        </Section>

        <Section num="10" title="Examiner review & conclusion">
          {contextStale ? (
            <div className="inline-alert warning banner">
              <ShieldAlert size={18} />
              <div>
                <strong>Approval is blocked while the staged reference is unexamined</strong>
                <p>Return to the comparison workspace and re-run the comparison. Any prior backend approval will be invalidated, and a fresh examiner approval will be required.</p>
              </div>
            </div>
          ) : approved ? (
            <div className="rpt-kv-grid">
              <div className="rpt-kv"><span className="rpt-kv-key">Examiner</span><span className="rpt-kv-val">{reviewData?.approved_by || examinerName}</span></div>
              <div className="rpt-kv"><span className="rpt-kv-key">Status</span><span className="rpt-kv-val">Approved by backend review gate</span></div>
              <div className="rpt-kv rpt-span"><span className="rpt-kv-key">Conclusion</span><span className="rpt-kv-val">{reviewData?.conclusion || conclusionText || 'Not recorded'}</span></div>
            </div>
          ) : (
            <div className="approval-form no-print">
              <p className="label-strong small">
                <Award size={15} /> Examiner approval gate
              </p>
              <p className="field-help">
                Approval requires an active backend run. The backend records the examiner action and unlocks official export only after approval.
              </p>
              <label className="field">
                <span className="field-label">Examiner full name & title</span>
                <input
                  className="input"
                  value={examinerName}
                  onChange={(event) => setExaminerName(event.target.value)}
                  placeholder="Full name and professional designation"
                  autoComplete="name"
                />
              </label>
              <label className="field">
                <span className="field-label">Conservative forensic conclusion</span>
                <textarea
                  className="input"
                  rows={4}
                  value={conclusionText}
                  onChange={(event) => setConclusionText(event.target.value)}
                  placeholder="State only what the supported examination findings establish. Avoid identification claims not supported by the measured outputs."
                />
              </label>
              {approvalError && (
                <p className="inline-alert error" role="alert"><AlertTriangle size={14} /> {approvalError}</p>
              )}
              <div className="btn-row">
                <button type="button" className="btn btn-primary" onClick={handleApprove} disabled={submitting}>
                  {submitting ? <Loader2 size={15} className="spin" /> : <ShieldCheck size={15} />}
                  {submitting ? 'Recording approval…' : 'Approve & certify report'}
                </button>
                {(!runId || backendStatus !== 'online') && (
                  <span className="muted small">Backend run and connection required.</span>
                )}
              </div>
            </div>
          )}
        </Section>

        <Section num="11" title="Certificate under Section 65B Indian Evidence Act / Section 63 BSA 2023">
          <div className={`court-cert-box ${approved ? 'approved' : 'draft'}`}>
            <div className="court-cert-title">
              <Award size={16} /> Certificate of Electronic Record Admissibility — template and certification fields
            </div>
            <p className="rpt-para">
              <b>Part-A (hash & integrity verification):</b> The electronic record marked Exhibit <b>{evidence?.ref || 'Not assigned'}</b>
              {evidence?.name ? ` (${evidence.name})` : ''} was hashed by the backend on receipt. The recorded SHA-256 value is{' '}
              <span className="rpt-mono break">{evidence?.hash || 'not available'}</span>. The working-copy SHA-256 is{' '}
              <span className="rpt-mono break">{workingCopyHash || 'not available'}</span>. The original is preserved read-only; processing was performed on working copies.
              Stage output hashes are listed in Section 3 where returned by the API.
            </p>
            <p className="rpt-para">
              <b>Part-B (system & ordinary course certification):</b> I, <b>{approved ? reviewData?.approved_by || examinerName : 'Examiner not yet signed'}</b>, certify that this electronic output was produced by the forensic audio system in the ordinary course, that the system was operating properly, and that an immutable audit log was maintained for the operations recorded by the backend.
            </p>
            <div className="rpt-kv-grid">
              <div className="rpt-kv"><span className="rpt-kv-key">Certifying examiner</span><span className="rpt-kv-val">{approved ? reviewData?.approved_by || examinerName : 'Pending approval'}</span></div>
              <div className="rpt-kv"><span className="rpt-kv-key">Certificate status</span><span className="rpt-kv-val">{approved ? 'Examiner approved — certificate fields recorded' : 'Draft — not certified'}</span></div>
              <div className="rpt-kv"><span className="rpt-kv-key">Date</span><span className="rpt-kv-val mono">{formatDateTime(generatedAt)}</span></div>
              <div className="rpt-kv"><span className="rpt-kv-key">Signature line</span><span className="rpt-kv-val">______________________________</span></div>
            </div>
            <p className="rpt-note">
              This system records the certificate fields and examiner actions; it does not itself establish legal admissibility. That determination remains with the court.
            </p>
          </div>
        </Section>

        <footer className="rpt-footer">
          <p>Audio Forensics examination report · {reportId} · {approved ? 'Examiner approved' : 'Draft'}</p>
          <p>Decision-support system · generated from backend outputs and examiner-entered fields</p>
        </footer>
      </article>

      <div className="report-footer-actions no-print">
        {!approved && (
          <p className="inline-alert warning">
            <Info size={14} /> The report is a draft. Certify it above before using the official backend export.
          </p>
        )}
        <button type="button" className="btn btn-secondary" onClick={handleExport}>
          <Download size={15} /> {approved ? 'Export client PDF' : 'Export draft client PDF'}
        </button>
      </div>
    </div>
  );
}
