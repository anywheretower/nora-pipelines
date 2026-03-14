export default function Sidebar({ detail, onClose }) {
  if (!detail) {
    return (
      <div className="sidebar-empty">
        <p>Haz click en un elemento del diagrama de flujo para ver su detalle</p>
      </div>
    )
  }

  return (
    <div className="sidebar-content">
      <button className="sidebar-close" onClick={onClose}>✕</button>
      <div className="sidebar-detail">
        <div style={{ marginBottom: 8 }}>
          <span className={`card-badge ${detail.badgeClass}`}>{detail.badge}</span>
        </div>
        <h3>{detail.title}</h3>
        <div className="sidebar-type">{detail.type}</div>
        <div className="sidebar-desc">{detail.desc}</div>
        {detail.details && detail.details.length > 0 && (
          <ul>
            {detail.details.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
