import { useRef, useState } from 'react';
import {
  ShieldCheck,
  Clock3,
  Fingerprint,
  CalendarClock,
  CalendarDays,
  MapPin,
  UserRound,
  HardDrive,
  FileAudio,
  FileText,
  ClipboardList,
  Mic2,
  ChevronRight,
  Radio,
  Database,
  Hash,
  AlertTriangle,
  RefreshCw,
  PlayCircle,
} from 'lucide-react';
import Panel from '../components/Panel.jsx';
import PageHeading from '../components/PageHeading.jsx';
import FileDropzone from '../components/FileDropzone.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import AudioWaveform from '../components/AudioWaveform.jsx';
import CopyButton from '../components/CopyButton.jsx';
import MetaList from '../components/MetaList.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useToast } from '../components/Toast.jsx';
import { computeSHA256 } from '../services/api';
import { decodeAudioSource } from '../utils/audioAnalysis';
import { validateAudioFile, formatFileType } from '../utils/files';
import {
  formatBytes,
  formatChannels,
  formatDateTime,
  formatDuration,
  formatSampleRate,
  hashPreview,
} from '../utils/format';

function makeLocalRecord(file) {
  return {
    ref: 'Pending backend ID',
    name: file.name,
    file,
    sizeMB: file.size / (1024 * 1024),
    bytes: file.size,
    format: formatFileType(file),
    duration: '—',
    durationSeconds: 0,
    sampleRate: '—',
    sampleRateHz: 0,
    channels: '—',
    channelCount: 0,
    hash: '',
    hashStatus: 'hashing',
    backendVerified: false,
    captured: formatDateTime(new Date()),
    source: 'Browser-selected exhibit',
    uploadStatus: 'staged',
  };
}

