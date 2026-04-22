import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// Engine
import { generateNetwork }             from './engine/NetworkBuilder';
import { findSCCs, getDeathLoops }     from './engine/Tarjan';
import { analyzeAllSCCs }              from './engine/FragilityEngine';
import { simulateCascade }             from './engine/EisenbergNoe';
import { calculateDebtRank }           from './engine/DebtRank';
import { load2008Scenario, SCENARIOS } from './engine/Scenarios';
import { generateExplanations }        from './engine/ExplanationEngine';
import findShortestContagionPaths      from './engine/Dijkstra';
import { computeRescueCapacity }       from './engine/MaxFlow';
import { computeSIS }                  from './engine/SystemicInstability';
import { rankVulnerability }           from './engine/VulnerabilityRanker';
import { getHeuristicRecommendation } from './engine/HeuristicAgent';

// Components
import NetworkGraph          from './components/NetworkGraph';
import InstitutionPanel      from './components/InstitutionPanel';
import SimulationControls    from './components/SimulationControls';
import FragilityPanel        from './components/FragilityPanel';
import ScenarioSelector      from './components/ScenarioSelector';
import ExplanationLog        from './components/ExplanationLog';
import RescuePanel           from './components/RescuePanel';
import MonteCarloPanel       from './components/MonteCarloPanel';
import ReportExporter        from './components/ReportExporter';
import SISGauge              from './components/SISGauge';
import VulnerabilityPanel    from './components/VulnerabilityPanel';
import InstitutionHealthTable from './components/InstitutionHealthTable';
import { SimulationDashboard } from './components/SimulationDashboard';
import { useSimulation }     from './hooks/useSimulation';
import { formatCurrency }    from './utils/formatCurrency';

import './index.css';

// Icons
const IconActivity  = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);

