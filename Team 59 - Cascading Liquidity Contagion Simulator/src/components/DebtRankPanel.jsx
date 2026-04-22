import { getTopSystemicNodes } from '../engine/DebtRank';
import { Crown } from 'lucide-react';

/**
 * DebtRankPanel — Shows the most systemically important nodes.
 */
export default function DebtRankPanel({ debtRanks, nodes }) {
  if (!debtRanks || debtRanks.size === 0) return null;

  const topNodes = getTopSystemicNodes(debtRanks, nodes, nodes.length);
  const maxDR = Math.max(...topNodes.map(n => n.debtRank), 0.01);

  return (
    <div className="glass-card">
      <div className="section-header">
        <Crown className="icon" size={16} />
        <h3>Systemic Importance (DebtRank)</h3>
      </div>

      <div className="debtrank-list">
        {topNodes.map((node, idx) => (
          <div key={node.id} className="debtrank-item animate-in" style={{ animationDelay: `${idx * 50}ms` }}>
            <span className="debtrank-name">
              {idx < 3 && (
                <span style={{
                  display: 'inline-block',
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: idx === 0 ? 'var(--accent-red)' : idx === 1 ? 'var(--accent-orange)' : 'var(--accent-yellow)',
                  textAlign: 'center',
                  lineHeight: '18px',
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#fff',
                  marginRight: 6,
                }}>
                  {idx + 1}
                </span>
              )}
              {node.name.split(' ')[0]}
            </span>
            <div className="debtrank-bar-container">
              <div
                className="debtrank-bar"
                style={{
                  width: `${(node.debtRank / maxDR) * 100}%`,
                  background: node.debtRank > 0.5
                    ? 'linear-gradient(90deg, #ef4444, #f97316)'
                    : node.debtRank > 0.3
                    ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                    : 'linear-gradient(90deg, #06b6d4, #8b5cf6)',
                }}
              />
            </div>
            <span className="debtrank-score">{node.debtRank.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
