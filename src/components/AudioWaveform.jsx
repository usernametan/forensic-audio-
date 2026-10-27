import { useEffect, useRef, useState } from 'react';
import { AudioLines, Loader2, AlertTriangle } from 'lucide-react';
import useDecodedAudio from '../hooks/useDecodedAudio';
import { formatDuration } from '../utils/format';

const RULER_STEPS = 6;

export default function AudioWaveform({
  source,
  color = '#D49A58',
  height = 128,
  currentTime = 0,
  duration: durationOverride,
  onSeek,
  selection,
  showRuler = true,
  compact = false,
  emptyLabel = 'No audio source available',
  ariaLabel = 'Audio waveform',
}) {
  const holderRef = useRef(null);
  const canvasRef = useRef(null);
  const [width, setWidth] = useState(0);
  const { status, peaks, duration, error } = useDecodedAudio(source, { buckets: 1100 });
  const effectiveDuration = duration || durationOverride || 0;

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder) return undefined;
    const observer = new ResizeObserver((entries) => {
      const nextWidth = entries[0]?.contentRect?.width || 0;
      setWidth(nextWidth);
    });
    observer.observe(holder);
    setWidth(holder.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !width || !peaks?.length) return undefined;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const center = height / 2;
    ctx.strokeStyle = 'rgba(244, 233, 217, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, center + 0.5);
    ctx.lineTo(width, center + 0.5);
    ctx.stroke();

    const barGap = Math.max(0.6, width / peaks.length);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.88;
    for (let i = 0; i < peaks.length; i += 1) {
      const x = (i / peaks.length) * width;
      const barHeight = Math.max(1, peaks[i] * (height - 8));
      ctx.fillRect(x, center - barHeight / 2, Math.max(0.7, barGap * 0.72), barHeight);
    }
    ctx.globalAlpha = 1;
    return undefined;
  }, [peaks, width, height, color]);

  const handleSeek = (event) => {
    if (!onSeek || !effectiveDuration || !holderRef.current) return;
    const rect = holderRef.current.getBoundingClientRect();
    const fraction = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    onSeek(fraction * effectiveDuration);
  };

  const playheadPosition = effectiveDuration > 0 ? Math.max(0, Math.min(1, currentTime / effectiveDuration)) : 0;

  return (
    <div className={`waveform-shell ${compact ? 'compact' : ''}`.trim()}>
      <div
        ref={holderRef}
        className={`waveform-stage ${onSeek ? 'is-seekable' : ''}`.trim()}
        style={{ height }}
        onClick={handleSeek}
        onKeyDown={(event) => {
          if (!onSeek) return;
          if (event.key === 'ArrowRight') {
            event.preventDefault();
            onSeek(Math.min(effectiveDuration, currentTime + 1));
          } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            onSeek(Math.max(0, currentTime - 1));
          } else if (event.key === 'Home') {
            event.preventDefault();
            onSeek(0);
          } else if (event.key === 'End') {
            event.preventDefault();
            onSeek(effectiveDuration);
          }
        }}
        role={onSeek ? 'slider' : 'img'}
        aria-label={ariaLabel}
        aria-valuemin={onSeek ? 0 : undefined}
        aria-valuemax={onSeek ? Math.round(effectiveDuration) : undefined}
        aria-valuenow={onSeek ? Math.round(currentTime) : undefined}
        tabIndex={onSeek ? 0 : -1}
      >
        <canvas ref={canvasRef} className="waveform-canvas" aria-hidden="true" />
        {selection && effectiveDuration > 0 && (
          <span
            className="waveform-selection"
            style={{
              left: `${Math.max(0, (selection.start / effectiveDuration) * 100)}%`,
              width: `${Math.max(0, ((selection.end - selection.start) / effectiveDuration) * 100)}%`,
            }}
            aria-hidden="true"
          />
        )}
        {effectiveDuration > 0 && (
          <span className="waveform-playhead" style={{ left: `${playheadPosition * 100}%` }} aria-hidden="true" />
        )}
        {status === 'loading' && (
          <span className="waveform-overlay">
            <Loader2 size={16} className="spin" /> Decoding audio…
          </span>
        )}
        {status === 'error' && (
          <span className="waveform-overlay error">
            <AlertTriangle size={16} /> {error || 'Audio could not be decoded.'}
          </span>
        )}
        {status === 'idle' && (
          <span className="waveform-overlay idle">
            <AudioLines size={16} /> {emptyLabel}
          </span>
        )}
      </div>

      {showRuler && weHaveDuration(effectiveDuration) && (
        <div className="wave-ruler" aria-hidden="true">
          {Array.from({ length: RULER_STEPS }).map((_, index) => {
            const fraction = index / (RULER_STEPS - 1);
            return (
              <span key={index} style={{ left: `${fraction * 100}%` }}>
                {formatDuration(effectiveDuration * fraction)}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

function weHaveDuration(duration) {
  return Number.isFinite(duration) && duration > 0;
}
