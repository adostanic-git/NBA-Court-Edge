import { useState } from 'react'
import { API, useTheme } from '../App'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

function authHeader() {
  const t = localStorage.getItem('token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

function useT() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return {
    dark,
    page:       dark ? '#05080f'                      : '#f0f3f8',
    surface:    dark ? '#0f1623'                      : '#ffffff',
    card:       dark ? '#0a0e1a'                      : '#f7f9fc',
    border:     dark ? '#1a2335'                      : 'rgba(0,0,0,0.09)',
    border2:    dark ? 'rgba(255,255,255,0.05)'       : 'rgba(0,0,0,0.06)',
    text1:      dark ? '#e2e8f0'                      : '#0c1a2e',
    text2:      dark ? '#94a3b8'                      : '#4a6484',
    text3:      dark ? '#475569'                      : '#7a8fa8',
    textDim:    dark ? '#334155'                      : '#94a3b8',
    inputBg:    dark ? '#0a0e1a'                      : '#f4f7fb',
    inputColor: dark ? '#e2e8f0'                      : '#0c1a2e',
    selectBg:   dark ? '#0a0e1a'                      : '#f4f7fb',
    selectColor:dark ? '#94a3b8'                      : '#4a6484',
    popBtnBg:   dark ? '#0f1623'                      : '#f0f3f8',
    popBtnBorder:dark ? '#1a2335'                     : 'rgba(0,0,0,0.1)',
    popBtnColor:dark ? '#64748b'                      : '#7a8fa8',
    popBtnHoverBg:   dark ? '#1a2335'                 : '#e4e9f0',
    popBtnHoverColor:dark ? '#e2e8f0'                 : '#0c1a2e',
    rowHover:   dark ? '#0f1a2b'                      : 'rgba(0,0,0,0.03)',
    shadow:     dark ? 'none'                         : '0 2px 16px rgba(0,0,0,0.07)',
    shadow2:    dark ? 'none'                         : '0 4px 24px rgba(0,0,0,0.08)',
    chartGrid:  dark ? '#1a2335'                      : 'rgba(0,0,0,0.07)',
    chartTick:  dark ? '#475569'                      : '#94a3b8',
    tooltipBg:  dark ? '#0f1623'                      : '#ffffff',
    spinBorder: dark ? '#1a2335'                      : 'rgba(0,0,0,0.1)',
    titleGrad:  dark
      ? 'linear-gradient(135deg, #fff 40%, #888)'
      : 'linear-gradient(135deg, #0c1a2e 40%, #4a6484)',
    tdColor:    dark ? '#e2e8f0'                      : '#0c1a2e',
    tdMuted:    dark ? '#64748b'                      : '#7a8fa8',
    thColor:    dark ? '#475569'                      : '#94a3b8',
    rowBorderB: dark ? '#0f1a2b'                      : 'rgba(0,0,0,0.06)',
    matchupColor:dark ? '#94a3b8'                     : '#4a6484',
  }
}

function StatBox({ label, value, sub, color }) {
  const T = useT()
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 100,
      boxShadow: T.shadow,
    }}>
      <div style={{ fontSize: 10, color: T.text3, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: color || T.text1, letterSpacing: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function GameRow({ game }) {
  const T = useT()
  const isWin = game.result === 'W'
  const td = { padding: '12px 14px', fontSize: 13, color: T.tdColor }
  return (
    <tr style={{ borderBottom: `1px solid ${T.rowBorderB}` }}
      onMouseEnter={e => e.currentTarget.style.background = T.rowHover}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
      <td style={td}>{game.date}</td>
      <td style={td}><span style={{ color: T.matchupColor }}>{game.matchup}</span></td>
      <td style={td}><span style={{ color: isWin ? '#00e5a0' : '#ff6b6b', fontWeight: 700 }}>{game.result}</span></td>
      <td style={{ ...td, fontWeight: 700, color: '#ff6b00' }}>{game.pts}</td>
      <td style={td}>{game.reb}</td>
      <td style={td}>{game.ast}</td>
      <td style={{ ...td, color: T.tdMuted }}>{game.min}</td>
      <td style={{ ...td, color: T.tdMuted }}>{game.fg_pct}%</td>
      <td style={{ ...td, color: game.plus_minus >= 0 ? '#00e5a0' : '#ff6b6b' }}>
        {game.plus_minus >= 0 ? '+' : ''}{game.plus_minus}
      </td>
    </tr>
  )
}

const POPULAR = ['Nikola Jokic', 'LeBron James', 'Shai Gilgeous-Alexander', 'Giannis Antetokounmpo', 'Jayson Tatum', 'Luka Doncic', 'Stephen Curry', 'Kevin Durant']

export default function PlayerSearch() {
  const T = useT()
  const [query, setQuery] = useState('')
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastN, setLastN] = useState(10)

  async function search(name = query) {
    if (!name.trim()) return
    setLoading(true); setError(null); setStats(null)
    try {
      const res = await fetch(`${API}/api/player/${encodeURIComponent(name.trim())}/stats?last_n_games=${lastN}`, { headers: authHeader() })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Igrač nije pronađen')
      setStats(data)
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  const chartData = stats?.game_by_game?.slice(0, lastN).reverse().map((g, i) => ({
    name: `G${i + 1}`, pts: g.pts, reb: g.reb, ast: g.ast,
  })) || []

  function chipStyle(color) {
    return {
      fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
      background: color + '18', border: `1px solid ${color}30`, color,
      fontFamily: "'DM Sans', sans-serif",
    }
  }

  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeIn  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

        .search-input {
          width: 100%;
          background: ${T.inputBg};
          border: 1px solid ${T.border};
          border-radius: 12px;
          padding: 16px 20px;
          color: ${T.inputColor};
          font-size: 16px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .search-input:focus { border-color: #ff6b00; }
        .search-input::placeholder { color: ${T.textDim}; }

        .ps-select {
          background: ${T.selectBg};
          border: 1px solid ${T.border};
          border-radius: 10px;
          padding: 0 14px;
          color: ${T.selectColor};
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          cursor: pointer;
          transition: background 0.2s;
        }

        .pop-btn {
          background: ${T.popBtnBg};
          border: 1px solid ${T.popBtnBorder};
          border-radius: 8px;
          padding: 7px 14px;
          color: ${T.popBtnColor};
          font-size: 12px; font-weight: 600;
          cursor: pointer;
          font-family: 'DM Sans', sans-serif;
          transition: all 0.15s;
        }
        .pop-btn:hover {
          background: ${T.popBtnHoverBg};
          color: ${T.popBtnHoverColor};
          border-color: ${T.border};
        }
      `}</style>

      <div style={{
        background: T.page,
        minHeight: '100vh',
        fontFamily: "'DM Sans', sans-serif", color: T.text1,
        boxSizing: 'border-box',
      }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto',
        padding: '32px 28px 80px',
        boxSizing: 'border-box',
      }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 11, color: '#ff6b00', letterSpacing: 3, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
            PRETRAGA
          </div>
          <h1 style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 'clamp(36px, 6vw, 64px)',
            letterSpacing: 2,
            background: T.titleGrad,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            STATISTIKE IGRAČA
          </h1>
        </div>

        {/* Search box */}
        <div style={{
          background: T.surface, border: `1px solid ${T.border}`,
          borderRadius: 20, padding: 24, marginBottom: 32,
          boxShadow: T.shadow2,
        }}>
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <input
              className="search-input"
              placeholder="Unesite ime igrača (npr. Nikola Jokic)..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && search()}
            />
            <select
              value={lastN}
              onChange={e => setLastN(+e.target.value)}
              className="ps-select"
            >
              {[5, 10, 15, 20].map(n => <option key={n} value={n}>L{n}</option>)}
            </select>
            <button onClick={() => search()} disabled={loading} style={{
              background: 'linear-gradient(135deg, #ff6b00, #ff9500)', color: '#000',
              border: 'none', borderRadius: 12, padding: '0 24px', fontSize: 14,
              fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}>
              {loading ? '...' : 'Pretraži'}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: T.textDim, marginRight: 4, fontWeight: 700, letterSpacing: 1 }}>BRZI IZBOR:</span>
            {POPULAR.map(p => (
              <button key={p} className="pop-btn" onClick={() => { setQuery(p); search(p) }}>{p}</button>
            ))}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.3)',
            borderRadius: 12, padding: '14px 18px', color: '#ff6b6b', fontSize: 14, marginBottom: 24,
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.text3 }}>
            <div style={{
              display: 'inline-block', width: 28, height: 28,
              border: `2px solid ${T.spinBorder}`, borderTopColor: '#ff6b00',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            <div style={{ marginTop: 14, fontSize: 14 }}>Učitavam statistike...</div>
          </div>
        )}

        {/* Results */}
        {stats && !loading && (
          <div style={{ animation: 'fadeIn 0.4s ease' }}>

            {/* Player header */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap' }}>
              <div style={{ flex: 1 }}>
                <h2 style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 'clamp(28px, 5vw, 52px)',
                  letterSpacing: 2, color: T.text1, marginBottom: 6,
                }}>
                  {stats.player_name}
                </h2>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={chipStyle('#ff6b00')}>{stats.team}</span>
                  <span style={chipStyle(T.dark ? '#475569' : '#7a8fa8')}>{stats.games_analyzed} mečeva analizirano</span>
                  <span style={chipStyle(
                    stats.recent_trend === 'hot' ? '#00e5a0' :
                    stats.recent_trend === 'cold' ? '#ff6b6b' :
                    (T.dark ? '#475569' : '#7a8fa8')
                  )}>
                    {stats.recent_trend === 'hot' ? '🔥 Forma raste' : stats.recent_trend === 'cold' ? '❄️ Forma opada' : '〰 Neutralno'}
                  </span>
                </div>
              </div>
            </div>

            {/* Section label helper */}
            {(() => {
              const SectionLabel = ({ children }) => (
                <div style={{ fontSize: 11, color: T.text3, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, fontWeight: 700 }}>
                  {children}
                </div>
              )

              return (
                <>
                  {/* Season averages */}
                  <SectionLabel>SEZONSKI PROSEK</SectionLabel>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
                    <StatBox label="Poeni"        value={stats.season_averages?.pts} color="#ff6b00" />
                    <StatBox label="Skokovi"      value={stats.season_averages?.reb} color="#00e5a0" />
                    <StatBox label="Asistencije"  value={stats.season_averages?.ast} color="#60a5fa" />
                    <StatBox label="P+R+A"        value={stats.season_averages?.pra} color="#a78bfa" />
                  </div>

                  {/* Last N averages */}
                  <SectionLabel>PROSEK POSLEDNJIH {lastN}</SectionLabel>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 28, flexWrap: 'wrap' }}>
                    <StatBox label="Poeni"       value={stats.averages_last_n?.pts} color="#ff6b00" sub={`Sezona: ${stats.season_averages?.pts}`} />
                    <StatBox label="Skokovi"     value={stats.averages_last_n?.reb} color="#00e5a0" sub={`Sezona: ${stats.season_averages?.reb}`} />
                    <StatBox label="Asistencije" value={stats.averages_last_n?.ast} color="#60a5fa" sub={`Sezona: ${stats.season_averages?.ast}`} />
                    <StatBox label="Minuti"      value={stats.averages_last_n?.min} color="#94a3b8" />
                  </div>

                  {/* Chart */}
                  {chartData.length > 0 && (
                    <div style={{
                      background: T.surface, border: `1px solid ${T.border}`,
                      borderRadius: 20, padding: 24, marginBottom: 28,
                      boxShadow: T.shadow2,
                    }}>
                      <SectionLabel>GRAFIKON — POSLEDNJIH {lastN} MEČEVA</SectionLabel>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3,3" stroke={T.chartGrid} />
                          <XAxis dataKey="name" tick={{ fill: T.chartTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fill: T.chartTick, fontSize: 11 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{
                            background: T.tooltipBg, border: `1px solid ${T.border}`,
                            borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 12,
                            color: T.text1,
                          }} />
                          <Line type="monotone" dataKey="pts" stroke="#ff6b00" strokeWidth={2} dot={{ r: 4, fill: '#ff6b00' }} name="Poeni" />
                          <Line type="monotone" dataKey="reb" stroke="#00e5a0" strokeWidth={2} dot={{ r: 4, fill: '#00e5a0' }} name="Skokovi" />
                          <Line type="monotone" dataKey="ast" stroke="#60a5fa" strokeWidth={2} dot={{ r: 4, fill: '#60a5fa' }} name="Asistencije" />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Home/Away splits */}
                  {(stats.home_splits || stats.away_splits) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
                      {[
                        { label: '🏠 Domaćin', data: stats.home_splits },
                        { label: '✈️ Gost',    data: stats.away_splits },
                      ].map(s => s.data && (
                        <div key={s.label} style={{
                          background: T.surface, border: `1px solid ${T.border}`,
                          borderRadius: 16, padding: 20, boxShadow: T.shadow,
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: T.text2, marginBottom: 14, letterSpacing: 1 }}>
                            {s.label} ({s.data.games}G)
                          </div>
                          <div style={{ display: 'flex', gap: 16 }}>
                            {[{ l: 'PTS', v: s.data.pts, c: '#ff6b00' }, { l: 'REB', v: s.data.reb, c: '#00e5a0' }, { l: 'AST', v: s.data.ast, c: '#60a5fa' }].map(x => (
                              <div key={x.l} style={{ textAlign: 'center' }}>
                                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: x.c }}>{x.v}</div>
                                <div style={{ fontSize: 10, color: T.text3, letterSpacing: 1 }}>{x.l}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Game log table */}
                  <div style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 20, padding: 24, boxShadow: T.shadow2,
                  }}>
                    <SectionLabel>GAME LOG — POSLEDNJIH {lastN} MEČEVA</SectionLabel>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                            {['Datum', 'Meč', 'Rez', 'PTS', 'REB', 'AST', 'MIN', 'FG%', '+/-'].map(h => (
                              <th key={h} style={{
                                padding: '8px 14px', textAlign: 'left',
                                fontSize: 10, color: T.thColor, letterSpacing: 2,
                                textTransform: 'uppercase', fontWeight: 700,
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stats.game_by_game?.map((g, i) => <GameRow key={i} game={g} />)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>
      </div>
    </>
  )
}