export default function DashboardScreen({
  caseInfo,
  setCaseInfo,
  evidence,
  setEvidence,
  reference,
  setReference,
  onBegin,
  backendStatus,
  sessionStartedAt,
  runId,
}) {
  const [starting, setStarting] = useState(false);
  const [fileError, setFileError] = useState('');
  const notify = useToast();
  const evidenceToken = useRef(0);
  const referenceToken = useRef(0);

  const handleEvidenceFile = async (file) => {
    const validationError = validateAudioFile(file);
    if (validationError) {
      setFileError(validationError);
      notify(validationError, 'error');
      return;
    }
    setFileError('');
    const token = ++evidenceToken.current;
    const record = makeLocalRecord(file);
    setEvidence(record);

    try {
      const hash = await computeSHA256(file);
      if (token !== evidenceToken.current) return;
      setEvidence((previous) =>
        previous ? { ...previous, hash, hashStatus: 'ready', ref: `LOCAL-${hash.slice(0, 6).toUpperCase()}` } : previous
      );
    } catch (error) {
      if (token !== evidenceToken.current) return;
      setEvidence((previous) =>
        previous ? { ...previous, hashStatus: 'error', hashError: error.message } : previous
      );
      notify('The browser could not compute a SHA-256 fingerprint for this file.', 'warning');
    }

    try {
      const buffer = await decodeAudioSource({ file });
      if (token !== evidenceToken.current) return;
      setEvidence((previous) =>
        previous
          ? {
              ...previous,
              duration: formatDuration(buffer.duration),
              durationSeconds: buffer.duration,
              sampleRate: formatSampleRate(buffer.sampleRate),
              sampleRateHz: buffer.sampleRate,
              channels: formatChannels(buffer.numberOfChannels),
              channelCount: buffer.numberOfChannels,
            }
          : previous
      );
    } catch {
      if (token !== evidenceToken.current) return;
      setEvidence((previous) =>
        previous ? { ...previous, decodeWarning: 'Audio metadata could not be decoded in this browser.' } : previous
      );
    }
  };

  const handleRemoveEvidence = () => {
    evidenceToken.current += 1;
    setEvidence(null);
    setFileError('');
    notify('Staged exhibit removed. No analysis run was started.', 'info');
  };

  const handleReferenceFile = async (file) => {
    const validationError = validateAudioFile(file);
    if (validationError) {
      notify(`Reference specimen rejected: ${validationError}`, 'error');
      return;
    }
    const token = ++referenceToken.current;
    const record = {
      ...makeLocalRecord(file),
      ref: 'Pending reference ID',
      origin: 'Examiner-selected reference specimen',
    };
    setReference(record);
    try {
      const hash = await computeSHA256(file);
      if (token !== referenceToken.current) return;
      setReference((previous) =>
        previous ? { ...previous, hash, hashStatus: 'ready', ref: `REF-${hash.slice(0, 6).toUpperCase()}` } : previous
      );
    } catch {
      if (token !== referenceToken.current) return;
      setReference((previous) => (previous ? { ...previous, hashStatus: 'error' } : previous));
    }
    try {
      const buffer = await decodeAudioSource({ file });
      if (token !== referenceToken.current) return;
      setReference((previous) =>
        previous
          ? {
              ...previous,
              duration: formatDuration(buffer.duration),
              durationSeconds: buffer.duration,
              sampleRate: formatSampleRate(buffer.sampleRate),
              sampleRateHz: buffer.sampleRate,
              channels: formatChannels(buffer.numberOfChannels),
              channelCount: buffer.numberOfChannels,
            }
          : previous
      );
    } catch {
      // The backend will still probe the reference after upload.
    }
  };

  const handleRemoveReference = () => {
    setReference(null);
    notify('Reference specimen removed.', 'info');
  };

  const begin = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await onBegin();
    } finally {
      setStarting(false);
    }
  };

  const canBegin = Boolean(evidence?.file) && evidence?.hashStatus !== 'hashing' && backendStatus === 'online' && !starting;
  const beginLabel = runId ? 'Open existing analysis' : starting ? 'Uploading & queueing…' : 'Begin analysis';

  return (
    <div className="stack-xl">
      <PageHeading
        eyebrow="Step 01 · Evidence intake"
        title="Case workspace"
        description="Register the examination reference, stage the questioned exhibit, and lock it into the analysis pipeline. The browser computes a provisional SHA-256 before the backend re-hashes the file on receipt."
        actions={
          <>
            <StatusBadge tone={backendStatus === 'online' ? 'success' : backendStatus === 'checking' ? 'warning' : 'danger'}>
              <Database size={12} /> {backendStatus === 'online' ? 'Analysis service online' : backendStatus === 'checking' ? 'Checking service' : 'Analysis service offline'}
            </StatusBadge>
            <StatusBadge tone="neutral" dot={false}>
              <Radio size={12} /> Local session
            </StatusBadge>
          </>
        }
      />

      <div className="dashboard-grid">
        <Panel
          icon={<FileText size={17} />}
          title="Case registration"
          subtitle="References recorded on the examination report. Fields left blank are shown as not provided."
        >
          <div className="field-grid">
            <label className="field">
              <span className="field-label"><Hash size={13} /> Case ID</span>
              <input
                className="input mono"
                value={caseInfo.id}
                onChange={(event) => setCaseInfo((current) => ({ ...current, id: event.target.value }))}
                placeholder="e.g. CEP-2026-AF-0000"
                autoComplete="off"
              />
              <span className="field-help">Used as the report reference and in the audit questionnaire.</span>
            </label>
            <label className="field">
              <span className="field-label"><CalendarDays size={13} /> Case title</span>
              <input
                className="input"
                value={caseInfo.title}
                onChange={(event) => setCaseInfo((current) => ({ ...current, title: event.target.value }))}
                placeholder="Short examination description"
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span className="field-label"><MapPin size={13} /> Source / custody origin</span>
              <input
                className="input"
                value={caseInfo.source}
                onChange={(event) => setCaseInfo((current) => ({ ...current, source: event.target.value }))}
                placeholder="Police station, court exhibit, agency or laboratory"
                autoComplete="off"
              />
            </label>
            <label className="field">
              <span className="field-label"><UserRound size={13} /> Seizing officer / examining officer</span>
              <input
                className="input"
                value={caseInfo.collector}
                onChange={(event) => setCaseInfo((current) => ({ ...current, collector: event.target.value }))}
                placeholder="Name and designation"
                autoComplete="off"
              />
            </label>
          </div>

          <MetaList
            compact
            columns={2}
            items={[
              { label: 'Session opened', value: formatDateTime(sessionStartedAt), icon: <Clock3 size={13} />, mono: true },
              {
                label: 'Custody verification',
                value: backendStatus === 'online' ? 'Available on upload' : 'Requires backend',
                icon: <ShieldCheck size={13} />,
              },
              {
                label: 'Exhibit count',
                value: `${evidence ? '1 questioned' : '0 questioned'} · ${reference ? '1 reference' : '0 reference'}`,
                icon: <FileAudio size={13} />,
              },
              {
                label: 'Active run',
                value: runId || 'Not started',
                icon: <PlayCircle size={13} />,
                mono: true,
              },
            ]}
          />
        </Panel>

        <Panel
          icon={<FileAudio size={17} />}
          title="Questioned exhibit"
          subtitle="Drag and drop or browse. Accepted formats match the backend upload validation."
          actions={
            evidence ? (
              <StatusBadge tone={evidence.backendVerified ? 'success' : evidence.hashStatus === 'error' ? 'warning' : 'info'}>
                {evidence.backendVerified ? 'Backend verified' : evidence.hashStatus === 'hashing' ? 'Hashing locally' : 'Staged locally'}
              </StatusBadge>
            ) : (
              <StatusBadge tone="neutral">No file staged</StatusBadge>
            )
          }
        >
          <FileDropzone
            id="evidence-file"
            label="Drop the questioned audio evidence here"
            description="or click to browse · WAV / MP3 / FLAC / OGG / M4A · up to 500 MB"
            file={evidence?.file || (evidence ? { name: evidence.name, size: evidence.bytes || 0 } : null)}
            onFile={handleEvidenceFile}
            onRemove={handleRemoveEvidence}
            busy={evidence?.hashStatus === 'hashing'}
            busyLabel={`Fingerprinting ${evidence?.name || 'file'}…`}
            disabled={starting}
            help="The original file is never modified. The backend stores a read-only original and creates a separate working copy."
          />
          {fileError && (
            <p className="inline-alert error" role="alert">
              <AlertTriangle size={14} /> {fileError}
            </p>
          )}
          {evidence?.uploadStatus === 'error' && (
            <p className="inline-alert error" role="alert">
              <AlertTriangle size={14} /> The last upload attempt did not complete. The staged file and case fields are preserved; review the service status and retry analysis.
            </p>
          )}
          {evidence?.uploadStatus === 'uploaded' && (
            <p className="inline-alert success">
              <ShieldCheck size={14} /> Officer upload confirmed. Evidence ID {evidence.backendId || evidence.ref} is now held in the backend custody record.
            </p>
          )}
          {evidence?.decodeWarning && (
            <p className="inline-alert warning">
              <AlertTriangle size={14} /> {evidence.decodeWarning} The backend probe will provide authoritative metadata after upload.
            </p>
          )}
        </Panel>
      </div>

      <div className="dashboard-register-grid">
        <Panel
          icon={<ClipboardList size={17} />}
          title="Evidence register"
          subtitle="Only values actually available for the staged file are displayed. Nothing is invented to complete the record."
          actions={
            evidence ? (
              <StatusBadge tone="accent">{evidence.ref || 'Pending identifier'}</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Awaiting exhibit</StatusBadge>
            )
          }
        >
          {!evidence ? (
            <EmptyState
              icon={<FileAudio size={22} />}
              title="No evidence staged"
              compact
            >
              <p>Select a questioned audio exhibit above. A local SHA-256 and available audio metadata will be calculated immediately.</p>
              <p>Analysis cannot start until the file is staged and the backend service is online.</p>
            </EmptyState>
          ) : (
            <div className="evidence-register">
              <div className="evidence-preview">
                <AudioWaveform
                  source={evidence.file ? { file: evidence.file } : undefined}
                  color="#D49A58"
                  height={104}
                  emptyLabel="Waveform unavailable — the browser file handle is no longer available"
                  ariaLabel={`Waveform preview for ${evidence.name}`}
                />
              </div>
              <div className="evidence-heading">
                <div>
                  <p className="evidence-name">{evidence.name}</p>
                  <p className="muted small">
                    {evidence.source || 'Questioned exhibit'} · staged {evidence.captured || 'this session'}
                  </p>
                </div>
                <div className="evidence-heading-badges">
                  <StatusBadge tone={evidence.hashStatus === 'ready' || evidence.backendVerified ? 'success' : evidence.hashStatus === 'error' ? 'danger' : 'warning'} dot={false}>
                    {evidence.backendVerified ? 'SHA-256 re-verified by backend' : evidence.hashStatus === 'ready' ? 'Browser SHA-256 computed' : evidence.hashStatus === 'error' ? 'Hash failed' : 'Computing hash'}
                  </StatusBadge>
                </div>
              </div>

              <MetaList
                columns={3}
                items={[
                  { label: 'Evidence reference', value: evidence.ref || 'Pending backend ID', mono: true, icon: <Fingerprint size={13} /> },
                  { label: 'File size', value: formatBytes(evidence.bytes), mono: true, icon: <HardDrive size={13} /> },
                  { label: 'Duration', value: evidence.duration || 'Not yet available', mono: true, icon: <Clock3 size={13} /> },
                  { label: 'Format', value: evidence.format || 'Not available', icon: <FileAudio size={13} /> },
                  { label: 'Sample rate', value: evidence.sampleRate || 'Not yet available', mono: true, icon: <Radio size={13} /> },
                  { label: 'Channels', value: evidence.channels || 'Not yet available', icon: <Radio size={13} /> },
                  { label: 'Parsed locally', value: evidence.captured || '—', icon: <CalendarClock size={13} /> },
                  {
                    label: 'Backend custody record',
                    value: evidence.backendMeta ? `Evidence ID ${evidence.backendMeta.evidence_id}` : 'Created only after upload',
                    mono: Boolean(evidence.backendMeta),
                    icon: <Database size={13} />,
                  },
                ]}
              />

              <div className="hash-block">
                <div className="hash-block-head">
                  <span className="field-label">
                    <Hash size={13} /> {evidence.backendVerified ? 'SHA-256 (backend verified)' : 'SHA-256 (browser calculation)'}
                  </span>
                  <CopyButton value={evidence.hash} label="Copy hash" />
                </div>
                <code className="hash-value">{evidence.hash || (evidence.hashStatus === 'error' ? 'Hash calculation failed' : 'Calculating…')}</code>
                <p className="field-help">
                  {evidence.backendVerified
                    ? 'The backend re-computed this digest when the exhibit was received. It is the value used for the custody record.'
                    : 'This digest is provisional. It is not a chain-of-custody record until the backend re-hashes the uploaded file.'}
                </p>
              </div>
            </div>
          )}
        </Panel>

        <Panel
          icon={<Mic2 size={17} />}
          title="Reference specimen"
          subtitle="Optional. A known/authorised reference enables the voice comparison stage."
          actions={
            reference ? (
              <StatusBadge tone="reference">{reference.ref || 'Reference staged'}</StatusBadge>
            ) : (
              <StatusBadge tone="neutral">Optional</StatusBadge>
            )
          }
        >
          {reference?.file || reference?.name ? (
            <div className="reference-summary">
              <div className="reference-file">
                <FileAudio size={16} aria-hidden="true" />
                <div>
                  <p className="label-strong truncate" title={reference.name}>{reference.name}</p>
                  <p className="muted small">{reference.origin || 'Reference specimen'}</p>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleRemoveReference}>
                  Remove
                </button>
              </div>
              <MetaList
                compact
                columns={2}
                items={[
                  { label: 'Duration', value: reference.duration || 'Not yet available', mono: true },
                  { label: 'Size', value: formatBytes(reference.bytes), mono: true },
                  { label: 'Sample rate', value: reference.sampleRate || 'Not yet available', mono: true },
                  { label: 'Channels', value: reference.channels || 'Not yet available' },
                ]}
              />
              {reference.hash && (
                <div className="hash-block compact">
                  <div className="hash-block-head">
                    <span className="field-label"><Hash size={13} /> SHA-256</span>
                    <CopyButton value={reference.hash} label="Copy" />
                  </div>
                  <code className="hash-value" title={reference.hash}>{hashPreview(reference.hash, 18, 12)}</code>
                </div>
              )}
              <p className="field-help">
                Uploaded with the exhibit when analysis begins. It can be replaced later from the comparison workspace; doing so invalidates any prior approval.
              </p>
            </div>
          ) : (
            <>
              <FileDropzone
                compact
                id="reference-file"
                label="Add a reference voice specimen"
                description="Optional · same accepted audio formats"
                onFile={handleReferenceFile}
                disabled={starting}
              />
              <p className="field-help">
                Without a reference, the comparison stage is recorded as not performed. A reference can also be added later from the comparison workspace.
              </p>
            </>
          )}
        </Panel>
      </div>

      <div className="cta-row">
        <div className="cta-copy">
          <p className="cta-title">
            {runId ? 'Analysis run already exists' : evidence ? 'Ready to lock the exhibit into analysis' : 'Stage a questioned exhibit to continue'}
          </p>
          <p className="cta-note muted">
            {backendStatus !== 'online'
              ? 'The analysis service is offline. Start the FastAPI backend to upload, hash server-side, and queue the pipeline.'
              : runId
                ? 'Return to the existing run without creating a duplicate upload. Replace the file above to start a new local session.'
                : 'Beginning analysis uploads the original, records a server-side SHA-256, creates a working copy, and starts the pipeline in the background.'}
          </p>
        </div>
        <div className="cta-actions">
          {backendStatus !== 'online' && (
            <span className="inline-status">
              <RefreshCw size={13} /> Waiting for analysis service
            </span>
          )}
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={begin}
            disabled={!canBegin && !runId}
            title={
              runId
                ? 'Open the existing pipeline run'
                : !evidence
                  ? 'Stage an exhibit first'
                  : backendStatus !== 'online'
                    ? 'Start the backend analysis service first'
                    : evidence.hashStatus === 'hashing'
                      ? 'Wait for the local hash to finish'
                      : 'Upload and start analysis'
            }
          >
            {starting ? <RefreshCw size={16} className="spin" /> : <ShieldCheck size={16} />}
            {beginLabel}
            {!starting && <ChevronRight size={16} />}
          </button>
        </div>
      </div>
      <p className="session-note">
        Numeric client-side measurements are indicative until the backend returns its own probe. No hash, duration or format is displayed as verified before the backend confirms it.
      </p>
    </div>
  );
}
