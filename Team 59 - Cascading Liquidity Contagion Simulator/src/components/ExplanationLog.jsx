import { formatCurrency } from '../utils/formatCurrency';

export default function ExplanationLog({ explanations = [], cascadeResult, contagionPathData, nodes, currency = 'USD', vulnerabilityRanking = [] }) {
  if (!explanations || explanations.length === 0) {
    return (
      <div className="section-empty">
        <span style={{ fontSize: 20 }}>📋</span>
        Trigger a shock to see the contagion narrative
      </div>
    );
  }

  // Collect fire-sale events by round
  const fireSaleByRound = new Map();
  if (cascadeResult?.rounds) {
    for (const round of cascadeResult.rounds) {
      if (round.fireSaleEvents?.length > 0) {
        fireSaleByRound.set(round.round, round.fireSaleEvents);
      }
    }
  }

  const allRounds = new Set([...explanations.map(e => e.round), ...fireSaleByRound.keys()]);
  const sortedRounds = [...allRounds].sort((a, b) => a - b);

  const handleCopy = () => {
    const text = explanations.map(e => `[Round ${e.round}] ${e.nodeName}: ${e.narrative}`).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Prediction summary */}
      {vulnerabilityRanking.length > 0 && (
        <div style={{ padding: '10px 14px', background: 'rgba(0,220,255,0.04)', borderBottom: '1px solid var(--glass-border)', marginBottom: 4 }}>
          <div style={{ fontSize: 9.5, color: 'var(--cyan)', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Structural Risk Prediction
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            Pre-shock model identified <strong style={{ color: 'var(--text-primary)' }}>{vulnerabilityRanking[0].name}</strong> as highest vulnerability node.
            Predicted: <span style={{ color: 'var(--yellow)', fontFamily: "'JetBrains Mono',monospace" }}>
              {vulnerabilityRanking[0].predictedCascade?.totalDefaults} defaults, {formatCurrency(vulnerabilityRanking[0].predictedCascade?.totalSystemicLoss, currency)} loss
            </span>.
          </div>
          {cascadeResult && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              Actual: <span style={{ color: 'var(--text-primary)' }}>
                {cascadeResult.totalDefaults} defaults, {formatCurrency(cascadeResult.totalSystemicLoss, currency)} loss
              </span>
            </div>
          )}
        </div>
      )}

      {/* Copy button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '4px 14px 0' }}>
        <button
          onClick={handleCopy}
          style={{ fontSize: 10, color: 'var(--text-muted)', background: 'transparent', border: '1px solid var(--glass-border)', borderRadius: 5, padding: '3px 10px', cursor: 'pointer' }}
        >
          📋 Copy Log
        </button>
      </div>

      {/* Timeline */}
      {sortedRounds.map(roundNum => {
        const roundExps = explanations.filter(e => e.round === roundNum);
        const fsEvents  = fireSaleByRound.get(roundNum) ?? [];
        return (
          <div key={roundNum}>
            {/* Credit loss entries */}
            {roundExps.map(exp => (
              <div key={`${exp.nodeId}-${exp.round}`} className="exp-entry">
                <span className="exp-round-tag">R{exp.round}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ marginBottom: 3 }}>{exp.narrative}</div>
                  <div style={{ fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace" }}>
                    <span style={{ color: 'var(--green)' }}>{formatCurrency(exp.capitalBefore, currency)}</span>
                    <span style={{ color: 'var(--text-muted)', margin: '0 6px' }}>→</span>
                    <span style={{ color: 'var(--red)' }}>{formatCurrency(exp.capitalAfter, currency)}</span>
                  </div>
                </div>
              </div>
            ))}

            {/* Fire-sale entries */}
            {fsEvents.map((fs, idx) => (
              <div key={`fs-${roundNum}-${idx}`} className="exp-entry" style={{ borderLeft: '2px solid var(--orange)', borderBottom: '1px solid rgba(255,140,66,0.1)' }}>
                <span className="exp-round-tag" style={{ background: 'rgba(255,140,66,0.12)', color: 'var(--orange)' }}>R{roundNum}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 600, marginBottom: 2 }}>
                    🔥 Fire-Sale — {fs.asset}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    <strong>{fs.sellers.join(', ')}</strong> liquidated {formatCurrency(fs.soldVolume, currency)} {fs.asset}.
                    Price impact: <span style={{ color: 'var(--yellow)', fontFamily: "'JetBrains Mono',monospace" }}>
                      -{(fs.priceImpact * 100).toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      })}

      {/* Contagion path analysis */}
      {contagionPathData?.fastestVictim !== undefined && contagionPathData.fastestVictim !== -1 && nodes && (
        <div className="exp-entry" style={{ borderTop: '1px solid var(--glass-border)', marginTop: 4, paddingTop: 8 }}>
          <span className="exp-round-tag" style={{ background: 'rgba(255,140,66,0.12)', color: 'var(--orange)' }}>PATH</span>
          <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Fastest contagion route:{' '}
            {contagionPathData.paths[contagionPathData.fastestVictim]?.map((nodeIdx, i, arr) => (
              <span key={nodeIdx}>
                <strong style={{ color: 'var(--text-primary)' }}>{nodes[nodeIdx]?.name}</strong>
                {i < arr.length - 1 && <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
