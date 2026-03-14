import { useState } from 'react'

/* ── Resource type config ── */
const RESOURCE_CONFIG = {
  skill:    { label: 'SKILL',    cls: 'res-skill' },
  script:   { label: 'SCRIPT',   cls: 'res-script' },
  supabase: { label: 'SUPABASE', cls: 'res-supabase' },
  doc:      { label: 'DOC',      cls: 'res-doc' },
  env:      { label: 'ENV',      cls: 'res-env' },
  usuario:  { label: 'USUARIO',  cls: 'res-usuario' },
}

/* ── Step card with resource badge ── */

function StepCard({ step, index }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails = step.details && step.details.length > 0
  const res = step.resource
  const config = RESOURCE_CONFIG[res.type] || { label: res.type.toUpperCase(), cls: 'res-default' }

  // For supabase, show the operation type too
  const opCls = res.op ? `res-supabase-${res.op.toLowerCase()}` : ''

  return (
    <div
      className={`step-card ${config.cls}${hasDetails ? ' expandable' : ''}${expanded ? ' expanded' : ''}`}
      onClick={() => hasDetails && setExpanded(v => !v)}
    >
      {/* Resource badge — prominent at top */}
      <div className="step-resource-row">
        <span className={`step-resource-badge ${config.cls} ${opCls}`}>
          {res.op || config.label}
        </span>
        <span className="step-resource-name">{res.name}</span>
        {hasDetails && <span className="step-toggle">{expanded ? '−' : '+'}</span>}
      </div>

      {/* Step label + description */}
      <div className="step-label">{step.label}</div>
      <div className="step-desc">{step.description}</div>

      {/* Filter (for supabase queries) */}
      {step.filter && <div className="step-filter">{step.filter}</div>}

      {/* State change */}
      {step.stateChange && <div className="step-state-change">Estado: {step.stateChange}</div>}

      {/* Expandable details */}
      {expanded && hasDetails && (
        <ul className="step-details">
          {step.details.map((d, i) => <li key={i}>{d}</li>)}
        </ul>
      )}

      {/* Docs used */}
      {step.docs && (
        <div className="step-docs">
          {step.docs.map((d, i) => <span key={i} className="step-doc-pill">{d}</span>)}
        </div>
      )}
    </div>
  )
}

/* ── State evolution indicator ── */

function StateIndicator({ data }) {
  if (data.stateIn === undefined && data.stateOut === undefined) return null
  if (data.stateIn === null && data.stateOut === null) return null

  return (
    <div className="state-indicator">
      {data.stateIn !== null ? (
        <span className="state-badge state-in">{data.stateIn}</span>
      ) : data.stateOut !== null ? (
        <span className="state-badge state-none">no existe</span>
      ) : null}
      {data.stateOut !== null && data.stateOut !== undefined && (
        <>
          <span className="state-arrow">→</span>
          <span className="state-badge state-out">{data.stateOut}</span>
        </>
      )}
    </div>
  )
}

/* ── Detail panel ── */

