import { useState, useMemo } from 'react'

/* ── Resource type config ── */
const RESOURCE_CONFIG = {
  skill:    { label: 'SKILL',    cls: 'res-skill' },
  script:   { label: 'SCRIPT',   cls: 'res-script' },
  supabase: { label: 'SUPABASE', cls: 'res-supabase' },
  doc:      { label: 'DOC',      cls: 'res-doc' },
  env:      { label: 'ENV',      cls: 'res-env' },
  usuario:  { label: 'USUARIO',  cls: 'res-usuario' },
}

/* ── Friendly labels for write sub-keys ── */
const WRITE_KEY_LABELS = {
  insert: 'INSERT',
  update: 'UPDATE',
  update_on_pickup: 'UPDATE (pickup)',
  update_on_error: 'UPDATE (error)',
  update_on_pass: 'UPDATE (QA pass)',
  update_textos: 'UPDATE (textos)',
  insert_on_fail: 'INSERT (QA fail)',
  insert_imagen: 'INSERT (imagen)',
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

      {/* Filter (for supabase queries) — enhanced */}
      {step.filter && (
        <div className="step-filter-enhanced">
          <span className="filter-prefix">WHERE</span>
          <code className="filter-query">{step.filter}</code>
        </div>
      )}

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

/* ── Supabase Fields Block ── */

function SupabaseFieldsBlock({ supabaseFields }) {
  if (!supabaseFields) return null

  const { reads, writes, filters } = supabaseFields
  const hasReads = reads && Object.keys(reads).length > 0
  const hasWrites = writes && Object.keys(writes).length > 0
  const hasFilters = filters && filters.length > 0

  if (!hasReads && !hasWrites && !hasFilters) return null

  return (
    <div className="sb-fields-panel">
      <div className="sb-fields-title">Operaciones Supabase</div>

      {/* READS */}
      {hasReads && (
        <div className="sb-section">
          <div className="sb-section-label sb-section-reads">READS</div>
          {Object.entries(reads).map(([table, fields]) => (
            <div key={table} className="sb-table-row">
              <span className="sb-table-name">{table}</span>
              <div className="sb-field-list">
                {(Array.isArray(fields) ? fields : []).map((f, i) => (
                  <span key={i} className="sb-field-badge sb-field-read">{f}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* WRITES */}
      {hasWrites && (
        <div className="sb-section">
          <div className="sb-section-label sb-section-writes">WRITES</div>
          {Object.entries(writes).map(([table, value]) => {
            // storage is always an array of strings
            if (table === 'storage') {
              return (
                <div key={table} className="sb-table-row">
                  <span className="sb-table-name">📁 storage</span>
                  <div className="sb-field-list">
                    {(Array.isArray(value) ? value : []).map((f, i) => (
                      <span key={i} className="sb-field-badge sb-field-storage">{f}</span>
                    ))}
                  </div>
                </div>
              )
            }

            // creatividades can be array of strings or object with sub-keys
            if (Array.isArray(value)) {
              return (
                <div key={table} className="sb-table-row">
                  <span className="sb-table-name">{table}</span>
                  <div className="sb-field-list">
                    {value.map((f, i) => (
                      <span key={i} className="sb-field-badge sb-field-write">{f}</span>
                    ))}
                  </div>
                </div>
              )
            }

            // Object with sub-keys (insert, update, update_on_pickup, etc.)
            if (typeof value === 'object' && value !== null) {
              return (
                <div key={table} className="sb-table-row">
                  <span className="sb-table-name">{table}</span>
                  <div className="sb-writes-subkeys">
                    {Object.entries(value).map(([subKey, subFields]) => {
                      const isInsert = subKey.startsWith('insert')
                      const label = WRITE_KEY_LABELS[subKey] || subKey.toUpperCase()
                      return (
                        <div key={subKey} className="sb-subkey-row">
                          <span className={`sb-op-badge ${isInsert ? 'sb-op-insert' : 'sb-op-update'}`}>
                            {label}
                          </span>
                          <div className="sb-field-list">
                            {(Array.isArray(subFields) ? subFields : []).map((f, i) => (
                              <span key={i} className="sb-field-badge sb-field-write">{f}</span>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            }

            return null
          })}
        </div>
      )}

      {/* FILTERS */}
      {hasFilters && (
        <div className="sb-section">
          <div className="sb-section-label sb-section-filters">FILTERS</div>
          <div className="sb-filters-list">
            {filters.map((f, i) => (
              <div key={i} className="sb-filter-code">
                <span className="filter-prefix">WHERE</span>
                <code>{f}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Pipeline Command Bar ── */

function CommandBar({ command }) {
  if (!command) return null
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="pipeline-command-bar">
      <code className="pipeline-command">{command}</code>
      <button className="copy-btn" onClick={handleCopy}>
        {copied ? '✓' : 'Copiar'}
      </button>
    </div>
  )
}

/* ── Pipeline Summary ── */

function PipelineSummary({ pipeline }) {
  const stats = useMemo(() => {
    let reads = 0, inserts = 0, updates = 0, storageFiles = 0
    let scripts = new Set(), skills = new Set()
    let hardware = null, totalTime = []

    Object.values(pipeline.phases).forEach(phase => {
      const sf = phase.supabaseFields
      if (sf) {
        if (sf.reads) reads += Object.keys(sf.reads).length
        if (sf.writes) {
          Object.entries(sf.writes).forEach(([key, val]) => {
            if (key === 'storage') {
              storageFiles += (Array.isArray(val) ? val.length : 0)
            } else if (Array.isArray(val)) {
              inserts++
            } else if (typeof val === 'object' && val !== null) {
              Object.keys(val).forEach(k => {
                if (k.startsWith('insert')) inserts++
                else updates++
              })
            }
          })
        }
      }

      if (phase.executorDetail) {
        if (phase.executor === 'script') scripts.add(phase.executorDetail)
        else if (phase.executor === 'skill') skills.add(phase.executorDetail)
      }

      if (phase.meta) {
        phase.meta.forEach(m => {
          if (m.label === 'Hardware' && !hardware) hardware = m.value
          if (m.label === 'Tiempo') totalTime.push(m.value)
        })
      }
    })

    return {
      supabaseOps: reads + inserts + updates,
      reads, inserts, updates,
      storageFiles,
      scripts: [...scripts],
      skills: [...skills],
      hardware,
      totalTime,
    }
  }, [pipeline])

  return (
    <div className="pipeline-summary">
      <div className="summary-stat">
        <span className="summary-stat-num">{stats.supabaseOps}</span>
        <span className="summary-stat-label">Ops Supabase</span>
        <span className="summary-stat-detail">{stats.reads}R {stats.inserts}I {stats.updates}U</span>
      </div>
      <div className="summary-stat">
        <span className="summary-stat-num">{stats.storageFiles}</span>
        <span className="summary-stat-label">Storage files</span>
      </div>
      <div className="summary-stat">
        <span className="summary-stat-num">{stats.scripts.length}</span>
        <span className="summary-stat-label">Scripts</span>
        {stats.scripts.map((s, i) => <span key={i} className="summary-stat-detail">{s}</span>)}
      </div>
      <div className="summary-stat">
        <span className="summary-stat-num">{stats.skills.length}</span>
        <span className="summary-stat-label">Skills</span>
      </div>
      {stats.hardware && (
        <div className="summary-stat summary-stat-hw">
          <span className="summary-stat-label">HW</span>
          <span className="summary-stat-detail">{stats.hardware}</span>
        </div>
      )}
    </div>
  )
}

/* ── State Machine Flow Strip ── */

function StateFlowStrip({ pipeline }) {
  const states = useMemo(() => {
    const result = []
    const seen = new Set()

    pipeline.executionBlocks.forEach(block => {
      block.phases.forEach(phaseId => {
        const phase = pipeline.phases[phaseId]
        if (!phase) return

        if (phase.stateIn && !seen.has(phase.stateIn)) {
          seen.add(phase.stateIn)
          result.push({ state: phase.stateIn, type: 'in' })
        }
        if (phase.stateOut && !seen.has(phase.stateOut)) {
          seen.add(phase.stateOut)
          result.push({ state: phase.stateOut, type: 'out' })
        }
      })
    })

    return result
  }, [pipeline])

  if (states.length === 0) return null

  return (
    <div className="state-flow-strip">
      <span className="state-flow-label">Estados:</span>
      <div className="state-flow-nodes">
        <span className="state-badge state-none">null</span>
        {states.map((s, i) => (
          <span key={i} className="state-flow-node">
            <span className="state-arrow">→</span>
            <span className={`state-badge ${s.type === 'out' ? 'state-out' : 'state-in'}`}>{s.state}</span>
          </span>
        ))}
      </div>
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
          {data.manual && <span className="manual-badge">MANUAL</span>}
          <StateIndicator data={data} />
        </div>
        <span className="detail-panel-desc">{data.description}</span>
      </div>

      {/* Supabase Fields */}
      <SupabaseFieldsBlock supabaseFields={data.supabaseFields} />

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
        {/* Command bar */}
        <CommandBar command={pipeline.command} />

        {/* Pipeline summary stats */}
        <PipelineSummary pipeline={pipeline} />

        {/* State machine flow */}
        <StateFlowStrip pipeline={pipeline} />

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
                      {block.executor === 'usuario' ? 'Usuario' : block.executor === 'skill' ? 'Skill' : block.executor === 'nora' ? 'NORA' : 'Script'}
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
                      const isManual = data.manual === true

                      // Collect resource types used in this phase
                      const resourceTypes = data.steps
                        ? [...new Set(data.steps.map(s => s.resource.op || RESOURCE_CONFIG[s.resource.type]?.label || s.resource.type.toUpperCase()))]
                        : []

                      return (
                        <button
                          key={phaseId}
                          className={`exec-phase${isActive ? ' active' : ''}${isDimmed ? ' dimmed' : ''}${isManual ? ' exec-phase-manual' : ''}`}
                          onClick={() => !isDimmed && onPhaseClick(pipeline.id, phaseId)}
                        >
                          <span className="exec-phase-icon">{uPhase.icon}</span>
                          <span className={`exec-phase-label ${uPhase.cls}`}>{uPhase.label}</span>
                          {isManual && <span className="manual-badge-sm">MANUAL</span>}
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
