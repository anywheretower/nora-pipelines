export default function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((item, i) => (
        <span className="legend-item" key={i}>
          <span className={`legend-box ${item.cls}`}>{item.label}</span>
        </span>
      ))}
    </div>
  )
}
