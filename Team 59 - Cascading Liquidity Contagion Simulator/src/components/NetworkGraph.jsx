import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { Network } from 'vis-network';

// ── Bank abbreviation map ────────────────────────────────────────────────
const BANK_ABBREVIATIONS = {
  'SBI': 'SBI', 'HDFC Bank': 'HDFC', 'ICICI Bank': 'ICICI',
  'Axis Bank': 'Axis', 'Kotak': 'Kotak', 'PNB': 'PNB',
  'BoB': 'BoB', 'Canara': 'Canara', 'Union Bank': 'Union',
  'IndusInd': 'IndusInd', 'Yes Bank': 'Yes', 'IDFC First': 'IDFC',
  'Federal': 'Federal', 'Bandhan': 'Bandhan', 'RBL': 'RBL',
  'Lehman Brothers': 'Lehman', 'Bear Stearns': 'Bear', 'Goldman Sachs': 'GS',
  'JPMorgan Chase': 'JPM', 'Merrill Lynch': 'Merrill', 'Citigroup': 'Citi',
  'Morgan Stanley': 'MS', 'AIG': 'AIG', 'Wachovia': 'Wachovia',
};

function getShortLabel(name) {
  return BANK_ABBREVIATIONS[name] || (name.length > 13 ? name.slice(0, 12) + '…' : name);
}

function computeNodeSize(capital, allCapitals) {
  const MIN = 20, MAX = 42;
  const minC = Math.min(...allCapitals);
  const maxC = Math.max(...allCapitals);
  if (minC === maxC) return (MIN + MAX) / 2;
  const lMin = Math.log(Math.max(1, minC));
  const lMax = Math.log(Math.max(1, maxC));
  const lVal = Math.log(Math.max(1, capital));
  return MIN + ((lVal - lMin) / (lMax - lMin)) * (MAX - MIN);
}

function fmtCapital(v, currency) {
  if (currency === 'INR') {
    if (v >= 100000) return `₹${(v/100000).toFixed(1)}L Cr`;
    if (v >= 1000)   return `₹${(v/1000).toFixed(0)}K Cr`;
    return `₹${v} Cr`;
  }
  if (v >= 1000) return `$${(v/1000).toFixed(1)}T`;
  return `$${v}B`;
}

function nodeColor(node, isDefaulted, sccInfo) {
  if (isDefaulted) return { bg: '#3d0a0a', border: '#ff4d4d', glow: 'rgba(255,77,77,0.6)' };
  if (node.npaRatio !== undefined) {
    if (node.npaRatio >= 4.0) return { bg: '#2d1200', border: '#ff8c42', glow: 'rgba(255,140,66,0.5)' };
    if (node.npaRatio >= 2.0) return { bg: '#2d2200', border: '#ffd24d', glow: 'rgba(255,210,77,0.4)' };
    return { bg: '#00220f', border: '#00e87a', glow: 'rgba(0,232,122,0.4)' };
  }
  if (sccInfo) {
    const s = sccInfo.fragilityScore || 0;
    if (sccInfo.classification === 'Critical' || s >= 3.0) return { bg: '#3d0a0a', border: '#ff4d4d', glow: 'rgba(255,77,77,0.6)' };
    if (sccInfo.classification === 'High Risk' || s >= 1.5) return { bg: '#2d1200', border: '#ff8c42', glow: 'rgba(255,140,66,0.5)' };
  }
  return { bg: '#001a1a', border: '#00dcff', glow: 'rgba(0,220,255,0.4)' };
}

