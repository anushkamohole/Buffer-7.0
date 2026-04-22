import { useState } from 'react';
import { formatCurrency } from '../utils/formatCurrency';

/**
 * RescuePanel — Ford-Fulkerson Max-Flow Rescue Analysis
 *
 * Props:
 *   data       — { maxFlow, bottleneckEdge, flowPaths }
 *   nodes      — current node array
 *   currency   — "USD" | "INR"
 *   onInject   — (injectAmount, flowPaths) => void  — propagates capital injection up to App
 */
export default function RescuePanel({ data: rescueData, nodes, currency = 'USD', onInject }) {
  const [injectAmount, setInjectAmount] = useState(0);
  const [injected, setInjected]         = useState(false);
  const [injecting, setInjecting]       = useState(false);

  if (!rescueData) {
    return (
      <div className="card-body" style={{ textAlign: 'center', padding: '24px 16px' }}>
        <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.5 }}>🛡</div>
        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 700, marginBottom: 6 }}>
          Rescue Logic Inactive
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          Ford-Fulkerson max-flow capacity is computed automatically after you trigger a shock.
          <br /><br />
          <span style={{ color: 'var(--cyan)' }}>
            Select a target bank in the Shock Simulator above and click "GENERATE SIMULATION SHOCK".
          </span>
        </div>
      </div>
    );
  }

  const { maxFlow, bottleneckEdge, flowPaths = [] } = rescueData;
  const nodeName = idx => nodes?.[idx]?.name ?? `Node ${idx}`;
  const significantPaths = flowPaths.filter(p => p.flow > 1e-6);
  const maxInject = Math.ceil((maxFlow || 0) * 1.5) || 100;

  const handleInject = () => {
    if (injectAmount <= 0) return;
    setInjecting(true);

    // Propagate capital change to App.jsx so graph re-renders
    if (typeof onInject === 'function') {
      onInject(injectAmount, significantPaths);
    }

    setTimeout(() => {
      setInjecting(false);
      setInjected(true);
      setTimeout(() => setInjected(false), 4000);
    }, 600);
  };

  const injectionSufficient = injectAmount >= maxFlow * 0.8;

  return (
    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Max Rescue Capacity Hero */}
      <div style={{
        padding: '14px',
        borderRadius: 8,
        background: 'rgba(0,220,255,0.06)',
        border: '1px solid rgba(0,220,255,0.2)',
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 10, color: 'var(--cyan)', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
          Theoretical Max Rescue Capacity
        </div>
        <div style={{ fontSize: 28, fontWeight: 800, color: '#fff', fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>
          {formatCurrency(maxFlow, currency)}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6 }}>
          Ford-Fulkerson max-flow · {significantPaths.length} rescue route{significantPaths.length !== 1 ? 's' : ''} identified
        </div>
      </div>

      {/* Systemic Bottleneck */}
      {bottleneckEdge && (
        <div style={{ background: 'rgba(255,210,77,0.06)', border: '1px solid rgba(255,210,77,0.25)', borderRadius: 8, padding: '10px 13px' }}>
          <div style={{ fontSize: 10, color: 'var(--yellow)', fontFamily: "'JetBrains Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>
            🚨 Systemic Bottleneck — Highlighted in Graph
          </div>
          <div style={{ fontSize: 13, color: '#fff', fontWeight: 700 }}>
            {nodeName(bottleneckEdge[0])} <span style={{ color: 'var(--yellow)' }}>→</span> {nodeName(bottleneckEdge[1])}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
            Removing this link would maximally reduce recovery capacity
          </div>
        </div>
      )}

      {/* Rescue Routes — shown as green edges in graph */}
      {significantPaths.length > 0 && (
        <div>
          <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Augmenting Rescue Routes (green edges in graph)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {significantPaths.slice(0, 4).map((fp, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '6px 10px', borderRadius: 6,
                background: 'rgba(0,232,122,0.05)', border: '1px solid rgba(0,232,122,0.15)',
              }}>
                <span style={{ fontSize: 11, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                  {fp.path.map(idx => nodes[idx]?.name?.split(' ')[0] ?? `N${idx}`).join(' → ')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--green)', fontWeight: 700, fontFamily: "'JetBrains Mono',monospace", flexShrink: 0 }}>
                  {formatCurrency(fp.flow, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liquidity Injector */}
      <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 12, marginTop: 4 }}>
        <div className="form-label" style={{ marginBottom: 8 }}>
          <span>Liquidity Injection Amount</span>
          <span className="form-label-value">{formatCurrency(injectAmount, currency)}</span>
        </div>
        <input
          type="range"
          className="form-range"
          min={0}
          max={maxInject}
          step={Math.max(1, Math.round(maxInject / 50))}
          value={injectAmount}
          onChange={e => setInjectAmount(Number(e.target.value))}
          style={{ accentColor: injectionSufficient ? 'var(--green)' : 'var(--cyan)' }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)', marginTop: 3, marginBottom: 10 }}>
          <span>$0</span>
          <span style={{ color: injectionSufficient ? 'var(--green)' : 'var(--text-muted)' }}>
            {injectionSufficient ? '✓ Sufficient to break contagion' : `Target: ${formatCurrency(Math.round(maxFlow * 0.8), currency)}`}
          </span>
          <span>{formatCurrency(maxInject, currency)}</span>
        </div>
        <button
          className="btn-primary"
          style={{
            width: '100%',
            height: 40,
            background: injecting
              ? 'rgba(0,220,255,0.08)'
              : injectionSufficient
                ? 'rgba(0,232,122,0.15)'
                : 'rgba(0,220,255,0.1)',
            borderColor: injectionSufficient ? 'rgba(0,232,122,0.5)' : 'rgba(0,220,255,0.35)',
            color: injectionSufficient ? 'var(--green)' : 'var(--cyan)',
            fontSize: 12,
            fontWeight: 700,
          }}
          onClick={handleInject}
          disabled={injecting || injectAmount <= 0}
        >
          {injecting ? '⏳ Injecting...' : `💧 Inject ${formatCurrency(injectAmount, currency)} Capital Flow`}
        </button>
      </div>

      {/* Success confirmation */}
      {injected && (
        <div style={{
          fontSize: 11, color: 'var(--green)',
          background: 'var(--green-dim)',
          border: '1px solid rgba(0,232,122,0.3)',
          padding: '10px 12px', borderRadius: 7, textAlign: 'center',
          lineHeight: 1.5,
        }}>
          ✅ Liquidity injected into the network.<br />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            Node capitals updated — check graph for color changes.
          </span>
        </div>
      )}
    </div>
  );
}
