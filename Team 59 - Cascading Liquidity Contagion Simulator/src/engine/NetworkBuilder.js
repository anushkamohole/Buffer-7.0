/**
 * NetworkBuilder.js — Scale-Free Financial Network Generator
 * 
 * Generates a directed, weighted graph representing an interbank network.
 * Uses preferential attachment (Barabási–Albert model) to produce a
 * scale-free topology where a few hub banks have many connections.
 */

// ── Bank Names & Seed Data ─────────────────────────────────────────────
const BANK_NAMES = [
  'Apex Global',
  'Meridian Capital',
  'Vanguard Trust',
  'Sovereign Bank',
  'Atlas Financial',
  'Nexus Holdings',
  'Pinnacle Group',
  'Citadel Reserve',
  'Horizon Partners',
  'Quantum Finance',
  'Sterling Credit',
  'Obelisk Bancorp',
];

/**
 * Seeded PRNG for deterministic graph generation.
 * Uses a simple mulberry32 algorithm.
 */
function createRNG(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate a synthetic financial network.
 *
 * @param {Object}  options
 * @param {number}  [options.nodeCount=12]       Number of banks.
 * @param {number}  [options.minCapitalRatio=0.06] Min equity-to-asset ratio.
 * @param {number}  [options.maxCapitalRatio=0.15] Max equity-to-asset ratio.
 * @param {number}  [options.seed=42]            PRNG seed for reproducibility.
 * @param {boolean} [options.isRealData]         Flag for real data scenarios.
 * @returns {{ nodes: Array, edges: Array }}
 */
export function generateNetwork(options = {}) {
  // Routing logic for real data (India 2025)
  if (options.isRealData) {
    return buildIndiaNetwork(options);
  }

  const {
    nodeCount = 12,
    minCapitalRatio = 0.06,
    maxCapitalRatio = 0.15,
    seed = 42,
  } = options;

  const rand = createRNG(seed);

  // ── 1. Create Nodes ────────────────────────────────────────────────
  const nodes = [];
  for (let i = 0; i < nodeCount; i++) {
    const assets = Math.round(200 + rand() * 800);        // 200–1000 B
    const capitalRatio = minCapitalRatio + rand() * (maxCapitalRatio - minCapitalRatio);
    const capital = Math.round(assets * capitalRatio);
    const liabilities = assets - capital;

    nodes.push({
      id: i,
      name: BANK_NAMES[i] || `Bank ${i}`,
      assets,
      liabilities,
      capital,
      initialCapital: capital,
    });
  }

  // ── 2. Create Edges (Preferential Attachment) ──────────────────────
  const edges = [];
  const degree = new Array(nodeCount).fill(1); // start with 1 to avoid 0

  // For each node, attach 2–4 outgoing edges preferentially
  for (let i = 0; i < nodeCount; i++) {
    const numEdges = 2 + Math.floor(rand() * 3); // 2–4 edges

    for (let e = 0; e < numEdges; e++) {
      // Weighted random target (preferential attachment)
      const totalDeg = degree.reduce((a, b) => a + b, 0);
      let pick = rand() * totalDeg;
      let target = 0;

      for (let j = 0; j < nodeCount; j++) {
        pick -= degree[j];
        if (pick <= 0) {
          target = j;
          break;
        }
      }

      // No self-loops, no duplicate edges
      if (target === i) continue;
      if (edges.some(edge => edge.from === i && edge.to === target)) continue;

      // Weight: interbank exposure proportional to source assets (10–500 B)
      const maxExposure = Math.min(nodes[i].assets * 0.5, 500);
      const weight = Math.round(10 + rand() * (maxExposure - 10));

      edges.push({
        from: i,
        to: target,
        weight,
      });

      degree[i]++;
      degree[target]++;
    }
  }

  return { nodes, edges, currency: 'USD' };
}

/**
 * Maximum Entropy exposure matrix construction.
 * 
 * Theory: We know each bank's total interbank liabilities (approx 8% of total assets
 * per RBI FSR assumption) but NOT who they owe it to specifically.
 * Maximum Entropy says: distribute evenly — the assumption that introduces
 * the LEAST additional information beyond what we know.
 *
 * Formula: W[i][j] = totalInterbankLiabilities[i] / (n - 1)   for all j ≠ i
 *          W[i][i] = 0
 *
 * This is the standard academic approach (Upper 2004, BIS Working Paper).
 */
export function buildIndiaNetwork(scenario) {
  const n = scenario.nodes.length;
  const INTERBANK_RATIO = 0.08; // 8% of total assets, RBI FSR standard assumption

  // Step 1: compute each bank's total interbank liabilities
  const totalLiabilities = scenario.nodes.map(
    node => node.totalAssets * INTERBANK_RATIO
  );

  // Step 2: Maximum Entropy — distribute evenly to all other banks
  // We produce an "edges" array instead of a raw matrix to maintain compatibility
  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j) {
        edges.push({
          from: scenario.nodes[i].id,
          to: scenario.nodes[j].id,
          weight: totalLiabilities[i] / (n - 1)
        });
      }
    }
  }

  // Step 3: build nodes array in the format EisenbergNoe.js expects
  const nodes = scenario.nodes.map(node => ({
    id:       node.id,
    name:     node.name,
    assets:   node.totalAssets,
    liabilities: node.totalAssets - node.capital,
    capital:  node.capital,
    initialCapital: node.capital,
    currency: scenario.currency,
    // Stress weight: NPA ratio increases vulnerability
    stressMultiplier: 1 + (node.npaRatio / 100),
    crar:     node.crar,
    npaRatio: node.npaRatio
  }));

  return { nodes, edges, currency: scenario.currency };
}

/**
 * Get adjacency list representation of the graph.
 * @param {Array} edges  Array of { from, to, weight }
 * @returns {Map<number, Array<{to: number, weight: number}>>}
 */
export function getAdjacencyList(edges) {
  const adj = new Map();
  for (const { from, to, weight } of edges) {
    if (!adj.has(from)) adj.set(from, []);
    adj.get(from).push({ to, weight });
  }
  return adj;
}

/**
 * Get reverse adjacency list (creditors pointing to debtors).
 * If A→B (A owes B), reverse is B→A.
 * @param {Array} edges
 * @returns {Map<number, Array<{from: number, weight: number}>>}
 */
export function getReverseAdjacencyList(edges) {
  const rev = new Map();
  for (const { from, to, weight } of edges) {
    if (!rev.has(to)) rev.set(to, []);
    rev.get(to).push({ from, weight });
  }
  return rev;
}

export default { generateNetwork, getAdjacencyList, getReverseAdjacencyList };
