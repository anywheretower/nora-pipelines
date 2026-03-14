import { textToImageFlow, iteracionFlow, legend } from '../data/flows'

function FlowBox({ type, text, selected, onClick }) {
  const cls = `flow-box flow-${type}${selected ? ' selected' : ''}`
  return <span className={cls} onClick={() => onClick(text)}>{text}</span>
}

function FlowLevel({ label, items, selectedBox, onSelectBox }) {
  return (
    <div className="flow-level">
      <div className="flow-level-label">{label}</div>
      <div className="flow-level-content">
        <div className="flow-row">
          {items.map((item, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span className="flow-arrow">→</span>}
              <FlowBox
                type={item.type}
                text={item.text}
                selected={selectedBox === item.text}
                onClick={onSelectBox}
              />
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function FlowCard({ flow, selectedBox, onSelectBox }) {
  const levelLabels = {
    activador: 'Activador',
    supabase: 'Supabase',
    comfy: 'ComfyUI',
    qa: 'QA',
  }

  return (
    <div className="flow-card">
      <div className="flow-card-label">
        {flow.title} <span>{flow.subtitle}</span>
      </div>
      {Object.entries(flow.levels).map(([key, items]) => (
        <FlowLevel
          key={key}
          label={levelLabels[key] || key}
          items={items}
          selectedBox={selectedBox}
          onSelectBox={onSelectBox}
        />
      ))}
      {flow.note && <div className="flow-card-note">{flow.note}</div>}
    </div>
  )
}

export default function FlowDiagram({ selectedBox, onSelectBox }) {
  return (
    <div>
      <div className="section-title">
        Flujos del Pipeline <span className="subtitle">click en un elemento para ver detalle</span>
      </div>

      <FlowCard flow={textToImageFlow} selectedBox={selectedBox} onSelectBox={onSelectBox} />

      <div className="flow-separator" />

      <FlowCard flow={iteracionFlow} selectedBox={selectedBox} onSelectBox={onSelectBox} />

      <div className="flow-legend">
        {legend.map((l, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span className={`flow-box flow-${l.type}`} style={{ padding: '2px 8px', fontSize: '0.55rem', cursor: 'default' }}>{l.text}</span>
            <span>{l.label}</span>
          </span>
        ))}
      </div>
    </div>
  )
}
