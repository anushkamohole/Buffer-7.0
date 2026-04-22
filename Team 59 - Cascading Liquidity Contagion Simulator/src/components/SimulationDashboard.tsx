import React, { useState } from 'react';
import { Activity, ShieldCheck, Zap } from 'lucide-react';

interface SimulationDashboardProps {
    networkData: {
        nodes: any[];
        edges: any[];
    };
    wasmReady?: boolean;
    onRunSimulation?: (nodes: any[], edges: any[]) => Promise<any>;
    onSimulationResult?: (result: any, simNodes: any[]) => void;
    getBailoutRecommendation?: (nodes: any[], matrix: number[][], sis: number) => Promise<number[]>;
    drlEnabled: boolean;
    setDrlEnabled: (enabled: boolean) => void;
}

export const SimulationDashboard: React.FC<SimulationDashboardProps> = ({ 
    networkData, 
    wasmReady = false, 
    onRunSimulation, 
    onSimulationResult,
    getBailoutRecommendation,
    drlEnabled,
    setDrlEnabled
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [results, setResults] = useState<any>(null);
    const [recommendations, setRecommendations] = useState<number[]>([]);

    const executeSimulation = async () => {
        if (!networkData.nodes.length || !onRunSimulation) return;
        setIsProcessing(true);
        try {
            // Compute matrix for AI observations if needed
            const n = networkData.nodes.length;
            const matrix = Array.from({ length: n }, () => new Array(n).fill(0));
            networkData.edges.forEach((edge: any) => {
                const fromIdx = networkData.nodes.findIndex((node: any) => node.id === edge.from);
                const toIdx = networkData.nodes.findIndex((node: any) => node.id === edge.to);
                if (fromIdx !== -1 && toIdx !== -1) matrix[fromIdx][toIdx] = edge.weight || 0;
            });

            let simNodes = [...networkData.nodes];

            if (drlEnabled && getBailoutRecommendation) {
                const mockSis = 0.45;
                const recs = await getBailoutRecommendation(networkData.nodes, matrix, mockSis);
                setRecommendations(recs);

                const availableFund = 100.0;
                simNodes = networkData.nodes.map((node, i) => ({
                    ...node,
                    assets: node.assets + (recs[i] * availableFund)
                }));
            } else {
                setRecommendations([]);
            }

            // Fixed: onRunSimulation now correctly receives (nodes, edges) to satisfy Rust parser
            const simResult = await onRunSimulation(simNodes, networkData.edges);
            setResults(simResult);
            onSimulationResult?.(simResult, simNodes);
        } finally {
            setIsProcessing(false);
        }
    };

    // Strategic sorting and justification logic
    const topRecs = recommendations
        .map((val, idx) => {
            const node = networkData.nodes[idx];
            // Justification logic: High linkage vs high volatility
            const isHighLinkage = node?.assets > 600; // heuristic for linkage/hub
            return { 
                node, 
                percentage: val,
                reason: isHighLinkage ? "Prioritized for Contagion Containment" : "Prioritized due to High Systemic Linkage"
            };
        })
        .filter(item => item.node && item.percentage > 0.001)
        .sort((a, b) => b.percentage - a.percentage)
        .slice(0, 5);

    return (
        <div className="bottom-panel">
            <div className="card-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="card-title">
                        <Activity size={14} className="card-title-icon" /> 
                        <span>WASM CORE & AI HUB</span>
                    </div>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '9px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono', fontWeight: 700 }}>
                            <input 
                                type="checkbox" 
                                checked={drlEnabled} 
                                onChange={() => setDrlEnabled(!drlEnabled)}
                            />
                            ENABLE AI STRATEGY
                        </label>
                        <button 
                            onClick={executeSimulation}
                            disabled={isProcessing}
                            className="btn-primary"
                            style={{ height: '28px', padding: '0 15px', fontSize: '10px' }}
                        >
                            <Zap size={10} style={{ marginRight: '5px' }} />
                            {isProcessing ? 'RUNNING...' : 'EXECUTE'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="card-body">
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: '15px', height: '100%' }}>
                    <div style={{ background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px', fontFamily: 'JetBrains Mono' }}>WASM Result</div>
                        {results ? (
                            <div>
                                <div style={{ fontSize: '22px', fontWeight: '900', color: results.default_status.filter((s:any) => s).length > 0 ? '#ff4d4d' : '#00e87a', fontFamily: 'JetBrains Mono' }}>
                                    {results.default_status.filter((s:any) => s).length} DEFAULTS
                                </div>
                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>CORE STABLE · {results.sccs.length} SCCs ANALYZED</div>
                            </div>
                        ) : (
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>Awaiting simulation...</div>
                        )}
                    </div>

                    <div style={{ background: 'rgba(0, 232, 122, 0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(0, 232, 122, 0.1)', display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                            <ShieldCheck size={14} color="#00e87a" />
                            <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#00e87a', fontFamily: 'JetBrains Mono', fontWeight: 800 }}>STRATEGIC BAILOUT PRIORITY</div>
                        </div>
                        {!drlEnabled ? (
                            <div style={{ margin: 'auto', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>Awaiting Simulation Input...</div>
                        ) : topRecs.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                {topRecs.map((item, i) => (
                                    <div key={i} style={{ fontSize: '9px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#fff', fontWeight: 800 }}>{item.node.name}</span>
                                            <span style={{ color: '#00dcff', fontWeight: 800 }}>+{(item.percentage * 100).toFixed(1)}%</span>
                                        </div>
                                        <div style={{ fontSize: '8px', color: 'var(--text-muted)', fontStyle: 'italic' }}>{item.reason}</div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ margin: 'auto', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>Searching for systemic saviors...</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
