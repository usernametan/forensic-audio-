export default function GlassPanel({ title, subtitle, actions, children, className = '', bodyClass = '' }) {
  return (
    <section className={`glass-panel ${className}`}>
      {(title || actions) && (
        <header className="panel-header">
          <div>
            {title && <h3 className="panel-title">{title}</h3>}
            {subtitle && <p className="panel-sub">{subtitle}</p>}
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      <div className={`panel-body ${bodyClass}`}>{children}</div>
    </section>
  );
}
