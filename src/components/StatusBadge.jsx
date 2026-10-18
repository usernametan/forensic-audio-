const TONES = {
  cyan: 'chip-cyan',
  green: 'chip-green',
  amber: 'chip-amber',
  violet: 'chip-violet',
  gray: 'chip-gray',
  red: 'chip-red',
};

export default function StatusBadge({ tone = 'cyan', dot = true, children, className = '' }) {
  return (
    <span className={`status-chip ${TONES[tone] || TONES.cyan} ${className}`}>
      {dot && <span className="chip-dot" />}
      {children}
    </span>
  );
}
