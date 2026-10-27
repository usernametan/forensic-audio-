export default function MetaList({ items, columns = 2, compact = false }) {
  return (
    <dl className={`meta-list ${compact ? 'compact' : ''}`.trim()} style={{ '--meta-columns': columns }}>
      {items.map((item) => (
        <div className="meta-item" key={item.label}>
          {item.icon && <span className="meta-icon" aria-hidden="true">{item.icon}</span>}
          <dt>{item.label}</dt>
          <dd className={item.mono ? 'mono' : ''}>{item.value ?? 'Not available'}</dd>
        </div>
      ))}
    </dl>
  );
}
