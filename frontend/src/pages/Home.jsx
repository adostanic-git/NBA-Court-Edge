import { useState, useEffect, useRef } from 'react'
import { API, useTheme } from '../App'
import ParticleBackground from '../components/ParticleBackground'

function authHeader(json = false) {
  const t = localStorage.getItem('token')
  const h = {}
  if (t) h['Authorization'] = `Bearer ${t}`
  if (json) h['Content-Type'] = 'application/json'
  return h
}

const REC = {
  OVER:  { color: '#00e5a0', bg: 'rgba(0,229,160,0.08)',   border: 'rgba(0,229,160,0.25)',  icon: '↑' },
  UNDER: { color: '#60a5fa', bg: 'rgba(96,165,250,0.08)',  border: 'rgba(96,165,250,0.25)', icon: '↓' },
  SKIP:  { color: '#ff6b6b', bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.2)', icon: '—' },
}
const VAL = {
  excellent: { color: '#00e5a0', label: 'ODLIČNO',  dot: '#00e5a0' },
  good:      { color: '#a3e635', label: 'DOBRO',    dot: '#a3e635' },
  fair:      { color: '#ffd700', label: 'SOLIDNO',  dot: '#ffd700' },
  poor:      { color: '#ff6b6b', label: 'SLABO',    dot: '#ff6b6b' },
}
const PROP = { points: 'Poeni', rebounds: 'Skokovi', assists: 'Asistencije', pra: 'P+R+A' }

// ─── NBA Team Colors ──────────────────────────────────────────────────────────
const NBA_TEAM_COLORS = {
  Lakers:       { g1: 'rgba(85,37,131,0.14)',   g2: 'rgba(253,185,39,0.07)' },
  Celtics:      { g1: 'rgba(0,122,51,0.14)',     g2: 'rgba(186,150,83,0.06)' },
  Warriors:     { g1: 'rgba(29,66,138,0.13)',    g2: 'rgba(255,199,44,0.07)' },
  Bulls:        { g1: 'rgba(206,17,65,0.13)',    g2: 'rgba(0,0,0,0.06)' },
  Heat:         { g1: 'rgba(152,0,46,0.13)',     g2: 'rgba(249,160,27,0.06)' },
  Nets:         { g1: 'rgba(50,50,50,0.14)',     g2: 'rgba(200,200,200,0.04)' },
  Knicks:       { g1: 'rgba(0,107,182,0.13)',    g2: 'rgba(245,132,38,0.06)' },
  Bucks:        { g1: 'rgba(0,71,27,0.14)',      g2: 'rgba(238,225,198,0.05)' },
  Nuggets:      { g1: 'rgba(13,36,64,0.14)',     g2: 'rgba(254,197,36,0.08)' },
  Suns:         { g1: 'rgba(29,17,96,0.14)',     g2: 'rgba(229,96,32,0.07)' },
  Mavericks:    { g1: 'rgba(0,83,188,0.13)',     g2: 'rgba(0,43,127,0.06)' },
  Clippers:     { g1: 'rgba(200,16,46,0.13)',    g2: 'rgba(29,66,138,0.06)' },
  Thunder:      { g1: 'rgba(0,125,195,0.13)',    g2: 'rgba(239,59,36,0.06)' },
  Grizzlies:    { g1: 'rgba(93,118,169,0.13)',   g2: 'rgba(18,23,63,0.07)' },
  Spurs:        { g1: 'rgba(150,160,168,0.1)',   g2: 'rgba(0,0,0,0.07)' },
  Jazz:         { g1: 'rgba(0,43,92,0.14)',      g2: 'rgba(0,101,161,0.07)' },
  Rockets:      { g1: 'rgba(206,17,65,0.13)',    g2: 'rgba(198,203,210,0.05)' },
  Pelicans:     { g1: 'rgba(0,22,65,0.14)',      g2: 'rgba(180,151,90,0.06)' },
  Hawks:        { g1: 'rgba(225,68,52,0.13)',    g2: 'rgba(196,214,0,0.05)' },
  Cavaliers:    { g1: 'rgba(134,0,56,0.13)',     g2: 'rgba(4,30,66,0.07)' },
  Sixers:       { g1: 'rgba(0,107,182,0.13)',    g2: 'rgba(237,23,76,0.06)' },
  Raptors:      { g1: 'rgba(206,17,65,0.13)',    g2: 'rgba(6,25,34,0.07)' },
  Pacers:       { g1: 'rgba(0,45,98,0.14)',      g2: 'rgba(253,187,48,0.07)' },
  Magic:        { g1: 'rgba(0,125,197,0.13)',    g2: 'rgba(196,206,211,0.05)' },
  Hornets:      { g1: 'rgba(29,17,96,0.13)',     g2: 'rgba(0,120,140,0.07)' },
  Blazers:      { g1: 'rgba(224,58,62,0.13)',    g2: 'rgba(6,25,34,0.07)' },
  Timberwolves: { g1: 'rgba(12,35,64,0.14)',     g2: 'rgba(35,197,82,0.06)' },
  Kings:        { g1: 'rgba(91,43,130,0.13)',    g2: 'rgba(99,113,122,0.06)' },
  Pistons:      { g1: 'rgba(200,16,46,0.13)',    g2: 'rgba(29,66,138,0.06)' },
  Wizards:      { g1: 'rgba(0,43,92,0.13)',      g2: 'rgba(227,24,55,0.06)' },
}

function getTeamGradient(teamName) {
  if (!teamName) return null
  const key = Object.keys(NBA_TEAM_COLORS).find(k =>
    teamName.toLowerCase().includes(k.toLowerCase())
  )
  return key ? NBA_TEAM_COLORS[key] : null
}

