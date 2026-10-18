export default function ProgressBar({ value = 0, color = '#22d3ee', height = 6, shimmer = false }) {
  return (
    <div className="progress-track" style={{ height }}>
      <div
        className={`progress-fill ${shimmer ? 'progress-shimmer' : ''}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: `linear-gradient(90deg, ${color}66, ${color})` }}
      />
    </div>
  );
}
