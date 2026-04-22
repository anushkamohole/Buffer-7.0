import React from 'react';

const FragilityPanel = ({ sccData = [] }) => {
  const safe = Array.isArray(sccData) ? sccData : [];

  const sorted = React.useMemo(() =>
    [...safe].sort((a, b) => (b?.fragilityIndex ?? b?.fragility ?? 0) - (a?.fragilityIndex ?? a?.fragility ?? 0)),
  [safe]);

  if (sorted.length === 0) {
    return (
      <div className="card">
        <div className="section-empty">
          <span style={{ fontSize: 24 }}>🔗</span>
          No strongly connected components detected.<br />
          <span className="text-muted">Network is currently acyclic.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-body" style={{ padding: '10px 12px' }}>
        {sorted.map((scc, i) => {
          const fragility      = scc?.fragilityScore ?? scc?.fragilityIndex ?? scc?.fragility ?? 0;
          const exposure       = scc?.totalInternalExposure ?? scc?.internalExposure ?? scc?.totalInternal ?? 0;
          const capital        = scc?.totalCapital ?? scc?.capital ?? 0;
          const memberNames    = Array.isArray(scc?.members)
            ? scc.members
            : (Array.isArray(scc?.memberNames) ? scc.memberNames : []);

          let level = 'safe';
          let levelColor = 'var(--green)';
          let levelLabel = 'SAFE';
          if (fragility > 1.2 || exposure > capital * 1.1) {
            level = 'critical'; levelColor = 'var(--red)'; levelLabel = 'CRITICAL';
          } else if (fragility > 0.8) {
            level = 'high'; levelColor = 'var(--yellow)'; levelLabel = 'HIGH RISK';
          }

          return (
            <div key={scc?.id ?? i} className={`scc-item ${level}`}>
              <div className="scc-rank">RANK #{i + 1} · DEATH LOOP</div>

              <div className="scc-fragility">
                <span className="scc-fragility-label">Fragility Index</span>
                <span className="scc-fragility-score" style={{ color: levelColor }}>
                  {fragility.toFixed(3)} · <span style={{ fontSize: 10, fontWeight: 600 }}>{levelLabel}</span>
                </span>
              </div>

              {memberNames.length > 0 && (
                <div className="scc-members">
                  {memberNames.slice(0, 8).map((name, j) => (
                    <span key={j} className="scc-member-tag">{name}</span>
                  ))}
                  {memberNames.length > 8 && (
                    <span className="scc-member-tag" style={{ color: 'var(--text-muted)' }}>
                      +{memberNames.length - 8}
                    </span>
                  )}
                </div>
              )}

              <div className="scc-stats">
                <div>
                  <div className="scc-stat-label">Internal Exposure</div>
                  <div className="scc-stat-value">${exposure.toLocaleString()}B</div>
                </div>
                <div>
                  <div className="scc-stat-label">Capital Buffer</div>
                  <div className="scc-stat-value">${capital.toLocaleString()}B</div>
                </div>
              </div>

              {level === 'critical' && (
                <div className="scc-warning" style={{ background: 'rgba(255,77,77,0.1)', color: 'var(--red)', border: '1px solid rgba(255,77,77,0.25)' }}>
                  ⚠ Exposure exceeds capital — loop amplification risk
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default FragilityPanel;