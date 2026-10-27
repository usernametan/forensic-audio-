export default function EmptyState({ icon, title, children, action, compact = false, tone = 'neutral' }) {
  return (
    <div className={`empty-state ${compact ? 'compact' : ''} empty-${tone}`.trim()}>
      {icon && <span className="empty-icon" aria-hidden="true">{icon}</span>}
      {title && <p className="empty-title">{title}</p>}
      {children && <div className="empty-copy">{children}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
