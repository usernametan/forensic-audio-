import { useRef, useState } from 'react';
import {
  FileAudio,
  PlayCircle,
  Loader2,
  ScanLine,
  ShieldAlert,
  ChevronRight,
  Gauge,
  Waves,
  AlertTriangle,
  CheckCircle2,
  UploadCloud,
  RefreshCw,
  Info,
} from 'lucide-react';
import Panel from '../components/Panel.jsx';
import PageHeading from '../components/PageHeading.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import AudioWaveform from '../components/AudioWaveform.jsx';
import AudioPlayer from '../components/AudioPlayer.jsx';
import MetaList from '../components/MetaList.jsx';
import EmptyState from '../components/EmptyState.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { useToast } from '../components/Toast.jsx';
import useObjectUrl from '../hooks/useObjectUrl';
import { computeSHA256 } from '../services/api';
import { decodeAudioSource } from '../utils/audioAnalysis';
import { validateAudioFile, formatFileType } from '../utils/files';
import { formatBytes, formatChannels, formatDuration, formatDateTime, formatNumber, formatSampleRate } from '../utils/format';
import { buildComparisonMetrics } from '../utils/review';

function SamplePanel({ role, tone, sample, color, source, onChoose, chooseLabel = 'Choose file' }) {
  const objectUrl = useObjectUrl(sample?.file);
  return (
    <Panel
      icon={<FileAudio size={17} />}
      title={role}
      subtitle={sample?.origin || (role === 'Questioned exhibit' ? 'Original exhibit preview; comparison uses the backend-denoised working audio' : 'Known / authorised reference specimen')}
      actions={sample ? <StatusBadge tone={tone}>{sample.ref || 'Staged'}</StatusBadge> : <StatusBadge tone="neutral">Not selected</StatusBadge>}
    >
      {!sample ? (
        <EmptyState
          compact
          icon={<FileAudio size={20} />}
          title="No sample selected"
          action={onChoose ? (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onChoose}>
              <UploadCloud size={14} /> {chooseLabel}
            </button>
          ) : null}
        >
          <p>{role === 'Reference specimen' ? 'Choose an authorised reference specimen to enable comparison. You can also drag a file onto this panel.' : 'Upload and analyse a questioned exhibit in the case workspace first.'}</p>
        </EmptyState>
      ) : (
        <>
          <div className="sample-wave">
            <AudioWaveform
              source={source}
              color={color}
              height={100}
              emptyLabel={source ? undefined : 'Waveform unavailable — no local audio handle for this sample'}
              ariaLabel={`${role} waveform`}
            />
          </div>
          {objectUrl ? (
            <AudioPlayer src={objectUrl} title={`${role} playback`} durationHint={sample.durationSeconds || 0} />
          ) : (
            <p className="field-help">Playback is unavailable for a backend-only reference record because the API does not expose original exhibit audio.</p>
          )}
          <MetaList
            compact
            columns={2}
            items={[
              { label: 'File', value: sample.name || 'Not available', icon: <FileAudio size={13} /> },
              { label: 'Duration', value: sample.duration || 'Not available', mono: true, icon: <PlayCircle size={13} /> },
              { label: 'Format', value: sample.format || 'Not available', icon: <Waves size={13} /> },
              { label: 'Sample rate', value: sample.sampleRate || 'Not available', mono: true },
              { label: 'Channels', value: sample.channels || 'Not available' },
              { label: 'File size', value: formatBytes(sample.bytes), mono: true },
            ]}
          />
          {sample.qualityNote && <p className="sample-note muted small">{sample.qualityNote}</p>}
          {onChoose && (
            <div className="btn-row">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onChoose}>
                <UploadCloud size={14} /> {chooseLabel}
              </button>
              <span className="muted small">Selecting a new file marks the existing result as stale until comparison is re-run.</span>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

export default function ComparisonScreen({
  evidence,
  reference,
  setReference,
  comparisonStatus,
  comparisonError,
  result,
  onRunComparison,
  onContinue,
  backendStatus,
  runId,
  reviewData,
}) {
  const [fileError, setFileError] = useState('');
  const [hashing, setHashing] = useState(false);
  const refInput = useRef(null);
  const notify = useToast();
  const referenceToken = useRef(0);
  const running = comparisonStatus === 'running';
  const stale = Boolean(reference?.needsComparison);
  const integrity = reviewData?.stages?.integrity?.metrics;
  const denoise = reviewData?.stages?.denoise?.metrics;

  const chooseReference = async (file) => {
    const validationError = validateAudioFile(file);
    if (validationError) {
      setFileError(validationError);
      notify(validationError, 'error');
      return;
    }
    setFileError('');
    setHashing(true);
    const token = ++referenceToken.current;
    const localRecord = {
      ref: 'Pending reference ID',
      name: file.name,
      file,
      origin: 'Examiner-selected reference specimen',
      bytes: file.size,
      sizeMB: file.size / (1024 * 1024),
      format: formatFileType(file),
      duration: '—',
      durationSeconds: 0,
      sampleRate: '—',
      sampleRateHz: 0,
      channels: '—',
      channelCount: 0,
      hash: '',
      hashStatus: 'hashing',
      backendId: null,
      backendVerified: false,
      captured: formatDateTime(new Date()),
      needsComparison: true,
    };
    setReference(localRecord);

    try {
      const hash = await computeSHA256(file);
      if (token !== referenceToken.current) return;
      setReference((previous) =>
        previous ? { ...previous, hash, hashStatus: 'ready', ref: `REF-${hash.slice(0, 6).toUpperCase()}` } : previous
      );
    } catch {
      if (token !== referenceToken.current) return;
      notify('The browser could not compute a SHA-256 fingerprint for the reference file.', 'warning');
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
      // The backend will probe and report metadata when the comparison is run.
    } finally {
      if (token === referenceToken.current) setHashing(false);
    }
  };

  const handleRemoveReference = () => {
    setReference(null);
    setFileError('');
    notify('Reference specimen removed from this session.', 'info');
  };

  const canCompare = Boolean(runId) && backendStatus === 'online' && Boolean(reference?.file || reference?.backendId) && !running && !hashing;
  const disableReason = !runId
    ? 'Run the evidence analysis pipeline first.'
    : backendStatus !== 'online'
      ? 'The analysis service must be online.'
      : !reference
        ? 'Select a reference specimen first.'
        : hashing
          ? 'Wait for the reference hash to complete.'
          : '';

  const metrics = buildComparisonMetrics(result);

  return (
    <div className="stack-xl">
      <PageHeading
        eyebrow="Step 03 · Voice comparison"
        title="Speaker comparison lab"
        description="Compare the questioned exhibit against an authorised reference. The two waveforms are shown independently and are not time-aligned. Results are measured similarity outputs, not an identification conclusion."
        actions={
          <>
            <StatusBadge tone={running ? 'info' : result ? 'success' : comparisonError ? 'danger' : 'neutral'}>
              {running ? 'Comparison running' : result ? 'Measured result available' : comparisonError ? 'Comparison failed' : 'Awaiting comparison'}
            </StatusBadge>
            {stale && <StatusBadge tone="warning">Reference changed</StatusBadge>}
          </>
        }
      />

      {backendStatus !== 'online' && (
        <div className="inline-alert warning banner">
          <Info size={16} />
          <div>
            <strong>Analysis service offline</strong>
            <p>Comparison requires the backend. No fallback or simulated score is calculated in the browser.</p>
          </div>
        </div>
      )}

      {stale && (
        <div className="inline-alert warning banner">
          <AlertTriangle size={16} />
          <div>
            <strong>A new reference file is staged</strong>
            <p>The displayed result, if any, belongs to the previous reference. Run the comparison again to replace the measured output. Re-analysis also resets any prior examiner approval.</p>
          </div>
        </div>
      )}

      <div className="compare-grid">
        <SamplePanel
          role="Questioned exhibit"
          tone="primary"
          sample={evidence}
          color="#D49A58"
          source={evidence?.file ? { file: evidence.file } : undefined}
        />
        <div
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            const file = event.dataTransfer.files?.[0];
            if (file) chooseReference(file);
          }}
        >
          <SamplePanel
            role="Reference specimen"
            tone="reference"
            sample={reference}
            color="#8EA6BB"
            source={reference?.file ? { file: reference.file } : undefined}
            onChoose={() => refInput.current?.click()}
            chooseLabel={reference ? 'Replace reference' : 'Select reference'}
          />
          <input
            ref={refInput}
            id="comparison-reference"
            type="file"
            accept="audio/*,.wav,.mp3,.flac,.ogg,.m4a"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) chooseReference(file);
            }}
          />
          {fileError && (
            <p className="inline-alert error" role="alert">
              <AlertTriangle size={14} /> {fileError}
            </p>
          )}
        </div>
      </div>

      <Panel
        icon={<ScanLine size={17} />}
        title="Comparison execution"
        subtitle="Runs the backend comparison against the analysed questioned audio and the selected reference."
        actions={
          result ? (
            <StatusBadge tone="success">Backend result</StatusBadge>
          ) : (
            <StatusBadge tone="neutral">{runId ? `Run ${runId}` : 'No active run'}</StatusBadge>
          )
        }
      >
        {running && (
          <div className="compare-running">
            <span className="running-orbit" aria-hidden="true">
              <Loader2 size={26} className="spin" />
            </span>
            <div>
              <p className="label-strong">Comparison in progress</p>
              <p className="muted small">
                The backend is measuring embeddings, pitch and MFCC distance. The analysis service does not return granular progress for this operation, so no artificial percentage is displayed.
              </p>
            </div>
          </div>
        )}

        {!running && comparisonError && (
          <div className="inline-alert error banner" role="alert">
            <ShieldAlert size={18} />
            <div>
              <strong>Comparison failed</strong>
              <p>{comparisonError}</p>
              <button type="button" className="btn btn-secondary btn-sm" onClick={onRunComparison} disabled={!canCompare}>
                <RefreshCw size={14} /> Retry comparison
              </button>
            </div>
          </div>
        )}

        {!running && !comparisonError && !result && (
          <div className="compare-idle">
            <ScanLine size={30} className="idle-icon" aria-hidden="true" />
            <p className="label-strong">Ready to compare</p>
            <p className="muted small">
              {disableReason || 'Both samples are staged. Running the comparison produces measured acoustic outputs from the backend.'}
            </p>
            <button type="button" className="btn btn-primary" onClick={onRunComparison} disabled={!canCompare}>
              <ScanLine size={15} /> Run comparison
            </button>
          </div>
        )}

        {!running && result && (
          <div className="comparison-result">
            <div className="backend-banner">
              <CheckCircle2 size={18} />
              <div>
                <p className="backend-banner-title">Backend analysis output — measured similarity, not an identification</p>
                <p className="backend-banner-sub">
                  Model: {result.model} {result.version ? `(${result.version})` : ''}. {result.method || 'Combined acoustic-phonetic and embedding method.'} Examiner interpretation is required before any conclusion is stated.
                </p>
              </div>
            </div>

            <div className="result-grid">
              <div className="result-col">
                <div className="result-heading-row">
                  <div>
                    <p className="label-strong result-heading">Measured outputs</p>
                    <p className="muted small">Values are shown exactly as returned by the backend. They are not probabilities of identity.</p>
                  </div>
                </div>
                <div className="metric-list">
                  {metrics.map((metric) => (
                    <div className="metric-row" key={metric.key}>
                      <div className="metric-head">
                        <span>{metric.label}</span>
                        <span className="mono">{metric.display} <span className="metric-scale">{metric.scale}</span></span>
                      </div>
                      {metric.key === 'embedding' || metric.key === 'fused' ? (
                        <ProgressBar value={Number(metric.value) * 100} color={metric.key === 'fused' ? '#D49A58' : '#8EA6BB'} height={6} label={metric.label} />
                      ) : null}
                      <p className="metric-description">{metric.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="result-col">
                <div className="result-heading-row">
                  <p className="label-strong result-heading">Algorithmic interpretation</p>
                </div>
                <div className="hypothesis-box">
                  <p className="hypothesis-label">Pipeline verbal output</p>
                  <p className="hypothesis-text">{result.verbal || 'No verbal interpretation was returned.'}</p>
                  <p className="field-help">This wording is generated by the comparison algorithm. It must not be adopted as an examiner conclusion without independent review.</p>
                </div>

                <p className="label-strong result-heading">Sample and run context</p>
                <div className="context-list">
                  <div className="context-row">
                    <span>Reference specimen</span>
                    <span className="mono">{result.specimenFile || reference?.name || '—'}</span>
                  </div>
                  <div className="context-row">
                    <span>Questioned F0 mean ± SD</span>
                    <span className="mono">
                      {formatNumber(result.f0Questioned, 1)} ± {formatNumber(result.f0QuestionedStd, 1)} Hz
                    </span>
                  </div>
                  <div className="context-row">
                    <span>Reference F0 mean</span>
                    <span className="mono">{formatNumber(result.f0Reference, 1)} Hz</span>
                  </div>
                  <div className="context-row">
                    <span>Denoise engine</span>
                    <span className="mono">{denoise?.engine || '—'}</span>
                  </div>
                  <div className="context-row">
                    <span>Integrity flags</span>
                    <span>{integrity?.flags?.length ? `${integrity.flags.length} returned` : 'None returned'}</span>
                  </div>
                </div>

                {integrity?.flags?.length > 0 && (
                  <div className="flag-list">
                    {integrity.flags.map((flag) => (
                      <div className="flag-row" key={flag}>
                        <AlertTriangle size={14} aria-hidden="true" />
                        <span>{flag}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="result-actions">
              <button type="button" className="btn btn-secondary" onClick={onRunComparison} disabled={!canCompare}>
                <RefreshCw size={15} /> Re-run comparison
              </button>
              <span className="muted small">
                {disableReason || 'Re-running replaces the stored comparison output and invalidates prior examiner approval.'}
              </span>
            </div>
          </div>
        )}
      </Panel>

      <div className="cta-row">
        <div className="cta-copy">
          <p className="cta-title">Continue to transcript review</p>
          <p className="cta-note muted">
            {result
              ? 'The measured comparison output will be attached to the report for examiner interpretation.'
              : 'No comparison result is available. The report will state that comparison was not performed.'}
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={onContinue}>
          Review transcript <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
