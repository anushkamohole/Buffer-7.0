/**
 * DebtRank.js — Systemic Importance Calculator
 *
 * DebtRank measures the fraction of total system capital that would be
 * affected if a single node enters distress. It is a recursive measure
 * that accounts for indirect contagion through the network.
 *
 * Algorithm (Battiston et al., 2012):
 *   1. Start with node i in distress (h_i = 1, all others h_j = 0).
 *   2. For each time step, propagate distress:
 *        h_j(t+1) = min(1, h_j(t) + Σ W_ij * h_i(t))
 *      where W_ij = exposure(j→i) / capital(j)  [impact matrix].
 *   3. DebtRank(i) = Σ h_j * (capital_j / totalCapital)  for j ≠ i.
 */

/**
 * Calculate DebtRank for every node in the network.
 *
 * @param {Array} nodes  Array of node objects with { id, capital }.
 * @param {Array} edges  Array of { from, to, weight }.
 * @returns {Map<number, number>}  Map of nodeId → debtRank score [0,1].
 */
export function calculateDebtRank(nodes, edges) {
  const totalCapital = nodes.reduce((s, n) => s + n.capital, 0);
  if (totalCapital <= 0) {
    return new Map(nodes.map(n => [n.id, 0]));
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const nodeIds = nodes.map(n => n.id);

  // Build impact matrix W[j][i] = exposure(j owed by i) / capital(j)
  // Edge from→to means "from owes to", so to is exposed to from.
  // If `from` defaults, `to` loses weight.  W[to][from] = weight / capital(to)
  const W = new Map();
  for (const id of nodeIds) {
    W.set(id, new Map());
  }

  for (const { from, to, weight } of edges) {
    const creditorCapital = nodeMap.get(to)?.capital || 0;
    if (creditorCapital > 0) {
      const impact = Math.min(weight / creditorCapital, 1.0);
      W.get(to).set(from, (W.get(to).get(from) || 0) + impact);
    }
  }

  const debtRanks = new Map();
  const maxIterations = 10;

  // Calculate DebtRank for each node
  for (const sourceId of nodeIds) {
    // h[j] = distress level of node j
    const h = new Map(nodeIds.map(id => [id, 0]));
    h.set(sourceId, 1.0);

    // Track which nodes have already been "activated" (to avoid double-counting)
    const activated = new Set([sourceId]);

    for (let t = 0; t < maxIterations; t++) {
      const hNew = new Map(h);
      let changed = false;

      for (const jId of nodeIds) {
        if (activated.has(jId) && jId !== sourceId) continue; // already fully propagated
        if (jId === sourceId) continue;

        // Sum incoming distress from all connected distressed nodes
        let incomingDistress = 0;
        const impacts = W.get(jId);
        if (impacts) {
          for (const [iId, wji] of impacts) {
            if (h.get(iId) > 0) {
              incomingDistress += wji * h.get(iId);
            }
          }
        }

        const newH = Math.min(1, h.get(jId) + incomingDistress);
        if (newH > h.get(jId) + 1e-9) {
          hNew.set(jId, newH);
          changed = true;
          if (newH >= 1.0) activated.add(jId);
        }
      }

      // Update h
      for (const [id, val] of hNew) {
        h.set(id, val);
      }

      if (!changed) break;
    }

    // DebtRank = weighted sum of distress (excluding source)
    let dr = 0;
    for (const jId of nodeIds) {
      if (jId === sourceId) continue;
      const capitalJ = nodeMap.get(jId)?.capital || 0;
      dr += h.get(jId) * (capitalJ / totalCapital);
    }

    debtRanks.set(sourceId, Math.round(dr * 1000) / 1000);
  }

  return debtRanks;
}

/**
 * Get the most systemically important nodes, sorted by DebtRank.
 *
 * @param {Map<number, number>} debtRanks  Map from calculateDebtRank.
 * @param {Array}               nodes      Node array.
 * @param {number}              [topN=5]   How many to return.
 * @returns {Array<{id: number, name: string, debtRank: number}>}
 */
export function getTopSystemicNodes(debtRanks, nodes, topN = 5) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  return [...debtRanks.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .map(([id, dr]) => ({
      id,
      name: nodeMap.get(id)?.name || `Node ${id}`,
      debtRank: dr,
    }));
}

export default { calculateDebtRank, getTopSystemicNodes };