// ─── Live Clock ───────────────────────────────────────────────────────────────
function LiveClock({ period, gameClock, isLive }) {
  const secsRef    = useRef(null)
  const ivRef      = useRef(null)
  const prevClock  = useRef(null)   // prethodni gameClock sa servera
  const frozenRef  = useRef(false)  // da li je sat zamrznut
  const [display, setDisplay] = useState('')
  const [frozen,  setFrozen]  = useState(false)

  function parse(gc) {
    if (!gc) return null
    const pt  = gc.match(/PT(\d+)M([\d.]+)S/)
    const col = gc.match(/(\d+):(\d+)/)
    if (pt)  return parseInt(pt[1]) * 60 + Math.floor(parseFloat(pt[2]))
    if (col) return parseInt(col[1]) * 60 + parseInt(col[2])
    return null
  }

  function fmt(s) {
    const m   = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `Q${period} ${m}:${sec.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    clearInterval(ivRef.current)
    if (!isLive) { setDisplay(''); setFrozen(false); prevClock.current = null; return }

    // Prazan gameClock = timeout / kraj četvrtine / pauza
    if (!gameClock) {
      setDisplay(period ? `Q${period} ⏸` : 'PAUZA')
      setFrozen(true); frozenRef.current = true
      prevClock.current = gameClock
      return
    }

    const parsed = parse(gameClock)

    // Nije parsiralo ili nula
    if (parsed === null || parsed === 0) {
      setDisplay(period ? `Q${period} ⏸` : 'PAUZA')
      setFrozen(true); frozenRef.current = true
      prevClock.current = gameClock
      return
    }

    // Isti gameClock kao prošli update → sat stoji (timeout / slobodna bacanja)
    if (gameClock === prevClock.current) {
      clearInterval(ivRef.current)
      setFrozen(true); frozenRef.current = true
      // Pokaži zamrznutu vrijednost sa simbolom pauze
      setDisplay(`${fmt(secsRef.current ?? parsed)} ⏸`)
      return
    }

    // Novi gameClock — sat je krenuo
    prevClock.current = gameClock
    setFrozen(false); frozenRef.current = false
    secsRef.current = parsed
    setDisplay(fmt(parsed))

    ivRef.current = setInterval(() => {
      // Ako je sat u međuvremenu zamrznut, ne tickaj
      if (frozenRef.current) { clearInterval(ivRef.current); return }
      secsRef.current = Math.max(0, secsRef.current - 1)
      setDisplay(fmt(secsRef.current))
      if (secsRef.current <= 0) {
        clearInterval(ivRef.current)
        setDisplay(period ? `Q${period} ⏸` : 'KRAJ')
      }
    }, 1000)

    return () => clearInterval(ivRef.current)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameClock, period, isLive])

  if (!isLive) return null
  return (
    <span style={{
      fontSize: 11, fontWeight: 700,
      color: frozen ? '#94a3b8' : '#00e5a0',
      background: frozen ? 'rgba(148,163,184,0.08)' : 'rgba(0,229,160,0.1)',
      border: `1px solid ${frozen ? 'rgba(148,163,184,0.2)' : 'rgba(0,229,160,0.2)'}`,
      borderRadius: 5, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 5,
      transition: 'color 0.3s, background 0.3s, border-color 0.3s',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: frozen ? '#94a3b8' : '#00e5a0',
        animation: frozen ? 'none' : 'livePulse 1.2s ease-in-out infinite',
        transition: 'background 0.3s',
      }} />
      {display || (period ? `Q${period} LIVE` : 'LIVE')}
    </span>
  )
}

// ─── Games Table ──────────────────────────────────────────────────────────────
function GamesTable({ games }) {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const T = {
    border:   dark ? '#1a2335'  : 'rgba(0,0,0,0.09)',
    border2:  dark ? '#0a0e1a'  : 'rgba(0,0,0,0.05)',
    headerBg: dark ? 'linear-gradient(90deg, #060a12, #080c18)' : 'linear-gradient(90deg, #f4f7fb, #f0f3f8)',
    headerTxt:dark ? '#253352'  : '#94a3b8',
    rowHover: dark ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.025)',
    text1:    dark ? '#e2e8f0'  : '#0c1a2e',
    text2:    dark ? '#94a3b8'  : '#4a6484',
    finishedTxt: dark ? '#475569' : '#94a3b8',
    surface:  dark ? 'transparent' : '#ffffff',
    shadow:   dark ? 'none'     : '0 2px 12px rgba(0,0,0,0.07)',
  }
  return (
    <div style={{ borderRadius: 16, border: `1px solid ${T.border}`, overflow: 'hidden', boxShadow: T.shadow }}>
      {/* Header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '120px 1fr 140px 1fr',
        background: T.headerBg, borderBottom: `1px solid ${T.border}`,
        padding: '10px 18px', backdropFilter: dark ? 'none' : 'none',
      }}>
        {['STATUS','DOMAĆIN','REZULTAT','GOST'].map((label, i) => (
          <div key={label} style={{
            fontSize: 9, color: T.headerTxt, letterSpacing: 1.8, fontWeight: 700,
            textAlign: i === 0 ? 'left' : i === 1 ? 'right' : i === 2 ? 'center' : 'left',
          }}>{label}</div>
        ))}
      </div>

      {/* Rows */}
      {games.map((game, idx) => {
        const homeFullName = [game.home_city, game.home_team].filter(Boolean).join(' ') || game.home_abbr || '—'
        const awayFullName = [game.away_city, game.away_team].filter(Boolean).join(' ') || game.away_abbr || '—'
        const rowBg = game.is_live
          ? 'linear-gradient(90deg, rgba(0,212,170,0.05) 0%, transparent 70%)'
          : T.surface
        return (
          <div key={idx} style={{
            display: 'grid', gridTemplateColumns: '120px 1fr 140px 1fr',
            alignItems: 'center', padding: '14px 18px',
            borderBottom: idx < games.length - 1 ? `1px solid ${T.border2}` : 'none',
            background: rowBg,
            borderLeft: `3px solid ${game.is_live ? '#00d4aa' : game.is_final ? T.border : 'rgba(255,107,0,0.4)'}`,
            animation: 'cardIn 0.4s ease both',
            animationDelay: `${idx * 0.05}s`,
            transition: 'background 0.2s',
          }}
            onMouseEnter={e => { if (!game.is_live) e.currentTarget.style.background = T.rowHover }}
            onMouseLeave={e => { e.currentTarget.style.background = rowBg }}
          >
            {/* Col 1 — status */}
            <div>
              {game.is_live ? (
                <LiveClock period={game.period} gameClock={game.game_clock} isLive={true} />
              ) : game.is_final ? (
                <span style={{ fontSize: 9, color: T.finishedTxt, fontWeight: 700, letterSpacing: 1 }}>ZAVRŠENO</span>
              ) : (
                <div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 19, color: '#ff9500', lineHeight: 1 }}>
                    {game.sr_time || '—'}
                  </div>
                  <div style={{ fontSize: 8, color: T.headerTxt, letterSpacing: 1, marginTop: 2 }}>DANAS</div>
                </div>
              )}
            </div>

            {/* Col 2 — home team */}
            <div style={{ textAlign: 'right', paddingRight: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: game.is_final ? T.finishedTxt : T.text1, lineHeight: 1.3 }}>
                {homeFullName}
              </div>
              {game.is_live && game.period && (
                <div style={{ fontSize: 9, color: '#00e5a0', marginTop: 2, fontWeight: 600, letterSpacing: 0.5 }}>
                  Četvrtina {game.period}
                </div>
              )}
            </div>

            {/* Col 3 — score / VS */}
            <div style={{ textAlign: 'center' }}>
              {(game.is_live || game.is_final) ? (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: game.is_live ? 'rgba(0,229,160,0.06)' : (dark ? '#060a12' : 'rgba(0,0,0,0.05)'),
                  border: `1px solid ${game.is_live ? 'rgba(0,229,160,0.2)' : (dark ? '#111827' : 'rgba(0,0,0,0.1)')}`,
                  borderRadius: 10, padding: '5px 12px',
                }}>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: game.is_live ? '#00e5a0' : T.finishedTxt, lineHeight: 1 }}>
                    {game.home_score ?? 0}
                  </span>
                  <span style={{ fontSize: 10, color: T.headerTxt, fontWeight: 700 }}>:</span>
                  <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 24, color: game.is_live ? '#00e5a0' : T.finishedTxt, lineHeight: 1 }}>
                    {game.away_score ?? 0}
                  </span>
                </div>
              ) : (
                <div style={{ display: 'inline-flex', alignItems: 'center',
                  background: 'rgba(255,107,0,0.06)', border: '1px solid rgba(255,107,0,0.15)',
                  borderRadius: 8, padding: '4px 14px',
                }}>
                  <span style={{ fontSize: 11, color: '#ff9500', fontWeight: 700, letterSpacing: 1.5 }}>VS</span>
                </div>
              )}
            </div>

            {/* Col 4 — away team */}
            <div style={{ paddingLeft: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: game.is_final ? T.finishedTxt : T.text2, lineHeight: 1.3 }}>
                {awayFullName}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Pick Card — NBA Trading Card + Aurora Shimmer + Flip ────────────────────
function PickCard({ pick, onSave, savedIds, idx }) {
  const rec     = REC[pick.recommendation] || REC.SKIP
  const todayStr = new Date().toLocaleDateString('sv-SE')
  const key     = `${pick.player_name}|${pick.prop_type}|${pick.line}|${todayStr}`
  const isSaved = savedIds.has(key)
  const [saving,  setSaving]  = useState(false)
  const [flipped, setFlipped] = useState(false)
  const backRef = useRef(null)
  const [backH,   setBackH]   = useState(0)

  useEffect(() => {
    if (backRef.current) setBackH(backRef.current.scrollHeight)
  }, [])

  const hasLine = pick.line && pick.line > 0
  const hasOdds = pick.odds && Object.keys(pick.odds).length > 0
  const conf    = pick.confidence ?? 0

  async function handleSave(e) {
    e.stopPropagation()
    if (isSaved || saving) return
    setSaving(true); await onSave(pick); setSaving(false)
  }

  // Bar calculation
  const barPct  = pick.avg_last_10 ? (() => {
    const diff  = pick.avg_last_10 - pick.line
    const scale = Math.max(pick.line * 0.3, 5)
    return Math.min(Math.abs(diff) / scale * 50, 50)
  })() : 0
  const barOver = pick.avg_last_10 ? pick.avg_last_10 >= pick.line : true

  return (
    <div style={{
      perspective: 900,
      animation: 'cardIn 0.5s ease both',
      animationDelay: `${idx * 0.07}s`,
    }}>
      {/* ── Flip container ── */}
      <div className="pick-card-flip" style={{
        position: 'relative',
        width: '100%',
        transformStyle: 'preserve-3d',
        transition: 'transform 0.55s cubic-bezier(0.4,0.2,0.2,1), height 0.4s ease',
        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        height: flipped ? (backH || 440) : 320,
      }}>

        {/* ══════════════ PREDNJA STRANA ══════════════ */}
        <div className="pick-card-face pick-card-front" style={{
          position: 'absolute', inset: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          borderRadius: 18, overflow: 'hidden',
          background: '#080c18',
          border: '2px solid rgba(96,165,250,0.22)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          animation: 'auroraGlow 5s ease-in-out infinite',
          pointerEvents: flipped ? 'none' : 'auto',
        }}>
          {/* Aurora nebula — border glow */}
          <div style={{
            position: 'absolute', inset: -2, borderRadius: 20, zIndex: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse at 0% 50%, rgba(0,229,160,0.18) 0%, transparent 55%), radial-gradient(ellipse at 100% 50%, rgba(167,139,250,0.18) 0%, transparent 55%), radial-gradient(ellipse at 50% 0%, rgba(96,165,250,0.12) 0%, transparent 50%)',
            animation: 'auroraDrift 5s ease-in-out infinite',
          }} />
          {/* Aurora drift overlay */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 16, zIndex: 2, pointerEvents: 'none',
            background: 'linear-gradient(100deg, rgba(0,229,160,0.03) 0%, rgba(96,165,250,0.05) 33%, rgba(167,139,250,0.04) 66%, rgba(0,229,160,0.02) 100%)',
            backgroundSize: '400% 100%',
            animation: 'auroraDrift 5s ease-in-out infinite',
          }} />

          {/* Content above overlays */}
          <div style={{ position: 'relative', zIndex: 3 }}>

            {/* Rainbow accent line */}
            <div style={{ height: 3, background: 'linear-gradient(90deg,#00e5a0,#60a5fa,#a78bfa,#00e5a0)', backgroundSize: '300%', animation: 'auroraLine 4s linear infinite' }} />

            {/* Header — dark section with player name */}
            <div style={{
              background: 'linear-gradient(160deg,#0d1829 0%,#070b16 100%)',
              padding: '16px 16px 12px', position: 'relative', overflow: 'hidden',
              borderBottom: '1px solid #0f1627',
            }}>
              {/* Jersey number ghost */}
              <div style={{ position: 'absolute', right: 10, top: -2, fontFamily: "'Bebas Neue',sans-serif", fontSize: 88, color: 'rgba(255,255,255,0.04)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
                {pick.jersey_number ?? '#'}
              </div>
              {/* Top-left glow */}
              <div style={{ position: 'absolute', top: -20, left: -20, width: 90, height: 90, borderRadius: '50%', background: 'radial-gradient(circle,rgba(96,165,250,0.07) 0%,transparent 70%)', pointerEvents: 'none' }} />

              <div style={{ fontSize: 9, color: '#60a5fa', letterSpacing: 2.5, fontWeight: 700, marginBottom: 4 }}>
                {pick.team?.toUpperCase()}
              </div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 30, color: '#ffffff', letterSpacing: 2, lineHeight: 1, marginBottom: 5 }}>
                {pick.player_name?.toUpperCase()}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#334155' }}>
                <span style={{ color: '#475569', fontWeight: 700 }}>{pick.team}</span>
                <span>vs</span>
                <span style={{ color: '#475569' }}>{pick.opponent}</span>
                <span>·</span>
                <span>{pick.is_home ? '🏠' : '✈️'}</span>
              </div>
            </div>

            {/* Stat boxes — GRANICA / AVG L10 / CONF */}
            <div style={{ display: 'flex', gap: 8, padding: '12px 14px', background: '#070b16', borderBottom: '1px solid #0f1627' }}>
              {/* GRANICA — orange */}
              <div style={{ flex: 1, background: 'rgba(255,106,0,0.08)', border: '1px solid rgba(255,106,0,0.25)', borderRadius: 10, padding: '10px 6px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,rgba(255,106,0,0.7),transparent)' }} />
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: '#ff9500', lineHeight: 1 }}>{hasLine ? pick.line : '—'}</div>
                <div style={{ fontSize: 7, color: 'rgba(255,106,0,0.55)', letterSpacing: 1.5, marginTop: 3, fontWeight: 700 }}>GRANICA</div>
              </div>
              {/* AVG L10 — rec color */}
              <div style={{ flex: 1, background: rec.bg, border: `1px solid ${rec.border}`, borderRadius: 10, padding: '10px 6px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg,transparent,${rec.color},transparent)` }} />
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: rec.color, lineHeight: 1 }}>{pick.avg_last_10 ?? '—'}</div>
                <div style={{ fontSize: 7, color: `${rec.color}88`, letterSpacing: 1.5, marginTop: 3, fontWeight: 700 }}>AVG L10</div>
              </div>
              {/* CONF — purple */}
              <div style={{ flex: 1, background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.22)', borderRadius: 10, padding: '10px 6px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg,transparent,rgba(167,139,250,0.7),transparent)' }} />
                <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 26, color: '#a78bfa', lineHeight: 1 }}>{conf}%</div>
                <div style={{ fontSize: 7, color: 'rgba(167,139,250,0.55)', letterSpacing: 1.5, marginTop: 3, fontWeight: 700 }}>CONF</div>
              </div>
            </div>

            {/* Bar */}
            {hasLine && pick.avg_last_10 && (
              <div style={{ padding: '8px 14px 10px', background: '#070b16', borderBottom: '1px solid #0f1627' }}>
                <div style={{ position: 'relative', height: 4, background: '#0a0e1a', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#1e3a5f', transform: 'translateX(-50%)' }} />
                  <div style={{
                    position: 'absolute',
                    left: barOver ? '50%' : `${50 - barPct}%`,
                    width: `${barPct}%`,
                    top: 0, bottom: 0,
                    background: barOver ? `linear-gradient(90deg,${rec.color}55,${rec.color}cc)` : 'linear-gradient(90deg,#ff6b6bcc,#ff6b6b55)',
                    borderRadius: 3,
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                  <span style={{ fontSize: 7, color: '#1e2d40', letterSpacing: 1, fontWeight: 700 }}>◄ UNDER</span>
                  <span style={{ fontSize: 7, color: '#1e2d40', letterSpacing: 1, fontWeight: 700 }}>OVER ►</span>
                </div>
              </div>
            )}

            {/* Footer — rec + DETALJI + save */}
            <div style={{ padding: '12px 14px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {/* Recommendation */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: rec.bg, border: `1px solid ${rec.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Bebas Neue',sans-serif", fontSize: 20, color: rec.color }}>
                  {rec.icon}
                </div>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: rec.color, letterSpacing: 2, lineHeight: 1 }}>{pick.recommendation}</div>
                  <div style={{ fontSize: 9, color: `${rec.color}88`, letterSpacing: 1, marginTop: 1 }}>{PROP[pick.prop_type] || pick.prop_type}</div>
                </div>
              </div>

              {/* DETALJI button */}
              <button onClick={() => setFlipped(true)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg,rgba(96,165,250,0.14),rgba(167,139,250,0.11))',
                border: '1px solid rgba(96,165,250,0.38)',
                borderRadius: 10, padding: '8px 13px',
                cursor: 'pointer', fontFamily: "'DM Sans',sans-serif",
                animation: 'btnSheen 2.5s ease-in-out infinite',
              }}>
                <span style={{ fontSize: 13, color: '#60a5fa', display: 'inline-block', animation: 'btnSpin 4s linear infinite' }}>↻</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#93c5fd', letterSpacing: 1.5 }}>DETALJI</span>
              </button>
            </div>

            {/* Save button */}
            {hasLine && (
              <div style={{ padding: '0 14px 14px' }}>
                <button onClick={handleSave} disabled={isSaved || saving} style={{
                  width: '100%', padding: '9px 0', borderRadius: 9,
                  fontSize: 12, fontWeight: 700, cursor: isSaved ? 'default' : 'pointer',
                  fontFamily: "'DM Sans',sans-serif", transition: 'all 0.2s',
                  background: isSaved ? 'rgba(0,229,160,0.07)' : `linear-gradient(135deg,${rec.color}dd,${rec.color})`,
                  color: isSaved ? '#00e5a0' : '#000',
                  border: isSaved ? '1px solid rgba(0,229,160,0.2)' : 'none',
                  letterSpacing: 0.5,
                }}>
                  {saving ? '⏳' : isSaved ? '✓ SAČUVANO' : '+ SAČUVAJ TIP'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════ POLEĐINA ══════════════ */}
        <div ref={backRef} className="pick-card-face pick-card-back" style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
          transform: 'rotateY(180deg)',
          borderRadius: 18, overflow: 'hidden',
          background: '#0c1220',
          border: '2px solid rgba(96,165,250,0.18)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
          pointerEvents: flipped ? 'auto' : 'none',
        }}>
          {/* Thin aurora border only — no overlay on content */}
          <div style={{ position: 'absolute', inset: -2, borderRadius: 20, zIndex: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse at 0% 100%,rgba(0,229,160,0.1) 0%,transparent 50%), radial-gradient(ellipse at 100% 0%,rgba(167,139,250,0.1) 0%,transparent 50%)', animation: 'auroraDrift 5s ease-in-out infinite' }} />

          <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Rainbow line */}
            <div style={{ height: 3, background: 'linear-gradient(90deg,#00e5a0,#60a5fa,#a78bfa,#00e5a0)', backgroundSize: '300%', animation: 'auroraLine 4s linear infinite', flexShrink: 0 }} />

            {/* Header */}
            <div style={{ padding: '11px 16px 10px', background: '#111827', borderBottom: '1px solid #1e2a3a', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, letterSpacing: 0.5 }}>
                {pick.player_name} · {PROP[pick.prop_type] || pick.prop_type}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', borderRadius: 6, padding: '3px 9px' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#00e5a0', animation: 'glow 2s ease-in-out infinite', display: 'inline-block' }} />
                <span style={{ fontSize: 9, color: '#00e5a0', fontWeight: 700, letterSpacing: 1 }}>ODLIČNO</span>
              </div>
            </div>

            {/* Statistike */}
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a2335', flexShrink: 0 }}>
              <div style={{ fontSize: 8, color: '#475569', letterSpacing: 2.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Statistike</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { v: pick.season_avg ?? pick.avg_last_10, l: 'Sez AVG', c: '#ff9500' },
                  { v: pick.avg_last_10, l: 'L10 AVG', c: '#00e5a0' },
                  { v: pick.avg_last_5, l: 'L5 AVG', c: '#60a5fa' },
                  { v: conf + '%', l: 'CONF', c: '#a78bfa' },
                ].map(s => (
                  <div key={s.l} style={{ flex: 1, textAlign: 'center', background: '#111827', border: '1px solid #1e2a3a', borderRadius: 8, padding: '7px 4px' }}>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: s.c, lineHeight: 1 }}>{s.v ?? '—'}</div>
                    <div style={{ fontSize: 7, color: '#475569', letterSpacing: 1, marginTop: 3, fontWeight: 600 }}>{s.l}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Razlozi */}
            {pick.key_factors?.length > 0 && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a2335', flexShrink: 0 }}>
                <div style={{ fontSize: 8, color: '#475569', letterSpacing: 2.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>AI Razlozi</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {pick.key_factors.slice(0, 4).map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                      <span style={{ color: '#60a5fa', fontSize: 12, flexShrink: 0, lineHeight: 1.4, fontWeight: 700 }}>›</span>
                      <span style={{ fontSize: 12, color: '#cbd5e1', lineHeight: 1.45 }}>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Kvote */}
            {hasOdds && (
              <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a2335', flexShrink: 0 }}>
                <div style={{ fontSize: 8, color: '#475569', letterSpacing: 2.5, fontWeight: 700, textTransform: 'uppercase', marginBottom: 8 }}>Kvote</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(pick.odds).map(([book, odds]) => odds && (
                    <div key={book} style={{ background: '#111827', border: '1px solid #1e2a3a', borderRadius: 7, padding: '5px 10px' }}>
                      <div style={{ fontSize: 9, color: '#475569', fontWeight: 600, marginBottom: 1 }}>{book}</div>
                      <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 800 }}>
                        {pick.recommendation === 'OVER' ? odds.over || '—' : odds.under || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ padding: '11px 16px 13px', background: '#111827', borderTop: '1px solid #1e2a3a', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 18, color: rec.color, letterSpacing: 2 }}>
                {rec.icon} {pick.recommendation} {hasLine ? pick.line : ''}
              </div>
              <button onClick={() => setFlipped(false)} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'rgba(255,106,0,0.07)', border: '1px solid rgba(255,106,0,0.22)',
                borderRadius: 8, padding: '7px 13px', cursor: 'pointer',
                fontFamily: "'DM Sans',sans-serif",
              }}>
                <span style={{ fontSize: 9, color: '#ff6a00', fontWeight: 700, letterSpacing: 1.5 }}>↻ NAZAD</span>
              </button>
            </div>
          </div>
        </div>

      </div>{/* /flip container */}
    </div>
  )
}

