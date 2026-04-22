import { useState, useCallback, useRef } from 'react';
import { runMonteCarlo } from '../engine/MonteCarlo';
import { formatCurrency } from '../utils/formatCurrency';

/**
 * MonteCarloPanel
 * 
 * Performance Fix: Heavy simulation loop is wrapped in an async Promise
 * to ensure UI responsiveness. Added robust error handling for mathematical
 * edge cases and overflows in the Eisenberg-Noe engine.
 */
export default function MonteCarloPanel({ nodes, edges, currency, onMCResult }) {
  const [iterations,    setIterations]    = useState(500);
  const [shockMean,     setShockMean]     = useState('');
  const [shockStdPct,   setShockStdPct]   = useState(20);
  const [lgdMean,       setLgdMean]       = useState(0.8);
  const [lgdStdDev,     setLgdStdDev]     = useState(0.12);
  const [targetIdx,     setTargetIdx]     = useState(0);
  const [result,        setResult]        = useState(null);
  const [isSimulating,  setIsSimulating]  = useState(false);
  const [error,         setError]         = useState(null);

  const handleRun = useCallback(async () => {
    setError(null);
    if (!nodes?.length || !edges?.length) { 
      setError('Load a scenario first.'); 
      return; 
    }
    const rawMean = parseFloat(shockMean);
    if (isNaN(rawMean) || rawMean <= 0) { 
      setError('Enter a valid shock mean.'); 
      return; 
    }

    setIsSimulating(true);
    setResult(null);
    onMCResult?.(null);

    try {
      // Execute heavy Monte Carlo loop in a Promise wrapper to allow React to paint
      const mcResultObj = await new Promise((resolve, reject) => {
        setTimeout(() => {
          try {
            const res = runMonteCarlo(nodes, edges, {
              iterations:      Math.max(10, Math.min(5000, iterations)),
              shockMean:       rawMean,
              shockStdDev:     rawMean * (shockStdPct / 100),
              lgdMean,
              lgdStdDev,
              targetNodeIndex: targetIdx,
            });
            resolve(res);
          } catch (e) {
            reject(new Error(`Simulation Overflow: ${e.message}`));
          }
        }, 60); // 60ms delay ensures "Simulating..." button state is visible
      });

      setResult(mcResultObj);
      onMCResult?.(mcResultObj);
    } catch (e) {
      console.error("Monte Carlo Error:", e);
      setError(e.message);
    } finally {
      setIsSimulating(false);
    }
  }, [nodes, edges, iterations, shockMean, shockStdPct, lgdMean, lgdStdDev, targetIdx, onMCResult]);

  return (
    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      
      <div className="form-row">
        <div className="form-label">Probabilistic Shock Target</div>
        <select
          className="form-select"
          value={targetIdx}
          onChange={e => {
            const idx = parseInt(e.target.value, 10);
            setTargetIdx(idx);
            if (!shockMean) setShockMean(String(Math.round(nodes[idx]?.capital * 0.5 ?? 0)));
          }}
        >
          {nodes?.map((n, i) => (
            <option key={n.id} value={i}>{n.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <div className="form-row">
          <div className="form-label">Iterations</div>
          <input
            type="number" className="form-select"
            value={iterations} onChange={e => setIterations(parseInt(e.target.value, 10) || 500)}
          />
        </div>
        <div className="form-row">
          <div className="form-label">Shock Mean ($B)</div>
          <input
            type="number" className="form-select" placeholder="Amount"
            value={shockMean} onChange={e => setShockMean(e.target.value)}
          />
        </div>
      </div>

      <div className="form-row">
        <label className="form-label">
          <span>Simulation Variance (σ)</span>
          <span className="text-cyan">±{shockStdPct}%</span>
        </label>
        <input
          type="range" className="form-range"
          min={0} max={80} value={shockStdPct}
          onChange={e => setShockStdPct(parseInt(e.target.value, 10))}
          style={{ accentColor: '#a78bfa' }}
        />
      </div>

      {error && <div style={{ fontSize: 11, color: 'var(--red)', background: 'var(--red-dim)', padding: 8, borderRadius: 6 }}>{error}</div>}

      <button
        className="btn-primary"
        style={{
          height: 44,
          background: isSimulating ? 'rgba(255,255,255,0.05)' : 'linear-gradient(90deg, #1e3a5f 0%, #004b7a 100%)',
          borderColor: isSimulating ? 'rgba(255,255,255,0.1)' : 'var(--cyan)',
          color: '#fff',
          fontWeight: 800,
          borderRadius: 8,
          boxShadow: isSimulating ? 'none' : '0 4px 14px rgba(0, 220, 255, 0.2)',
          cursor: isSimulating ? 'wait' : 'pointer'
        }}
        onClick={handleRun}
        disabled={isSimulating}
      >
        {isSimulating ? 'ENGAGING MONTE CARLO CORE...' : '▶ RUN MONTE CARLO ENGINE'}
      </button>

      {result && (
        <div style={{ marginTop: 8, padding: 10, background: 'rgba(0,220,255,0.05)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center' }}>
            STATISTICAL SUMMARY (95% CONFIDENCE)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>VaR 95%</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange)' }}>{formatCurrency(result.var95, currency)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Worst Case</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--red)' }}>{formatCurrency(result.worstCase, currency)}</div>
            </div>
          </div>
          <div style={{ marginTop: 8, fontSize: 10, color: 'var(--green)', textAlign: 'center' }}>
             Heat-map data sent to graph. Overlay ENABLED.
          </div>
        </div>
      )}
    </div>
  );
}