const NetworkGraph = forwardRef(({
  nodes     = [],
  edges     = [],
  cascadeState,
  selectedNodeId,
  onNodeSelect,
  debtRanks,
  sccData,
  contagionPathData,
  rescueData,
  mcResult,
  vulnerabilityMode,
  vulnerabilityRanking,
  visualMode = 'default',
  currency = 'USD',
  drlEnabled,
  aiRecommendations,
}, ref) => {
  const containerRef = useRef(null);
  const networkRef   = useRef(null);
  const prevDataRef  = useRef({ nodes: [], edges: [], visualMode: '' });

  useImperativeHandle(ref, () => ({
    getNetwork: () => networkRef.current,
    fit: () => networkRef.current?.fit({ animation: true }),
    zoom: (factor) => {
      const net = networkRef.current;
      if (!net) return;
      const s = net.getScale();
      net.moveTo({ scale: s * factor, animation: { duration: 300 } });
    }
  }));

  useEffect(() => {
    if (!containerRef.current || !nodes.length) return;

    // Check if structural data or mode actually changed
    const nodesChanged = JSON.stringify(nodes.map(n => n.id)) !== JSON.stringify(prevDataRef.current.nodes.map(n => n.id));
    const modeChanged  = visualMode !== prevDataRef.current.visualMode;
    const cascadeChanged = !!cascadeState !== !!prevDataRef.current.cascadeState;

    const allCapitals = nodes.map(n => n.capital);
    const sccMembership = new Map();
    if (Array.isArray(sccData)) {
      sccData.forEach(scc => {
        const members = Array.isArray(scc?.members) ? scc.members : [];
        const info = {
          fragilityScore: scc?.fragilityIndex ?? scc?.fragility ?? 0,
          classification: scc?.classification ?? '',
        };
        members.forEach(id => sccMembership.set(id, info));
      });
    }

    const defaultedSet = new Set(
      cascadeState ? cascadeState.filter(s => s.defaulted).map(s => s.id) : []
    );

    const probMap = new Map();
    // Fix: runMonteCarlo returns defaultProbabilities (Map<nodeId, probability>),
    // NOT nodeStats. Read the correct property.
    if (visualMode === 'montecarlo' && mcResult?.defaultProbabilities) {
      mcResult.defaultProbabilities.forEach((prob, nodeId) => probMap.set(nodeId, prob));
    }

    const visNodes = nodes.map(node => {
      const isDefaulted = defaultedSet.has(node.id);
      const sccInfo     = sccMembership.get(node.id);
      const size        = computeNodeSize(node.capital, allCapitals);
      const col         = nodeColor(node, isDefaulted, sccInfo);
      const isSelected  = node.id === selectedNodeId;
      const label       = getShortLabel(node.name);
      
      let bgOverride    = col.bg;
      let borderOverride = col.border;
      if (visualMode === 'montecarlo') {
        const p = probMap.get(node.id) ?? 0;
        
        if (p <= 0.5) {
          // 0% (Deep Blue/Cyan: 0, 100, 200) -> 50% (Yellow: 255, 210, 77)
          const f = p * 2;
          const r = Math.round(0 + f * 255);
          const g = Math.round(100 + f * (210 - 100));
          const b = Math.round(200 + f * (77 - 200));
          bgOverride = `rgb(${r}, ${g}, ${b})`;
        } else {
          // 50% (Yellow: 255, 210, 77) -> 100% (Neon Red: 255, 50, 50)
          const f = (p - 0.5) * 2;
          const r = 255;
          const g = Math.round(210 + f * (50 - 210));
          const b = Math.round(77 + f * (50 - 77));
          bgOverride = `rgb(${r}, ${g}, ${b})`;
        }
        borderOverride = p > 0.6 ? '#ff4d4d' : '#00dcff';
      }

      return {
        id: node.id,
        label: label,
        title: `${node.name} (Capital: ${fmtCapital(node.capital, currency)})`,
        shape: 'dot',
        size,
        color: {
          background: bgOverride,
          border: isSelected ? '#ffffff' : borderOverride,
          highlight: { background: bgOverride, border: '#ffffff' },
        },
        shadow: (drlEnabled && aiRecommendations?.[nodes.indexOf(node)] > 0.1) ? {
          enabled: true,
          color: 'rgba(0, 220, 255, 0.8)',
          size: 25,
          x: 0, y: 0
        } : false,
        borderWidth: isSelected ? 3 : 2,
        font: {
          size: 11,
          face: 'JetBrains Mono',
          color: '#ffffff',
          strokeWidth: 2,
          strokeColor: '#000000',
          vadjust: 34,
        },
      };
    });

    const rescuePathSet = new Set();
    if (visualMode === 'rescue' && rescueData?.flowPaths) {
      for (const fp of rescueData.flowPaths) {
        if (fp.flow > 1e-6) {
          for (let i = 0; i < fp.path.length - 1; i++) {
            // Store as "fromId-toId" using node index -> node.id mapping
            const fromNode = nodes[fp.path[i]];
            const toNode   = nodes[fp.path[i + 1]];
            if (fromNode && toNode) rescuePathSet.add(`${fromNode.id}-${toNode.id}`);
          }
        }
      }
    }

    const bottleneckKey = visualMode === 'rescue' && rescueData?.bottleneckEdge
      ? `${nodes[rescueData.bottleneckEdge[0]]?.id}-${nodes[rescueData.bottleneckEdge[1]]?.id}`
      : null;

    const visEdges = edges.map((edge, idx) => {
      const isContagion = visualMode === 'contagion-path' && contagionPathData?.paths?.some(p => p.includes(edge.from) && p.includes(edge.to));
      const isRescue    = rescuePathSet.has(`${edge.from}-${edge.to}`);
      const isBottleneck = bottleneckKey === `${edge.from}-${edge.to}`;

      let color, width, dashes;
      if (isBottleneck) {
        color = '#ffd24d'; width = 3; dashes = [6, 3];
      } else if (isRescue) {
        color = '#00e87a'; width = 2.5; dashes = false;
      } else if (isContagion) {
        color = '#ff8c42'; width = 2; dashes = false;
      } else {
        color = 'rgba(0, 220, 255, 0.12)'; width = 1; dashes = false;
      }
      
      return {
        id: idx,
        from: edge.from,
        to: edge.to,
        arrows: isRescue ? { to: { enabled: true, scaleFactor: 0.8 } } : 'to',
        color: { color, highlight: '#ffffff' },
        width,
        dashes,
        smooth: { type: 'curvedCW', roundness: 0.2 },
      };
    });

    const options = {
      physics: {
        solver: 'forceAtlas2Based',
        forceAtlas2Based: {
          gravitationalConstant: -55,
          centralGravity: 0.015,
          springLength: 170,
          springConstant: 0.12,
          damping: 0.6,
          avoidOverlap: 1,
        },
        stabilization: { iterations: 150, updateInterval: 25 },
      },
      interaction: {
        hover: true,
        tooltipDelay: 200,
        zoomView: true,
        multiselect: false,
      },
    };

    if (networkRef.current) {
      // ONLY update data if nodes/edges or modes changed significantly.
      // Selection should NOT trigger a full setData which restarts physics.
      if (nodesChanged || cascadeChanged || modeChanged) {
        networkRef.current.setData({ nodes: visNodes, edges: visEdges });
        networkRef.current.setOptions(options);
      } else {
        // Optimized update: just update nodes for highlighting without re-starting physics
        networkRef.current.body.data.nodes.update(visNodes);
        if (selectedNodeId !== null) {
          networkRef.current.selectNodes([selectedNodeId]);
        } else {
          networkRef.current.unselectAll();
        }
      }
    } else {
      networkRef.current = new Network(containerRef.current, { nodes: visNodes, edges: visEdges }, options);
      networkRef.current.on('click', params => {
        if (params.nodes.length > 0) onNodeSelect(params.nodes[0]);
        else onNodeSelect(null);
      });
      // Stop physics once stabilized to keep graph calm
      networkRef.current.on('stabilized', () => {
        networkRef.current.setOptions({ physics: { enabled: false } });
      });
      // Re-enable physics if user drags a node
      networkRef.current.on('dragStart', () => {
        networkRef.current.setOptions({ physics: { enabled: true } });
      });
    }

    prevDataRef.current = { nodes, visualMode, cascadeState };
  }, [nodes, edges, cascadeState, selectedNodeId, debtRanks, sccData, visualMode, currency, contagionPathData, mcResult]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});

export default NetworkGraph;
