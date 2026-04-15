export default function TipCard({ tip, compact = false }) {
  const isOver = tip.recommendation === 'OVER'
  const isUnder = tip.recommendation === 'UNDER'
  const isSkip = tip.recommendation === 'SKIP'

  const recColor = isOver ? 'var(--green)' : isUnder ? 'var(--red)' : 'var(--muted)'
  const recBg = isOver ? 'var(--green-dim)' : isUnder ? 'var(--red-dim)' : 'rgba(107,114,128,0.1)'
  const recBorder = isOver ? 'rgba(0,214,143,0.3)' : isUnder ? 'rgba(255,77,79,0.3)' : 'rgba(107,114,128,0.2)'

  const valueColors = {
    excellent: 'var(--gold)',
    good: 'var(--green)',
    fair: '#60A5FA',
    poor: 'var(--muted)',
    skip: 'var(--muted)'
  }

  const conf = tip.confidence || 0
  const confColor = conf >= 70 ? 'var(--green)' : conf >= 50 ? 'var(--gold)' : 'var(--muted)'

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${recBorder}`,
      borderRadius: 'var(--radius-xl)',
      padding: compact ? '20px 24px' : '28px 32px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background accent glow */}
      {!isSkip && (
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: 300, height: 300,
          background: isOver
            ? 'radial-gradient(circle, rgba(0,214,143,0.06) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(255,77,79,0.06) 0%, transparent 70%)',
          pointerEvents: 'none'
        }} />
      )}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        {/* Left: player + prop info */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: compact ? 22 : 30,
              letterSpacing: 1,
              color: 'var(--text-1)',
              lineHeight: 1
            }}>
              {tip.player_name}
            </h2>
            {tip.opponent && (
              <span style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                vs {tip.opponent}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 13, fontWeight: 600,
              color: 'var(--text-2)',
              textTransform: 'uppercase', letterSpacing: 1
            }}>
              {tip.prop_type?.replace('_', ' ')}
            </span>
            <span style={{ color: 'var(--border)', fontSize: 16 }}>·</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-display)', letterSpacing: 1 }}>
              {tip.line}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>O/U</span>
          </div>
        </div>

        {/* Right: recommendation badge */}
        <div style={{ textAlign: 'right' }}>
          <div style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            background: recBg,
            border: `1px solid ${recBorder}`,
            borderRadius: 'var(--radius-lg)',
            padding: '12px 24px',
            minWidth: 120
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32,
              letterSpacing: 3,
              color: recColor,
              lineHeight: 1
            }}>
              {tip.recommendation}
            </span>
            {/* Confidence bar */}
            <div style={{ marginTop: 8, width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-3)', letterSpacing: 1 }}>CONFIDENCE</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: confColor }}>{conf}%</span>
              </div>
              <div style={{ height: 3, background: 'var(--bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${conf}%`,
                  background: confColor,
                  borderRadius: 2,
                  transition: 'width 0.8s ease'
                }} />
              </div>
            </div>
          </div>

          {/* Value rating */}
          {tip.value_rating && tip.value_rating !== 'skip' && (
            <div style={{
              marginTop: 8, fontSize: 11, fontWeight: 600,
              color: valueColors[tip.value_rating] || 'var(--muted)',
              letterSpacing: 1, textTransform: 'uppercase'
            }}>
              {tip.value_rating === 'excellent' && '★ '}
              {tip.value_rating} value
            </div>
          )}
        </div>
      </div>

      {/* Reasoning */}
      {tip.reasoning && !compact && (
        <div style={{
          marginTop: 20, padding: '14px 16px',
          background: 'var(--bg-1)',
          borderRadius: 'var(--radius-md)',
          borderLeft: `3px solid ${recColor}`,
          fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6
        }}>
          {tip.reasoning}
        </div>
      )}

      {/* Key factors */}
      {tip.key_factors?.length > 0 && !compact && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tip.key_factors.map((f, i) => (
            <span key={i} style={{
              fontSize: 12, padding: '4px 10px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              color: 'var(--text-3)'
            }}>
              {f}
            </span>
          ))}
        </div>
      )}

      {/* Best odd highlight */}
      {tip.best_bookmaker && tip.best_odd > 0 && !compact && (
        <div style={{
          marginTop: 16, display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'var(--gold-glow)',
          border: '1px solid var(--border-accent)',
          borderRadius: 'var(--radius-md)',
          fontSize: 13
        }}>
          <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase' }}>
            Najbolja kvota
          </span>
          <span style={{ color: 'var(--text-3)' }}>·</span>
          <span style={{ color: 'var(--text-1)', textTransform: 'capitalize', fontWeight: 500 }}>
            {tip.best_bookmaker}
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--gold)', letterSpacing: 1 }}>
            {tip.best_odd.toFixed(2)}
          </span>
        </div>
      )}
    </div>
  )
}
