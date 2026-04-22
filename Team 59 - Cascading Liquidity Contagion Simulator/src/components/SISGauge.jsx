import React from 'react';

const SISGauge = ({ sisData }) => {
  if (!sisData) return null;
  
  // Ensure sis is a valid number and handle potential weird characters
  const rawSis = sisData.sis ?? 0;
  const sis = typeof rawSis === 'number' ? rawSis : parseFloat(rawSis) || 0;
  
  const label = sisData.label ?? sisData.classification ?? 'STABLE';
  const clamped = Math.min(Math.max(sis, 0), 1);

  let color, badgeBg, badgeBorder;
  if (sis > 0.6)      { color = 'var(--red)';    badgeBg = 'var(--red-dim)';    badgeBorder = 'rgba(255,77,77,0.35)'; }
  else if (sis > 0.3) { color = 'var(--yellow)'; badgeBg = 'var(--yellow-dim)'; badgeBorder = 'rgba(255,210,77,0.35)'; }
  else                { color = 'var(--green)';   badgeBg = 'var(--green-dim)';  badgeBorder = 'rgba(0,232,122,0.35)'; }

  return (
    <div className="sis-gauge-wrap">
      {/* Use standard sans-serif for the number to avoid weird font character issues */}
      <div className="sis-value" style={{ color, fontFamily: 'sans-serif' }}>
        {sis === 0 ? "0.000" : sis.toFixed(3)}
      </div>
      <div style={{ flex: 1 }}>
        <div className="sis-gauge-bar-wrap">
          <div
            className="sis-gauge-fill"
            style={{
              width: `${clamped * 100}%`,
              background: `linear-gradient(90deg, var(--green), ${sis > 0.3 ? 'var(--yellow)' : 'var(--green)'}, ${sis > 0.6 ? 'var(--red)' : 'transparent'})`,
              boxShadow: `0 0 8px ${color}`,
            }}
          />
        </div>
      </div>
      <div
        className="sis-label-badge"
        style={{ background: badgeBg, border: `1px solid ${badgeBorder}`, color }}
      >
        {label}
      </div>
    </div>
  );
};

export default SISGauge;
