export default function Panel({
  title,
  subtitle,
  actions,
  children,
  icon,
  className = '',
  bodyClassName = '',
  as: Element = 'section',
}) {
  return (
    <Element className={`panel ${className}`.trim()}>
      {(title || subtitle || actions) && (
        <header className="panel-header">
          <div className="panel-heading">
            {icon && <span className="panel-icon" aria-hidden="true">{icon}</span>}
            <div className="panel-heading-copy">
              {title && <h2 className="panel-title">{title}</h2>}
              {subtitle && <p className="panel-sub">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="panel-actions">{actions}</div>}
        </header>
      )}
      <div className={`panel-body ${bodyClassName}`.trim()}>{children}</div>
    </Element>
  );
}