function App() {
  const { isReady: wasmReady, runSimulation: runWasmSim, getBailoutRecommendation } = useSimulation();
  const graphRef = useRef(null);

  // State
  const [networkData, setNetworkData]           = useState({ nodes: [], edges: [] });
  const [selectedNodeId, setSelectedNodeId]     = useState(null);
  const [cascadeResult, setCascadeResult]       = useState(null);
  const [cascadeState, setCascadeState]         = useState(null);
  const [explanations, setExplanations]         = useState([]);
  const [currentScenario, setCurrentScenario]  = useState('random');
  const [animationTimer, setAnimationTimer]     = useState(null);
  const [contagionPathData, setContagionPath]   = useState(null);
  const [currency, setCurrency]                 = useState('USD');
  const [rescueData, setRescueData]             = useState(null);
  const [mcResult, setMcResult]                 = useState(null);
  const [visualMode, setVisualMode]             = useState('default');
  const [vulnerabilityMode, setVulnerabilityMode] = useState(false);
  const [sisData, setSisData]                   = useState({ sis: 0, classification: 'STABLE', label: 'STABLE' });
  const [vulnerabilityRanking, setVulnRanking] = useState([]);
  const [drlEnabled, setDrlEnabled]             = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState([]);
  const [isSimulating, setIsSimulating]         = useState(false);

  // Scenario Load
  const loadScenario = useCallback((id) => {
    if (animationTimer) clearInterval(animationTimer);
    setCascadeResult(null); setCascadeState(null); setExplanations([]);
    setSelectedNodeId(null); setContagionPath(null); setRescueData(null);
    setMcResult(null); setVisualMode('default'); setVulnerabilityMode(false);
    setAiRecommendations([]);
    setIsSimulating(false); // CRITICAL: Reset the simulation lock on reload

    const scenario = SCENARIOS.find(s => s.id === id);
    let data;
    if (id === 'lehman2008')          data = load2008Scenario();
    else if (scenario?.isRealData)    data = generateNetwork(scenario);
    else                              data = generateNetwork({ nodeCount: 12, seed: 42 });

    setNetworkData(data || { nodes: [], edges: [] });
    setCurrentScenario(id);
    setCurrency(data?.currency || 'USD');
  }, [animationTimer]);

  useEffect(() => { loadScenario('random'); }, []);

  // Analysis
  const sccData = useMemo(() => {
    if (!networkData?.nodes?.length) return [];
    try {
      return analyzeAllSCCs(
        getDeathLoops(findSCCs(networkData.nodes, networkData.edges)),
        networkData.nodes, networkData.edges
      ) || [];
    } catch { return []; }
  }, [networkData]);

  const debtRanks = useMemo(() => {
    if (!networkData?.nodes?.length) return new Map();
    try { return calculateDebtRank(networkData.nodes, networkData.edges) || new Map(); }
    catch { return new Map(); }
  }, [networkData]);

  const buildMatrix = useCallback((nodes, edges) => {
    const n = nodes.length;
    const m = Array.from({ length: n }, () => new Array(n).fill(0));
    const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
    edges.forEach(e => {
      const f = idx.get(e.from), t = idx.get(e.to);
      if (f !== undefined && t !== undefined) m[f][t] = e.weight;
    });
    return { m, idx };
  }, []);

  useEffect(() => {
    if (!networkData?.nodes?.length) return;
    try {
      const { m } = buildMatrix(networkData.nodes, networkData.edges);
      setSisData(computeSIS(networkData.nodes, m, sccData) || { sis: 0, classification: 'STABLE', label: 'STABLE' });
      setVulnRanking(rankVulnerability(networkData.nodes, m, sccData, debtRanks) || []);
    } catch (e) { console.warn('Prediction error', e); }
  }, [networkData, sccData, debtRanks, buildMatrix]);

    const handleTriggerShock = useCallback((nodeId, shockAmount, lgd, fireSaleEnabled = false) => {
    if (animationTimer) clearInterval(animationTimer);
    setIsSimulating(true);

    const { m, idx } = buildMatrix(networkData.nodes, networkData.edges);
    const result = simulateCascade(networkData.nodes, networkData.edges, nodeId, shockAmount, { lgd });
    
    const shockedIdx = idx.get(nodeId);
    if (shockedIdx !== undefined) {
      setContagionPath(findShortestContagionPaths(networkData.nodes, m, shockedIdx));
      const defaultedIds = new Set(result.finalState.filter(s => s.defaulted).map(s => s.id));
      const safe = networkData.nodes.map((nd, i) => ({ i, id: nd.id })).filter(({ id }) => id !== nodeId && !defaultedIds.has(id)).map(({ i }) => i);
      setRescueData(computeRescueCapacity(networkData.nodes, m, shockedIdx, safe));
    }
    
    setExplanations([]);
    setCascadeResult(result);
    
    // Initial round snapshot
    setCascadeState(result.rounds[0].snapshot);

    let rnd = 0;
    const timer = setInterval(() => {
      rnd++;
      if (rnd < result.rounds.length) {
        setCascadeState(result.rounds[rnd].snapshot);
        const exps = generateExplanations(result, networkData.nodes, currency);
        setExplanations(prev => [...prev, ...exps.filter(e => e.round === rnd)]);
      } else {
        clearInterval(timer);
        setIsSimulating(false);
      }
    }, 1000);
    setAnimationTimer(timer);
    setVisualMode('contagion-path');
  }, [networkData, animationTimer, currency, buildMatrix]);

  const handleReset = useCallback(() => {
    if (animationTimer) clearInterval(animationTimer);
    setCascadeResult(null); setCascadeState(null); setExplanations([]);
    setContagionPath(null); setRescueData(null); setMcResult(null);
    setVisualMode('default'); setVulnerabilityMode(false);
    setIsSimulating(false);
  }, [animationTimer]);

  // Rescue Capital Injection ──────────────────────────────────────────
  // When the user clicks "Inject Capital Flow" in RescuePanel, distribute the
  // injected amount proportionally across nodes on the rescue routes.
  const handleInject = useCallback((injectAmount, flowPaths) => {
    if (!flowPaths?.length || injectAmount <= 0) return;

    // Build a map of nodeIndex → flow received
    const capitalBoost = new Map();
    const totalFlow = flowPaths.reduce((s, fp) => s + fp.flow, 0);
    for (const fp of flowPaths) {
      if (fp.flow <= 0) continue;
      const share = (fp.flow / totalFlow) * injectAmount;
      // Distribute share along the path nodes (skip source index 0)
      for (let i = 1; i < fp.path.length; i++) {
        const nodeIdx = fp.path[i];
        capitalBoost.set(nodeIdx, (capitalBoost.get(nodeIdx) ?? 0) + share / (fp.path.length - 1));
      }
    }

    // Update networkData — inject capital into affected nodes
    setNetworkData(prev => {
      const updatedNodes = prev.nodes.map((node, i) => {
        const boost = capitalBoost.get(i) ?? 0;
        if (boost <= 0) return node;
        const newCapital = node.capital + boost;
        // If was insolvent and now capital > 0, mark as recovered
        return { ...node, capital: newCapital, defaulted: newCapital <= 0 };
      });
      return { ...prev, nodes: updatedNodes };
    });

    // Update cascadeState so graph node colors reflect the injection
    setCascadeState(prev => {
      if (!prev) return prev;
      return prev.map((s, i) => {
        const boost = capitalBoost.get(i) ?? 0;
        if (boost <= 0) return s;
        const newCapital = (s.capital ?? 0) + boost;
        return { ...s, capital: newCapital, defaulted: newCapital <= 0 };
      });
    });

    // Switch to rescue view to show the green flow edges
    setVisualMode('rescue');
  }, []);

  // WASM State Sync ───────────────────────────────────────────────────
  const handleWasmResult = useCallback((result, simNodes) => {
    // Force React to recognize a state change with spread and status recalculation
    const finalNodes = simNodes.map((node, i) => {
      const finalAssets = result.clearing_vector[i];
      const finalCapital = finalAssets - node.liabilities;
      const initialCap = node.initialCapital || node.capital;
      
      return {
        ...node,
        capital: finalCapital,
        defaulted: result.default_status[i] || finalCapital <= 0,
        status: finalCapital <= 0 ? 'DEFAULT' : (finalCapital < initialCap * 0.5 ? 'DISTRESSED' : 'HEALTHY')
      };
    });

    // Visual Refresh: Update the simulation overlay state, DO NOT OVERWRITE base networkData
    setCascadeState([...finalNodes]);
  }, []);

  // AI Bailout Heuristic ──────────────────────────────────────────────
  // Replaces the worker-based model with a dynamic heuristic policy.
  const aiBailoutHeuristic = useCallback(() => {
    const recs = getHeuristicRecommendation(networkData.nodes, vulnerabilityRanking, sccData, debtRanks);
    setAiRecommendations(recs);
    return recs;
  }, [networkData, vulnerabilityRanking, sccData, debtRanks]);

  const selectedNode = useMemo(
    () => networkData.nodes.find(n => n.id === selectedNodeId),
    [networkData.nodes, selectedNodeId]
  );

  const totalCapital = networkData.nodes.reduce((a, n) => a + n.capital, 0);
  const systemicLoss = cascadeResult?.totalSystemicLoss ?? 0;
  const defaults     = cascadeResult?.totalDefaults ?? 0;
  const survival     = cascadeResult ? (cascadeResult.survivalRate * 100).toFixed(0) : 100;

  return (
    <div className="shell">
      <header className="shell-header">
        <div className="header-brand">
          <div className="header-brand-icon"><IconActivity /></div>
          <div>
            <div className="header-brand-title">Cascading Liquidity Contagion Simulator</div>
            <div className="header-brand-sub">Structural Fragility Â· Eisenberg-Noe Â· DRL Agent</div>
          </div>
        </div>
        <div className="header-center">
          <ScenarioSelector currentScenario={currentScenario} onSelect={loadScenario} />
        </div>
        <div className="header-right">
          <ReportExporter
            networkData={networkData}
            sccData={sccData}
            cascadeResult={cascadeResult}
            explanations={explanations}
            contagionPathData={contagionPathData}
            rescueData={rescueData}
            mcResult={mcResult}
            currency={currency}
            currentScenarioId={currentScenario}
          />
        </div>
      </header>

      <div className="shell-body">
        {/* LEFT COLUMN: FRAGILITY & VULNERABILITY */}
        <div className="col col-left">
          <SectionLabel icon="⬡" text="STRUCTURAL FRAGILITY" badge={`${sccData.length} SCCs`} />
          <FragilityPanel sccData={sccData || []} />
          <SectionLabel icon="📉" text="PRE-SHOCK RISK RANKING" />
          <VulnerabilityPanel ranking={vulnerabilityRanking || []} currency={currency} />
        </div>

        {/* CENTER COLUMN: LIVE GRAPH & DASHBOARDS */}
        <div className="col-center">
          <div className="graph-card">
            <div className="graph-status-badge">
              <span className={`status-dot ${cascadeResult ? 'danger' : 'safe'}`} />
              <div className="mono" style={{ fontSize: 11 }}>
                {cascadeResult ? 'CONTAGION ACTIVE' : 'SYSTEM HEALTHY'}
              </div>
            </div>

            <div className="graph-overlay-top">
              {['default', 'vulnerability', 'montecarlo', 'rescue', 'contagion-path'].map((mode) => {
                const isVMode = mode === 'vulnerability';
                const isActive = isVMode ? vulnerabilityMode : visualMode === mode;
                const isDisabled = mode === 'montecarlo' ? !mcResult : (mode === 'rescue' || mode === 'contagion-path') ? !rescueData : false;
                
                return (
                  <button 
                    key={mode}
                    className={`graph-mode-btn ${isActive ? 'active' : ''}`} 
                    onClick={() => isVMode ? setVulnerabilityMode(!vulnerabilityMode) : setVisualMode(mode)}
                    disabled={isDisabled}
                    style={isDisabled ? { opacity: 0.3, cursor: 'not-allowed' } : {}}
                    title={isDisabled ? `Run ${mode.replace('-', ' ')} simulation first` : `Switch to ${mode} view`}
                  >
                    {mode === 'default' ? 'Standard' : mode.charAt(0).toUpperCase() + mode.slice(1).replace('-', ' ')}
                  </button>
                );
              })}
            </div>

            <div className="graph-zoom-controls">
              <button className="zoom-btn" onClick={() => graphRef.current?.zoom(1.4)}>+</button>
              <button className="zoom-btn" onClick={() => graphRef.current?.zoom(0.7)}>âˆ’</button>
              <button className="zoom-btn" style={{ fontSize: 10, fontWeight: 700 }} onClick={() => graphRef.current?.fit()}>FIT</button>
            </div>

            <NetworkGraph
              ref={graphRef}
              nodes={networkData.nodes || []}
              edges={networkData.edges || []}
              selectedNodeId={selectedNodeId}
              onNodeSelect={setSelectedNodeId}
              cascadeState={cascadeState}
              debtRanks={debtRanks}
              sccData={sccData}
              contagionPathData={visualMode === 'contagion-path' ? contagionPathData : null}
              rescueData={visualMode === 'rescue' ? rescueData : null}
              mcResult={visualMode === 'montecarlo' ? mcResult : null}
              vulnerabilityMode={vulnerabilityMode}
              vulnerabilityRanking={vulnerabilityRanking || []}
              visualMode={visualMode}
              currency={currency}
              drlEnabled={drlEnabled}
              aiRecommendations={aiRecommendations}
            />
          </div>

          <div className="bottom-section">
            <SimulationDashboard 
              networkData={networkData} 
              wasmReady={wasmReady} 
              onRunSimulation={runWasmSim} 
              onSimulationResult={handleWasmResult}
              getBailoutRecommendation={aiBailoutHeuristic} 
              drlEnabled={drlEnabled}
              setDrlEnabled={setDrlEnabled}
            />
            
            <InstitutionHealthTable 
              nodes={networkData.nodes || []} 
              cascadeState={cascadeState} 
              currency={currency} 
            />
          </div>
        </div>


        {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
            RIGHT COLUMN â€” SYSTEMIC RISK ANALYSIS
            All 5 mandatory panels in order. Spacious. No crowding.
        â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
        <div className="col col-right">

          {/* 1 â”€â”€ SYSTEMIC RISK INDEX */}
          <div className="right-section-label" style={{ paddingTop: 4 }}>
            <span><span style={{ color: 'var(--cyan)', marginRight: 6 }}>◈</span>SYSTEMIC RISK INDEX</span>
          </div>
          <div className="card">
            <SISGauge sisData={sisData} />
          </div>

          {/* 2 ── INSTITUTION DETAILS */}
          <div className="right-section-label">
            <span><span style={{ color: 'var(--cyan)', marginRight: 6 }}>🏦</span>INSTITUTION DETAILS</span>
            {selectedNode && <span style={{ fontSize: 9, color: 'var(--cyan)', fontFamily: 'JetBrains Mono' }}>LIVE</span>}
          </div>
          <div className="card">
            <InstitutionPanel
              node={selectedNode}
              cascadeState={cascadeState}
              debtRank={selectedNodeId ? debtRanks.get(selectedNodeId) : undefined}
              currency={currency}
            />
          </div>

          {/* 3 â”€â”€ SHOCK SIMULATOR */}
          <div className="right-section-label">
            <span><span style={{ color: 'var(--red)', marginRight: 6 }}>⚡</span>SHOCK SIMULATOR</span>
          </div>
          <div className="card">
            <SimulationControls
              nodes={networkData.nodes || []}
              onTrigger={handleTriggerShock}
              onReset={handleReset}
              isSimulating={isSimulating}
            />
          </div>

          {/* 4 â”€â”€ RESCUE MAX-FLOW */}
          <div className="right-section-label">
            <span><span style={{ color: 'var(--green)', marginRight: 6 }}>🛡️</span>RESCUE MAX-FLOW</span>
            {rescueData && <span style={{ fontSize: 9, color: 'var(--green)', fontFamily: 'JetBrains Mono' }}>FORD-FULKERSON</span>}
          </div>
          <div className="card">
            <RescuePanel
              data={rescueData}
              currency={currency}
              nodes={networkData.nodes}
              onInject={handleInject}
            />
          </div>

          {/* 5 â”€â”€ MONTE CARLO STRESS TEST */}
          <div className="right-section-label">
            <span><span style={{ color: '#a78bfa', marginRight: 6 }}>🎲</span>MONTE CARLO STRESS</span>
          </div>
          <div className="card">
            <MonteCarloPanel
              nodes={networkData.nodes || []}
              edges={networkData.edges || []}
              currency={currency}
              onMCResult={(res) => {
                setMcResult(res);
                if (res) setVisualMode('montecarlo'); // auto-switch to heatmap
              }}
            />
          </div>

        </div>
      </div>


      <footer className="shell-footer">
        <FooterStat label="NODES" value={networkData.nodes.length} />
        <FooterStat label="EXPOSURES" value={networkData.edges.length} />
        <FooterStat label="TOTAL CAPITAL" value={formatCurrency(totalCapital, currency)} />
        <FooterStat label="SYSTEMIC LOSS" value={formatCurrency(systemicLoss, currency)} color={systemicLoss > 0 ? 'red' : ''} />
        <FooterStat label="DEFAULTS" value={defaults} color={defaults > 0 ? 'red' : ''} />
        <FooterStat label="SURVIVAL" value={`${survival}%`} color={survival < 80 ? 'red' : survival < 95 ? 'yellow' : 'green'} />
      </footer>
    </div>
  );
}

function SectionLabel({ icon, text, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 2px 4px' }}>
      <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-primary)', fontFamily: 'JetBrains Mono', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: 'var(--cyan)' }}>{icon}</span> {text}
      </div>
      {badge && <span className="card-badge" style={{ background: 'var(--cyan-dim)', color: 'var(--cyan)', border: '1px solid var(--glass-border-hi)' }}>{badge}</span>}
    </div>
  );
}

function FooterStat({ label, value, color }) {
  return (
    <div className="footer-stat">
      <span className="footer-stat-label">{label}</span>
      <span className={`footer-stat-value ${color ? color : ''}`}>{value}</span>
    </div>
  );
}

export default App;





