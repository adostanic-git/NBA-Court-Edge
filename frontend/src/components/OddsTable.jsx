export default function OddsTable({ odds, recommendation, bestBookmaker }) {
  if (!odds || Object.keys(odds).length === 0) return null

  const isOver = recommendation === 'OVER'
  const isUnder = recommendation === 'UNDER'

  const bookmakerLabels = {
    meridian: 'Meridian',
    mozzart: 'Mozzart',
    maxbet: 'MaxBet',
    admiral: 'Admiral',
    sbbet: 'SBbet',
  }

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-xl)',
      padding: '24px',
      height: 'fit-content'
    }}>
      <h3 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 18, letterSpacing: 1,
        marginBottom: 16, color: 'var(--text-1)'
      }}>
        KVOTE
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 0 }}>
        {/* Header */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--text-3)', padding: '0 0 10px', textTransform: 'uppercase' }}>Kladionica</div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--green)', padding: '0 0 10px', textTransform: 'uppercase', textAlign: 'center' }}>OVER</div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--red)', padding: '0 0 10px', textTransform: 'uppercase', textAlign: 'center' }}>UNDER</div>

        {/* Divider */}
        <div style={{ gridColumn: '1/-1', height: 1, background: 'var(--border)', marginBottom: 8 }} />

        {Object.entries(odds).map(([bookie, bookOdds]) => {
          const isBest = bookie === bestBookmaker
          return (
            <>
              <div key={`${bookie}-name`} style={{
                padding: '10px 0',
                fontSize: 13, fontWeight: isBest ? 600 : 400,
                color: isBest ? 'var(--gold)' : 'var(--text-2)',
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                {isBest && <span style={{ fontSize: 10 }}>★</span>}
                {bookmakerLabels[bookie] || bookie}
              </div>

              <OddCell
                key={`${bookie}-over`}
                value={bookOdds.over}
                isHighlight={isOver && bookie === bestBookmaker}
                color="var(--green)"
              />
              <OddCell
                key={`${bookie}-under`}
                value={bookOdds.under}
                isHighlight={isUnder && bookie === bestBookmaker}
                color="var(--red)"
              />
            </>
          )
        })}
      </div>

      <div style={{ marginTop: 16, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.5 }}>
        ★ = Preporučena kladionica za ovaj tip
      </div>
    </div>
  )
}

function OddCell({ value, isHighlight, color }) {
  if (!value) {
    return <div style={{ padding: '10px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>—</div>
  }
  return (
    <div style={{
      padding: '8px 4px',
      textAlign: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: isHighlight ? 22 : 17,
        letterSpacing: 0.5,
        color: isHighlight ? color : 'var(--text-2)',
        background: isHighlight ? (color === 'var(--green)' ? 'var(--green-dim)' : 'var(--red-dim)') : 'transparent',
        padding: isHighlight ? '3px 10px' : '0',
        borderRadius: 6,
        transition: 'all 0.2s'
      }}>
        {value.toFixed(2)}
      </span>
    </div>
  )
}
