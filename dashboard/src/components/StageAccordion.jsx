import { useState } from 'react'

function SubAccordion({ label, children }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`sub-accordion${open ? ' open' : ''}`}>
      <button className="sub-accordion-trigger" onClick={() => setOpen(o => !o)}>
        <span className="sub-accordion-chevron">▶</span>
        {label}
      </button>
      <div className="sub-accordion-content">
        {children}
      </div>
    </div>
  )
}

function StageDetail({ stage }) {
  return (
    <div className="stage-detail">
      <div className="stage-desc">{stage.description}</div>

      {stage.flowBoxes && (
        <div className="flow-detail-row">
          {stage.flowBoxes.map((fb, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span className="flow-arrow">→</span>}
              <span className={`flow-box flow-${fb.type}`}>{fb.text}</span>
            </span>
          ))}
        </div>
      )}

      {stage.details && stage.details.length > 0 && (
        <SubAccordion label={`Detalle (${stage.details.length})`}>
          <ul className="stage-list">
            {stage.details.map((d, i) => (
              <li key={i}>
                <span className="stage-list-marker">›</span>
                {d}
              </li>
            ))}
          </ul>
        </SubAccordion>
      )}

      {stage.meta && stage.meta.length > 0 && (
        <div className="stage-meta">
          {stage.meta.map((m, i) => (
            <div className="stage-meta-row" key={i}>
              <span className="stage-meta-icon">{m.icon}</span>
              <span className="stage-meta-text"><strong>{m.label}:</strong> {m.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StageAccordion({ stages, openId, onToggle }) {
  return (
    <div className="accordion">
      {stages.map(stage => {
        const isOpen = openId === stage.id
        return (
          <div className={`accordion-item${isOpen ? ' open' : ''}`} key={stage.id}>
            <button className="accordion-trigger" onClick={() => onToggle(stage.id)}>
              <span className="accordion-chevron">▶</span>
              <span className={`accordion-icon ${stage.iconCls}`}>{stage.icon}</span>
              <span className="accordion-label">
                {stage.label}
                <span className="accordion-sublabel">{stage.sublabel}</span>
              </span>
              <span className={`accordion-badge ${stage.badgeCls}`}>{stage.badge}</span>
            </button>
            <div className="accordion-content">
              {isOpen && <StageDetail stage={stage} />}
            </div>
          </div>
        )
      })}
    </div>
  )
}
