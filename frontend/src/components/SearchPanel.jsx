import { useState } from 'react'

const PROP_TYPES = [
  { value: 'points', label: 'Poeni (PTS)' },
  { value: 'rebounds', label: 'Skokovi (REB)' },
  { value: 'assists', label: 'Asistencije (AST)' },
  { value: 'pra', label: 'PRA (P+R+A)' },
  { value: 'pts_rebs', label: 'Poeni + Skokovi' },
  { value: 'pts_asts', label: 'Poeni + Asistencije' },
]

const POPULAR_PLAYERS = [
  'LeBron James', 'Stephen Curry', 'Kevin Durant', 'Giannis Antetokounmpo',
  'Luka Doncic', 'Nikola Jokic', 'Joel Embiid', 'Jayson Tatum',
  'Shai Gilgeous-Alexander', 'Anthony Davis', 'Damian Lillard'
]

export default function SearchPanel({ onAnalyze, onQuick, loading }) {
  const [playerName, setPlayerName] = useState('')
  const [propType, setPropType] = useState('points')
  const [line, setLine] = useState('')
  const [opponent, setOpponent] = useState('')
  const [lastNGames, setLastNGames] = useState(10)
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filtered = POPULAR_PLAYERS.filter(p =>
    playerName.length > 1 && p.toLowerCase().includes(playerName.toLowerCase())
  )

  function handleSubmit(e) {
    e.preventDefault()
    if (!playerName || !line) return
    onAnalyze({ playerName, propType, line, opponent, lastNGames })
  }

  function handleQuick() {
    if (!playerName) return
    onQuick(playerName, lastNGames)
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--bg-2)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-1)',
    fontSize: 14,
    padding: '10px 14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 1,
    color: 'var(--text-3)',
    marginBottom: 6,
    textTransform: 'uppercase'
  }

  return (
    <div style={{ paddingTop: 40 }}>
      {/* Hero text */}
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(36px, 8vw, 72px)',
          letterSpacing: 4,
          lineHeight: 0.9,
          background: 'linear-gradient(135deg, #fff 30%, var(--gold) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 12
        }}>
          NBA PROP<br />ANALYZER
        </h1>
        <p style={{ color: 'var(--text-3)', fontSize: 14, maxWidth: 480, margin: '0 auto' }}>
          AI analiza player props — statistika poslednjih mečeva vs. linija kladionice
        </p>
      </div>

      {/* Form card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        padding: '28px 32px',
      }}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            {/* Player name with autocomplete */}
            <div style={{ position: 'relative' }}>
              <label style={labelStyle}>Igrač</label>
              <input
                style={inputStyle}
                placeholder="LeBron James..."
                value={playerName}
                onChange={e => { setPlayerName(e.target.value); setShowSuggestions(true) }}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                onFocus={() => setShowSuggestions(true)}
                autoComplete="off"
              />
              {showSuggestions && filtered.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                  background: 'var(--bg-3)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)', marginTop: 4,
                  overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)'
                }}>
                  {filtered.map(p => (
                    <div
                      key={p}
                      style={{
                        padding: '9px 14px', fontSize: 14, cursor: 'pointer',
                        color: 'var(--text-2)', borderBottom: '1px solid var(--border)',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={e => e.target.style.background = 'var(--bg-2)'}
                      onMouseLeave={e => e.target.style.background = 'transparent'}
                      onMouseDown={() => { setPlayerName(p); setShowSuggestions(false) }}
                    >
                      {p}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Prop type */}
            <div>
              <label style={labelStyle}>Tip oklade</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={propType}
                onChange={e => setPropType(e.target.value)}
              >
                {PROP_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>

            {/* Line */}
            <div>
              <label style={labelStyle}>Linija (opciono)</label>
              <input
                style={inputStyle}
                type="number"
                step="0.5"
                placeholder="Auto (odds-api)"
                value={line}
                onChange={e => setLine(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
            {/* Opponent */}
            <div>
              <label style={labelStyle}>Protivnik (opciono)</label>
              <input
                style={inputStyle}
                placeholder="Boston Celtics..."
                value={opponent}
                onChange={e => setOpponent(e.target.value)}
              />
            </div>

            {/* Last N games */}
            <div>
              <label style={labelStyle}>Poslednjih mečeva</label>
              <select
                style={{ ...inputStyle, cursor: 'pointer' }}
                value={lastNGames}
                onChange={e => setLastNGames(e.target.value)}
              >
                {[5, 7, 10, 15, 20].map(n => (
                  <option key={n} value={n}>Poslednjih {n}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="submit"
              disabled={loading || !playerName}
              style={{
                flex: 2,
                padding: '13px 24px',
                background: loading ? 'var(--bg-3)' : 'var(--gold)',
                color: loading ? 'var(--text-3)' : '#080c14',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 600,
                fontSize: 14,
                letterSpacing: 0.5,
                transition: 'all 0.2s',
                opacity: !playerName && !loading ? 0.5 : 1
              }}
            >
              {loading ? '⟳  Analiziram...' : '⚡  Analiziraj prop'}
            </button>

            <button
              type="button"
              onClick={handleQuick}
              disabled={loading || !playerName}
              style={{
                flex: 1,
                padding: '13px 20px',
                background: 'transparent',
                color: 'var(--gold)',
                border: '1px solid var(--border-accent)',
                borderRadius: 'var(--radius-md)',
                fontWeight: 500,
                fontSize: 14,
                transition: 'all 0.2s',
                opacity: !playerName && !loading ? 0.5 : 1
              }}
            >
              Svi propovi
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
