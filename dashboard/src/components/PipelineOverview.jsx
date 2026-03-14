export default function PipelineOverview({ nodes, activeId, onNodeClick }) {
  return (
    <div className="pipeline-overview">
      <div className="pipeline-title">Pipeline: Text-to-Image Original</div>
      <div className="pipeline-flow">
        {nodes.map((node, i) => (
          <span key={node.id} style={{ display: 'contents' }}>
            {i > 0 && <span className="pipeline-arrow">→</span>}
            <div
              className={`pipeline-node${activeId === node.id ? ' active' : ''}`}
              onClick={() => onNodeClick(node.id)}
            >
              <div className={`pipeline-node-box ${node.cls}`}>{node.label}</div>
              <div className="pipeline-node-label">{node.sublabel}</div>
            </div>
          </span>
        ))}
      </div>
    </div>
  )
}
