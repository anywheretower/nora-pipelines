export default function Header({ theme, onToggleTheme, pipelineCount, skillCount, scriptCount, docCount }) {
  return (
    <div className="header">
      <h1>NORA Pipelines</h1>
      <div className="header-sub">Sistema de generacion creativa automatizada</div>
      <div className="header-stats">
        <div className="header-stat">
          <span className="header-stat-num">{pipelineCount}</span>
          <span className="header-stat-label">pipeline</span>
        </div>
        <div className="header-stat">
          <span className="header-stat-num">{skillCount}</span>
          <span className="header-stat-label">skills</span>
        </div>
        <div className="header-stat">
          <span className="header-stat-num">{scriptCount}</span>
          <span className="header-stat-label">scripts</span>
        </div>
        <div className="header-stat">
          <span className="header-stat-num">{docCount}</span>
          <span className="header-stat-label">docs</span>
        </div>
        <button className="theme-toggle" onClick={onToggleTheme}>
          {theme === 'dark' ? '☀ Light' : '● Dark'}
        </button>
      </div>
    </div>
  )
}
