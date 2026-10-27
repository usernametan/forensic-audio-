import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  Loader2,
  AlertTriangle,
  ChevronRight,
  Activity,
  Gauge,
  FileAudio,
  ShieldAlert,
  Info,
  Waves,
  Sparkles,
  Users,
} from 'lucide-react';
import Panel from '../components/Panel.jsx';
import PageHeading from '../components/PageHeading.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import AudioWaveform from '../components/AudioWaveform.jsx';
import AudioPlayer from '../components/AudioPlayer.jsx';
import SpectrogramView from '../components/SpectrogramView.jsx';
import SpeakerTimeline from '../components/SpeakerTimeline.jsx';
import MetaList from '../components/MetaList.jsx';
import EmptyState from '../components/EmptyState.jsx';
import useDecodedAudio from '../hooks/useDecodedAudio';
import useObjectUrl from '../hooks/useObjectUrl';
import { pipelineStageStates } from '../utils/review';
import { formatBytes, formatNumber } from '../utils/format';
import { getOutputUrl } from '../services/api';

const STAGE_ICONS = {
  denoise: Sparkles,
  diarize: Users,
  compare: Activity,
  transcribe: FileAudio,
  translate: FileAudio,
  acoustic: Waves,
  integrity: ShieldAlert,
};

function StageState({ status }) {
  if (status === 'complete') {
    return (
      <span className="stage-state complete">
        <CheckCircle2 size={14} /> Complete
      </span>
    );
  }
  if (status === 'running') {
    return (
      <span className="stage-state running">
        <Loader2 size={14} className="spin" /> Running
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="stage-state failed">
        <AlertTriangle size={14} /> Failed
      </span>
    );
  }
  return (
    <span className="stage-state pending">
      <CircleDashed size={14} /> Pending
    </span>
  );
}

