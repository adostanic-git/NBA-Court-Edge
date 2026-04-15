import { useState, useEffect, useRef } from 'react'
import { API, useTheme } from '../App'

function authHeader(json = false) {
  const t = localStorage.getItem('token')
  const h = {}
  if (t) h['Authorization'] = `Bearer ${t}`
  if (json) h['Content-Type'] = 'application/json'
  return h
}

const REC_COLOR = { OVER: '#00d4aa', UNDER: '#4da6ff', SKIP: '#ff4d6a' }
const REC_ICON  = { OVER: '📈', UNDER: '📉', SKIP: '⛔' }
const PROP_LABEL = { points: 'Poeni', rebounds: 'Skokovi', assists: 'Asistencije', pra: 'P+R+A' }

function groupByDate(history) {
  const groups = {}
  history.forEach(tip => {
    const d = tip.game_date || tip.created_at?.split('T')[0] || tip.created_at?.split(' ')[0] || 'Nepoznato'
    if (!groups[d]) groups[d] = []
    groups[d].push(tip)
  })
  return groups
}

function srDate(s) {
  try { return new Date(s).toLocaleDateString('sr-RS', { weekday:'long', day:'numeric', month:'long', year:'numeric' }) }
  catch { return s }
}

// ─── Theme colors helper ──────────────────────────────────────────────────────
function useT() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return {
    dark,
    surface:  dark ? '#0a0e1a'           : '#ffffff',
    card:     dark ? '#0d1220'           : '#ffffff',
    subtle:   dark ? '#0f1623'           : '#f4f7fb',
    border:   dark ? '#1a2335'           : 'rgba(0,0,0,0.09)',
    border2:  dark ? '#0f1627'           : 'rgba(0,0,0,0.06)',
    text1:    dark ? '#edf2f7'           : '#0c1a2e',
    text2:    dark ? '#94a3b8'           : '#2d4a6a',
    text3:    dark ? '#475569'           : '#5a7898',
    textDim:  dark ? '#334155'           : '#7a9ab8',
    textVdim: dark ? '#253352'           : '#a8bfd4',
    shadow:   dark ? 'none'              : '0 2px 12px rgba(0,0,0,0.07)',
    shadow2:  dark ? 'none'              : '0 4px 24px rgba(0,0,0,0.09)',
  }
}

