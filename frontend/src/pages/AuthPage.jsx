import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, API } from '../App'

export default function AuthPage() {
  const { login }  = useAuth()
  const navigate   = useNavigate()

  const [active,    setActive]    = useState(false)   // true = register panel active
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })
  const [regForm,   setRegForm]   = useState({ username: '', email: '', password: '' })
  const [loginErr,  setLoginErr]  = useState(null)
  const [regErr,    setRegErr]    = useState(null)
  const [loginOk,   setLoginOk]   = useState(null)
  const [regOk,     setRegOk]     = useState(null)
  const [loginLoad, setLoginLoad] = useState(false)
  const [regLoad,   setRegLoad]   = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoginLoad(true); setLoginErr(null); setLoginOk(null)
    try {
      const res  = await fetch(`${API}/api/auth/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Greška pri prijavi')
      setLoginOk('Uspešna prijava!')
      setTimeout(() => { login(data.user, data.token); navigate('/') }, 800)
    } catch (err) { setLoginErr(err.message) }
    setLoginLoad(false)
  }

  async function handleRegister(e) {
    e.preventDefault()
    setRegLoad(true); setRegErr(null); setRegOk(null)
    try {
      const res  = await fetch(`${API}/api/auth/register`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(regForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Greška pri registraciji')
      setRegOk('Nalog kreiran!')
      setTimeout(() => { login(data.user, data.token); navigate('/') }, 800)
    } catch (err) { setRegErr(err.message) }
    setRegLoad(false)
  }

  const floaters = [
    { v:'73%',  t:'8%',  l:'8%',  d:'0s',   s:22 },
    { v:'28.5', t:'22%', r:'10%', d:'0.8s', s:18 },
    { v:'OVER', t:'52%', l:'6%',  d:'1.5s', s:16 },
    { v:'1.88', t:'74%', r:'7%',  d:'2.0s', s:19 },
    { v:'PTS',  t:'87%', l:'28%', d:'0.5s', s:14 },
    { v:'112',  t:'38%', r:'16%', d:'1.2s', s:26 },
    { v:'UNDER',t:'62%', l:'18%', d:'0.3s', s:13 },
    { v:'NBA',  t:'15%', r:'28%', d:'1.7s', s:15 },
  ]

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#05080f', fontFamily:"'DM Sans',sans-serif", position:'relative', overflow:'hidden' }}>
      <style>{`
        /* ── dot-grid page background ── */
        .auth-bg::before {
          content:''; position:absolute; inset:0;
          background-image: radial-gradient(circle, rgba(30,50,80,0.5) 1px, transparent 1px);
          background-size: 28px 28px; pointer-events:none;
        }

        /* ── main container ── */
        .auth-container {
          position: relative;
          width: 820px; max-width: 96vw;
          min-height: 540px;
          border-radius: 22px;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04);
        }

        /* ── form panels ── */
        .auth-panel {
          position: absolute;
          top: 0; height: 100%;
          width: 50%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 44px 40px;
          box-sizing: border-box;
          background: #080c18;
          transition: all 0.65s cubic-bezier(0.68,-0.55,0.27,1.55);
        }

        /* ── SIGN IN panel ── */
        .auth-sign-in {
          left: 0; z-index: 2;
          opacity: 1;
          transform: translateX(0);
        }
        .auth-container.active .auth-sign-in {
          transform: translateX(100%);
          opacity: 0;
          z-index: 1;
        }

        /* ── SIGN UP panel ── */
        .auth-sign-up {
          left: 0; z-index: 1;
          opacity: 0;
          transform: translateX(0);
        }
        .auth-container.active .auth-sign-up {
          transform: translateX(100%);
          opacity: 1;
          z-index: 5;
          animation: authReveal 0.65s cubic-bezier(0.68,-0.55,0.27,1.55) forwards;
        }
        @keyframes authReveal {
          0%   { transform: translateX(30px); opacity:0; }
          100% { transform: translateX(100%); opacity:1; }
        }

        /* ── OVERLAY container ── */
        .auth-overlay-wrap {
          position: absolute;
          top: 0; left: 50%; z-index: 100;
          width: 50%; height: 100%;
          overflow: hidden;
          transition: transform 0.65s cubic-bezier(0.68,-0.55,0.27,1.55);
        }
        .auth-container.active .auth-overlay-wrap {
          transform: translateX(-100%);
        }

        /* ── OVERLAY inner ── */
        .auth-overlay {
          position: relative;
          width: 200%; height: 100%; left: -100%;
          background: linear-gradient(135deg, #ff7a1a 0%, #e55000 55%, #8c2800 100%);
          transition: transform 0.65s cubic-bezier(0.68,-0.55,0.27,1.55);
        }
        .auth-container.active .auth-overlay {
          transform: translateX(50%);
        }

        /* ── OVERLAY panels ── */
        .auth-overlay-panel {
          position: absolute;
          top: 0; height: 100%; width: 50%;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          padding: 44px 36px; box-sizing: border-box;
          text-align: center;
          overflow: hidden;
        }
        .auth-overlay-left  {
          transform: translateX(-20%);
          transition: transform 0.65s cubic-bezier(0.68,-0.55,0.27,1.55);
        }
        .auth-overlay-right {
          right: 0;
          transform: translateX(0);
          transition: transform 0.65s cubic-bezier(0.68,-0.55,0.27,1.55);
        }
        .auth-container.active .auth-overlay-left  { transform: translateX(0); }
        .auth-container.active .auth-overlay-right { transform: translateX(20%); }

        /* ── inputs ── */
        .auth-input {
          width: 100%; box-sizing: border-box;
          background: #0d1220; border: 1px solid #1a2840; border-radius: 10px;
          padding: 12px 16px; color: #edf2f7; font-size: 13.5px;
          font-family: 'DM Sans',sans-serif; outline: none;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          display: block; margin-bottom: 10px; letter-spacing: 0.2px;
        }
        .auth-input:focus {
          border-color: #ff6a00;
          box-shadow: 0 0 0 3px rgba(255,106,0,0.13);
          background: #0b1020;
        }
        .auth-input::placeholder { color: #1e3250; }

        /* ── buttons ── */
        .auth-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 11px 36px; border: none; border-radius: 30px;
          font-size: 11px; font-weight: 700; cursor: pointer;
          font-family: 'DM Sans',sans-serif; letter-spacing: 2.5px; text-transform: uppercase;
          transition: transform 0.18s, box-shadow 0.18s, opacity 0.18s;
          position: relative; overflow: hidden; margin-top: 6px;
        }
        .auth-btn::after {
          content:''; position:absolute; inset:0;
          background: linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 55%);
          opacity:0; transition: opacity 0.2s;
        }
        .auth-btn:hover:not(:disabled)::after  { opacity:1; }
        .auth-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.35); }
        .auth-btn:disabled { opacity:0.5; cursor:not-allowed; transform:none; }
        .auth-btn-solid { background: linear-gradient(135deg,#ff6a00,#ff9c00); color:#000; box-shadow: 0 6px 20px rgba(255,106,0,0.4); }
        .auth-btn-ghost { background: transparent; color:#fff; border: 1.5px solid rgba(255,255,255,0.5); }
        .auth-btn-ghost:hover:not(:disabled) { border-color:#fff; box-shadow: 0 10px 28px rgba(0,0,0,0.2); }

        /* spinner */
        @keyframes spin { to { transform:rotate(360deg); } }
        .auth-spinner {
          width:14px; height:14px; border-radius:50%;
          border:2px solid rgba(0,0,0,0.2); border-top-color:#000;
          animation: spin 0.7s linear infinite;
          flex-shrink:0;
        }
        .auth-btn-ghost .auth-spinner { border:2px solid rgba(255,255,255,0.2); border-top-color:#fff; }

        /* alerts */
        .auth-err { background:rgba(255,60,60,0.09); border:1px solid rgba(255,60,60,0.28); color:#ff6a6a; border-radius:9px; padding:9px 14px; font-size:12px; margin-bottom:10px; text-align:center; width:100%; box-sizing:border-box; }
        .auth-ok  { background:rgba(0,210,150,0.09); border:1px solid rgba(0,210,150,0.28); color:#00d49a; border-radius:9px; padding:9px 14px; font-size:12px; margin-bottom:10px; text-align:center; width:100%; box-sizing:border-box; }

        /* floating numbers */
        @keyframes authFloat { 0%,100%{ transform:translateY(0); opacity:0.15; } 50%{ transform:translateY(-10px); opacity:0.28; } }

        /* ── mobile ── */
        @media (max-width: 640px) {
          .auth-container { min-height: 100dvh; border-radius:0; }
          .auth-panel { width:100%; }
          .auth-sign-in { left:0; }
          .auth-sign-up  { left:0; }
          .auth-overlay-wrap { display:none; }
          .auth-container.active .auth-sign-in { transform:translateX(-100%); opacity:0; }
          .auth-container.active .auth-sign-up { transform:translateX(0); opacity:1; animation:none; }
          .auth-mobile-toggle { display:flex !important; }
        }
        .auth-mobile-toggle { display:none; }
      `}</style>

      {/* page dot-grid */}
      <div className="auth-bg" style={{ position:'fixed', inset:0, pointerEvents:'none' }} />

      {/* ambient glow */}
      <div style={{ position:'fixed', top:'40%', left:'50%', transform:'translate(-50%,-50%)', width:600, height:600, borderRadius:'50%', background:'radial-gradient(circle, rgba(255,106,0,0.04) 0%, transparent 65%)', pointerEvents:'none' }} />

      {/* ════════════════════════════════════
          MAIN CONTAINER
      ════════════════════════════════════ */}
      <div className={`auth-container${active ? ' active' : ''}`}>

        {/* ── SIGN IN FORM ── */}
        <div className="auth-panel auth-sign-in">
          <div style={{ width:'100%', maxWidth:300 }}>
            <div style={{ marginBottom:28, textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#ff6a00', letterSpacing:4, fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>Dobrodošao nazad</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:42, letterSpacing:2.5, color:'#edf2f7', lineHeight:1, marginBottom:8 }}>PRIJAVA</div>
              <div style={{ width:32, height:3, background:'linear-gradient(90deg,#ff6a00,#ff9c00)', borderRadius:2, margin:'0 auto' }} />
            </div>

            {loginErr && <div className="auth-err">⚠ {loginErr}</div>}
            {loginOk  && <div className="auth-ok">✓ {loginOk}</div>}

            <form onSubmit={handleLogin} style={{ width:'100%' }}>
              <input className="auth-input" type="email" placeholder="Email adresa"
                value={loginForm.email} onChange={e => setLoginForm(f=>({...f,email:e.target.value}))} required />
              <input className="auth-input" type="password" placeholder="Lozinka"
                value={loginForm.password} onChange={e => setLoginForm(f=>({...f,password:e.target.value}))} required />
              <div style={{ textAlign:'center', marginTop:4 }}>
                <button type="submit" className="auth-btn auth-btn-solid" disabled={loginLoad}>
                  {loginLoad ? <><span className="auth-spinner"/>&nbsp;Prijavljivanje</> : 'Prijavi se'}
                </button>
              </div>
            </form>

            {/* mobile toggle */}
            <div className="auth-mobile-toggle" style={{ justifyContent:'center', marginTop:22, fontSize:13, color:'#3d5570' }}>
              Nemaš nalog?&nbsp;
              <span style={{ color:'#ff6a00', fontWeight:600, cursor:'pointer' }} onClick={()=>setActive(true)}>Registruj se</span>
            </div>
          </div>
        </div>

        {/* ── SIGN UP FORM ── */}
        <div className="auth-panel auth-sign-up">
          <div style={{ width:'100%', maxWidth:300 }}>
            <div style={{ marginBottom:24, textAlign:'center' }}>
              <div style={{ fontSize:9, color:'#ff6a00', letterSpacing:4, fontWeight:700, textTransform:'uppercase', marginBottom:8 }}>Kreiraj nalog</div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:42, letterSpacing:2.5, color:'#edf2f7', lineHeight:1, marginBottom:8 }}>REGISTRACIJA</div>
              <div style={{ width:32, height:3, background:'linear-gradient(90deg,#ff6a00,#ff9c00)', borderRadius:2, margin:'0 auto' }} />
            </div>

            {regErr && <div className="auth-err">⚠ {regErr}</div>}
            {regOk  && <div className="auth-ok">✓ {regOk}</div>}

            <form onSubmit={handleRegister} style={{ width:'100%' }}>
              <input className="auth-input" type="text" placeholder="Korisničko ime"
                value={regForm.username} onChange={e => setRegForm(f=>({...f,username:e.target.value}))} required />
              <input className="auth-input" type="email" placeholder="Email adresa"
                value={regForm.email} onChange={e => setRegForm(f=>({...f,email:e.target.value}))} required />
              <input className="auth-input" type="password" placeholder="Lozinka (min. 6 karaktera)"
                value={regForm.password} onChange={e => setRegForm(f=>({...f,password:e.target.value}))} required />
              <div style={{ textAlign:'center', marginTop:4 }}>
                <button type="submit" className="auth-btn auth-btn-solid" disabled={regLoad}>
                  {regLoad ? <><span className="auth-spinner"/>&nbsp;Kreiranje</> : 'Registruj se'}
                </button>
              </div>
            </form>

            {/* mobile toggle */}
            <div className="auth-mobile-toggle" style={{ justifyContent:'center', marginTop:22, fontSize:13, color:'#3d5570' }}>
              Već imaš nalog?&nbsp;
              <span style={{ color:'#ff6a00', fontWeight:600, cursor:'pointer' }} onClick={()=>setActive(false)}>Prijavi se</span>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════
            OVERLAY  (orange sliding panel)
        ════════════════════════════════════ */}
        <div className="auth-overlay-wrap">
          <div className="auth-overlay">

            {/* ── LEFT overlay panel (shown when register is active) ── */}
            <div className="auth-overlay-panel auth-overlay-left">
              {/* floating numbers */}
              {floaters.slice(0,4).map((f,i) => (
                <div key={i} style={{ position:'absolute', top:f.t, left:f.l, right:f.r, fontFamily:"'Bebas Neue',sans-serif", fontSize:f.s, color:'rgba(0,0,0,0.22)', letterSpacing:2, animation:`authFloat 4s ease-in-out ${f.d} infinite`, pointerEvents:'none', userSelect:'none' }}>{f.v}</div>
              ))}
              <div style={{ position:'relative', zIndex:1 }}>
                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:52, letterSpacing:3, lineHeight:0.85, marginBottom:16, color:'#fff' }}>
                  COURT<br />
                  <span style={{ WebkitTextStroke:'2px rgba(255,255,255,0.5)', color:'transparent' }}>EDGE</span>
                </div>
                <p style={{ fontSize:13.5, color:'rgba(255,255,255,0.75)', lineHeight:1.7, marginBottom:32, maxWidth:220 }}>
                  Već imaš nalog? Vrati se i nastavi analizu.
                </p>
                <button className="auth-btn auth-btn-ghost" onClick={()=>setActive(false)}>
                  Prijavi se
                </button>
              </div>
            </div>

            {/* ── RIGHT overlay panel (shown by default, on login screen) ── */}
            <div className="auth-overlay-panel auth-overlay-right">
              {/* floating numbers */}
              {floaters.slice(4).map((f,i) => (
                <div key={i} style={{ position:'absolute', top:f.t, left:f.l, right:f.r, fontFamily:"'Bebas Neue',sans-serif", fontSize:f.s, color:'rgba(0,0,0,0.22)', letterSpacing:2, animation:`authFloat 4.5s ease-in-out ${f.d} infinite`, pointerEvents:'none', userSelect:'none' }}>{f.v}</div>
              ))}
              {/* glow blobs */}
              <div style={{ position:'absolute', top:-60, right:-40, width:240, height:240, borderRadius:'50%', background:'radial-gradient(circle,rgba(255,220,100,0.3) 0%,transparent 65%)', pointerEvents:'none' }} />
              <div style={{ position:'absolute', bottom:-40, left:-30, width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle,rgba(0,0,0,0.35) 0%,transparent 65%)', pointerEvents:'none' }} />
              {/* diagonal lines */}
              <div style={{ position:'absolute', top:0, right:-60, width:1, height:'200%', background:'rgba(255,255,255,0.07)', transform:'rotate(12deg)', transformOrigin:'top', pointerEvents:'none' }} />
              <div style={{ position:'absolute', top:0, right:40, width:1, height:'200%', background:'rgba(255,255,255,0.04)', transform:'rotate(12deg)', transformOrigin:'top', pointerEvents:'none' }} />

              <div style={{ position:'relative', zIndex:1 }}>
                {/* eyebrow */}
                <div style={{ display:'inline-flex', alignItems:'center', gap:7, background:'rgba(0,0,0,0.18)', borderRadius:20, padding:'5px 14px', marginBottom:18 }}>
                  <span style={{ width:6, height:6, borderRadius:'50%', background:'#fff', opacity:0.65, display:'inline-block' }} />
                  <span style={{ fontSize:9, letterSpacing:3.5, color:'rgba(255,255,255,0.65)', fontWeight:700, textTransform:'uppercase' }}>NBA Prop Analyzer</span>
                </div>

                <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:52, letterSpacing:3, lineHeight:0.85, marginBottom:16 }}>
                  <span style={{ color:'#fff', display:'block' }}>COURT</span>
                  <span style={{ display:'block', WebkitTextStroke:'2px rgba(255,255,255,0.5)', color:'transparent' }}>EDGE</span>
                </div>

                <p style={{ fontSize:13.5, color:'rgba(255,255,255,0.75)', lineHeight:1.7, marginBottom:32, maxWidth:220 }}>
                  Nemaš nalog? Pridruži se besplatno i počni sa AI analizom.
                </p>

                {/* mini stats */}
                <div style={{ display:'flex', gap:24, marginBottom:36 }}>
                  {[['AI','Powered'],['LIVE','Stats'],['FREE','Uvek']].map(([n,l]) => (
                    <div key={n}>
                      <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:22, color:'#fff', letterSpacing:2, lineHeight:1 }}>{n}</div>
                      <div style={{ fontSize:8, color:'rgba(255,255,255,0.45)', letterSpacing:2, fontWeight:600, marginTop:2, textTransform:'uppercase' }}>{l}</div>
                    </div>
                  ))}
                </div>

                <button className="auth-btn auth-btn-ghost" onClick={()=>setActive(true)}>
                  Registruj se
                </button>
              </div>
            </div>

          </div>
        </div>
        {/* /overlay */}

      </div>
      {/* /container */}

    </div>
  )
}
