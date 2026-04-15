import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth, useTheme } from '../App'

export default function Navbar() {
  const { user, logout }      = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate  = useNavigate()
  const location  = useLocation()
  const [showMenu, setShowMenu] = useState(false)

  const dark = theme === 'dark'

  function handleLogout() {
    logout()
    navigate('/auth')
  }

  const links = [
    { path: '/',        label: 'Danas'    },
    { path: '/search',  label: 'Pretraga' },
    { path: '/history', label: 'Istorija' },
  ]

  const navBg      = dark ? 'rgba(5,8,15,0.90)'      : 'rgba(248,250,252,0.92)'
  const borderB    = dark ? 'rgba(255,255,255,0.05)'  : 'rgba(0,0,0,0.08)'
  const textMuted  = dark ? '#4a5a6e'                 : '#8fa3ba'
  const textActive = dark ? '#edf2f7'                 : '#0c1a2e'
  const dropBg     = dark ? '#0c1220'                 : '#ffffff'
  const dropBorder = dark ? '#1c2e48'                 : 'rgba(0,0,0,0.1)'
  const dropText   = dark ? '#7a90a8'                 : '#4a6484'
  const dropHoverBg= dark ? 'rgba(255,255,255,0.05)'  : 'rgba(0,0,0,0.04)'
  const divider    = dark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.07)'
  const avatarBtn  = dark ? 'rgba(255,106,0,0.08)'    : 'rgba(255,106,0,0.07)'
  const avatarBord = dark ? 'rgba(255,106,0,0.18)'    : 'rgba(255,106,0,0.25)'
  const themeBtnBg = dark ? 'rgba(255,255,255,0.06)'  : 'rgba(0,0,0,0.06)'
  const themeBtnBd = dark ? 'rgba(255,255,255,0.1)'   : 'rgba(0,0,0,0.12)'

  return (
    <>
      <style>{`
        .nav-link {
          position: relative;
          background: none; border: none;
          padding: 0 2px; padding-bottom: 2px;
          font-size: 12px; font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          letter-spacing: 1.2px; text-transform: uppercase;
          cursor: pointer;
          transition: color 0.15s;
        }
        .nav-link::after {
          content: '';
          position: absolute; bottom: -2px; left: 0; right: 0;
          height: 2px; background: #ff6a00; border-radius: 1px;
          transform: scaleX(0); transition: transform 0.2s ease;
          transform-origin: left;
        }
        .nav-link.active::after    { transform: scaleX(1); }
        .nav-link:hover:not(.active)::after { transform: scaleX(0.4); opacity: 0.5; }

        .nav-backdrop { position: fixed; inset: 0; z-index: 150; }

        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: none; }
        }

        /* Theme toggle button */
        .theme-btn {
          display: flex; align-items: center; justify-content: center;
          width: 34px; height: 34px; border-radius: 9px; border: none;
          cursor: pointer; transition: background 0.2s, transform 0.15s;
          font-size: 16px; flex-shrink: 0;
        }
        .theme-btn:hover { transform: rotate(15deg) scale(1.08); }
      `}</style>

      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: navBg,
        backdropFilter: 'blur(24px)',
        borderBottom: `1px solid ${borderB}`,
        padding: '0 24px',
        transition: 'background 0.3s ease',
      }}>
        {/* Thin orange top accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, #ff6a00, #ff9c00 40%, transparent 75%)',
          opacity: dark ? 0.7 : 0.5,
        }} />

        <div style={{
          maxWidth: 1140, margin: '0 auto', height: 56,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20,
        }}>

          {/* ── Logo ── */}
          <button
            onClick={() => navigate('/')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}
          >
            <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 4, lineHeight: 1 }}>
              <span style={{ color: dark ? '#ffffff' : '#0c1a2e' }}>COURT </span>
              <span style={{ color: '#ff6a00' }}>EDGE</span>
            </span>
            <span style={{
              fontSize: 8, fontWeight: 700, color: '#00d4aa',
              background: 'rgba(0,212,170,0.12)', border: '1px solid rgba(0,212,170,0.25)',
              borderRadius: 4, padding: '2px 6px', letterSpacing: 1.5, fontFamily: "'DM Sans', sans-serif",
            }}>
              LIVE
            </span>
          </button>

          {/* ── Nav links ── */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            {links.map(({ path, label }) => {
              const active = location.pathname === path
              return (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`nav-link${active ? ' active' : ''}`}
                  style={{ color: active ? textActive : textMuted }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* ── Right side: theme toggle + user ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>

            {/* Sun / Moon toggle */}
            <button
              className="theme-btn"
              onClick={toggleTheme}
              title={dark ? 'Pređi na svetlu temu' : 'Pređi na tamnu temu'}
              style={{ background: themeBtnBg, border: `1px solid ${themeBtnBd}` }}
            >
              {dark
                ? /* Sun */
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffd700" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="5"/>
                    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                : /* Moon */
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7a8cb8" strokeWidth="2" strokeLinecap="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
              }
            </button>

            {/* User dropdown */}
            <div style={{ position: 'relative' }}>
              {showMenu && <div className="nav-backdrop" onClick={() => setShowMenu(false)} />}

              <button
                onClick={() => setShowMenu(m => !m)}
                style={{
                  background: avatarBtn, border: `1px solid ${avatarBord}`,
                  borderRadius: 10, padding: '6px 12px 6px 8px',
                  display: 'flex', alignItems: 'center', gap: 9,
                  cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
                  color: dark ? '#c8d4e0' : '#1e3a5f',
                  fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
                }}
              >
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ff6a00, #ffb347)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 800, color: '#000', flexShrink: 0,
                }}>
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user?.username}
                </span>
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none"
                  style={{ opacity: 0.4, flexShrink: 0, transition: 'transform 0.2s', transform: showMenu ? 'rotate(180deg)' : 'none' }}>
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {showMenu && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                  background: dropBg, border: `1px solid ${dropBorder}`,
                  borderRadius: 14, padding: 8, minWidth: 200,
                  boxShadow: dark
                    ? '0 20px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.04)'
                    : '0 12px 40px rgba(0,0,0,0.12)',
                  animation: 'dropIn 0.18s ease both', zIndex: 200,
                }}>
                  {/* User info header */}
                  <div style={{ padding: '14px 14px 16px', borderBottom: `1px solid ${divider}`, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg, #ff6a00 0%, #ff9500 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 17, fontWeight: 800, color: '#fff',
                      fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1,
                      boxShadow: '0 2px 12px rgba(255,106,0,0.35)',
                    }}>
                      {user?.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    {/* Text */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 700, letterSpacing: 0.3,
                        color: dark ? '#f1f5f9' : '#0c1a2e',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontFamily: "'DM Sans', sans-serif",
                      }}>{user?.username}</div>
                      <div style={{
                        fontSize: 11, marginTop: 3, letterSpacing: 0.2,
                        color: dark ? '#4a6484' : '#8fa3ba',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        fontFamily: "'DM Sans', sans-serif",
                      }}>{user?.email}</div>
                    </div>
                  </div>

                  {[
                    { label: 'Moj nalog',       path: '/account', icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></> },
                    { label: 'Istorija tipova', path: '/history', icon: <><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></> },
                  ].map(item => (
                    <button
                      key={item.path}
                      onClick={() => { navigate(item.path); setShowMenu(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', textAlign: 'left', background: 'none', border: 'none',
                        color: dropText, fontSize: 13, fontWeight: 500,
                        padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
                        fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = dropHoverBg; e.currentTarget.style.color = dark ? '#edf2f7' : '#0c1a2e' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = dropText }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{item.icon}</svg>
                      {item.label}
                    </button>
                  ))}

                  <div style={{ height: 1, background: divider, margin: '6px 0' }} />

                  <button
                    onClick={handleLogout}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', textAlign: 'left', background: 'none', border: 'none',
                      color: '#ff6a6a', fontSize: 13, fontWeight: 500,
                      padding: '9px 14px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: "'DM Sans', sans-serif", transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,106,106,0.08)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
                    </svg>
                    Odjavi se
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </nav>
    </>
  )
}
