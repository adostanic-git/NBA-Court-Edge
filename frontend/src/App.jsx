import { useState, useEffect, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import AuthPage    from './pages/AuthPage'
import Home        from './pages/Home'
import PlayerSearch from './pages/PlayerSearch'
import History     from './pages/History'
import Account     from './pages/Account'
import Navbar      from './components/Navbar'

export const API = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ── Auth context ──────────────────────────────────────────────────────────────
export const AuthContext = createContext(null)
export function useAuth() { return useContext(AuthContext) }

// ── Theme context ─────────────────────────────────────────────────────────────
export const ThemeContext = createContext({ theme: 'dark', toggleTheme: () => {} })
export function useTheme() { return useContext(ThemeContext) }

// ── Animated neon loading logo ────────────────────────────────────────────────
const WORD1 = 'COURT'
const WORD2 = 'EDGE'

function NeonLogo() {
  const letters = [...WORD1.split(''), null, ...WORD2.split('')]
  return (
    <div style={{
      fontFamily: "'Bebas Neue', sans-serif",
      fontSize: 64, letterSpacing: 8,
      lineHeight: 1, display: 'flex', alignItems: 'baseline', gap: 0,
    }}>
      {letters.map((ch, i) => {
        if (ch === null) return <span key={i} style={{ display: 'inline-block', width: '0.35em' }} />
        const delay = `${i * 0.1}s`
        const isEdge = i > WORD1.length
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              color: isEdge ? '#ff6a00' : '#ffffff',
              animation: `neonFlicker 0.55s ease both`,
              animationDelay: delay,
              opacity: 0,
            }}
          >
            {ch}
          </span>
        )
      })}
    </div>
  )
}

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/auth" replace />
  return children
}

function AppContent() {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [theme,   setTheme]   = useState(() => localStorage.getItem('ce_theme') || 'dark')
  const location = useLocation()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setUser(data) })
        .catch(() => {})
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  function login(userData, token) {
    localStorage.setItem('token', token)
    setUser(userData)
  }

  function logout() {
    localStorage.removeItem('token')
    setUser(null)
  }

  function toggleTheme() {
    setTheme(t => {
      const next = t === 'dark' ? 'light' : 'dark'
      localStorage.setItem('ce_theme', next)
      return next
    })
  }

  const isAuthPage = location.pathname === '/auth'
  const bg = theme === 'dark' ? '#05080f' : '#eef1f6'

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: '#05080f',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 28,
    }}>
      <NeonLogo />
      <div style={{
        fontSize: 10, letterSpacing: 5, color: 'rgba(255,255,255,0.25)',
        fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textTransform: 'uppercase',
        animation: 'fadeIn 0.4s ease 1.2s both', opacity: 0,
      }}>
        NBA Prop Analyzer
      </div>
      <div style={{
        display: 'flex', gap: 6,
        animation: 'fadeIn 0.4s ease 1.4s both', opacity: 0,
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: '50%', background: '#ff6a00',
            animation: `pulse 1s ease-in-out ${i * 0.18}s infinite`,
          }} />
        ))}
      </div>
    </div>
  )

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <AuthContext.Provider value={{ user, login, logout }}>
        <div className={theme === 'light' ? 'light-theme' : ''} style={{ minHeight: '100vh', background: bg, transition: 'background 0.3s ease' }}>
          {!isAuthPage && user && <Navbar />}
          <Routes>
            <Route path="/auth"     element={user ? <Navigate to="/" replace /> : <AuthPage />} />
            <Route path="/login"    element={<Navigate to="/auth" replace />} />
            <Route path="/register" element={<Navigate to="/auth" replace />} />
            <Route path="/"         element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/search"   element={<ProtectedRoute><PlayerSearch /></ProtectedRoute>} />
            <Route path="/history"  element={<ProtectedRoute><History /></ProtectedRoute>} />
            <Route path="/account"  element={<ProtectedRoute><Account /></ProtectedRoute>} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </AuthContext.Provider>
    </ThemeContext.Provider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}
