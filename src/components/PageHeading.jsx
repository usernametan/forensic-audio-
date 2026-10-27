export default function PageHeading({ eyebrow, title, description, actions, meta }) {
  return (
    <div className="page-heading">
      <div className="page-heading-copy">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="h1">{title}</h1>
        {description && <p className="page-description">{description}</p>}
        {meta && <div className="page-meta">{meta}</div>}
      </div>
      {actions && <div className="heading-badges">{actions}</div>}
    </div>
  );
}
