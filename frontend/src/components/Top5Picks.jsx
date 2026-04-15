import { useState, useEffect } from 'react'

const VALUE_COLORS = {
  excellent: 'var(--gold)',
  good:      'var(--green)',
  fair:      '#60A5FA',
  poor:      'var(--muted)',
}

const PROP_LABELS = {
  points:   'PTS',
  rebounds: 'REB',
  assists:  'AST',
  pra:      'PRA',
  pts_rebs: 'P+R',
  pts_asts: 'P+A',
}

export default function Top5Picks() {
  const [picks, setPicks] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)

  async function fetchPicks(refresh = false) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/picks/top5${refresh ? '?refresh=true' : ''}`)
      if (!res.ok) throw new Error('Server error')
      const data = await res.json()
      setPicks(data.picks || [])
      setLoaded(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-accent)',
      borderRadius: 'var(--radius-xl)',
      padding: '28px 32px',
      marginTop: 32,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              background: 'var(--gold)',
              color: '#080c14',
              fontSize: 10, fontWeight: 700,
              letterSpacing: 1.5,
              padding: '3px 8px',
              borderRadius: 4,
            }}>AI PICKS</span>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24, letterSpacing: 2,
              color: 'var(--text-1)', lineHeight: 1
            }}>
              TOP 5 DANAS
            </h2>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
            AI analizira sve igrače svih današnjih mečeva i bira najsigurnije tipove
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {loaded && (
            <button
              onClick={() => fetchPicks(true)}
              disabled={loading}
              style={{
                padding: '8px 16px',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-3)',
                fontSize: 12,
                cursor: 'pointer'
              }}
            >
              ↺ Refresh
            </button>
          )}
          <button
            onClick={() => fetchPicks(false)}
            disabled={loading}
            style={{
              padding: '10px 22px',
              background: loading ? 'var(--bg-3)' : 'var(--gold)',
              color: loading ? 'var(--text-3)' : '#080c14',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: 0.5,
              cursor: loading ? 'default' : 'pointer',
              transition: 'all 0.2s',
              minWidth: 140
            }}
          >
            {loading ? '⟳ Analiziram...' : loaded ? 'Prikaži ponovo' : '⚡ Generiši top 5'}
          </button>
        </div>
      </div>

      {/* Warning: takes time */}
      {!loaded && !loading && (
        <div style={{
          padding: '14px 16px',
          background: 'var(--bg-2)',
          borderRadius: 'var(--radius-md)',
          fontSize: 13,
          color: 'var(--text-3)',
          borderLeft: '3px solid var(--gold)',
          lineHeight: 1.6
        }}>
          ⏱ Analiza traje 30–90 sekundi — AI prolazi sve igrače svih današnjih mečeva
          i ocenjuje svaki prop. Rezultati se kešuju 30 minuta.
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height: 72, borderRadius: 'var(--radius-md)', animationDelay: `${i * 0.1}s` }} className="skeleton" />
          ))}
          <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
            Preuzimam statistiku i šaljem AI analizu...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '12px 16px',
          background: 'var(--red-dim)',
          border: '1px solid rgba(255,77,79,0.3)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--red)',
          fontSize: 13
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Picks list */}
      {!loading && picks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {picks.map((pick, i) => (
            <PickRow key={i} pick={pick} rank={i + 1} />
          ))}
        </div>
      )}

      {/* Empty: no games today */}
      {!loading && loaded && picks.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '32px 0',
          color: 'var(--text-3)', fontSize: 14
        }}>
          Nema NBA mečeva danas ili nisu pronađeni value betovi.
        </div>
      )}
    </div>
  )
}

function PickRow({ pick, rank }) {
  const isOver  = pick.recommendation === 'OVER'
  const isUnder = pick.recommendation === 'UNDER'
  const recColor = isOver ? 'var(--green)' : isUnder ? 'var(--red)' : 'var(--muted)'
  const recBg    = isOver ? 'var(--green-dim)' : isUnder ? 'var(--red-dim)' : 'rgba(107,114,128,0.1)'
  const conf = pick.confidence || 0
  const confColor = conf >= 70 ? 'var(--green)' : conf >= 55 ? 'var(--gold)' : 'var(--muted)'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '36px 1fr auto auto auto',
      alignItems: 'center',
      gap: 16,
      padding: '14px 16px',
      background: 'var(--bg-2)',
      borderRadius: 'var(--radius-md)',
      border: '1px solid var(--border)',
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,180,0,0.25)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      {/* Rank */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 22, color: rank === 1 ? 'var(--gold)' : 'var(--text-3)',
        textAlign: 'center', lineHeight: 1
      }}>
        {rank}
      </div>

      {/* Player + info */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-1)' }}>
            {pick.player_name}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1,
            background: 'var(--bg-3)',
            color: 'var(--text-3)',
            padding: '2px 6px', borderRadius: 4
          }}>
            {PROP_LABELS[pick.prop_type] || pick.prop_type?.toUpperCase()}
          </span>
          <span style={{ fontSize: 13, color: 'var(--gold)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
            {pick.line}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
          {pick.team} vs {pick.opponent}
          {pick.reasoning && (
            <span style={{ marginLeft: 8, color: 'var(--text-3)' }}>· {pick.reasoning.slice(0, 80)}{pick.reasoning.length > 80 ? '...' : ''}</span>
          )}
        </div>
      </div>

      {/* Avg */}
      <div style={{ textAlign: 'center', minWidth: 60 }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2, letterSpacing: 1 }}>AVG</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-display)' }}>
          {pick.avg_last_10}
        </div>
      </div>

      {/* Confidence */}
      <div style={{ textAlign: 'center', minWidth: 60 }}>
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2, letterSpacing: 1 }}>CONF</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: confColor, fontFamily: 'var(--font-display)' }}>
          {conf}%
        </div>
      </div>

      {/* Recommendation */}
      <div style={{
        padding: '8px 18px',
        background: recBg,
        borderRadius: 8,
        textAlign: 'center',
        minWidth: 80
      }}>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 18,
          letterSpacing: 2,
          color: recColor,
          lineHeight: 1
        }}>
          {pick.recommendation}
        </div>
        <div style={{
          fontSize: 10, color: VALUE_COLORS[pick.value_rating] || 'var(--text-3)',
          marginTop: 3, letterSpacing: 0.5
        }}>
          {pick.value_rating}
        </div>
      </div>
    </div>
  )
}
