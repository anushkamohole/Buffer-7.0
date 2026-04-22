import { BarChart3, ShieldAlert, Crown, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../utils/formatCurrency';

/**
 * FragilityCentralityView — Side-by-side comparison showing that
 * DebtRank (centrality) alone doesn't predict cascade devastation.
 * Nodes inside fragile SCCs cause disproportionate damage.
 */
export default function FragilityCentralityView({ nodes, debtRanks, sccData, currency }) {
  if (!nodes?.length || !debtRanks?.size || !sccData?.length) return null;

  // Build SCC membership map
  const sccMembershipMap = new Map();
  sccData.forEach((scc, idx) => {
    for (const id of scc.members) {
      sccMembershipMap.set(id, { sccIndex: idx, ...scc });
    }
  });

  // Sort nodes by DebtRank descending
  const ranked = nodes
    .map(n => ({
      id: n.id,
      name: n.name,
      debtRank: debtRanks.get(n.id) || 0,
      scc: sccMembershipMap.get(n.id) || null,
      capital: n.capital,
    }))
    .sort((a, b) => b.debtRank - a.debtRank);

  return (
    <div className="glass-card">
      <div className="section-header">
        <BarChart3 className="icon" size={16} />
        <h3>Fragility vs. Centrality</h3>
      </div>

      <div style={{ padding: 'var(--space-md)', overflowY: 'auto', maxHeight: 340 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 70px 70px 90px',
          gap: '4px 8px',
          fontSize: 11,
          color: 'var(--text-muted)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          paddingBottom: 8,
          borderBottom: '1px solid var(--border-subtle)',
          marginBottom: 6,
        }}>
          <span>Institution</span>
          <span style={{ textAlign: 'right' }}>DebtRank</span>
          <span style={{ textAlign: 'right' }}>Capital</span>
          <span style={{ textAlign: 'center' }}>SCC Status</span>
        </div>

        {ranked.map((r, idx) => (
          <div
            key={r.id}
            className="animate-in"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 70px 70px 90px',
              gap: '4px 8px',
              padding: '6px 0',
              borderBottom: '1px solid var(--border-subtle)',
              alignItems: 'center',
              animationDelay: `${idx * 30}ms`,
            }}
          >
            <span style={{
              fontSize: 12,
              color: 'var(--text-primary)',
              fontWeight: 500,
            }}>
              {r.name.split(' ')[0]}
            </span>

            <span style={{
              textAlign: 'right',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              fontWeight: 600,
              color: r.debtRank > 0.6 ? 'var(--accent-red)' :
                     r.debtRank > 0.4 ? 'var(--accent-yellow)' :
                     'var(--accent-green)',
            }}>
              {r.debtRank.toFixed(3)}
            </span>

            <span style={{
              textAlign: 'right',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--text-secondary)',
            }}>
              {formatCurrency(r.capital, currency)}
            </span>

            <span style={{ textAlign: 'center' }}>
              {r.scc ? (
                <span className={`badge badge--${r.scc.classification.toLowerCase()}`}>
                  {r.scc.classification === 'Critical' ? '☠️' : '⚠️'} {r.scc.fragilityScore.toFixed(1)}
                </span>
              ) : (
                <span style={{
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontStyle: 'italic',
                }}>
                  Peripheral
                </span>
              )}
            </span>
          </div>
        ))}

        {/* Insight callout */}
        <div style={{
          marginTop: 12,
          padding: '10px 12px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 'var(--radius-md)',
          fontSize: 11,
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}>
          <strong style={{ color: 'var(--accent-red)' }}>⚠ Key Insight:</strong>{' '}
          High DebtRank (centrality) does not guarantee devastating cascade.
          Nodes inside <strong>Critical SCCs</strong> (Fragility &gt; 1) trigger
          mathematically inevitable cluster collapse — regardless of their individual centrality score.
        </div>
      </div>
    </div>
  );
}
