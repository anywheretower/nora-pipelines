export default function PhaseStrip({ phases, activeId, onPhaseClick }) {
  return (
    <div className="phase-strip">
      {phases.map((phase, i) => {
        const isActive = activeId === phase.id
        const isDimmed = activeId && !isActive
        return (
          <div
            key={phase.id}
            className={`phase-strip-item ${phase.cls}${isActive ? ' active' : ''}${isDimmed ? ' dimmed' : ''}`}
            onClick={() => onPhaseClick(phase.id)}
          >
            <span className="phase-strip-icon">{phase.icon}</span>
            <span className="phase-strip-label">{phase.label}</span>
            <span className="phase-strip-sub">{phase.sublabel}{phase.optional ? ' ·' : ''}</span>
            {i < phases.length - 1 && <span className="phase-strip-arrow">›</span>}
          </div>
        )
      })}
    </div>
  )
}