// ─── Arena Spotlight Header ───────────────────────────────────────────────────
function ArenaSpotlight({ liveCount = 0, gamesCount = 0, picksCount = 0, today = '' }) {
  const dustRef = useRef(null)
  useEffect(() => {
    const c = dustRef.current
    if (!c) return
    for (let i = 0; i < 24; i++) {
      const p = document.createElement('div')
      p.style.cssText = `
        position:absolute; width:2px; height:2px; border-radius:50%;
        background:rgba(255,220,120,0.45); animation:dustFloat linear infinite;
        left:${50 + Math.random() * 240 - 120}%; top:${Math.random() * 100}%;
        --dx:${(Math.random() - 0.5) * 70}px; --dy:${-Math.random() * 150}px;
        animation-duration:${3 + Math.random() * 5}s;
        animation-delay:${-Math.random() * 8}s;
        opacity:${0.2 + Math.random() * 0.5};
      `
      c.appendChild(p)
    }
    return () => { c.innerHTML = '' }
  }, [])
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      borderRadius: '0 0 28px 28px',
      background: '#000', minHeight: 380,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      marginBottom: 32, border: '1px solid #111', borderTop: 'none',
    }}>
      <div style={{ position:'absolute',inset:0, background:'radial-gradient(ellipse at 50% 0%,#0d0d1a 0%,#000 60%)', pointerEvents:'none' }} />
      {/* Left cone */}
      <div style={{ position:'absolute',top:0,left:'5%', width:0,height:0, borderLeft:'130px solid transparent',borderRight:'130px solid transparent',borderTop:'380px solid rgba(255,220,100,0.04)', transformOrigin:'top center',animation:'sweepLeft 8s ease-in-out infinite',filter:'blur(8px)' }} />
      <div style={{ position:'absolute',top:0,left:'calc(5% + 80px)', width:90,height:340, background:'linear-gradient(180deg,rgba(255,220,100,0.14) 0%,rgba(255,180,50,0.03) 70%,transparent 100%)', transformOrigin:'top center',animation:'sweepLeft 8s ease-in-out infinite',filter:'blur(16px)',borderRadius:'0 0 60px 60px' }} />
      {/* Right cone */}
      <div style={{ position:'absolute',top:0,right:'5%', width:0,height:0, borderLeft:'130px solid transparent',borderRight:'130px solid transparent',borderTop:'380px solid rgba(255,220,100,0.04)', transformOrigin:'top center',animation:'sweepRight 8s ease-in-out infinite',filter:'blur(8px)' }} />
      <div style={{ position:'absolute',top:0,right:'calc(5% + 80px)', width:90,height:340, background:'linear-gradient(180deg,rgba(255,220,100,0.14) 0%,rgba(255,180,50,0.03) 70%,transparent 100%)', transformOrigin:'top center',animation:'sweepRight 8s ease-in-out infinite',filter:'blur(16px)',borderRadius:'0 0 60px 60px' }} />
      {/* Floor pool */}
      <div style={{ position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)', width:560,height:72, background:'radial-gradient(ellipse,rgba(255,200,60,0.10) 0%,transparent 70%)', animation:'floorPulse 8s ease-in-out infinite',pointerEvents:'none' }} />
      {/* Shimmer bar at bottom */}
      <div style={{ position:'absolute',bottom:0,left:0,right:0,height:2,background:'#050505',overflow:'hidden' }}>
        <div style={{ height:'100%',width:'40%',background:'linear-gradient(90deg,transparent,rgba(255,107,0,0.5),transparent)',animation:'barSlide 3s ease-in-out infinite' }} />
      </div>
      {/* Dust */}
      <div ref={dustRef} style={{ position:'absolute',top:20,left:'50%',transform:'translateX(-50%)', width:320,height:310,pointerEvents:'none' }} />
      {/* Logo + stats */}
      <div style={{ position:'relative',zIndex:10,textAlign:'center',padding:'36px 20px' }}>
        {/* Date pill — spaced above the title */}
        {today && (
          <div style={{ display:'inline-flex',alignItems:'center',gap:8,background:'rgba(255,107,0,0.08)',border:'1px solid rgba(255,107,0,0.2)',borderRadius:30,padding:'4px 12px',marginBottom:28,animation:'fadeIn 0.5s ease' }}>
            <span style={{ width:5,height:5,borderRadius:'50%',background:'#ff6b00',animation:'glow 2s ease-in-out infinite' }} />
            <span style={{ fontSize:10,color:'#ff9500',fontWeight:700,letterSpacing:2,textTransform:'uppercase' }}>NBA · {today}</span>
            {liveCount > 0 && (
              <span style={{ background:'rgba(0,229,160,0.15)',border:'1px solid rgba(0,229,160,0.3)',color:'#00e5a0',borderRadius:20,padding:'2px 9px',fontSize:9,fontWeight:700,letterSpacing:1 }}>
                {liveCount} LIVE
              </span>
            )}
          </div>
        )}
        <h1 style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:'clamp(76px,10vw,128px)', letterSpacing:6,lineHeight:0.88,color:'#ffffff', textShadow:'0 0 30px rgba(255,200,60,0.6),0 0 60px rgba(255,160,0,0.35),0 0 100px rgba(255,100,0,0.15)', animation:'logoGlow 8s ease-in-out infinite',margin:0 }}>
          COURT<br /><span style={{ color:'#ff6a00' }}>EDGE</span>
        </h1>
        <p style={{ fontSize:11,letterSpacing:5,color:'rgba(255,200,60,0.45)',textTransform:'uppercase',marginTop:14,fontWeight:600,marginBottom:22 }}>
          AI-Powered NBA Prop Analiza
        </p>
        {/* Stats row */}
        <div style={{ display:'flex',justifyContent:'center',gap:12,flexWrap:'wrap' }}>
          {[
            { label:'Mečeva danas', value: gamesCount || '—', color:'#ff6a00' },
            { label:'AI tipova',    value: picksCount || '—', color:'#00d4aa' },
            { label:'Live',         value: liveCount,          color: liveCount > 0 ? '#00d4aa' : 'rgba(255,255,255,0.12)' },
          ].map(s => (
            <div key={s.label} style={{ background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)',borderRadius:10,padding:'8px 18px',textAlign:'center',backdropFilter:'blur(4px)' }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:s.color,lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:9,color:'rgba(255,255,255,0.25)',letterSpacing:1.5,textTransform:'uppercase',marginTop:3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Games Timeline ────────────────────────────────────────────────────────────
function GamesTimeline({ games, dark }) {
  const scrollRef = useRef(null)
  const nowRef    = useRef(null)
  const dragging  = useRef(false)
  const startX    = useRef(0)
  const scrollL   = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const down = e => { dragging.current=true; startX.current=e.pageX-el.offsetLeft; scrollL.current=el.scrollLeft; el.style.cursor='grabbing' }
    const up   = () => { dragging.current=false; el.style.cursor='grab' }
    const move = e => { if(!dragging.current)return; e.preventDefault(); el.scrollLeft=scrollL.current-(e.pageX-el.offsetLeft-startX.current) }
    el.addEventListener('mousedown',down); el.addEventListener('mouseleave',up)
    el.addEventListener('mouseup',up);     el.addEventListener('mousemove',move)
    return () => { el.removeEventListener('mousedown',down); el.removeEventListener('mouseleave',up); el.removeEventListener('mouseup',up); el.removeEventListener('mousemove',move) }
  }, [])

  // Center the NOW divider in the scroll container on mount
  useEffect(() => {
    const el  = scrollRef.current
    const now = nowRef.current
    if (!el || !now) return
    el.scrollLeft = now.offsetLeft - el.offsetWidth / 2 + 24
  }, [games])

  // Live clock for NOW label
  const [nowTime, setNowTime] = useState(() => {
    const d = new Date()
    return d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit', hour12: false })
  })
  useEffect(() => {
    const iv = setInterval(() => {
      const d = new Date()
      setNowTime(d.toLocaleTimeString('sr-RS', { hour: '2-digit', minute: '2-digit', hour12: false }))
    }, 10000)
    return () => clearInterval(iv)
  }, [])

  const finished  = games.filter(g => g.is_final)
  const live      = games.filter(g => g.is_live)
  const scheduled = games.filter(g => !g.is_live && !g.is_final)
  const sorted    = [...finished, ...live, ...scheduled]

  function stripe(team) {
    if (!team) return '#1a2335'
    const n = team.toLowerCase()
    if (n.includes('laker'))    return 'linear-gradient(90deg,#552581,#fdb927)'
    if (n.includes('celtic'))   return 'linear-gradient(90deg,#007a33,#ba9653)'
    if (n.includes('warrior'))  return 'linear-gradient(90deg,#1d428a,#ffc72c)'
    if (n.includes('nugget'))   return 'linear-gradient(90deg,#0d2240,#fec524)'
    if (n.includes('buck'))     return 'linear-gradient(90deg,#00471b,#eee1c6)'
    if (n.includes('heat'))     return 'linear-gradient(90deg,#98002e,#f9a01b)'
    if (n.includes('thunder'))  return 'linear-gradient(90deg,#007dc5,#ef3b27)'
    if (n.includes('sun'))      return 'linear-gradient(90deg,#1d1160,#e56020)'
    if (n.includes('knick'))    return 'linear-gradient(90deg,#006bb6,#f58426)'
    if (n.includes('bull'))     return 'linear-gradient(90deg,#ce1141,#000)'
    if (n.includes('mav'))      return 'linear-gradient(90deg,#00538c,#002b7f)'
    if (n.includes('hawk'))     return 'linear-gradient(90deg,#e13a3e,#c4d600)'
    if (n.includes('cavalier') || n.includes('cavs')) return 'linear-gradient(90deg,#860038,#041e42)'
    if (n.includes('clipper'))  return 'linear-gradient(90deg,#c8102e,#1d428a)'
    if (n.includes('grizzl'))   return 'linear-gradient(90deg,#5d76a9,#12173f)'
    if (n.includes('spur'))     return 'linear-gradient(90deg,#c4ced4,#000)'
    if (n.includes('rocket'))   return 'linear-gradient(90deg,#ce1141,#c4ced4)'
    if (n.includes('pacer'))    return 'linear-gradient(90deg,#002d62,#fdbb30)'
    if (n.includes('magic'))    return 'linear-gradient(90deg,#007dc5,#c4ced4)'
    if (n.includes('net'))      return 'linear-gradient(90deg,#222,#555)'
    if (n.includes('raptor'))   return 'linear-gradient(90deg,#ce1141,#000)'
    if (n.includes('sixers') || n.includes('76ers')) return 'linear-gradient(90deg,#006bb6,#ed174c)'
    if (n.includes('wolves') || n.includes('timberwolf')) return 'linear-gradient(90deg,#0c2340,#236192)'
    if (n.includes('blazer'))   return 'linear-gradient(90deg,#e03a3e,#000)'
    if (n.includes('king'))     return 'linear-gradient(90deg,#5a2d82,#63717a)'
    if (n.includes('jazz'))     return 'linear-gradient(90deg,#002b5c,#00471b)'
    if (n.includes('pistons') || n.includes('piston')) return 'linear-gradient(90deg,#c8102e,#1d428a)'
    if (n.includes('wizard'))   return 'linear-gradient(90deg,#002b5c,#e31837)'
    if (n.includes('hornet'))   return 'linear-gradient(90deg,#1d1160,#00788c)'
    if (n.includes('pelican'))  return 'linear-gradient(90deg,#0c2340,#85714d)'
    return 'linear-gradient(90deg,#1a2335,#253352)'
  }

  if (sorted.length === 0) return (
    <div style={{ textAlign:'center',padding:'40px 20px',background:dark?'#0a0e1a':'#f4f7fb',border:`1px dashed ${dark?'#1a2335':'rgba(0,0,0,0.1)'}`,borderRadius:16 }}>
      <div style={{ fontSize:36,marginBottom:10 }}>🏀</div>
      <div style={{ fontSize:14,color:dark?'#334155':'#7a9ab8' }}>Nema mečeva za danas</div>
    </div>
  )

  // NOW divider — centered in viewport on mount via nowRef
  const NowDivider = () => (
    <div ref={nowRef} style={{ display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0,width:52,position:'relative',zIndex:6,alignSelf:'stretch' }}>
      {/* Current time */}
      <div style={{ fontSize:11,fontFamily:"'Bebas Neue',sans-serif",letterSpacing:2,color:'#ff6a00',marginBottom:3,lineHeight:1 }}>{nowTime}</div>
      {/* NOW badge */}
      <div style={{ fontSize:7,letterSpacing:3,color:'#ff6a00',background:dark?'#05080f':'#fff',border:'1px solid rgba(255,106,0,0.5)',padding:'2px 8px',borderRadius:3,fontWeight:700,whiteSpace:'nowrap',marginBottom:0,boxShadow:'0 0 12px rgba(255,106,0,0.25)' }}>NOW</div>
      {/* Vertical line — fills remaining height */}
      <div style={{ width:1,flexGrow:1,minHeight:160,background:'linear-gradient(180deg,rgba(255,106,0,0.9) 0%,rgba(255,106,0,0.3) 60%,transparent 100%)',position:'relative' }}>
        <div style={{ position:'absolute',inset:0,borderLeft:'1px dashed rgba(255,106,0,0.55)' }} />
      </div>
    </div>
  )

  return (
    <div ref={scrollRef} style={{ overflowX:'auto',overflowY:'visible',cursor:'grab',paddingBottom:12,scrollbarWidth:'thin',scrollbarColor:'#1e2d40 transparent',WebkitOverflowScrolling:'touch' }}>
      <div style={{ display:'flex',position:'relative',padding:'36px 32px 8px',minWidth:'max-content',alignItems:'flex-start',gap:0 }}>
        {/* Rail */}
        <div style={{ position:'absolute',top:36,left:0,right:0,height:1,pointerEvents:'none',
          background:'linear-gradient(90deg,transparent 0%,#1a2335 4%,#253352 30%,#334155 48%,#334155 52%,#253352 70%,#1a2335 96%,transparent 100%)' }} />

        {[...finished, ...live].map((game, idx) => {
          const homeLabel = game.home_team || game.home_abbr || '—'
          const awayLabel = game.away_team || game.away_abbr || '—'
          const isLive  = game.is_live
          const isFinal = game.is_final
          const isSched = !isLive && !isFinal
          const homeLeading = isLive && (game.home_score??0) > (game.away_score??0)
          const awayLeading = isLive && (game.away_score??0) > (game.home_score??0)
          const homeWon = isFinal && (game.home_score??0) > (game.away_score??0)
          const awayWon = isFinal && (game.away_score??0) > (game.home_score??0)
          const cardBorder = isLive ? 'rgba(0,229,160,0.22)' : isSched ? 'rgba(255,106,0,0.16)' : (dark ? '#253352' : 'rgba(0,0,0,0.1)')
          const topStripe  = isLive ? stripe(homeLabel) : isFinal ? (dark?'#111827':'#d1d5db') : 'linear-gradient(90deg,#1a2335,#253352)'
          const nameColor  = (lead, won) => lead ? '#00e5a0' : won ? (dark?'#e2e8f0':'#0c1a2e') : (!won&&isFinal) ? (dark?'#475569':'#94a3b8') : (dark?'#64748b':'#64748b')
          const scoreColor = (lead, won) => lead ? '#00e5a0' : won ? (dark?'#94a3b8':'#64748b') : (dark?'#475569':'#94a3b8')

          return (
            <div key={idx} style={{ display:'flex',flexDirection:'column',alignItems:'center',width:196,flexShrink:0,position:'relative',animation:`tlGameIn 0.5s cubic-bezier(0.16,1,0.3,1) ${idx*0.07}s both` }}>
              {/* Time label + node */}
              <div style={{ display:'flex',flexDirection:'column',alignItems:'center',zIndex:2 }}>
                <div style={{ fontSize:8,letterSpacing:2,color:dark?'#334155':'#94a3b8',fontWeight:700,marginBottom:6,height:14,display:'flex',alignItems:'center' }}>
                  {game.sr_time || ''}
                </div>
                <div style={{ width:14,height:14,borderRadius:'50%',flexShrink:0,
                  background: isLive ? '#00e5a0' : isSched ? 'transparent' : (dark?'#0d1626':'#d1d5db'),
                  border: isLive ? 'none' : isSched ? '2px solid rgba(255,106,0,0.5)' : `1px solid ${dark?'#253352':'#94a3b8'}`,
                  boxShadow: isLive ? '0 0 10px rgba(0,229,160,0.8),0 0 24px rgba(0,229,160,0.3)' : 'none',
                  animation: isLive ? 'tlNodePulse 1.5s ease-in-out infinite' : 'none',
                }} />
              </div>
              {/* Connector */}
              <div style={{ width:1,height:18,background:'linear-gradient(180deg,#253352,rgba(30,45,64,0.3))',flexShrink:0 }} />
              {/* Card */}
              <div style={{ width:172,background:dark?'#080c18':'#fff',border:`1px solid ${cardBorder}`,borderRadius:12,overflow:'hidden',transition:'border-color 0.2s,transform 0.2s',opacity:isFinal?0.85:1,boxShadow:dark?'none':'0 2px 12px rgba(0,0,0,0.07)' }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.borderColor=isLive?'rgba(0,229,160,0.4)':isSched?'rgba(255,106,0,0.3)':(dark?'#334155':'#94a3b8')}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.borderColor=cardBorder}}>
                <div style={{ height:2,background:topStripe,borderRadius:'12px 12px 0 0' }} />
                <div style={{ padding:'10px 12px' }}>
                  {/* Status */}
                  <div style={{ display:'flex',alignItems:'center',gap:5,marginBottom:9 }}>
                    {isLive && <span style={{ width:6,height:6,borderRadius:'50%',background:'#00e5a0',animation:'livePulse 1.2s ease-in-out infinite',flexShrink:0 }} />}
                    {isLive
                      ? <LiveClock period={game.period} gameClock={game.game_clock} isLive={true} />
                      : <span style={{ fontSize:8,letterSpacing:2,fontWeight:700,color:isFinal?(dark?'#253352':'#94a3b8'):(dark?'#475569':'#7a9ab8') }}>
                          {isFinal ? 'ZAVRŠENO' : (game.sr_time || 'ZAKAZANO')}
                        </span>
                    }
                  </div>
                  {/* Teams */}
                  {isSched ? (
                    <>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:30,color:dark?'#e2e8f0':'#0c1a2e',letterSpacing:2,lineHeight:1,textAlign:'center' }}>{game.sr_time||'—'}</div>
                      <div style={{ display:'flex',alignItems:'center',margin:'8px 0',gap:6 }}>
                        <div style={{ flex:1,height:1,background:dark?'#111827':'#e2e8f0' }} />
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:10,color:dark?'#1e2d40':'#94a3b8',letterSpacing:3 }}>VS</span>
                        <div style={{ flex:1,height:1,background:dark?'#111827':'#e2e8f0' }} />
                      </div>
                      <div style={{ display:'flex',flexDirection:'column',gap:3 }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:dark?'#94a3b8':'#475569',letterSpacing:1 }}>{homeLabel}</span>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:dark?'#94a3b8':'#475569',letterSpacing:1 }}>{awayLabel}</span>
                      </div>
                    </>
                  ) : (
                    <div style={{ display:'flex',flexDirection:'column',gap:5 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline' }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:19,letterSpacing:1.5,lineHeight:1,color:nameColor(homeLeading,homeWon),textShadow:homeLeading?'0 0 12px rgba(0,229,160,0.3)':'none' }}>{homeLabel}</span>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:19,letterSpacing:1,lineHeight:1,color:scoreColor(homeLeading,homeWon) }}>{game.home_score??0}</span>
                      </div>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'baseline' }}>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:19,letterSpacing:1.5,lineHeight:1,color:nameColor(awayLeading,awayWon),textShadow:awayLeading?'0 0 12px rgba(0,229,160,0.3)':'none' }}>{awayLabel}</span>
                        <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:19,letterSpacing:1,lineHeight:1,color:scoreColor(awayLeading,awayWon) }}>{game.away_score??0}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}

        {/* NOW divider — only when there are scheduled games */}
        {scheduled.length > 0 && <NowDivider />}

        {scheduled.map((game, idx) => {
          const homeLabel = game.home_team || game.home_abbr || '—'
          const awayLabel = game.away_team || game.away_abbr || '—'
          const cardBorder = 'rgba(255,106,0,0.16)'
          const topStripe  = 'linear-gradient(90deg,#1a2335,#253352)'
          const globalIdx  = finished.length + live.length + idx

          return (
            <div key={`sched-${idx}`} style={{ display:'flex',flexDirection:'column',alignItems:'center',width:196,flexShrink:0,position:'relative',animation:`tlGameIn 0.5s cubic-bezier(0.16,1,0.3,1) ${globalIdx*0.07}s both` }}>
              {/* Time label + node */}
              <div style={{ display:'flex',flexDirection:'column',alignItems:'center',zIndex:2 }}>
                <div style={{ fontSize:8,letterSpacing:2,color:dark?'#334155':'#94a3b8',fontWeight:700,marginBottom:6,height:14,display:'flex',alignItems:'center' }}>
                  {game.sr_time || ''}
                </div>
                <div style={{ width:14,height:14,borderRadius:'50%',flexShrink:0,
                  background:'transparent',
                  border:'2px solid rgba(255,106,0,0.5)',
                  boxShadow:'none',animation:'none',
                }} />
              </div>
              {/* Connector */}
              <div style={{ width:1,height:18,background:'linear-gradient(180deg,rgba(255,106,0,0.3),rgba(30,45,64,0.2))',flexShrink:0 }} />
              {/* Card */}
              <div style={{ width:172,background:dark?'#080c18':'#fff',border:`1px solid ${cardBorder}`,borderRadius:12,overflow:'hidden',transition:'border-color 0.2s,transform 0.2s',boxShadow:dark?'none':'0 2px 12px rgba(0,0,0,0.07)' }}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.borderColor='rgba(255,106,0,0.3)'}}
                onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.borderColor=cardBorder}}>
                <div style={{ height:2,background:topStripe,borderRadius:'12px 12px 0 0' }} />
                <div style={{ padding:'10px 12px' }}>
                  <div style={{ display:'flex',alignItems:'center',gap:5,marginBottom:9 }}>
                    <span style={{ fontSize:8,letterSpacing:2,fontWeight:700,color:dark?'#475569':'#7a9ab8' }}>
                      {game.sr_time || 'ZAKAZANO'}
                    </span>
                  </div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:dark?'#e2e8f0':'#0c1a2e',letterSpacing:2,lineHeight:1,textAlign:'center',marginBottom:8 }}>{game.sr_time||'—'}</div>
                  <div style={{ display:'flex',alignItems:'center',margin:'6px 0 8px',gap:6 }}>
                    <div style={{ flex:1,height:1,background:dark?'#111827':'#e2e8f0' }} />
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:10,color:dark?'#1e2d40':'#94a3b8',letterSpacing:3 }}>VS</span>
                    <div style={{ flex:1,height:1,background:dark?'#111827':'#e2e8f0' }} />
                  </div>
                  <div style={{ display:'flex',flexDirection:'column',gap:3 }}>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:dark?'#94a3b8':'#64748b',letterSpacing:1 }}>{homeLabel}</span>
                    <span style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:17,color:dark?'#94a3b8':'#64748b',letterSpacing:1 }}>{awayLabel}</span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Picks Ticker ─────────────────────────────────────────────────────────────
