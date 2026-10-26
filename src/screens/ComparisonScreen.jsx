import { useRef, useState } from 'react';
import {
  FileAudio,
  FolderOpen,
  Play,
  Loader2,
  ScanLine,
  ShieldAlert,
  ChevronRight,
  Gauge,
  Waves,
  CheckCircle2,
} from 'lucide-react';
import GlassPanel from '../components/GlassPanel.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Waveform from '../components/Waveform.jsx';
import ProgressBar from '../components/ProgressBar.jsx';
import { useToast } from '../components/Toast.jsx';
import { EXAMPLE_REFERENCE } from '../data/mockData';

function SampleCard({ role, tone, sample, color, inputRef }) {
  return (
    <GlassPanel
      title={role}
      subtitle={sample.origin || 'Questioned exhibit segment (SPK-01)'}
      actions={<StatusBadge tone={tone}>{sample.ref}</StatusBadge>}
    >
      <div className="sample-wave" style={{ '--sample': color }}>
        <Waveform seed={sample.seed || 5} count={130} height={96} color={color} />
        <div className="wave-ruler">
          <span>00:00</span>
          <span>{sample.duration}</span>
        </div>
      </div>

      <div className="meta-grid compact">
        <div className="meta-item">
          <FileAudio size={13} />
          <span className="meta-key">File</span>
          <span className="meta-val mono truncate">{sample.name}</span>
        </div>
        <div className="meta-item">
          <Play size={13} />
          <span className="meta-key">Duration</span>
          <span className="meta-val mono">{sample.duration}</span>
        </div>
        <div className="meta-item">
          <Waves size={13} />
          <span className="meta-key">Format</span>
          <span className="meta-val">{sample.format}</span>
        </div>
        <div className="meta-item">
          <Gauge size={13} />
          <span className="meta-key">SNR</span>
          <span className="meta-val mono">{sample.snr || '—'}</span>
        </div>
        <div className="meta-item">
          <Waves size={13} />
          <span className="meta-key">Bandwidth</span>
          <span className="meta-val">{sample.bandwidth || sample.sampleRate}</span>
        </div>
        <div className="meta-item">
          <CheckCircle2 size={13} />
          <span className="meta-key">Quality</span>
          <span className="meta-val">
            <StatusBadge tone={sample.quality === 'Good' ? 'green' : 'amber'} dot={false}>
              {sample.quality}
            </StatusBadge>
          </span>
        </div>
      </div>

      {sample.qualityNote && <p className="sample-note muted small">{sample.qualityNote}</p>}

      <div className="btn-row">
        <button className="btn btn-secondary btn-sm" onClick={() => inputRef.current?.click()}>
          <FolderOpen size={14} /> Select file
        </button>
        <span className="muted small">Local browser selection · demo only</span>
      </div>
    </GlassPanel>
  );
}

import { computeSHA256 } from '../services/api';

