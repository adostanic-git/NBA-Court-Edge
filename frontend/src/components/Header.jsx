export default function Header() {
  return (
    <header style={{
      borderBottom: '1px solid var(--border)',
      background: 'rgba(8,12,20,0.9)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
      padding: '0 20px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16, height: 64 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--gold)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700,
            color: '#080c14'
          }}>C</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: 3, lineHeight: 1 }}>
              COURT EDGE
            </div>
            <div style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, lineHeight: 1, marginTop: 2 }}>
              AI POWERED
            </div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)' }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: 'var(--green)',
            boxShadow: '0 0 8px var(--green)',
            animation: 'pulse 2s infinite'
          }} />
          Live
        </div>
      </div>
    </header>
  )
}
