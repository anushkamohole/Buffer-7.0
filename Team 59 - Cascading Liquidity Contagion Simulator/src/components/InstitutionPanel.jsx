import React from 'react';
import { formatCurrency } from '../utils/formatCurrency';

const InstitutionPanel = ({ node, cascadeState, debtRank, currency = 'USD' }) => {
  if (!node) {
    return (
      <div className="inst-empty">
        <div className="inst-empty-icon">🏦</div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', textAlign: 'center' }}>
          Select an entity from the network<br />to perform balance-sheet analysis
        </div>
      </div>
    );
  }

  const currentState = cascadeState?.find(s => s.id === node.id) || node;
  const isDefaulted = currentState.defaulted;
  const equity = currentState.capital;
  const assets = currentState.assets;
  const debt = currentState.liabilities;
  const capRatio = ((equity / assets) * 100).toFixed(2);
  
  const initials = node.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header Container */}
      <div className="inst-header">
        <div className="inst-avatar" style={isDefaulted ? { borderColor: 'var(--red)', color: 'var(--red)', background: 'var(--red-dim)' } : {}}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div className="inst-name" style={isDefaulted ? { color: 'var(--red)' } : {}}>{node.name}</div>
          <div className="inst-type">
            {isDefaulted ? (
              <span style={{ color: 'var(--red)', fontWeight: 700 }}>⚠️ DEFAULTED / INSOLVENT</span>
            ) : (node.type || 'Commercial Banking Entity')}
          </div>
        </div>
      </div>

      {/* Balance Sheet Analysis */}
      <table className="balance-sheet">
        <thead>
          <tr>
            <th>Balance Sheet Category</th>
            <th style={{ textAlign: 'right' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="bs-row-header">Total Interbank Assets</td>
            <td className="bs-value">{formatCurrency(assets, currency)}</td>
          </tr>
          <tr>
            <td className="bs-row-header">Interbank Liabilities</td>
            <td className="bs-value">{formatCurrency(debt, currency)}</td>
          </tr>
          {node.npaRatio !== undefined && (
            <tr>
              <td className="bs-row-header">NPA Ratio</td>
              <td className="bs-value" style={{ color: node.npaRatio > 3 ? 'var(--orange)' : 'var(--green)' }}>
                {node.npaRatio.toFixed(2)}%
              </td>
            </tr>
          )}
          <tr>
            <td className="bs-row-header">DebtRank Centrality</td>
            <td className="bs-value" style={{ color: debtRank > 0.05 ? 'var(--yellow)' : '' }}>
              {debtRank ? debtRank.toFixed(5) : '0.00000'}
            </td>
          </tr>
          <tr className="bs-total-row">
            <td className="bs-row-header" style={{ color: 'var(--cyan)' }}>Equity (CET1 Buffer)</td>
            <td className="bs-value" style={{ color: equity < node.capital * 0.5 ? 'var(--red)' : 'var(--cyan)' }}>
              {formatCurrency(equity, currency)}
            </td>
          </tr>
          <tr className="bs-total-row">
            <td className="bs-row-header">Capital Adequacy Ratio</td>
            <td className="bs-value" style={{ color: capRatio < 8 ? 'var(--red)' : 'var(--green)' }}>
              {capRatio}%
            </td>
          </tr>
        </tbody>
      </table>

      {isDefaulted && (
        <div style={{ 
          padding: '14px', 
          margin: '10px',
          background: 'rgba(255,77,77,0.08)', 
          borderLeft: '3px solid var(--red)',
          borderRadius: 4,
          fontSize: 11, 
          color: 'var(--red)', 
          lineHeight: 1.5 
        }}>
          <strong>STATUS: DEFAULTED.</strong> This institution has exhausted its liquidity buffer. Contra-party losses are currently propagating through the interbank market.
        </div>
      )}
    </div>
  );
};

export default InstitutionPanel;
