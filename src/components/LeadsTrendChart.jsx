import { useMemo, useState } from 'react'
import { weeklyLeadTrend } from '../data/leads'

const width = 720
const height = 260
const padding = { top: 24, right: 16, bottom: 36, left: 36 }

export default function LeadsTrendChart() {
  const [activeIndex, setActiveIndex] = useState(weeklyLeadTrend.length - 1)
  const chart = useMemo(() => buildChart(weeklyLeadTrend), [])
  const active = weeklyLeadTrend[activeIndex]

  return (
    <div className="panel chart-panel">
      <div className="panel-header">
        <div>
          <h2>Динамика заявок</h2>
          <p>Количество входящих заявок за последние 7 дней</p>
        </div>
        <div className="chart-total">
          <span>Всего за неделю</span>
          <strong>{chart.total}</strong>
        </div>
      </div>

      <div className="chart-body">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label="График количества заявок за последние 7 дней"
          onMouseLeave={() => setActiveIndex(weeklyLeadTrend.length - 1)}
        >
          <defs>
            <linearGradient id="lead-area" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {chart.grid.map((line) => (
            <g key={line.value}>
              <line x1={padding.left} x2={width - padding.right} y1={line.y} y2={line.y} className="chart-grid" />
              <text x={padding.left - 8} y={line.y + 4} className="chart-axis">
                {line.value}
              </text>
            </g>
          ))}

          <path d={chart.areaPath} fill="url(#lead-area)" />
          <path d={chart.linePath} className="chart-line" />

          {chart.points.map((point, index) => (
            <g key={point.date}>
              <rect
                x={point.x - 28}
                y={padding.top}
                width="56"
                height={height - padding.top - padding.bottom}
                fill="transparent"
                onMouseEnter={() => setActiveIndex(index)}
              />
              <circle cx={point.x} cy={point.y} r={activeIndex === index ? 6 : 4} className="chart-dot" />
              <text x={point.x} y={height - 10} className="chart-label" textAnchor="middle">
                {point.label}
              </text>
            </g>
          ))}

          {chart.points[activeIndex] ? (
            <line
              x1={chart.points[activeIndex].x}
              x2={chart.points[activeIndex].x}
              y1={padding.top}
              y2={height - padding.bottom}
              className="chart-guide"
            />
          ) : null}
        </svg>

        <div className="chart-tooltip">
          <span>{active.label}</span>
          <strong>{active.count} заявок</strong>
        </div>
      </div>
    </div>
  )
}

function buildChart(items) {
  const max = Math.max(...items.map((item) => item.count), 1)
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const step = items.length > 1 ? innerWidth / (items.length - 1) : innerWidth
  const points = items.map((item, index) => {
    const x = padding.left + step * index
    const y = padding.top + innerHeight - (item.count / max) * innerHeight
    return { ...item, x, y }
  })

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`
  const gridMax = Math.ceil(max / 2) * 2
  const grid = [0, gridMax / 2, gridMax].map((value) => ({
    value,
    y: padding.top + innerHeight - (value / gridMax) * innerHeight,
  }))

  return {
    points,
    linePath,
    areaPath,
    grid,
    total: items.reduce((sum, item) => sum + item.count, 0),
  }
}
