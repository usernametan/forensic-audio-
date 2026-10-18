import { useMemo } from 'react';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeBars(seed, count) {
  const rand = mulberry32(seed * 7919 + 13);
  const bars = [];
  let v = 0.45;
  for (let i = 0; i < count; i += 1) {
    v = Math.max(0.1, Math.min(1, v + (rand() - 0.5) * 0.6));
    const env = 0.55 + 0.45 * Math.sin((i / count) * Math.PI * 3.2 + seed);
    const burst = rand() > 0.86 ? 1.25 : 1;
    bars.push(Math.max(0.07, Math.min(1, v * env * burst)));
  }
  return bars;
}

export default function Waveform({
  seed = 1,
  count = 110,
  color = '#22d3ee',
  height = 88,
  animated = false,
  className = '',
}) {
  const bars = useMemo(() => makeBars(seed, count), [seed, count]);

  return (
    <div
      className={`waveform ${animated ? 'waveform-animated' : ''} ${className}`}
      style={{ height }}
      role="img"
      aria-label="Audio waveform"
    >
      {bars.map((b, i) => (
        <span
          key={i}
          className="wave-bar"
          style={{
            height: `${Math.round(b * 100)}%`,
            background: `linear-gradient(180deg, ${color}, ${color}88)`,
            opacity: 0.5 + b * 0.5,
            animationDelay: animated ? `${(i % 14) * 0.07}s` : undefined,
          }}
        />
      ))}
    </div>
  );
}