function PicksTicker({ picks, dark }) {
  if (!picks || picks.length === 0) return null

  const recColor = { OVER: '#00e5a0', UNDER: '#60a5fa' }
  const propLabel = { points: 'PTS', rebounds: 'REB', assists: 'AST', pra: 'PRA' }

  // Duplicate for seamless infinite scroll
  const items = [...picks, ...picks]

  return (
    <div style={{
      background: dark ? '#020508' : '#f1f5f9',
      border: `1px solid ${dark ? '#0d1626' : 'rgba(0,0,0,0.07)'}`,
      borderRadius: 12, overflow: 'hidden', marginBottom: 28,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '7px 16px',
        background: dark ? '#040812' : '#e8edf4',
        borderBottom: `1px solid ${dark ? '#0d1626' : 'rgba(0,0,0,0.06)'}`,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#00e5a0', boxShadow: '0 0 8px #00e5a0', animation: 'livePulse 1.2s ease-in-out infinite', flexShrink: 0 }} />
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 3, color: '#00e5a0', textTransform: 'uppercase' }}>AI Tipovi</span>
        <span style={{ fontSize: 9, color: dark ? '#1e3250' : '#94a3b8', marginLeft: 2 }}>· {picks.length} {picks.length < 5 ? 'tipa' : 'tipova'} za danas</span>
      </div>
      {/* Scrolling track */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* fade edges */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 64, background: `linear-gradient(90deg,${dark ? '#020508' : '#f1f5f9'},transparent)`, zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 64, background: `linear-gradient(-90deg,${dark ? '#020508' : '#f1f5f9'},transparent)`, zIndex: 2, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', width: 'max-content', animation: 'tickerScroll 30s linear infinite' }}
          onMouseEnter={e => e.currentTarget.style.animationPlayState = 'paused'}
          onMouseLeave={e => e.currentTarget.style.animationPlayState = 'running'}
        >
          {items.map((p, i) => {
            const col = recColor[p.recommendation] || '#475569'
            const prop = propLabel[p.prop_type] || p.prop_type?.toUpperCase()
            return (
              <div key={i} style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '9px 22px',
                borderRight: `1px solid ${dark ? '#0d1626' : 'rgba(0,0,0,0.06)'}`,
                whiteSpace: 'nowrap', cursor: 'default',
                transition: 'background 0.15s',
              }}
                onMouseEnter={e => e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.04)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: col, flexShrink: 0 }} />
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 15, letterSpacing: 1, color: dark ? '#94a3b8' : '#334155' }}>{p.player_name}</span>
                <span style={{ fontSize: 9, color: dark ? '#1e3250' : '#94a3b8', fontWeight: 700, letterSpacing: 1 }}>{prop}</span>
                <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 17, letterSpacing: 1, color: col }}>{p.avg_last_10?.toFixed(1)}</span>
                <span style={{ fontSize: 9, color: dark ? '#1e3250' : '#94a3b8' }}>/ {p.line}</span>
                <span style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: 1.5, color: col,
                  background: col + '18', border: `1px solid ${col}33`,
                  borderRadius: 4, padding: '1px 6px',
                }}>{p.recommendation}</span>
                <span style={{ fontSize: 9, color: dark ? '#0d1626' : '#d1d5db' }}>·</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [games, setGames] = useState([])
  const [gamesLoading, setGamesLoading] = useState(true)
  const [picks, setPicks] = useState([])
  const [savedIds, setSavedIds] = useState(new Set())
  const [toast, setToast] = useState(null)
  const [liveCount, setLiveCount] = useState(0)
  const [countdown, setCountdown] = useState('')
  const toastRef = useRef(null)

  // Countdown do 16:00 — osvežava se svake sekunde dok nema tipova
  useEffect(() => {
    if (picks.length > 0) return
    function tick() {
      const now  = new Date()
      const next = new Date()
      next.setHours(16, 0, 0, 0)
      if (now >= next) next.setDate(next.getDate() + 1)
      const diff = next - now
      const h  = String(Math.floor(diff / 3600000)).padStart(2, '0')
      const m  = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0')
      const s  = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0')
      setCountdown(`${h}:${m}:${s}`)
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [picks.length])

  useEffect(() => {
    loadGames(true)
    loadSavedIds()
    loadCachedPicks()

    // ── SSE stream za live sat — backend gura update svakih 5s (live) / 30s (idle)
    let es = null
    let fallbackIv = null

    function applyGamesData(d) {
      if (!d.games) return
      setGames(d.games.filter(g => !g.error))
      setLiveCount(d.live_count || 0)
      if (d.games.length > 0) {
        fetch(`${API}/api/auth/games/cache`, {
          method: 'POST', headers: authHeader(true), body: JSON.stringify({ games: d.games })
        }).catch(() => {})
      }
    }

    function connectSSE() {
      es = new EventSource(`${API}/api/games/live/stream`)
      es.onmessage = (e) => {
        try { applyGamesData(JSON.parse(e.data)) } catch {}
      }
      es.onerror = () => {
        es.close()
        es = null
        // Fallback: poll svakih 10s ako SSE pukne
        if (!fallbackIv) {
          fallbackIv = setInterval(() => loadGames(false), 10000)
        }
      }
    }

    connectSSE()

    return () => {
      if (es) es.close()
      if (fallbackIv) clearInterval(fallbackIv)
    }
  }, [])

  function toast_(msg, type = 'success') {
    setToast({ msg, type })
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 3200)
  }

  async function loadSavedIds() {
    try {
      const r = await fetch(`${API}/api/auth/history`, { headers: authHeader() })
      const d = await r.json()
      const todayStr = new Date().toLocaleDateString('sv-SE')
      // Ključ uključuje datum — sprečava blokadu za isti igrač/prop/linija na novi dan
      setSavedIds(new Set((d.history || []).map(t => {
        const tipDate = t.game_date || t.created_at?.split('T')[0] || todayStr
        return `${t.player_name}|${t.prop_type}|${t.line}|${tipDate}`
      })))
    } catch {}
  }

  async function loadGames(isFirst = false) {
    if (isFirst) setGamesLoading(true)
    try {
      const ctrl = new AbortController()
      const timeout = setTimeout(() => ctrl.abort(), 12000)
      const r = await fetch(`${API}/api/games/live`, { headers: authHeader(), signal: ctrl.signal })
      clearTimeout(timeout)
      const d = await r.json()
      if (d.games) {
        setGames(d.games.filter(g => !g.error))
        setLiveCount(d.live_count || 0)
        if (d.games.length > 0) {
          fetch(`${API}/api/auth/games/cache`, {
            method: 'POST', headers: authHeader(true), body: JSON.stringify({ games: d.games })
          }).catch(() => {})
        }
      }
    } catch {
      try {
        const ctrl2 = new AbortController()
        const timeout2 = setTimeout(() => ctrl2.abort(), 10000)
        const r2 = await fetch(`${API}/api/games/today`, { headers: authHeader(), signal: ctrl2.signal })
        clearTimeout(timeout2)
        const d2 = await r2.json()
        setGames(d2.games || [])
      } catch {}
    } finally {
      if (isFirst) setGamesLoading(false)
    }
  }

  async function loadCachedPicks() {
    const todayStr = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD
    const LS_PICKS = 'ce_picks_v2'
    const LS_DATE  = 'ce_picks_date_v2'

    // 1. Prikaži localStorage odmah (nema bljeskanja praznog ekrana)
    try {
      const storedDate = localStorage.getItem(LS_DATE)
      if (storedDate === todayStr) {
        const raw = localStorage.getItem(LS_PICKS)
        if (raw) {
          const cached = JSON.parse(raw)
          if (cached?.length > 0) setPicks(cached)
        }
      } else {
        localStorage.removeItem(LS_PICKS)
        localStorage.removeItem(LS_DATE)
      }
    } catch {}

    // 2. Uvijek pita server — osvježava ako ima novih/više tipova
    try {
      const r = await fetch(`${API}/api/auth/picks/cached`, { headers: authHeader() })
      const d = await r.json()
      if (d.picks?.length > 0) {
        setPicks(d.picks)
        try {
          localStorage.setItem(LS_PICKS, JSON.stringify(d.picks))
          localStorage.setItem(LS_DATE, todayStr)
        } catch {}
      }
    } catch {}
  }

  async function savePick(pick) {
    const todayStr = new Date().toLocaleDateString('sv-SE')
    const key = `${pick.player_name}|${pick.prop_type}|${pick.line}|${todayStr}`
    if (savedIds.has(key)) { toast_('Već sačuvano!', 'info'); return }
    try {
      const r = await fetch(`${API}/api/auth/history/save`, {
        method: 'POST', headers: authHeader(true), body: JSON.stringify(pick)
      })
      if (!r.ok) { const e = await r.json().catch(() => ({})); toast_(`Greška: ${e.detail || r.status}`, 'error'); return }
      const d = await r.json()
      if (d.duplicate) toast_('Već sačuvano!', 'info')
      else { setSavedIds(p => new Set([...p, key])); toast_('✅ Tip sačuvan!') }
    } catch { toast_('Greška pri čuvanju', 'error') }
  }

  const today = new Date().toLocaleDateString('sr-RS', { weekday: 'long', day: 'numeric', month: 'long' })
  const live = games.filter(g => g.is_live)
  const scheduled = games.filter(g => !g.is_live && !g.is_final)
  const finished = games.filter(g => g.is_final)
  const sortedGames = [...live, ...scheduled, ...finished]

  const { theme } = useTheme()
  const dark = theme === 'dark'

  return (
    <>
      <style>{`
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes livePulse  { 0%,100%{opacity:1} 50%{opacity:.25} }
        @keyframes fadeIn     { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown  { from{opacity:0;transform:translateY(-16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cardIn     { from{opacity:0;transform:translateY(20px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes confBar    { from{width:0} }
        @keyframes dotBounce  { 0%,80%,100%{transform:scale(0.6);opacity:.4} 40%{transform:scale(1);opacity:1} }
        @keyframes glow       { 0%,100%{opacity:0.4} 50%{opacity:1} }
        @keyframes float      { 0%,100%{transform:translateY(0px) rotate(0deg)} 50%{transform:translateY(-12px) rotate(6deg)} }
        @keyframes orbit      { from{transform:rotate(0deg) translateX(60px) rotate(0deg)} to{transform:rotate(360deg) translateX(60px) rotate(-360deg)} }
        @keyframes orbitRev   { from{transform:rotate(0deg) translateX(90px) rotate(0deg)} to{transform:rotate(-360deg) translateX(90px) rotate(360deg)} }
        @keyframes shimmer    { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes barSlide   { from{transform:translateX(-100%)} to{transform:translateX(200%)} }
        @keyframes auroraGlow {
          0%,100% { box-shadow:0 0 0 1px rgba(96,165,250,0.15),0 12px 40px rgba(0,0,0,0.55),0 0 28px rgba(0,229,160,0.05); }
          33%     { box-shadow:0 0 0 1px rgba(167,139,250,0.22),0 12px 40px rgba(0,0,0,0.55),0 0 36px rgba(96,165,250,0.08); }
          66%     { box-shadow:0 0 0 1px rgba(0,229,160,0.2),  0 12px 40px rgba(0,0,0,0.55),0 0 32px rgba(167,139,250,0.06); }
        }
        @keyframes auroraDrift {
          0%,100% { background-position:0% 0%;opacity:0.6; }
          50%     { background-position:100% 0%;opacity:1; }
        }
        @keyframes auroraLine { 0%{background-position:0%} 100%{background-position:300%} }
        @keyframes btnSheen   { 0%{background-position:200% 0} 100%{background-position:-100% 0} }
        @keyframes btnSpin    { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes sweepLeft  { 0%{transform:rotate(-18deg)} 35%{transform:rotate(5deg)} 65%{transform:rotate(-8deg)} 100%{transform:rotate(-18deg)} }
        @keyframes sweepRight { 0%{transform:rotate(18deg)} 35%{transform:rotate(-5deg)} 65%{transform:rotate(8deg)} 100%{transform:rotate(18deg)} }
        @keyframes floorPulse { 0%,100%{opacity:.5;width:400px} 35%{opacity:1;width:560px} 65%{opacity:.7;width:470px} }
        @keyframes logoGlow   {
          0%,100%{text-shadow:0 0 20px rgba(255,200,60,.4),0 0 50px rgba(255,160,0,.2),0 0 80px rgba(255,100,0,.1)}
          35%{text-shadow:0 0 40px rgba(255,220,80,.8),0 0 80px rgba(255,160,0,.5),0 0 140px rgba(255,100,0,.25)}
          65%{text-shadow:0 0 30px rgba(255,200,60,.6),0 0 60px rgba(255,140,0,.35),0 0 100px rgba(255,80,0,.15)}
        }
        @keyframes dustFloat  { 0%{transform:translate(0,0) scale(0);opacity:0} 10%{opacity:1;transform:scale(1)} 90%{opacity:.3} 100%{transform:translate(var(--dx),var(--dy)) scale(.5);opacity:0} }
        @keyframes tlNodePulse{ 0%,100%{box-shadow:0 0 8px rgba(0,229,160,.7),0 0 18px rgba(0,229,160,.25)} 50%{box-shadow:0 0 16px rgba(0,229,160,1),0 0 34px rgba(0,229,160,.5)} }
        @keyframes tlGameIn   { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tickerScroll { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes cdFlicker { 0%,94%,100%{filter:drop-shadow(0 0 18px rgba(255,106,0,0.4))} 95%{filter:drop-shadow(0 0 3px rgba(255,106,0,0.1))} 97%{filter:drop-shadow(0 0 18px rgba(255,106,0,0.4))} }
        @keyframes colonBlink { 0%,49%{opacity:1} 50%,100%{opacity:0.18} }
        @keyframes cdRingPulse { 0%,100%{opacity:0.35;transform:translate(-50%,-50%) scale(1)} 50%{opacity:0.07;transform:translate(-50%,-50%) scale(1.05)} }
        .pick-card-flip { cursor: default; }
        .pick-card-front { min-height: 320px; }
        * { box-sizing:border-box; margin:0; padding:0; }
      `}</style>

      {/* Particle background — only on Home page */}
      <ParticleBackground />


      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 72, right: 20, zIndex: 999,
          background: toast.type === 'error' ? '#ef4444' : toast.type === 'info' ? '#3b82f6' : '#00d4aa',
          color: '#000', borderRadius: 12, padding: '12px 20px',
          fontSize: 13, fontWeight: 700, fontFamily: "'DM Sans',sans-serif",
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s ease',
        }}>{toast.msg}</div>
      )}

      {/* Main content — sits above particle canvas */}
      <div style={{ position: 'relative', zIndex: 1 }}>
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '0 20px 80px', fontFamily: "'DM Sans',sans-serif", color: dark ? '#e2e8f0' : '#0c1a2e' }}>

        {/* ── HERO (Arena Spotlight) ───────────────────────────────────────── */}
        <ArenaSpotlight liveCount={liveCount} gamesCount={games.length} picksCount={picks.length} today={today} />

        {/* ── LIVE PICKS TICKER ────────────────────────────────────────────── */}
        <PicksTicker picks={picks} dark={dark} />

        {/* ── MEČEVI (Horizontal Timeline) ─────────────────────────────────── */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 10, color: dark ? '#334155' : '#94a3b8', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 }}>RASPORED</span>
              {!gamesLoading && games.length > 0 && (
                <span style={{ fontSize: 11, color: dark ? '#475569' : '#7a9ab8', background: dark ? '#0f1627' : 'rgba(0,0,0,0.06)', border: `1px solid ${dark ? '#1a2335' : 'rgba(0,0,0,0.09)'}`, borderRadius: 5, padding: '2px 8px' }}>
                  {games.length} mečeva
                </span>
              )}
              {liveCount > 0 && (
                <span style={{ fontSize: 10, background: 'rgba(0,229,160,0.08)', border: '1px solid rgba(0,229,160,0.2)', color: '#00e5a0', borderRadius: 20, padding: '2px 9px', fontWeight: 700, letterSpacing: 1 }}>
                  ● {liveCount} LIVE
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 10, color: '#1e2d40' }}>auto 30s</span>
              <button onClick={() => loadGames(false)} style={{ background: '#0a0e1a', border: '1px solid #1a2335', color: '#475569', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: "'Outfit',sans-serif" }}>↺</button>
            </div>
          </div>

          {gamesLoading ? (
            <div style={{ display: 'flex', gap: 12, padding: '8px 0', overflowX: 'hidden' }}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ flexShrink: 0, width: 180, borderRadius: 14, border: '1px solid #1a2335', background: '#0a0e1a', padding: '16px 14px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ height: 6, background: '#111827', borderRadius: 4, width: 60, marginBottom: 12 }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                  </div>
                  <div style={{ height: 8, background: '#111827', borderRadius: 4, width: '80%', marginBottom: 8 }} />
                  <div style={{ height: 8, background: '#111827', borderRadius: 4, width: '65%' }} />
                </div>
              ))}
            </div>
          ) : games.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', background: dark ? '#0a0e1a' : '#f4f7fb', border: `1px dashed ${dark ? '#1a2335' : 'rgba(0,0,0,0.1)'}`, borderRadius: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🏀</div>
              <div style={{ fontSize: 14, color: dark ? '#334155' : '#7a9ab8' }}>Nema mečeva za danas</div>
            </div>
          ) : (
            <GamesTimeline games={sortedGames} dark={dark} />
          )}
        </div>

        {/* ── AI TIPOVI ────────────────────────────────────────────────────── */}
        <div>
          {/* Section header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, color: '#ff6b00', letterSpacing: 3, textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>
                AI ANALIZA
              </div>
              <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(24px,4vw,40px)', letterSpacing: 2, color: dark ? '#f1f5f9' : '#0c1a2e', lineHeight: 1 }}>
                TOP VALUE BETS
              </h2>
              {picks.length > 0 && (
                <div style={{ fontSize: 10, color: dark ? '#334155' : '#7a9ab8', marginTop: 5, letterSpacing: 0.5 }}>
                  {picks.length} {picks.length === 1 ? 'tip' : picks.length < 5 ? 'tipa' : 'tipova'} za danas
                </div>
              )}
            </div>
            {/* Auto badge */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(0,229,160,0.05)', border: '1px solid rgba(0,229,160,0.15)',
              borderRadius: 12, padding: '8px 16px',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e5a0', animation: 'glow 2s ease-in-out infinite', flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 11, color: '#00e5a0', fontWeight: 700, letterSpacing: 0.5 }}>AUTO · 16:00</div>
                <div style={{ fontSize: 9, color: '#334155', letterSpacing: 0.5 }}>svaki dan</div>
              </div>
            </div>
          </div>

          {/* ── Premium Empty State / Countdown ── */}
          {picks.length === 0 && (() => {
            const afterSixteen = new Date().getHours() >= 16
            const [h, m, s] = countdown ? countdown.split(':') : ['--','--','--']
            return (
              <div style={{
                position: 'relative', textAlign: 'center',
                padding: '60px 20px 52px',
                background: dark ? '#040912' : '#f4f7fb',
                border: `1px solid ${dark ? '#0d1626' : 'rgba(0,0,0,0.08)'}`,
                borderRadius: 20, overflow: 'hidden',
              }}>
                {/* Pulsing rings */}
                {[440, 330, 220].map((size, i) => (
                  <div key={i} style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: size, height: size, borderRadius: '50%',
                    border: '1px solid rgba(255,106,0,0.07)',
                    transform: 'translate(-50%,-50%)',
                    animation: `cdRingPulse ${3.5 + i * 0.7}s ease-in-out ${i * 0.4}s infinite`,
                    pointerEvents: 'none',
                  }} />
                ))}
                {/* Bottom glow */}
                <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 320, height: 70, background: 'radial-gradient(ellipse,rgba(255,106,0,0.1),transparent 70%)', pointerEvents: 'none' }} />

                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ fontSize: 9, color: dark ? '#334155' : '#94a3b8', letterSpacing: 4, fontWeight: 700, textTransform: 'uppercase', marginBottom: 22 }}>
                    {afterSixteen ? 'Generisanje u toku' : 'Sledeće generisanje za'}
                  </div>

                  {!afterSixteen && countdown ? (
                    /* ── Digit display ── */
                    <div style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 0, marginBottom: 28 }}>
                      {[[h,'sati'],[null,null],[m,'minuta'],[null,null],[s,'sekundi']].map((seg, i) => {
                        if (seg[0] === null) return (
                          <div key={i} style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize: 68, color: 'rgba(255,149,0,0.3)', margin: '0 3px', lineHeight: 1, paddingBottom: 16, animation: 'colonBlink 1s ease-in-out infinite' }}>:</div>
                        )
                        return (
                          <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{
                              fontFamily: "'Bebas Neue',sans-serif", fontSize: 72, letterSpacing: 4, lineHeight: 1,
                              background: 'linear-gradient(180deg,#ff9500 0%,#ff6a00 100%)',
                              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                              animation: 'cdFlicker 4s ease-in-out infinite',
                            }}>{seg[0]}</div>
                            <div style={{ fontSize: 8, color: dark ? '#1e3250' : '#94a3b8', letterSpacing: 2.5, textTransform: 'uppercase', marginTop: 4 }}>{seg[1]}</div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    /* ── After 16:00 spinner ── */
                    <div style={{ marginBottom: 28 }}>
                      <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid rgba(255,149,0,0.15)', borderTopColor: '#ff9500', animation: 'spin 0.9s linear infinite', margin: '0 auto 16px' }} />
                    </div>
                  )}

                  <div style={{ fontSize: 12, color: dark ? '#1e3250' : '#94a3b8', lineHeight: 1.9 }}>
                    {afterSixteen
                      ? <>AI analizira igrače i statistike —<br />tipovi će se pojaviti za koji trenutak</>
                      : <>AI automatski generiše najsigurnije tipove<br />svaki dan u <span style={{ color: '#ff9500', fontWeight: 700 }}>16:00h</span> po srpskom vremenu</>
                    }
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Pick grid */}
          {picks.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14, alignItems: 'start' }}>
              {picks.map((p, i) => (
                <PickCard key={`${p.player_name}-${p.prop_type}-${i}`} pick={p} onSave={savePick} savedIds={savedIds} idx={i} />
              ))}
            </div>
          )}
        </div>
      </div>
      </div>{/* /z-index wrapper */}
    </>
  )
}
