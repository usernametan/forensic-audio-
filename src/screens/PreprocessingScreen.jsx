import {
  Sparkles,
  AudioWaveform,
  Split,
  CheckCircle2,
  CircleDashed,
  Loader2,
  ChevronRight,
  Mic,
  Activity,
} from 'lucide-react';
import GlassPanel from '../components/GlassPanel.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Waveform from '../components/Waveform.jsx';
import { STAGE_META, STAGE_ORDER, SPEAKER_TRACKS } from '../data/mockData';

const STAGE_ICONS = {
  noise: Sparkles,
  enhance: AudioWaveform,
  separate: Split,
};

function StageStatus({ stage }) {
  if (stage.status === 'complete') {
    return (
      <span className="stage-state complete">
        <CheckCircle2 size={14} /> Complete
      </span>
    );
  }
  if (stage.status === 'running') {
    return (
      <span className="stage-state running">
        <Loader2 size={14} className="spin" /> Processing {stage.progress}%
      </span>
    );
  }
  return (
    <span className="stage-state idle">
      <CircleDashed size={14} /> Pending
    </span>
  );
}

export default function PreprocessingScreen({ evidence, stages, onRunNoise, onRunSeparate, onContinue }) {
  const overall = Math.round(
    (stages.noise.progress + stages.enhance.progress + stages.separate.progress) / 3
  );
  const anyRunning =
    stages.noise.status === 'running' ||
    stages.enhance.status === 'running' ||
    stages.separate.status === 'running';
  const separated = stages.separate.status === 'complete';

  return (
    <div className="stack-xl">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Screen 02 · Laboratory</p>
          <h2 className="h1">Audio Preprocessing</h2>
          <p className="muted">
            Exhibit <span className="mono">{evidence.ref}</span> · {evidence.name} — cleanup, enhancement and
            diarization of the questioned recording.
          </p>
        </div>
        <div className="heading-badges">
          <StatusBadge tone={anyRunning ? 'amber' : overall === 100 ? 'green' : 'gray'}>
            {overall === 100 ? 'Pipeline complete' : anyRunning ? 'Pipeline running' : 'Pipeline idle'}
          </StatusBadge>
        </div>
      </div>

      <GlassPanel
        title="Master Waveform — Questioned Exhibit"
        subtitle="Visual overview of the full recording before and during preprocessing"
        actions={
          <span className="mono panel-meta">
            {evidence.duration} · {evidence.sampleRate} · {evidence.channels}
          </span>
        }
      >
        <div className="hero-wave">
          <Waveform seed={101} count={170} height={132} color="#22d3ee" animated={anyRunning} />
          {anyRunning && <span className="wave-scanline" />}
          <div className="wave-ruler">
            <span>00:00</span>
            <span>00:54</span>
            <span>01:48</span>
            <span>02:42</span>
            <span>03:36</span>
            <span>04:32</span>
          </div>
        </div>

        <div className="overall-progress">
          <div className="overall-progress-head">
            <span className="label-strong">Overall preprocessing progress</span>
            <span className="mono">{overall}%</span>
          </div>
          <ProgressBar value={overall} height={8} shimmer={anyRunning} />
        </div>
      </GlassPanel>

      <div className="grid-2">
        <GlassPanel title="Processing Stages" subtitle="Simulated pipelines — no real signal processing is performed">
          <div className="stage-list">
            {STAGE_ORDER.map((key, i) => {
              const meta = STAGE_META[key];
              const stage = stages[key];
              const Icon = STAGE_ICONS[key];
              return (
                <div key={key} className={`stage-row status-${stage.status}`}>
                  <span className="stage-index">{i + 1}</span>
                  <span className="stage-icon">
                    <Icon size={16} />
                  </span>
                  <div className="stage-body">
                    <div className="stage-head">
                      <p className="stage-label">{meta.label}</p>
                      <StageStatus stage={stage} />
                    </div>
                    <p className="stage-detail">{meta.detail}</p>
                    <ProgressBar
                      value={stage.progress}
                      color={stage.status === 'complete' ? '#34d399' : '#22d3ee'}
                      height={5}
                      shimmer={stage.status === 'running'}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="btn-row">
            <button className="btn btn-primary" onClick={onRunNoise} disabled={anyRunning}>
              <Sparkles size={15} /> Reduce Noise
            </button>
            <button className="btn btn-secondary" onClick={onRunSeparate} disabled={anyRunning}>
              <Split size={15} /> Separate Speakers
            </button>
          </div>
        </GlassPanel>

        <GlassPanel
          title="Speaker Tracks"
          subtitle="Diarized output — one track per detected talker"
          actions={
            separated ? (
              <StatusBadge tone="violet">2 speakers · 47 segments</StatusBadge>
            ) : (
              <StatusBadge tone="gray">Awaiting separation</StatusBadge>
            )
          }
        >
          {separated ? (
            <div className="track-list">
              {SPEAKER_TRACKS.map((track) => (
                <div className="track-card" key={track.id} style={{ '--track': track.color }}>
                  <div className="track-head">
                    <span className="track-avatar">
                      <Mic size={14} />
                    </span>
                    <div>
                      <p className="track-label">
                        {track.label} <span className="mono track-id">{track.id}</span>
                      </p>
                      <p className="muted small">
                        {track.segments} segments · pitch {track.pitch}
                      </p>
                    </div>
                    <div className="track-time">
                      <p className="mono track-dur">{track.duration}</p>
                      <p className="muted small">talk time {track.talkTime}</p>
                    </div>
                  </div>
                  <Waveform seed={track.seed} count={120} height={64} color={track.color} animated />
                </div>
              ))}
              <div className="track-note">
                <Activity size={14} />
                Speaker 01 dominates the conversation (58% talk time). Tracks are exported to the comparison module
                as separate exhibits.
              </div>
            </div>
          ) : (
            <div className="empty-tracks">
              {SPEAKER_TRACKS.map((track) => (
                <div className="track-card ghost" key={track.id}>
                  <div className="track-head">
                    <span className="track-avatar ghost-avatar">
                      <Mic size={14} />
                    </span>
                    <div>
                      <p className="track-label muted">{track.label}</p>
                      <p className="muted small">Track will appear after separation</p>
                    </div>
                  </div>
                  <Waveform seed={track.seed} count={120} height={64} color="#3d4c68" />
                </div>
              ))}
              <p className="empty-hint muted small">
                Run “Reduce Noise” first, then “Separate Speakers” to populate the diarized tracks.
              </p>
            </div>
          )}
        </GlassPanel>
      </div>

      <div className="cta-row">
        <p className="cta-note muted">
          Preprocessed tracks feed the speaker comparison module. Partial pipelines can continue in demo mode.
        </p>
        <button className="btn btn-primary btn-lg" onClick={onContinue}>
          Continue to Comparison <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
