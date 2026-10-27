export default function ProgressBar({
  value = 0,
  color,
  height = 6,
  indeterminate = false,
  label,
}) {
  const safeValue = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      className={`progress-track ${indeterminate ? 'is-indeterminate' : ''}`.trim()}
      style={{ height }}
      role="progressbar"
      aria-label={label || 'Progress'}
      aria-valuemin={indeterminate ? undefined : 0}
      aria-valuemax={indeterminate ? undefined : 100}
      aria-valuenow={indeterminate ? undefined : safeValue}
    >
      <div
        className="progress-fill"
        style={{
          width: indeterminate ? '38%' : `${safeValue}%`,
          background: color || undefined,
        }}
      />
    </div>
  );
}
