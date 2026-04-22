import { Activity, TrendingDown, Shield, Skull } from 'lucide-react';
import { formatCurrency } from '../utils/formatCurrency';

/**
 * Dashboard — Systemic risk metrics displayed as glass cards.
 */
export default function Dashboard({ networkData, cascadeResult, debtRanks, currency }) {
  const totalNodes = networkData?.nodes?.length || 0;
  const totalEdges = networkData?.edges?.length || 0;

  const totalCapital = networkData?.nodes?.reduce((s, n) => s + n.capital, 0) || 0;

  // Post-cascade metrics
  const systemicLoss = cascadeResult?.totalSystemicLoss || 0;
  const defaultCount = cascadeResult?.totalDefaults || 0;
  const survivalRate = cascadeResult ? Math.round(cascadeResult.survivalRate * 100) : 100;
  const cascadeRounds = cascadeResult?.rounds?.length - 1 || 0;

  // Average DebtRank
  let avgDebtRank = 0;
  if (debtRanks && debtRanks.size > 0) {
    let sum = 0;
    for (const [, dr] of debtRanks) sum += dr;
    avgDebtRank = (sum / debtRanks.size).toFixed(3);
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--space-md)', flex: 1 }}>
      <div className="glass-card metric-card">
        <div className="label">Network</div>
        <div className="value">{totalNodes}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {totalEdges} exposures
        </div>
      </div>

      <div className="glass-card metric-card">
        <div className="label">Total Capital</div>
        <div className="value">{formatCurrency(totalCapital, currency)}</div>
      </div>

      <div className="glass-card metric-card">
        <div className="label">Systemic Loss</div>
        <div className={`value ${systemicLoss > 0 ? 'value--danger' : ''}`}>
          {formatCurrency(systemicLoss, currency)}
        </div>
      </div>

      <div className="glass-card metric-card">
        <div className="label">Defaults</div>
        <div className={`value ${defaultCount > 0 ? 'value--danger' : 'value--success'}`}>
          {defaultCount}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
          {cascadeRounds} rounds
        </div>
      </div>

      <div className="glass-card metric-card">
        <div className="label">Survival</div>
        <div className={`value ${survivalRate < 70 ? 'value--danger' : 'value--success'}`}>
          {survivalRate}%
        </div>
      </div>


    </div>
  );
}
