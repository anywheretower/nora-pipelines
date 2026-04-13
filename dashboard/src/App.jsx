import { useState, useEffect, useCallback, useMemo } from 'react'
import './App.css'

import Header from './components/Header'
import PhaseStrip from './components/PhaseStrip'
import PipelineCard from './components/PipelineCard'
import DocsGrid from './components/DocsGrid'
import Legend from './components/Legend'
import ScrollToTop from './components/ScrollToTop'

import { universalPhases, pipelines, sharedDocs, phaseColors } from './data/pipeline'
import { skills, scriptCards } from './data/skills'

function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('nora-pipelines-theme')
    if (saved) return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('nora-pipelines-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const [activePhase, setActivePhase] = useState(null) // { pipelineId, phaseId } or null
  const [docsOpen, setDocsOpen] = useState(false)

  const handlePhaseClick = useCallback((pipelineId, phaseId) => {
    setActivePhase(prev =>
      prev && prev.pipelineId === pipelineId && prev.phaseId === phaseId
        ? null
        : { pipelineId, phaseId }
    )
  }, [])

  const footerDate = useMemo(() => {
    const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Santiago' }))
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']
    const h = now.getHours().toString().padStart(2, '0')
    const m = now.getMinutes().toString().padStart(2, '0')
    return `${now.getDate()} de ${months[now.getMonth()]} ${now.getFullYear()}, ${h}:${m} hrs`
  }, [])

  return (
    <>
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        pipelineCount={pipelines.length}
        skillCount={skills.length}
        scriptCount={scriptCards.length}
        docCount={sharedDocs.length}
      />

      <div className="container">
        <Legend items={phaseColors} />

        {/* Pipeline cards */}
        {pipelines.map(p => (
          <PipelineCard
            key={p.id}
            pipeline={p}
            universalPhases={universalPhases}
            activePhase={activePhase && activePhase.pipelineId === p.id ? activePhase.phaseId : null}
            onPhaseClick={handlePhaseClick}
          />
        ))}

        {/* Docs accordion */}
        <div className="accordion" style={{ marginTop: 16 }}>
          <div className={`accordion-item${docsOpen ? ' open' : ''}`}>
            <button className="accordion-trigger" onClick={() => setDocsOpen(o => !o)}>
              <span className="accordion-chevron">▶</span>
              <span className="accordion-icon node-step">📄</span>
              <span className="accordion-label">
                Documentacion Compartida
                <span className="accordion-sublabel">{sharedDocs.length} archivos en docs/</span>
              </span>
            </button>
            <div className="accordion-content">
              {docsOpen && <DocsGrid docs={sharedDocs} />}
            </div>
          </div>
        </div>

        <div className="footer">
          NORA Pipelines Dashboard — Ultima actualizacion: {footerDate}
        </div>
      </div>

      <ScrollToTop />
    </>
  )
}

export default App