export default function ComparisonScreen({ questioned, reference, setReference, comparison, onRunComparison, onContinue }) {
  const refInputRef = useRef(null);
  const qInputRef = useRef(null);
  const [questionedSample, setQuestionedSample] = useState(questioned);
  const [dragRef, setDragRef] = useState(false);
  const notify = useToast();
  const running = comparison.status === 'running';
  const done = comparison.status === 'done';
  const result = comparison.result;

  const acceptFile = async (file, target) => {
    if (!file) return;
    const ok = /\.(wav|mp3|flac|m4a|ogg|aac|webm)$/i.test(file.name);
    if (!ok) {
      notify('Unsupported file type — select an audio file', 'warn');
      return;
    }
    let sha = '';
    try {
      sha = await computeSHA256(file);
    } catch {}
    const patch = {
      ref: `${target === 'q' ? 'EV' : 'REF'}-${String(Math.floor(Math.random() * 900) + 100)}`,
      name: file.name,
      file,
      hash: sha || 'pending-calculation…',
      sizeMB: Number((file.size / (1024 * 1024)).toFixed(1)),
      captured: 'Uploaded just now · local session',
      custom: true,
    };
    if (target === 'q') {
      setQuestionedSample((s) => ({ ...s, ...patch }));
    } else {
      setReference((r) => ({ ...r, ...patch }));
    }
    notify(`${target === 'q' ? 'Questioned' : 'Reference'} sample staged: ${file.name}${sha ? ` (SHA-256: ${sha.slice(0, 8)}…)` : ''}`, 'success');
  };

  return (
    <div className="stack-xl">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Screen 03 · Comparison</p>
          <h2 className="h1">Speaker Comparison</h2>
          <p className="muted">
            Side-by-side analysis of the questioned extract against an authorized reference voice sample.
          </p>
        </div>
        <div className="heading-badges">
          <StatusBadge tone={done ? 'green' : running ? 'amber' : 'gray'}>
            {done ? 'Demo result ready' : running ? 'Comparing…' : 'Awaiting comparison'}
          </StatusBadge>
        </div>
      </div>

      <div className="compare-grid">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragRef(true);
          }}
          onDragLeave={() => setDragRef(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragRef(false);
            acceptFile(e.dataTransfer.files?.[0], 'q');
          }}
          className={dragRef ? 'drag-target' : ''}
        >
          <SampleCard
            role="Questioned Evidence"
            tone="amber"
            sample={questionedSample}
            color="#fbbf24"
            inputRef={qInputRef}
          />
        </div>
        <SampleCard
          role="Reference Voice Sample"
          tone="cyan"
          sample={reference}
          color="#22d3ee"
          inputRef={refInputRef}
        />
      </div>

      <input
        ref={qInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.flac,.m4a,.ogg"
        hidden
        onChange={(e) => acceptFile(e.target.files?.[0], 'q')}
      />
      <input
        ref={refInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.flac,.m4a,.ogg"
        hidden
        onChange={(e) => acceptFile(e.target.files?.[0], 'r')}
      />

      <GlassPanel
        title="Comparison Pipeline"
        subtitle="Simulated acoustic analysis — deterministic mock feature scores"
        actions={
          done ? (
            <StatusBadge tone="violet">engine run {result.generatedAt}</StatusBadge>
          ) : (
            <StatusBadge tone="gray">{EXAMPLE_REFERENCE.ref} loaded by default</StatusBadge>
          )
        }
      >
        {!running && !done && (
          <div className="compare-idle">
            <ScanLine size={30} className="idle-icon" />
            <p className="label-strong">Ready to compare</p>
            <p className="muted small">
              Both samples are staged. Running the pipeline extracts illustrative spectral, pitch and prosody
              features and prints a clearly-labelled demo result.
            </p>
            <button className="btn btn-primary" onClick={onRunComparison}>
              <ScanLine size={15} /> Run Comparison
            </button>
          </div>
        )}

        {running && (
          <div className="compare-running">
            <div className="scan-stage">
              <Waveform seed={7} count={130} height={90} color="#22d3ee" animated />
              <span className="wave-scanline" />
            </div>
            <p className="label-strong">
              <Loader2 size={14} className="spin" /> Extracting features from both samples…
            </p>
            <div className="run-steps">
              <span className="run-step done">Waveform load</span>
              <span className="run-step done">VAD segmentation</span>
              <span className="run-step active">MFCC extraction</span>
              <span className="run-step">Pitch & prosody</span>
              <span className="run-step">Index scoring</span>
            </div>
            <ProgressBar value={72} shimmer />
          </div>
        )}

        {done && result && (
          <div className="compare-result">
            <div className="demo-banner">
              <ShieldAlert size={18} />
              <div>
                <p className="demo-banner-title">DEMO RESULT — NOT A VALIDATED FORENSIC IDENTIFICATION</p>
                <p className="demo-banner-sub">
                  The scores below are simulated numbers generated by a prototype for academic demonstration. They do
                  NOT establish that the two samples were produced by the same (or different) person, and no such
                  conclusion is claimed.
                </p>
              </div>
            </div>

            <div className="result-grid">
              <div className="result-col">
                <p className="label-strong result-heading">Illustrative similarity indices</p>
                {result.metrics.map((m) => (
                  <div className="metric-row" key={m.name}>
                    <div className="metric-head">
                      <span>{m.name}</span>
                      <span className="mono">{m.value.toFixed(2)}</span>
                    </div>
                    <ProgressBar value={m.value * 100} color="#38bdf8" height={6} />
                  </div>
                ))}
                <div className="composite-row">
                  <span>Composite illustrative index</span>
                  <span className="mono composite-val">{result.composite.toFixed(2)}</span>
                </div>
                <StatusBadge tone="amber">{result.verdictBand}</StatusBadge>
              </div>

              <div className="result-col">
                <p className="label-strong result-heading">Sample quality & features</p>
                <div className="quality-pair">
                  <div className="quality-card amber-card">
                    <p className="quality-role">Questioned</p>
                    <p className="quality-score mono">SNR {questioned.snr}</p>
                    <StatusBadge tone="amber" dot={false}>
                      Fair quality
                    </StatusBadge>
                    <p className="muted small">{result.featuresQuestioned}</p>
                  </div>
                  <div className="quality-card cyan-card">
                    <p className="quality-role">Reference</p>
                    <p className="quality-score mono">SNR {reference.snr || EXAMPLE_REFERENCE.snr}</p>
                    <StatusBadge tone="green" dot={false}>
                      Good quality
                    </StatusBadge>
                    <p className="muted small">{result.featuresReference}</p>
                  </div>
                </div>
                <p className="label-strong result-heading">Observations</p>
                <ul className="obs-list">
                  {result.observations.map((o) => (
                    <li key={o}>{o}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </GlassPanel>

      <div className="cta-row">
        <p className="cta-note muted">
          The comparison record is attached to the draft report as an illustrative observation only.
        </p>
        <button className="btn btn-primary btn-lg" onClick={onContinue}>
          Generate Transcript <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
