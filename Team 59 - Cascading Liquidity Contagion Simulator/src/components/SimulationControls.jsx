import { useState, useCallback } from 'react';
import { formatCurrency } from '../utils/formatCurrency';

// ─── SVG Icons ──────────────────────────────────────────────────────────────
const IconZap     = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
const IconRefresh = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>;
const IconFire    = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>;

export default function SimulationControls({ nodes = [], onTrigger, onReset, isSimulating }) {
  const [targetId,      setTargetId]      = useState('');
  const [shockAmount,   setShockAmount]   = useState(300);
  const [lgd,           setLgd]           = useState(1.0);
  const [fireSale,      setFireSale]      = useState(false);

  const selectedNode = nodes.find(n => String(n.id) === String(targetId));
  const maxShock     = selectedNode ? Math.round(selectedNode.assets * 0.9) : 1200;
  const canTrigger   = !!targetId && !isSimulating;

  return (
    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      <div className="form-row">
        <div className="form-label">Step 1: Select Target Institution</div>
        <select
          className="form-select"
          value={targetId}
          style={!targetId ? { borderColor: 'var(--cyan)', boxShadow: '0 0 8px var(--cyan-dim)' } : {}}
          onChange={e => {
            setTargetId(e.target.value);
            const node = nodes.find(n => String(n.id) === e.target.value);
            if (node) setShockAmount(Math.round(node.capital * 0.4));
          }}
        >
          <option value="" disabled>Choose a bank to shock…</option>
          {nodes.map(n => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="form-label">
          <span>Step 2: Shock Magnitude</span>
          <span className="form-label-value">{formatCurrency(shockAmount, 'USD')}</span>
        </div>
        <input
          type="range"
          className="form-range"
          min={10}
          max={maxShock}
          step={10}
          value={shockAmount}
          onChange={e => setShockAmount(Number(e.target.value))}
        />
      </div>

      <div className="form-row">
        <div className="form-label">
          <span>Loss Given Default (LGD)</span>
          <span className="form-label-value" style={{ color: 'var(--yellow)' }}>{(lgd * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          className="form-range"
          min={0.1}
          max={1.0}
          step={0.05}
          value={lgd}
          style={{ accentColor: 'var(--yellow)' }}
          onChange={e => setLgd(Number(e.target.value))}
        />
      </div>

      <div className="toggle-row">
        <span className="toggle-label">
          <IconFire /> Fire-Sale Contagion Channel
        </span>
        <label className="toggle">
          <input type="checkbox" checked={fireSale} onChange={e => setFireSale(e.target.checked)} />
          <span className="toggle-slider" />
        </label>
      </div>

      {/* Primary Action Button */}
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button
          className="btn-trigger"
          style={{ 
            flex: 1, 
            height: 42,
            background: canTrigger ? 'rgba(255,77,77,0.2)' : 'rgba(255,255,255,0.05)',
            borderColor: canTrigger ? 'var(--red)' : 'var(--glass-border)',
            opacity: canTrigger ? 1 : 0.5,
            animation: canTrigger ? 'pulse-shock 2s infinite' : 'none'
          }}
          disabled={!canTrigger}
          onClick={() => onTrigger(Number(targetId), shockAmount, lgd, fireSale)}
        >
          <IconZap /> {isSimulating ? 'SIMULATING...' : 'GENERATE SIMULATION SHOCK'}
        </button>
        <button className="btn-reset" style={{ height: 42, width: 42 }} onClick={onReset} title="Reset system to healthy state">
          <IconRefresh />
        </button>
      </div>

      {!targetId && (
        <div style={{ fontSize: 10, color: 'var(--cyan)', textAlign: 'center', fontWeight: 600 }}>
          ↑ Select a bank to begin contagion simulation
        </div>
      )}

      <style>{`
        @keyframes pulse-shock {
          0%   { box-shadow: 0 0 0 0 rgba(255,77,77,0.4); }
          70%  { box-shadow: 0 0 0 10px rgba(255,77,77,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,77,77,0); }
        }
      `}</style>
    </div>
  );
}