// ─── Live Stats ───────────────────────────────────────────────────────────────
function LiveStats({ playerName, line, propType, recommendation }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const ivRef = useRef(null)
  const T = useT()

  async function fetchLive() {
    try {
      const r = await fetch(`${API}/api/player/${encodeURIComponent(playerName)}/live`, { headers: authHeader() })
      setData(await r.json())
    } catch { setData({ is_live: false }) }
    setLoading(false)
  }

  useEffect(() => {
    fetchLive()
    ivRef.current = setInterval(fetchLive, 30000)
    return () => clearInterval(ivRef.current)
  }, [playerName])

  if (loading) return (
    <div style={{ padding: '8px 12px', background: T.subtle, borderRadius: 8, fontSize: 11, color: T.textDim }}>
      ⏳ Proveravam live status...
    </div>
  )
  if (!data?.is_live) return (
    <div style={{ padding: '8px 12px', background: T.subtle, borderRadius: 8, fontSize: 11, color: T.textVdim, border: `1px solid ${T.border2}` }}>
      • Meč nije u toku
    </div>
  )

  const statMap = { points: data.pts, rebounds: data.reb, assists: data.ast, pra: (data.pts||0)+(data.reb||0)+(data.ast||0) }
  const current = statMap[propType] ?? data.pts ?? 0
  const ahead = recommendation === 'OVER' ? current > line : current < line
  const diff = current - line

  return (
    <div style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.18)', borderRadius: 10, padding: '10px 14px', marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00d4aa', display: 'inline-block', animation: 'livepulse 1.2s infinite' }} />
          <span style={{ fontSize: 11, color: '#00d4aa', fontWeight: 700, letterSpacing: 1 }}>LIVE · {data.min}min</span>
        </div>
        <span style={{ fontSize: 10, color: ahead ? '#00d4aa' : '#ff4d6a', fontWeight: 700 }}>
          {ahead ? '✓ NA PUTU' : '✗ ZAOSTATAK'} ({diff > 0 ? '+' : ''}{diff.toFixed(1)} vs linija {line})
        </span>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { l: 'PTS', v: data.pts, h: propType === 'points' },
          { l: 'REB', v: data.reb, h: propType === 'rebounds' },
          { l: 'AST', v: data.ast, h: propType === 'assists' },
          { l: 'FG',  v: data.fg,  h: false },
        ].map(s => (
          <div key={s.l} style={{ textAlign: 'center', flex: s.l === 'FG' ? 'none' : 1 }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: s.h ? 28 : 20, color: s.h ? '#00d4aa' : T.text1, lineHeight: 1 }}>{s.v ?? 0}</div>
            <div style={{ fontSize: 9, color: s.h ? '#00d4aa' : T.text3, letterSpacing: 1 }}>{s.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── HitMiss ──────────────────────────────────────────────────────────────────
function HitMiss({ tip, sessionResult }) {
  const T = useT()
  const dbResult = (tip.result === 1 || tip.result === 0)
    ? { hit: tip.result === 1, actual: tip.actual_value ?? null, line: tip.line }
    : null

  const isChecking = !dbResult && sessionResult === 'checking'
  const result = dbResult || (sessionResult && sessionResult !== 'checking' ? sessionResult : null)

  if (tip.recommendation === 'SKIP') return null
  if (isChecking) return <span style={{ fontSize: 10, color: T.textDim }}>⏳</span>
  if (!result) return null

  if (result.hit === null || result.hit === undefined) {
    const reason = result.reason || ''
    const display = reason.toLowerCase().includes('igrač') && reason.includes('nije pronađen')
      ? '❓ Nije pronađen'
      : reason.includes('večeras') || reason.includes('tek igra')
      ? '🕐 Večeras'
      : '📅 Nije odigrano'
    return <span style={{ fontSize: 10, color: reason.includes('večeras') || reason.includes('tek igra') ? '#ff9500' : T.textDim }}>{display}</span>
  }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: result.hit ? 'rgba(0,212,170,0.1)' : 'rgba(255,77,106,0.1)',
      border: `1px solid ${result.hit ? 'rgba(0,212,170,0.3)' : 'rgba(255,77,106,0.3)'}`,
      borderRadius: 7, padding: '5px 11px',
    }}>
      <span style={{ fontSize: 15 }}>{result.hit ? '✅' : '❌'}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: result.hit ? '#00d4aa' : '#ff4d6a' }}>
        {result.hit ? 'POGOĐENO' : 'PROMAŠENO'}
      </span>
      {result.actual != null && (
        <span style={{ fontSize: 10, color: T.text3 }}>
          {result.actual} {result.hit ? '>' : '<'} {result.line ?? tip.line}
        </span>
      )}
    </div>
  )
}

