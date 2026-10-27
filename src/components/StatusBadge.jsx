const TONES = {
  neutral: 'badge-neutral',
  info: 'badge-info',
  primary: 'badge-primary',
  reference: 'badge-reference',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  accent: 'badge-accent',
};

export default function StatusBadge({ tone = 'neutral', dot = true, children, className = '' }) {
  return (
    <span className={`status-badge ${TONES[tone] || TONES.neutral} ${className}`.trim()}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
