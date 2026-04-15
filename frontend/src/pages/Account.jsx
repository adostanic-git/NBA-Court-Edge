import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, API, useTheme } from '../App'

function authHeader() {
  const t = localStorage.getItem('token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

const RANKS = [
  { min: 0,   max: 4,   label: 'STARTER', color: '#64748b', icon: '🌱', desc: 'Tek počinješ' },
  { min: 5,   max: 19,  label: 'ROOKIE',  color: '#4da6ff', icon: '🏀', desc: 'Ulaziš u igru' },
  { min: 20,  max: 49,  label: 'PRO',     color: '#a3e635', icon: '⭐', desc: 'Znaš šta radiš' },
  { min: 50,  max: 99,  label: 'EXPERT',  color: '#ffd700', icon: '🔥', desc: 'Iskusni analitičar' },
  { min: 100, max: Infinity, label: 'ELITE', color: '#00d4aa', icon: '👑', desc: 'Vrhunski analitičar' },
]
function getRank(total) { return RANKS.find(r => total >= r.min && total <= r.max) || RANKS[0] }

const PROP_SHORT  = { points: 'PTS', rebounds: 'REB', assists: 'AST', pra: 'PRA' }
const REC_COLOR   = { OVER: '#00d4aa', UNDER: '#4da6ff' }

// ─── Theme colors ─────────────────────────────────────────────────────────────
function useT() {
  const { theme } = useTheme()
  const dark = theme === 'dark'
  return {
    dark,
    surface:  dark ? '#0a0e1a' : '#ffffff',
    subtle:   dark ? '#0f1623' : '#f4f7fb',
    card:     dark ? '#0d1220' : '#ffffff',
    heroBg:   dark ? 'linear-gradient(135deg,#0d1829 0%,#080c18 60%,#0b1020 100%)' : 'linear-gradient(135deg,#fff 0%,#f4f7fb 100%)',
    border:   dark ? '#1a2335' : 'rgba(0,0,0,0.09)',
    border2:  dark ? '#0f1627' : 'rgba(0,0,0,0.06)',
    text1:    dark ? '#edf2f7' : '#0c1a2e',
    text2:    dark ? '#94a3b8' : '#2d4a6a',
    text3:    dark ? '#475569' : '#5a7898',
    textDim:  dark ? '#334155' : '#7a9ab8',
    textVdim: dark ? '#253352' : '#a8bfd4',
    shadow:   dark ? 'none'    : '0 2px 14px rgba(0,0,0,0.07)',
    shadow2:  dark ? 'none'    : '0 4px 24px rgba(0,0,0,0.09)',
    ringTrack:dark ? '#0f1627' : '#e4eaf2',
    haloProgress: dark ? '#0a0e1a' : '#e8eef6',
  }
}

// ─── HitRing ──────────────────────────────────────────────────────────────────
function HitRing({ rate, size = 88 }) {
  const [animated, setAnimated] = useState(0)
  const animRef = useRef(null)
  const T = useT()

  useEffect(() => {
    if (rate === null) return
    let start = null
    const dur = 1400
    const animate = ts => {
      if (!start) start = ts
      const prog = Math.min((ts - start) / dur, 1)
      setAnimated(Math.round((1 - Math.pow(1 - prog, 3)) * rate))
      if (prog < 1) animRef.current = requestAnimationFrame(animate)
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [rate])

  const r     = size / 2 - 7
  const circ  = 2 * Math.PI * r
  const pct   = rate !== null ? animated / 100 : 0
  const color = rate >= 60 ? '#00d4aa' : rate >= 40 ? '#ffd700' : '#ff4d6a'

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.ringTrack} strokeWidth={6} />
        {rate !== null && (
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
            strokeDasharray={`${pct * circ} ${circ}`} strokeLinecap="round" />
        )}
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
        {rate !== null ? (
          <>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color, lineHeight:1 }}>{animated}%</div>
            <div style={{ fontSize:8, color: T.textDim, letterSpacing:1, marginTop:1 }}>WIN</div>
          </>
        ) : (
          <div style={{ fontSize:9, color: T.textVdim, textAlign:'center', letterSpacing:0.5 }}>NEMA<br/>PODATAKA</div>
        )}
      </div>
    </div>
  )
}

