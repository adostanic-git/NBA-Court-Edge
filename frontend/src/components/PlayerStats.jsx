export default function PlayerStats({ stats, propType }) {
  if (!stats || stats.error) return null

  const avgs = stats.averages_last_n || {}
  const season = stats.season_averages || {}
  const n = stats.games_analyzed || 10

  const statRows = [
    { label: 'Poeni', key: 'pts', season: season.pts },
    { label: 'Skokovi', key: 'reb', season: season.reb },
    { label: 'Asistencije', key: 'ast', season: season.ast },
    { label: 'PRA', key: 'pra', season: season.pra },
    { label: 'Minuti', key: 'min', season: null },
    { label: 'FG%', key: 'fg_pct', season: null, suffix: '%' },
  ]

  const trendColor = {
    hot: 'var(--green)',
    cold: 'var(--red)',
    neutral: 'var(--text-3)'
  }
  const trendLabel = {
    hot: '🔥 Vrela forma',
    cold: '❄ Hladna forma',
    neutral: '➡ Neutralna forma'
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      padding: '24px',
      height: 'fit-content'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: 1, color: 'var(--text-1)' }}>
          STATISTIKA
        </h3>
        {stats.recent_trend && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: trendColor[stats.recent_trend] || 'var(--text-3)',
            letterSpacing: 0.5
          }}>
            {trendLabel[stats.recent_trend]}
          </span>
        )}
      </div>

      {/* Stats table */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-3)', paddingBottom: 8, textTransform: 'uppercase' }}>Stat</div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--gold)', paddingBottom: 8, textTransform: 'uppercase', textAlign: 'center' }}>
          Avg {n}
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-3)', paddingBottom: 8, textTransform: 'uppercase', textAlign: 'center' }}>
          Sezona
        </div>

        <div style={{ gridColumn: '1/-1', height: 1, background: 'var(--border)', marginBottom: 4 }} />

        {statRows.map(row => {
          const lastN = avgs[row.key]
          if (lastN === undefined || lastN === 0) return null
          const diff = row.season ? ((lastN - row.season) / row.season * 100) : null
          const isUp = diff !== null && diff > 5
          const isDown = diff !== null && diff < -5

          return (
            <>
              <div key={`${row.key}-label`} style={{ padding: '8px 0', fontSize: 13, color: 'var(--text-3)' }}>
                {row.label}
              </div>
              <div key={`${row.key}-avg`} style={{ padding: '8px 0', fontSize: 15, fontWeight: 700, color: 'var(--text-1)', textAlign: 'center' }}>
                {lastN}{row.suffix || ''}
              </div>
              <div key={`${row.key}-season`} style={{
                padding: '8px 0', fontSize: 13, textAlign: 'center',
                color: isUp ? 'var(--green)' : isDown ? 'var(--red)' : 'var(--text-3)'
              }}>
                {row.season != null ? (
                  <>
                    {row.season}{row.suffix || ''}
                    {diff !== null && Math.abs(diff) > 5 && (
                      <span style={{ fontSize: 11, marginLeft: 4 }}>
                        {isUp ? '↑' : '↓'}
                      </span>
                    )}
                  </>
                ) : '—'}
              </div>
            </>
          )
        })}
      </div>

      {/* Home/away splits */}
      {(stats.home_splits?.pts || stats.away_splits?.pts) && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-3)', marginBottom: 10, textTransform: 'uppercase' }}>
            Home / Away
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Home', data: stats.home_splits },
              { label: 'Away', data: stats.away_splits }
            ].map(({ label, data }) => data?.pts ? (
              <div key={label} style={{
                background: 'var(--bg-2)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 12px'
              }}>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4, letterSpacing: 1 }}>{label}</div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <Stat label="PTS" val={data.pts} />
                  <Stat label="REB" val={data.reb} />
                  <Stat label="AST" val={data.ast} />
                </div>
              </div>
            ) : null)}
          </div>
        </div>
      )}

      {stats.consistency_rating != null && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: 1, textTransform: 'uppercase' }}>Konzistentnost</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)' }}>{stats.consistency_rating}%</span>
          </div>
          <div style={{ height: 4, background: 'var(--bg-2)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${stats.consistency_rating}%`,
              background: stats.consistency_rating > 70 ? 'var(--green)' : stats.consistency_rating > 50 ? 'var(--gold)' : 'var(--red)',
              borderRadius: 2
            }} />
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, val }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>{val}</div>
    </div>
  )
}
