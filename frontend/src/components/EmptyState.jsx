export function LoadingSpinner() {
  return (
    <div style={{ marginTop: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      {/* Spinning ring */}
      <div style={{
        width: 52, height: 52,
        border: '3px solid var(--bg-3)',
        borderTop: '3px solid var(--gold)',
        borderRadius: '50%',
        animation: 'spin 0.9s linear infinite'
      }} />

      {/* Skeleton cards */}
      <div style={{ width: '100%', maxWidth: 800 }}>
        <div style={{ height: 140, borderRadius: 'var(--radius-xl)' }} className="skeleton" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
          <div style={{ height: 200, borderRadius: 'var(--radius-xl)' }} className="skeleton" />
          <div style={{ height: 200, borderRadius: 'var(--radius-xl)' }} className="skeleton" />
        </div>
      </div>

      <p style={{ fontSize: 13, color: 'var(--text-3)', letterSpacing: 1 }}>
        Preuzimam statistiku i analiziram...
      </p>
    </div>
  )
}

export default function EmptyState() {
  const examples = [
    { player: 'Nikola Jokic', prop: 'PRA', line: '52.5' },
    { player: 'Luka Doncic', prop: 'Points', line: '32.5' },
    { player: 'Stephen Curry', prop: 'Points', line: '28.5' },
  ]

  return (
    <div style={{
      marginTop: 60,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 32,
      textAlign: 'center'
    }}>
      {/* Icon */}
      <div style={{
        width: 72, height: 72,
        background: 'var(--bg-2)',
        border: '1px solid var(--border)',
        borderRadius: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32
      }}>
        🏀
      </div>

      <div>
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 28, letterSpacing: 2,
          color: 'var(--text-2)', marginBottom: 8
        }}>
          KAKO RADI
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-3)', maxWidth: 460, lineHeight: 1.7 }}>
          Unesi ime igrača, izaberi tip oklade i unesi liniju iz kladionice.
          AI analizira poslednjih N mečeva i daje ti preporuku OVER ili UNDER
          sa obrazloženjem i poređenjem kvota.
        </p>
      </div>

      {/* Steps */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, maxWidth: 600 }}>
        {[
          { num: '1', title: 'Unesi igrača', desc: 'Bilo koji NBA igrač iz aktivne sezone' },
          { num: '2', title: 'Izaberi prop', desc: 'Poeni, skokovi, asistencije, PRA...' },
          { num: '3', title: 'Dobij tip', desc: 'AI analiza + kvote svih kladionica' },
        ].map(step => (
          <div key={step.num} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px 16px',
          }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 32, color: 'var(--gold)',
              lineHeight: 1, marginBottom: 8
            }}>{step.num}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)', marginBottom: 4 }}>{step.title}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', lineHeight: 1.5 }}>{step.desc}</div>
          </div>
        ))}
      </div>

      {/* Example queries */}
      <div>
        <p style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: 1, marginBottom: 12, textTransform: 'uppercase' }}>
          Primeri
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {examples.map(ex => (
            <div key={ex.player} style={{
              padding: '7px 14px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border)',
              borderRadius: 20,
              fontSize: 12,
              color: 'var(--text-3)',
              cursor: 'default'
            }}>
              {ex.player} · {ex.prop} {ex.line}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