// ─── StatPill ─────────────────────────────────────────────────────────────────
function StatPill({ label, value, color, delay = 0 }) {
  const [show, setShow] = useState(false)
  const T = useT()
  useEffect(() => { const t = setTimeout(() => setShow(true), delay); return () => clearTimeout(t) }, [delay])

  return (
    <div style={{
      background: T.subtle, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: '14px 16px',
      boxShadow: T.shadow,
      opacity: show ? 1 : 0, transform: show ? 'none' : 'translateY(10px)',
      transition: 'opacity 0.4s ease, transform 0.4s ease',
    }}>
      <div style={{ fontSize: 9, color: T.textVdim, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 28, color, lineHeight: 1 }}>{value ?? '—'}</div>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Account() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const T = useT()
  const [stats, setStats]         = useState(null)
  const [recentTips, setRecentTips] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    fetch(`${API}/api/auth/history`, { headers: authHeader() })
      .then(r => r.json())
      .then(data => {
        const h       = data.history || []
        const checked = h.filter(t => t.result !== null && t.result !== undefined)
        const hits    = checked.filter(t => t.result === 1 || t.result === true).length
        const misses  = checked.filter(t => t.result === 0 || t.result === false).length
        const hitRate = checked.length >= 3 ? Math.round((hits / checked.length) * 100) : null
        setStats({
          total: h.length,
          over: h.filter(t => t.recommendation === 'OVER').length,
          under: h.filter(t => t.recommendation === 'UNDER').length,
          excellent: h.filter(t => t.value_rating === 'excellent').length,
          avgConf: h.length ? Math.round(h.reduce((s, t) => s + (t.confidence || 0), 0) / h.length) : 0,
          hits, misses, hitRate, checked: checked.length,
        })
        setRecentTips(h.slice(0, 6))
      })
      .catch(() => setStats({ total:0, over:0, under:0, excellent:0, avgConf:0, hits:0, misses:0, hitRate:null, checked:0 }))
      .finally(() => setLoading(false))
  }, [])

  function handleLogout() { logout(); navigate('/auth') }

  const memberDays    = user?.created_at
    ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000)
    : 0
  const rank          = getRank(stats?.total || 0)
  const nextRank      = RANKS[RANKS.findIndex(r => r.label === rank.label) + 1]
  const progressToNext = nextRank
    ? Math.round(((stats?.total || 0) - rank.min) / (nextRank.min - rank.min) * 100)
    : 100

  const actionBtn = {
    display: 'flex', alignItems: 'center', gap: 14,
    background: T.subtle, border: `1px solid ${T.border}`,
    borderRadius: 14, padding: '14px 16px',
    color: T.text1, fontSize: 14, fontWeight: 600,
    cursor: 'pointer', textAlign: 'left',
    fontFamily: "'DM Sans',sans-serif",
    width: '100%', transition: 'background 0.15s, border-color 0.15s, box-shadow 0.15s',
    boxShadow: T.shadow,
  }

  return (
    <>
      <style>{`
        @keyframes fadeIn    { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes slideDown { from{opacity:0;transform:translateY(-12px)} to{opacity:1;transform:translateY(0)} }
        @keyframes barFill   { from{width:0} }
        * { box-sizing:border-box; margin:0; padding:0; }
      `}</style>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 16px 100px', fontFamily: "'DM Sans',sans-serif", color: T.text1 }}>

        {/* ── HERO PROFILE CARD ── */}
        <div style={{
          position: 'relative', overflow: 'hidden',
          background: T.heroBg,
          border: `1px solid ${T.border}`,
          borderRadius: 24, padding: '28px 24px 24px', marginBottom: 20,
          animation: 'fadeIn 0.5s ease',
          boxShadow: T.shadow2,
        }}>
          {/* Rank glow blob */}
          <div style={{ position:'absolute', top:-60, right:-60, width:260, height:260, borderRadius:'50%', background:`radial-gradient(circle, ${rank.color}${T.dark ? '12' : '0a'} 0%, transparent 70%)`, pointerEvents:'none' }} />
          <div style={{ position:'absolute', bottom:-40, left:-40, width:180, height:180, borderRadius:'50%', background:`radial-gradient(circle, rgba(255,106,0,${T.dark ? '0.07' : '0.04'}) 0%, transparent 70%)`, pointerEvents:'none' }} />

          <div style={{ display:'flex', gap:20, alignItems:'flex-start', position:'relative' }}>
            {/* Avatar */}
            <div style={{ position:'relative', flexShrink:0 }}>
              <div style={{
                width:80, height:80, borderRadius:'50%',
                background:`linear-gradient(135deg, ${rank.color}, ${rank.color}88)`,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:36, fontWeight:800, color:'#000',
                fontFamily:"'Bebas Neue',sans-serif",
                boxShadow:`0 0 0 3px ${T.dark ? '#0d1829' : '#fff'}, 0 0 0 5px ${rank.color}44`,
              }}>
                {user?.username?.[0]?.toUpperCase()}
              </div>
              <div style={{
                position:'absolute', bottom:-4, right:-4,
                width:26, height:26, borderRadius:'50%',
                background: T.dark ? '#0d1829' : '#fff',
                border:`2px solid ${rank.color}`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:13,
              }}>
                {rank.icon}
              </div>
            </div>

            {/* Info */}
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ animation:'slideDown 0.4s ease 0.1s both', opacity:0 }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:32, letterSpacing:2, color: T.text1, lineHeight:1, marginBottom:2 }}>
                  {user?.username}
                </div>
                <div style={{ fontSize:12, color: T.text3, marginBottom:10 }}>{user?.email}</div>
              </div>

              {/* Rank badge */}
              <div style={{
                display:'inline-flex', alignItems:'center', gap:7,
                background: rank.color + (T.dark ? '12' : '10'),
                border:`1px solid ${rank.color}35`,
                borderRadius:8, padding:'5px 12px', marginBottom:14,
                animation:'slideDown 0.4s ease 0.2s both', opacity:0,
              }}>
                <span style={{ fontSize:14 }}>{rank.icon}</span>
                <div>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:16, color:rank.color, letterSpacing:2, lineHeight:1 }}>{rank.label}</div>
                  <div style={{ fontSize:9, color:rank.color, opacity:0.6, letterSpacing:0.5 }}>{rank.desc}</div>
                </div>
              </div>

              {/* Progress */}
              {nextRank && (
                <div style={{ animation:'slideDown 0.4s ease 0.3s both', opacity:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:5 }}>
                    <span style={{ fontSize:9, color: T.textDim, letterSpacing:1 }}>DO RANGA {nextRank.label}</span>
                    <span style={{ fontSize:9, color: T.textDim }}>{stats?.total || 0} / {nextRank.min}</span>
                  </div>
                  <div style={{ height:4, background: T.haloProgress, borderRadius:2, overflow:'hidden' }}>
                    <div style={{
                      height:'100%', width:`${progressToNext}%`,
                      background:`linear-gradient(90deg, ${rank.color}88, ${rank.color})`,
                      borderRadius:2, animation:'barFill 1.2s ease 0.4s both',
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Member days */}
            <div style={{ textAlign:'right', flexShrink:0, animation:'fadeIn 0.4s ease 0.3s both', opacity:0 }}>
              <div style={{ fontSize:9, color: T.textVdim, letterSpacing:1, marginBottom:4 }}>ČLAN</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color: T.text3, lineHeight:1 }}>
                {memberDays === 0 ? 'DANAS' : memberDays}
              </div>
              {memberDays > 0 && <div style={{ fontSize:9, color: T.textVdim, letterSpacing:1 }}>DANA</div>}
            </div>
          </div>
        </div>

        {/* ── WIN RATE + STATS ── */}
        {stats && (
          <div style={{ display:'flex', gap:14, marginBottom:20, animation:'fadeIn 0.5s ease 0.1s both', opacity:0 }}>
            <div style={{
              background: T.subtle, border:`1px solid ${T.border}`, borderRadius:20,
              padding:'20px 16px', display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', gap:8, minWidth:130,
              boxShadow: T.shadow,
            }}>
              <HitRing rate={stats.hitRate} size={88} />
              <div style={{ fontSize:9, color: T.textVdim, letterSpacing:1.5, textAlign:'center' }}>
                {stats.checked > 0
                  ? `${stats.hits}P / ${stats.misses}P (${stats.checked} prov.)`
                  : 'NEMA PROVJERA'}
              </div>
            </div>

            <div style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <StatPill label="Sačuvani tipovi" value={stats.total}         color={T.text1}                               delay={100} />
              <StatPill label="Avg pouzdanost"  value={`${stats.avgConf}%`} color={stats.avgConf >= 70 ? '#00d4aa' : '#ffd700'} delay={150} />
              <StatPill label="OVER tipovi"     value={stats.over}          color="#00d4aa"                                delay={200} />
              <StatPill label="UNDER tipovi"    value={stats.under}         color="#4da6ff"                                delay={250} />
            </div>
          </div>
        )}

        {/* ── NEDAVNI TIPOVI ── */}
        {recentTips.length > 0 && (
          <div style={{ marginBottom:20, animation:'fadeIn 0.5s ease 0.2s both', opacity:0 }}>
            <div style={{ fontSize:10, color: T.textDim, letterSpacing:2, fontWeight:700, textTransform:'uppercase', marginBottom:12 }}>
              NEDAVNI TIPOVI
            </div>
            <div style={{ background: T.subtle, border:`1px solid ${T.border}`, borderRadius:16, overflow:'hidden', boxShadow: T.shadow }}>
              {recentTips.map((tip, i) => {
                const recColor = REC_COLOR[tip.recommendation] || T.text3
                const resultColor = tip.result === 1 || tip.result === true
                  ? '#00d4aa' : tip.result === 0 || tip.result === false
                  ? '#ff4d6a' : T.textVdim
                const resultLabel = tip.result === 1 || tip.result === true
                  ? '✓ POGOĐENO' : tip.result === 0 || tip.result === false
                  ? '✗ PROMAŠENO' : '—'
                return (
                  <div key={i} style={{
                    display:'flex', alignItems:'center', gap:10, padding:'11px 14px',
                    borderBottom: i < recentTips.length - 1 ? `1px solid ${T.border2}` : 'none',
                    borderLeft:`3px solid ${recColor}`,
                  }}>
                    <div style={{
                      fontSize:9, fontWeight:700, color:recColor,
                      background: recColor + '15', border:`1px solid ${recColor}30`,
                      borderRadius:5, padding:'2px 7px', letterSpacing:1, flexShrink:0,
                    }}>
                      {tip.recommendation}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:700, color: T.text1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                        {tip.player_name}
                      </div>
                      <div style={{ fontSize:10, color: T.textDim, marginTop:1 }}>
                        {PROP_SHORT[tip.prop_type] || tip.prop_type} · {tip.line} · {tip.confidence}%
                      </div>
                    </div>
                    <div style={{ fontSize:10, color: T.textVdim, flexShrink:0 }}>
                      {tip.game_date || tip.created_at?.split('T')[0] || ''}
                    </div>
                    <div style={{ fontSize:10, fontWeight:700, color:resultColor, flexShrink:0, minWidth:80, textAlign:'right' }}>
                      {resultLabel}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── NAVIGACIJA ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:10, animation:'fadeIn 0.5s ease 0.3s both', opacity:0 }}>
          <div style={{ fontSize:10, color: T.textVdim, letterSpacing:2, fontWeight:700, textTransform:'uppercase', marginBottom:2 }}>NAVIGACIJA</div>

          {[
            { path:'/history', icon:'📋', title:'Istorija tipova', sub:'Pogledaj sve sačuvane tipove' },
            { path:'/search',  icon:'🔍', title:'Pretraga igrača', sub:'Ručna analiza bilo kog igrača' },
          ].map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={actionBtn}
              onMouseEnter={e => { e.currentTarget.style.background = T.dark ? '#111e30' : '#eef3f9'; e.currentTarget.style.boxShadow = T.shadow2 }}
              onMouseLeave={e => { e.currentTarget.style.background = T.subtle; e.currentTarget.style.boxShadow = T.shadow }}
            >
              <span style={{ fontSize:18 }}>{item.icon}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:14 }}>{item.title}</div>
                <div style={{ fontSize:11, color: T.text3, marginTop:1 }}>{item.sub}</div>
              </div>
              <span style={{ marginLeft:'auto', color: T.textDim, fontSize:18 }}>›</span>
            </button>
          ))}

          <div style={{ height:1, background: T.border, margin:'4px 0' }} />

          <button
            onClick={handleLogout}
            style={{ ...actionBtn, color:'#ff6a6a', background:'rgba(255,106,106,0.06)', border:'1px solid rgba(255,106,106,0.18)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,106,106,0.1)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,106,106,0.06)' }}
          >
            <span style={{ fontSize:18 }}>🚪</span>
            <div><div style={{ fontWeight:700, fontSize:14 }}>Odjavi se</div></div>
          </button>
        </div>

      </div>
    </>
  )
}
