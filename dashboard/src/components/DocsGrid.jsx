export default function DocsGrid({ docs }) {
  return (
    <div className="docs-grid">
      {docs.map((d, i) => (
        <div className="doc-item" key={i}>
          <div className="doc-item-name">{d.name}</div>
          <div className="doc-item-desc">{d.desc}</div>
        </div>
      ))}
    </div>
  )
}