function DetailPanel({ data }) {
  if (!data) return null

  return (
    <div className="detail-panel">
      {/* Header */}
      <div className="detail-panel-header">
        <div className="detail-panel-title-row">
          <span className="detail-panel-title">{data.title}</span>
          <StateIndicator data={data} />
        </div>
        <span className="detail-panel-desc">{data.description}</span>
      </div>

      {/* Steps sequence */}
      {data.steps && (
        <div className="steps-sequence">
          {data.steps.map((step, i) => (
            <div key={i} className="step-wrap">
              {i > 0 && <span className="step-arrow">→</span>}
              <StepCard step={step} index={i} />
            </div>
          ))}
        </div>
      )}

      {/* Legacy: details list for phases without steps (like QA) */}
      {!data.steps && data.details && (
        <div className="detail-extra-list" style={{ marginTop: 12 }}>
          {data.details.map((d, i) => (
            <span key={i} className="detail-extra-item">{d}</span>
          ))}
        </div>
      )}

      {/* Meta info */}
      {data.meta && data.meta.length > 0 && (
        <div className="detail-extra-meta" style={{ marginTop: 12 }}>
          {data.meta.map((m, i) => (
            <span key={i} className="detail-meta-item">
              <span className="detail-meta-icon">{m.icon}</span>
              <strong>{m.label}:</strong> {m.value}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Main component ── */

export default function PipelineCard({ pipeline, universalPhases, activePhase, onPhaseClick }) {
  const [open, setOpen] = useState(true)
  const [qaEnabled, setQaEnabled] = useState(true)

  const activeData = activePhase ? pipeline.phases[activePhase] : null
  const showDetail = activeData && !(activePhase === 'qa' && !qaEnabled)

  return (
    <div className={`pipeline-card${open ? ' open' : ''}`}>
      <div className="pipeline-card-header" onClick={() => setOpen(o => !o)}>
        <span className="pipeline-card-chevron">▶</span>
        <span className="pipeline-card-title">
          {pipeline.title}
          <span className="pipeline-card-subtitle">{pipeline.subtitle}</span>
        </span>
        <span className="pipeline-card-badge badge-gen">{pipeline.status}</span>
      </div>
      <div className="pipeline-card-body">
        {/* Execution blocks row */}
        <div className="exec-blocks">
          {pipeline.executionBlocks.map((block, bi) => {
            const isOptional = block.optional
            const isDimmed = isOptional && !qaEnabled

            return (
              <div key={bi} className="exec-block-wrap">
                {bi > 0 && (
                  <div className="exec-handoff">
                    <span className="exec-handoff-arrow">→</span>
                    {pipeline.executionBlocks[bi - 1].handoff && (
                      <span className="exec-handoff-label">{pipeline.executionBlocks[bi - 1].handoff}</span>
                    )}
                  </div>
                )}

                <div className={`exec-block exec-block-${block.executor}${isDimmed ? ' dimmed' : ''}`}>
                  <div className="exec-block-header">
                    <span className={`executor-badge executor-${block.executor}`}>
                      {block.executor === 'usuario' ? 'Usuario' : block.executor === 'skill' ? 'Skill' : 'Script'}
                    </span>
                    <span className="exec-block-label">{block.label}</span>
                    {isOptional && (
                      <span className="qa-toggle-inline" onClick={() => setQaEnabled(v => !v)}>
                        <span className={`qa-switch-track small${qaEnabled ? ' on' : ''}`}>
                          <span className="qa-switch-thumb" />
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="exec-block-phases">
                    {block.phases.map(phaseId => {
                      const data = pipeline.phases[phaseId]
                      const uPhase = universalPhases.find(p => p.id === phaseId)
                      if (!data || !uPhase) return null
                      const isActive = activePhase === phaseId

                      // Collect resource types used in this phase
                      const resourceTypes = data.steps
                        ? [...new Set(data.steps.map(s => s.resource.op || RESOURCE_CONFIG[s.resource.type]?.label || s.resource.type.toUpperCase()))]
                        : []

                      return (
                        <button
                          key={phaseId}
                          className={`exec-phase${isActive ? ' active' : ''}${isDimmed ? ' dimmed' : ''}`}
                          onClick={() => !isDimmed && onPhaseClick(pipeline.id, phaseId)}
                        >
                          <span className="exec-phase-icon">{uPhase.icon}</span>
                          <span className={`exec-phase-label ${uPhase.cls}`}>{uPhase.label}</span>
                          <span className="exec-phase-title">{data.title}</span>
                          {resourceTypes.length > 0 && (
                            <div className="exec-phase-resources">
                              {resourceTypes.map((rt, i) => (
                                <span key={i} className={`exec-phase-res-pill res-pill-${rt.toLowerCase()}`}>{rt}</span>
                              ))}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {showDetail && <DetailPanel data={activeData} />}
      </div>
    </div>
  )
}
