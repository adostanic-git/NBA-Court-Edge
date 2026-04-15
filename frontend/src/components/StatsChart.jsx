import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Legend
} from 'recharts'

const PROP_STAT_MAP = {
  points: 'pts',
  rebounds: 'reb',
  assists: 'ast',
  pra: 'pra',
  pts_rebs: ['pts', 'reb'],
  pts_asts: ['pts', 'ast'],
}

export default function StatsChart({ stats, propType, line }) {
  if (!stats?.game_by_game?.length) return null

  const statKey = PROP_STAT_MAP[propType] || 'pts'
  const games = [...(stats.game_by_game || [])].reverse()  // chronological order

  const data = games.map((g, i) => {
    let val
    if (Array.isArray(statKey)) {
      val = statKey.reduce((sum, k) => sum + (g[k] || 0), 0)
    } else {
      val = g[statKey] || g.pts || 0
    }
    return {
      name: g.date ? g.date.slice(5) : `G${i + 1}`,
      matchup: g.matchup || '',
      value: val,
      result: g.result || '',
      above: val >= line ? val : null,
      below: val < line ? val : null,
      pts: g.pts,
      reb: g.reb,
      ast: g.ast,
    }
  })

  const overCount = data.filter(d => d.value >= line).length
  const pct = Math.round((overCount / data.length) * 100)

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
      <div style={{
        background: 'var(--bg-3)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        fontSize: 12
      }}>
        <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-1)' }}>
          {d?.matchup || label}
        </div>
        <div style={{ color: d?.value >= line ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontSize: 16 }}>
          {d?.value} {d?.result && <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-3)', marginLeft: 4 }}>({d.result})</span>}
        </div>
        <div style={{ color: 'var(--text-3)', marginTop: 4 }}>
          Linija: {line} · {d?.value >= line ? '✓ OVER' : '✗ UNDER'}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      padding: '24px',
      marginTop: 20
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 1, color: 'var(--text-1)' }}>
          POSLEDNJIH {data.length} MEČEVA
        </h3>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Over rate:</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 22,
            color: pct >= 60 ? 'var(--green)' : pct <= 40 ? 'var(--red)' : 'var(--gold)',
            letterSpacing: 1
          }}>
            {pct}%
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            ({overCount}/{data.length})
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="name"
            tick={{ fill: '#6B7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#6B7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <ReferenceLine
            y={line}
            stroke="var(--gold)"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            label={{
              value: `${line}`,
              fill: 'var(--gold)',
              fontSize: 11,
              position: 'insideTopRight'
            }}
          />
          <Bar dataKey="above" fill="rgba(0,214,143,0.7)" radius={[3,3,0,0]} name="Over" />
          <Bar dataKey="below" fill="rgba(255,77,79,0.6)" radius={[3,3,0,0]} name="Under" />
          <Line
            type="monotone"
            dataKey="value"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--gold)' }}
          />
        </ComposedChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 12, justifyContent: 'center' }}>
        <LegendItem color="rgba(0,214,143,0.7)" label="Over" />
        <LegendItem color="rgba(255,77,79,0.6)" label="Under" />
        <LegendItem color="var(--gold)" label={`Linija (${line})`} dashed />
      </div>
    </div>
  )
}

function LegendItem({ color, label, dashed }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
      <div style={{
        width: dashed ? 20 : 10, height: dashed ? 2 : 10,
        background: color,
        borderRadius: dashed ? 1 : 2,
        borderTop: dashed ? `2px dashed ${color}` : 'none',
        background: dashed ? 'transparent' : color
      }} />
      {label}
    </div>
  )
}