// ─── Tip row ──────────────────────────────────────────────────────────────────
function TipRow({ tip, sessionResult }) {
  const [expanded, setExpanded] = useState(false)
  const T = useT()
  const color   = REC_COLOR[tip.recommendation] || T.text3
  const today   = new Date().toISOString().split('T')[0]
  const gameDate = tip.game_date || tip.created_at?.split('T')[0]
  const isToday = gameDate === today

  const dbHit  = tip.result === 1 ? true : tip.result === 0 ? false : null
  const sesHit = sessionResult && sessionResult !== 'checking' && sessionResult.hit !== undefined ? sessionResult.hit : null
  const hit    = dbHit !== null ? dbHit : sesHit

  const borderLeft = hit === true ? 'rgba(0,212,170,0.35)'
    : hit === false ? 'rgba(255,77,106,0.35)'
    : color + '30'

  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderLeft: `3px solid ${borderLeft}`,
      borderRadius: 12, overflow: 'hidden', marginBottom: 8,
      boxShadow: T.shadow,
      transition: 'box-shadow 0.15s',
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', cursor: 'pointer' }}
      >
        <span style={{ fontSize: 16, flexShrink: 0 }}>{REC_ICON[tip.recommendation] || '📊'}</span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: T.text1, marginBottom: 2 }}>{tip.player_name}</div>
          <div style={{ fontSize: 11, color: T.text3, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ background: T.subtle, border: `1px solid ${T.border2}`, borderRadius: 4, padding: '1px 6px', color: T.text2, fontSize: 10, fontWeight: 700 }}>
              {PROP_LABEL[tip.prop_type] || tip.prop_type?.toUpperCase()}
            </span>
            <span>Linija: <b style={{ color: T.text2 }}>{tip.line}</b></span>
            {tip.odds && Object.values(tip.odds)[0] && (() => {
              const o = Object.values(tip.odds)[0]
              const odd = tip.recommendation === 'OVER' ? o.over : o.under
              return odd ? <span style={{ color: '#ff9500', fontWeight: 700 }}>{odd}</span> : null
            })()}
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          <HitMiss tip={tip} sessionResult={sessionResult} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
          <div style={{ background: color + '18', border: `1px solid ${color}44`, borderRadius: 6, padding: '3px 9px' }}>
            <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, color, letterSpacing: 1 }}>{tip.recommendation}</span>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {isToday && <span style={{ fontSize: 8, color: '#ff6a00', fontWeight: 700, letterSpacing: 1 }}>DANAS</span>}
            <span style={{ fontSize: 10, color: tip.confidence >= 70 ? '#00d4aa' : tip.confidence >= 55 ? '#ffd700' : '#ff4d6a', fontWeight: 700 }}>{tip.confidence}%</span>
          </div>
        </div>

        <span style={{ fontSize: 10, color: T.textVdim, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 14px', borderTop: `1px solid ${T.border2}` }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '11px 0 10px' }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: color + '18', border: `1px solid ${color}30`, color }}>{tip.value_rating}</span>
            <span style={{ fontSize: 10, color: T.textDim }}>
              {new Date(tip.created_at).toLocaleString('sr-RS', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' })}
            </span>
          </div>

          {tip.reasoning && (
            <p style={{ fontSize: 13, color: T.text2, lineHeight: 1.65, marginBottom: 12 }}>{tip.reasoning}</p>
          )}

          {isToday && tip.recommendation !== 'SKIP' && (
            <LiveStats playerName={tip.player_name} line={tip.line} propType={tip.prop_type} recommendation={tip.recommendation} />
          )}

          {tip.odds && Object.keys(tip.odds).length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              {Object.entries(tip.odds).map(([book, odds]) => (
                <div key={book} style={{ background: T.subtle, border: `1px solid ${T.border}`, borderRadius: 7, padding: '5px 10px', fontSize: 11 }}>
                  <span style={{ color: T.textDim }}>{book}: </span>
                  <span style={{ color: T.text1, fontWeight: 600 }}>
                    {tip.recommendation === 'OVER' ? odds.over : odds.under}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Stats Card ───────────────────────────────────────────────────────────────
function StatsCard({ hits, misses, total, overCount, underCount, checking }) {
  const T = useT()
  const resolved = hits + misses
  const hitRate  = resolved > 0 ? Math.round((hits / resolved) * 100) : null

  const stats = [
    { l: 'Ukupno',     v: total,                                             c: T.text1 },
    { l: '📈 OVER',   v: overCount,                                          c: '#00d4aa' },
    { l: '📉 UNDER',  v: underCount,                                         c: '#4da6ff' },
    { l: '✅ Pogođeno', v: hits,                                             c: '#00d4aa' },
    { l: '❌ Promašeno', v: misses,                                          c: '#ff4d6a' },
    { l: '🎯 Hit rate', v: hitRate !== null ? `${hitRate}%` : checking > 0 ? '...' : '—',
      c: hitRate >= 60 ? '#00d4aa' : hitRate >= 45 ? '#ffd700' : hitRate !== null ? '#ff4d6a' : T.textDim },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
      {stats.map(s => (
        <div key={s.l} style={{
          background: T.subtle, border: `1px solid ${T.border}`,
          borderRadius: 10, padding: '12px 16px',
          boxShadow: T.shadow,
        }}>
          <div style={{ fontSize: 9, color: T.textDim, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 5 }}>{s.l}</div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: s.c, lineHeight: 1 }}>{s.v}</div>
        </div>
      ))}
      {(hitRate !== null || checking > 0) && (
        <div style={{ gridColumn: '1 / -1', background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '10px 14px', boxShadow: T.shadow }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 11, color: T.text3 }}>
            <span>
              Preciznost ({resolved} proverenih)
              {checking > 0 && <span style={{ color: T.textDim, marginLeft: 8 }}>· proveravam još {checking}...</span>}
            </span>
            {hitRate !== null && (
              <span style={{ fontWeight: 700, color: hitRate >= 60 ? '#00d4aa' : hitRate >= 45 ? '#ffd700' : '#ff4d6a' }}>{hitRate}%</span>
            )}
          </div>
          {hitRate !== null && (
            <div style={{ height: 6, background: T.subtle, borderRadius: 3, overflow: 'hidden', border: `1px solid ${T.border2}` }}>
              <div style={{ height: '100%', width: `${hitRate}%`, background: hitRate >= 60 ? '#00d4aa' : hitRate >= 45 ? '#ffd700' : '#ff4d6a', borderRadius: 3, transition: 'width 1s ease' }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function History() {
  const [history, setHistory]         = useState([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState('sve')
  const [checkResults, setCheckResults] = useState({})
  const checkStartedRef               = useRef(false)
  const T = useT()

  useEffect(() => { loadHistory() }, [])

  useEffect(() => {
    if (history.length > 0 && !checkStartedRef.current) {
      checkStartedRef.current = true
      autoCheckAll(history)
    }
  }, [history])

  async function loadHistory() {
    setLoading(true)
    try {
      const r = await fetch(`${API}/api/auth/history`, { headers: authHeader() })
      const d = await r.json()
      setHistory(d.history || [])
    } catch { setHistory([]) }
    setLoading(false)
  }

  async function autoCheckAll(tips) {
    const unchecked = tips.filter(t => t.recommendation !== 'SKIP' && t.result === null)
    if (!unchecked.length) return

    const initialChecking = {}
    unchecked.forEach(t => { initialChecking[t.id] = 'checking' })
    setCheckResults(initialChecking)

    const BATCH = 3
    for (let i = 0; i < unchecked.length; i += BATCH) {
      const batch = unchecked.slice(i, i + BATCH)
      const settled = await Promise.allSettled(batch.map(doCheck))
      const updates = {}
      settled.forEach((s, idx) => {
        updates[batch[idx].id] = s.status === 'fulfilled' && s.value
          ? s.value : { hit: null, reason: 'Greška' }
      })
      setCheckResults(prev => ({ ...prev, ...updates }))
      if (i + BATCH < unchecked.length) await new Promise(res => setTimeout(res, 500))
    }
  }

  async function doCheck(tip) {
    const gameDate = tip.game_date || tip.created_at?.split('T')[0]
    if (!gameDate) return { hit: null, reason: 'Nema datuma' }
    try {
      const url = `${API}/api/tips/check?player_name=${encodeURIComponent(tip.player_name)}&prop_type=${tip.prop_type}&line=${tip.line}&game_date=${gameDate}`
      const r = await fetch(url, { headers: authHeader() })
      const d = await r.json()
      if (d.hit === true || d.hit === false) {
        fetch(`${API}/api/auth/history/result`, {
          method: 'POST', headers: authHeader(true),
          body: JSON.stringify({ tip_id: tip.id, hit: d.hit, actual: d.actual ?? null })
        }).catch(() => {})
      }
      return d
    } catch { return { hit: null, reason: 'Greška' } }
  }

  function getTipHit(tip) {
    const ses = checkResults[tip.id]
    if (ses && ses !== 'checking') return ses.hit === true ? true : ses.hit === false ? false : null
    if (tip.result === 1) return true
    if (tip.result === 0) return false
    return null
  }

  const filtered = filter === 'sve' ? history : history.filter(t => t.recommendation === filter)
  const groups   = groupByDate(filtered)
  const dates    = Object.keys(groups).sort().reverse()
  const hits     = history.filter(t => getTipHit(t) === true).length
  const misses   = history.filter(t => getTipHit(t) === false).length
  const checkingCount = Object.values(checkResults).filter(v => v === 'checking').length

  /* ── Filter button style ── */
  const fbtnBase = {
    borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", transition: 'all .15s',
    border: `1px solid ${T.border}`,
  }
  const fbtnIdle   = { ...fbtnBase, background: T.subtle,  color: T.text3 }
  const fbtnActive = { ...fbtnBase, background: T.dark ? '#1a2e48' : '#0c1a2e', color: T.dark ? '#edf2f7' : '#ffffff', borderColor: T.dark ? '#334155' : '#0c1a2e' }

  return (
    <>
      <style>{`
        @keyframes spin      { to { transform: rotate(360deg); } }
        @keyframes fadeIn    { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes livepulse { 0%,100%{opacity:1} 50%{opacity:.25} }
        * { box-sizing:border-box; margin:0; padding:0; }
      `}</style>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 20px 80px', fontFamily: "'DM Sans',sans-serif", color: T.text1 }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 10, color: '#ff6a00', letterSpacing: 3.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>
            📋 ARHIVA
          </div>
          <h1 style={{
            fontFamily: "'Bebas Neue',sans-serif",
            fontSize: 'clamp(32px,5vw,58px)', letterSpacing: 2, lineHeight: 1,
            color: T.text1,
          }}>
            ISTORIJA TIPOVA
          </h1>
          <div style={{ width: 48, height: 3, background: 'linear-gradient(90deg,#ff6a00,#ff9c00)', borderRadius: 2, marginTop: 10 }} />
        </div>

        <StatsCard
          hits={hits} misses={misses} total={history.length}
          overCount={history.filter(t => t.recommendation === 'OVER').length}
          underCount={history.filter(t => t.recommendation === 'UNDER').length}
          checking={checkingCount}
        />

        {/* ── Filters ── */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {['sve', 'OVER', 'UNDER', 'SKIP'].map(f => (
            <button key={f} style={filter === f ? fbtnActive : fbtnIdle} onClick={() => setFilter(f)}>
              {f === 'sve' ? 'Sve' : f}
            </button>
          ))}
        </div>

        {/* ── Loading ── */}
        {loading && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: T.textDim }}>
            <div style={{ display: 'inline-block', width: 24, height: 24, border: `2px solid ${T.border}`, borderTopColor: '#ff6a00', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
            <div style={{ marginTop: 12, fontSize: 13 }}>Učitavam istoriju...</div>
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && history.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '80px 20px',
            background: T.subtle, border: `1px dashed ${T.border}`,
            borderRadius: 20, boxShadow: T.shadow,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.text3, marginBottom: 8 }}>Nema sačuvanih tipova</div>
            <div style={{ fontSize: 13, color: T.textDim }}>Generiši AI tipove i oni će se automatski sačuvati ovde</div>
          </div>
        )}

        {/* ── Grouped dates ── */}
        {!loading && dates.map(date => (
          <div key={date} style={{ marginBottom: 32, animation: 'fadeIn .4s ease' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text3 }}>
                📅 {srDate(date)}
              </div>
              <div style={{ flex: 1, height: 1, background: T.border }} />
              <div style={{ fontSize: 10, color: T.textVdim }}>{groups[date].length} tipova</div>
            </div>
            {groups[date].map(tip => (
              <TipRow key={tip.id} tip={tip} sessionResult={checkResults[tip.id]} />
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
