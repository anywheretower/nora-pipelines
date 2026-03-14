export default function SkillCard({ skill }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{skill.title}</div>
        <span className={`card-badge ${skill.badgeClass}`}>{skill.badge}</span>
      </div>
      <div className="card-body">
        <div className="card-desc">{skill.description}</div>
        {skill.meta && (
          <div className="card-meta">
            {skill.meta.map((m, i) => (
              <div className="meta-row" key={i}>
                <span className="meta-icon">{m.icon}</span>
                <span className="meta-text"><strong>{m.label}:</strong> {m.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="card-footer">
        <span className="rev">{skill.rev}</span>
        <span className="deps">{skill.deps}</span>
      </div>
    </div>
  )
}
