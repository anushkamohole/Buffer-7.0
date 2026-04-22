export default function InstitutionHealthTable({ nodes = [], cascadeState, currency = 'USD' }) {
  if (!nodes || nodes.length === 0) return null;

  return (
    <div className="bottom-panel">
      <div className="card-header">
        <div className="card-title">
          <span style={{ marginRight: 6 }}>🏥</span>
          INSTITUTION HEALTH
        </div>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div className="health-table-container" style={{ height: '100%', border: 'none' }}>
          <table className="health-table" style={{ display: 'table', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '38%' }} />
              <col style={{ width: '25%' }} />
              <col style={{ width: '17%' }} />
              <col style={{ width: '20%' }} />
            </colgroup>
            <thead>
              <tr style={{ display: 'table-row' }}>
                <th>Institution</th>
                <th>Capital Buffer</th>
                <th>Liquidity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody style={{ display: 'table-row-group' }}>
              {nodes.map(node => {
                const state         = cascadeState?.find(s => s.id === node.id);
                // Force sync: If no state in cascadeState, fallback to base node props
                const currentCap    = state ? state.capital : node.capital;
                const isDefaulted   = state ? state.defaulted : (node.capital <= 0);
                
                // term: initialCapital used for distress calculation
                const initialCap    = node.initialCapital || node.capital; 
                const survivalRatio = initialCap > 0 ? Math.max(0, currentCap / initialCap) : 1;
                const liquidity     = (node.assets * 0.15).toFixed(1);

                // calculateStatus logic fix: 
                // DEFAULT if capital <= 0. DISTRESSED if capital < 50% of initial.
                let statusClass = 'healthy', statusLabel = 'HEALTHY';
                if (isDefaulted || currentCap <= 0) { 
                  statusClass = 'default';  
                  statusLabel = 'DEFAULT'; 
                } else if (currentCap < (initialCap * 0.5)) { 
                  statusClass = 'critical'; 
                  statusLabel = 'DISTRESSED'; 
                } else if (survivalRatio < 0.8) { 
                  statusClass = 'fragile';  
                  statusLabel = 'STRESSED'; 
                }

                return (
                  <tr key={node.id} style={{ display: 'table-row' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ 
                        fontWeight: 800, 
                        color: (isDefaulted || currentCap <= 0) ? '#ff4d4d' : '#f8fafc', 
                        fontSize: '10.5px' 
                      }}>
                        {node.name}
                      </div>
                      <div style={{ fontSize: '8.5px', color: '#64748b', textTransform: 'uppercase' }}>
                        {node.type || 'Commercial Bank'}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', fontWeight: 700, color: currentCap < (initialCap * 0.5) ? '#fb923c' : '#f8fafc' }}>
                        {currency === 'INR' ? '₹' : '$'}{Number(currentCap).toFixed(1)}B
                      </div>
                      <div style={{ height: 2, width: '80%', background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden', marginTop: 4 }}>
                        <div style={{
                          height: '100%',
                          width: `${Math.min(100, survivalRatio * 100)}%`,
                          background: (isDefaulted || currentCap <= 0) ? '#ef4444' : (currentCap < (initialCap * 0.5) ? '#f97316' : '#22c55e'),
                          transition: 'width 0.4s ease-in-out',
                        }} />
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '11px', color: (isDefaulted || currentCap <= 0) ? '#64748b' : '#00dcff', fontWeight: 600 }}>
                        {liquidity}B
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <span className={`health-status ${statusClass}`} style={{ fontSize: '9px', fontWeight: 800 }}>
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