export default function PreprocessingScreen({
  evidence,
  stages,
  onRunNoise,
  onRunSeparate,
  onContinue,
  runId,
  reviewData,
  backendConnected,
}) {
  const [specTab, setSpecTab] = useState('processed');
  const [audioError, setAudioError] = useState(false);
  const overall = Math.round(
    (stages.noise.progress + stages.enhance.progress + stages.separate.progress) / 3
  );
  const anyRunning =
    stages.noise.status === 'running' ||
    stages.enhance.status === 'running' ||
    stages.separate.status === 'running';
  const noiseDone = stages.noise.status === 'complete';
  const separated = stages.separate.status === 'complete';

  const denoiseMetrics = reviewData?.stages?.denoise?.metrics;
  const diarizeMetrics = reviewData?.stages?.diarize?.metrics;
  const acousticMetrics = reviewData?.stages?.acoustic?.metrics;

  // Derive speaker tracks from real backend diarization if available
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
    const colors = ['#22d3ee', '#a78bfa', '#34d399', '#fbbf24'];
    displayTracks = Object.keys(spkMap).map((k, idx) => {
      const d = spkMap[k];
      const m = Math.floor(d.dur / 60);
      const s = Math.round(d.dur % 60);
      const durStr = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      const pct = Math.round((d.dur / totalSpkDur) * 100);
      return {
        id: k,
        label: k.replace('SPEAKER_', 'Speaker '),
        color: colors[idx % colors.length],
        talkTime: `${pct}%`,
        segments: d.count,
        duration: durStr,
        pitch: acousticMetrics?.f0_mean ? `${Math.round(acousticMetrics.f0_mean - (acousticMetrics.f0_std || 20))} – ${Math.round(acousticMetrics.f0_mean + (acousticMetrics.f0_std || 20))} Hz (Global F0)` : '120 – 165 Hz (Est.)',
        seed: (idx + 1) * 17,
      };
    });
  }

  return (
    <div className="stack-xl">
      <PageHeading
        eyebrow="Step 02 · Signal analysis"
        title="Audio analysis lab"
        description={`Questioned exhibit ${evidence.ref || evidence.name}. The waveform, playback and spectrogram are tied to the actual available audio source; processing states come from the backend run.`}
        actions={
          <>
            <StatusBadge tone={pipelineTone}>{pipelineStatusLabel}</StatusBadge>
            {pipeline.progress > 0 && pipeline.status !== 'needs_review' && pipeline.status !== 'approved' && (
              <span className="heading-progress mono">{pipeline.progress}%</span>
            )}
          </>
        }
      />

      {pipeline.status === 'failed' && (
        <div className="inline-alert error banner" role="alert">
          <AlertTriangle size={16} />
          <div>
            <strong>Pipeline failure</strong>
            <p>{pipeline.error || 'The backend reported a failure without a message.'}</p>
          </div>
        </div>
      )}

      {backendStatus !== 'online' && (
        <div className="inline-alert warning banner">
          <Info size={16} />
          <div>
            <strong>Analysis service offline</strong>
            <p>The local file can still be previewed where a browser file handle is available, but no processing output or backend metadata can be retrieved.</p>
          </div>
        </div>
      )}

      <div className="analysis-layout">
        <div className="analysis-main">
          <Panel
            icon={<Waves size={17} />}
            title="Signal workspace"
            subtitle={
              sourceMode === 'processed'
                ? 'Processed audio returned by the backend denoising stage.'
                : 'Original exhibit decoded in this browser. It has not been processed.'
            }
            actions={
              <div className="source-tabs" role="tablist" aria-label="Audio source">
                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceMode === 'original'}
                  className={sourceMode === 'original' ? 'active' : ''}
                  onClick={() => setSourceMode('original')}
                  disabled={!originalSource}
                  title={!originalSource ? 'The original browser file handle is unavailable' : 'Original file'}
                >
                  Original
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={sourceMode === 'processed'}
                  className={sourceMode === 'processed' ? 'active' : ''}
                  onClick={() => setSourceMode('processed')}
                  disabled={!processedSource}
                  title={!processedSource ? 'No processed output is available yet' : 'Processed denoised output'}
                >
                  Processed
                </button>
              </div>
            }
          >
            <div className={`source-banner ${sourceMode}`}>
              <span className="source-banner-title">
                {sourceMode === 'processed' ? 'Processed / denoised extract' : 'Original exhibit'}
              </span>
              <span className="source-banner-note">
                {sourceMode === 'processed'
                  ? denoiseMetrics?.engine
                    ? `Engine: ${denoiseMetrics.engine}`
                    : 'Backend denoised output'
                  : evidence.backendVerified
                    ? 'Backend-verified file received; preview uses the local browser copy.'
                    : 'Local browser preview. Server hash verification is pending.'}
              </span>
              {sourceMode === 'processed' && !processedUrl && (
                <StatusBadge tone="warning">Processed output unavailable</StatusBadge>
              )}
            </div>

            <AudioWaveform
              source={selectedSource}
              color={sourceMode === 'processed' ? '#D49A58' : '#8EA6BB'}
              height={168}
              currentTime={currentTime}
              duration={selectedSource ? undefined : evidence.durationSeconds}
              onSeek={(time) => playerRef.current?.seek(time)}
              ariaLabel={`${sourceMode} audio waveform`}
              emptyLabel={
                sourceMode === 'processed'
                  ? 'Processed audio is not available yet.'
                  : 'Original browser audio is no longer available.'
              }
            />

            <AudioPlayer
              ref={playerRef}
              src={sourceMode === 'processed' ? processedUrl : originalObjectUrl}
              title={`${sourceMode} audio`}
              durationHint={evidence.durationSeconds || 0}
              onTimeUpdate={setCurrentTime}
              disabled={!selectedSource}
            />

            <div className="spectrogram-section">
              <div className="section-heading-row">
                <div>
                  <h3 className="section-title">Frequency analysis</h3>
                  <p className="section-sub">STFT spectrogram with time and frequency axes.</p>
                </div>
                <div className="source-tabs" role="tablist" aria-label="Spectrogram source">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={specTab === 'original'}
                    className={specTab === 'original' ? 'active' : ''}
                    onClick={() => setSpecTab('original')}
                    disabled={!originalDecoded.buffer && !evidence.file}
                  >
                    Original
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={specTab === 'processed'}
                    className={specTab === 'processed' ? 'active' : ''}
                    onClick={() => setSpecTab('processed')}
                    disabled={!processedUrl}
                    title={!processedUrl ? 'No backend spectrogram is available yet' : 'Backend-rendered processed spectrogram'}
                  >
                    Processed
                  </button>
                </div>
              </div>
              <SpectrogramView
                audioBuffer={specTab === 'original' ? originalDecoded.buffer : processedDecoded.buffer}
                imageUrl={specTab === 'processed' && processedUrl ? getOutputUrl(`${runId}_spec_processed.png`) : ''}
                title={specTab === 'original' ? 'Original spectrogram' : 'Processed spectrogram'}
                duration={evidence.durationSeconds}
                height={220}
                active={specTab === 'original' ? Boolean(originalDecoded.buffer) : Boolean(processedDecoded.buffer || processedUrl)}
              />
              <p className="timeline-note">
                {specTab === 'processed'
                  ? 'The processed spectrogram is produced by the backend acoustic stage. If the image fails, the browser FFT of the processed WAV is used when available.'
                  : 'The original spectrogram is computed in this browser from the decoded exhibit and is therefore a local, non-forensic measurement.'}
              </p>
            </div>
          </Panel>

          <Panel
            icon={<Activity size={17} />}
            title="Processing stages"
            subtitle="Stage completion is read from the backend pipeline. No artificial per-stage percentages are shown."
            actions={<StatusBadge tone={pipelineTone}>{pipeline.currentStage ? `Current: ${pipeline.currentStage}` : pipelineStatusLabel}</StatusBadge>}
          >
            <div className="overall-progress">
              <div className="overall-progress-head">
                <span className="label-strong">Overall pipeline progress</span>
                <span className="mono">{pipeline.progress || 0}%</span>
              </div>
              <ProgressBar
                value={pipeline.progress}
                indeterminate={pipeline.status === 'running' && !pipeline.progress}
                label="Overall pipeline progress"
              />
            </div>

            <div className="stage-grid">
              {stageStates.map((stage) => {
                const Icon = STAGE_ICONS[stage.key] || Activity;
                const stageModel =
                  stage.model ||
                  reviewData?.stages?.[stage.key]?.model ||
                  (stage.key === 'compare' ? '' : '');
                return (
                  <div key={stage.key} className={`stage-card status-${stage.status}`}>
                    <div className="stage-card-head">
                      <span className="stage-icon" aria-hidden="true"><Icon size={16} /></span>
                      <div>
                        <p className="stage-label">{stage.label}</p>
                        <p className="stage-detail">{stage.description}</p>
                      </div>
                      <StageState status={stage.status} />
                    </div>
                    <div className="stage-card-foot">
                      <span className="muted small">{stage.modelHint}</span>
                      {stageModel && <span className="mono stage-model">{stageModel}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="timeline-note">
              The pipeline runs automatically after upload. Per-stage controls are intentionally not offered because the backend does not expose independent stage reruns.
            </p>
          </Panel>

          <Panel
            icon={<Users size={17} />}
            title="Speaker turns"
            subtitle="Diarization output with actual segment timestamps. Overlapping speech is expected to be imperfect."
            actions={
              segments.length ? (
                <StatusBadge tone="reference">{segments.length} turns returned</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">No diarization data</StatusBadge>
              )
            }
          >
            <SpeakerTimeline
              segments={segments}
              duration={Math.max(evidence.durationSeconds || 0, ...segments.map((segment) => Number(segment.end) || 0))}
              emptyText={pipeline.status === 'needs_review' || pipeline.status === 'approved' ? 'No speaker segments were returned.' : 'Speaker turns have not been returned yet.'}
            />
          </Panel>
        </div>

        <aside className="analysis-side">
          <Panel icon={<FileAudio size={17} />} title="Exhibit metadata" subtitle="Only confirmed values are shown.">
            <MetaList
              compact
              columns={1}
              items={[
                { label: 'File', value: evidence.name, icon: <FileAudio size={13} /> },
                { label: 'Evidence ID', value: evidence.ref || 'Not assigned', mono: true },
                { label: 'Duration', value: evidence.duration || 'Not available', mono: true },
                { label: 'Format', value: evidence.format || 'Not available' },
                { label: 'Sample rate', value: evidence.sampleRate || 'Not available', mono: true },
                { label: 'Channels', value: evidence.channels || 'Not available' },
                { label: 'File size', value: formatBytes(evidence.bytes), mono: true },
                { label: 'Backend status', value: evidence.backendVerified ? 'Verified on upload' : 'Local only', },
              ]}
            />
            {evidence.hash && (
              <div className="hash-block compact">
                <div className="hash-block-head">
                  <span className="field-label">SHA-256</span>
                </div>
                <code className="hash-value" title={evidence.hash}>{evidence.hash}</code>
              </div>
            )}
          </Panel>

          <Panel icon={<Gauge size={17} />} title="Signal measurements" subtitle="Returned metrics only; absent values remain unavailable.">
            {!denoiseMetrics && !acousticMetrics ? (
              <EmptyState compact icon={<Gauge size={20} />} title="No measurements yet">
                <p>Signal levels, pitch and spectral measurements appear when the backend stages complete.</p>
              </EmptyState>
            ) : (
              <div className="measurement-list">
                {denoiseMetrics && (
                  <>
                    <div className="measurement-row">
                      <span>Denoise engine</span>
                      <span className="mono">{denoiseMetrics.engine || '—'}</span>
                    </div>
                    <div className="measurement-row">
                      <span>SNR proxy</span>
                      <span className="mono">{formatNumber(denoiseMetrics.snr_proxy_db, 2)} dB</span>
                    </div>
                    <div className="measurement-row">
                      <span>RMS before / after</span>
                      <span className="mono">
                        {denoiseMetrics.before?.rms != null ? denoiseMetrics.before.rms.toFixed(4) : '—'} / {denoiseMetrics.after?.rms != null ? denoiseMetrics.after.rms.toFixed(4) : '—'}
                      </span>
                    </div>
                    <div className="measurement-row">
                      <span>Peak before / after</span>
                      <span className="mono">
                        {denoiseMetrics.before?.peak != null ? denoiseMetrics.before.peak.toFixed(4) : '—'} / {denoiseMetrics.after?.peak != null ? denoiseMetrics.after.peak.toFixed(4) : '—'}
                      </span>
                    </div>
                    <div className="measurement-row">
                      <span>Clipping before / after</span>
                      <span className="mono">
                        {denoiseMetrics.before?.clipped_ratio != null ? `${(denoiseMetrics.before.clipped_ratio * 100).toFixed(3)}%` : '—'} / {denoiseMetrics.after?.clipped_ratio != null ? `${(denoiseMetrics.after.clipped_ratio * 100).toFixed(3)}%` : '—'}
                      </span>
                    </div>
                    {denoiseMetrics.artifact_warning && (
                      <p className="inline-alert warning">
                        <AlertTriangle size={14} /> The denoise stage flagged a possible over-processing/artifact risk.
                      </p>
                    )}
                  </>
                )}
                {acousticMetrics && (
                  <>
                    <div className="measurement-row">
                      <span>Mean F0</span>
                      <span className="mono">{formatNumber(acousticMetrics.f0_mean, 1)} Hz</span>
                    </div>
                    <div className="measurement-row">
                      <span>F0 standard deviation</span>
                      <span className="mono">{formatNumber(acousticMetrics.f0_std, 1)} Hz</span>
                    </div>
                    <div className="measurement-row">
                      <span>Spectral centroid</span>
                      <span className="mono">{formatNumber(acousticMetrics.spectral_centroid, 1)} Hz</span>
                    </div>
                    <div className="measurement-row">
                      <span>Zero-crossing rate</span>
                      <span className="mono">{formatNumber(acousticMetrics.zcr, 5)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
            {!pipeline.progress && (
              <p className="field-help">No measurement is shown when the backend has not returned it.</p>
            )}
          </Panel>

          <Panel icon={<ShieldAlert size={17} />} title="Integrity flags" subtitle="Heuristic flags requiring examiner interpretation.">
            {!integrityMetrics ? (
              <EmptyState compact icon={<ShieldAlert size={20} />} title="Integrity analysis pending">
                <p>Integrity findings are returned by the backend after transcript and acoustic stages.</p>
              </EmptyState>
            ) : (
              <div className="flag-list">
                {(integrityMetrics.flags || []).length ? (
                  (integrityMetrics.flags || []).map((flag) => (
                    <div className="flag-row" key={flag}>
                      <AlertTriangle size={14} aria-hidden="true" />
                      <span>{flag}</span>
                    </div>
                  ))
                ) : (
                  <p className="muted small">No integrity flags were returned.</p>
                )}
                {integrityMetrics.metadata && (
                  <p className="field-help">
                    Container probe: {integrityMetrics.metadata.codec || 'unknown'} · {integrityMetrics.metadata.sr || '—'} Hz · {integrityMetrics.metadata.ch || '—'} channels
                  </p>
                )}
              </div>
            )}
          </Panel>
        </aside>
      </div>

      <div className="cta-row">
        <div className="cta-copy">
          <p className="cta-title">Continue the examination</p>
          <p className="cta-note muted">
            The comparison workspace uses the analysed exhibit and any reference specimen. If analysis is incomplete, later screens will clearly show which outputs are unavailable.
          </p>
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={onContinue}>
          Continue to comparison <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
