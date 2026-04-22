/**
 * SystemicInstability.js — Systemic Instability Score (SIS) Engine
 *
 * Transforms the network from a simulator into a prediction engine by
 * quantifying aggregate structural risk across three dimensions:
 * 1. SCC Fragility (Death Loops)
 * 2. Network Density (Interconnectedness)
 * 3. Concentration Index (HHI - Market Dominance)
 */

/**
 * Compute the Systemic Instability Score (SIS) for the current network.
 * 
 * @param {Array} nodes          Full node array.
 * @param {Array<Array>} exposureMatrix  n x n matrix where matrix[i][j] is exposure of i to j.
 * @param {Array} sccResults     Array of SCC fragility results from FragilityEngine.
 * @returns {Object}             { sis, sccFragilityWeighted, networkDensity, concentrationIndex, label }
 */
export function computeSIS(nodes, exposureMatrix, sccResults) {
  const n = nodes.length;
  if (n === 0) {
    return { 
      sis: 0, 
      sccFragilityWeighted: 0, 
      networkDensity: 0, 
      concentrationIndex: 0, 
      label: "STABLE" 
    };
  }

  // 1. sccFragilityWeighted
  // For each SCC, multiply fragility by member count, sum all, divide by total node count.
  const totalWeightedFragility = sccResults.reduce((sum, res) => sum + (res.fragilityScore * res.members.length), 0);
  const sccFragilityWeighted = totalWeightedFragility / n;

  // 2. networkDensity
  // count actual non-zero edges / (n * (n - 1))
  let edgeCount = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && exposureMatrix[i][j] > 0) {
        edgeCount++;
      }
    }
  }
  const networkDensity = n > 1 ? edgeCount / (n * (n - 1)) : 0;

  // 3. concentrationIndex (HHI)
  // sum((capital[i] / totalCapital)^2)
  const totalCapital = nodes.reduce((sum, node) => sum + node.capital, 0);
  const concentrationIndex = totalCapital > 0 
    ? nodes.reduce((sum, node) => sum + Math.pow(node.capital / totalCapital, 2), 0)
    : 0;

  // Normalize sccFragilityWeighted by dividing by reference fragility 3.0 and clamping to 1.0
  const normalizedSccFragility = Math.min(sccFragilityWeighted / 3.0, 1.0);

  // SIS calculation: (0.5 × sccFragilityWeighted_normalized) + (0.3 × networkDensity) + (0.2 × concentrationIndex)
  const sis = (0.5 * normalizedSccFragility) + (0.3 * networkDensity) + (0.2 * concentrationIndex);

  let label = "STABLE";
  if (sis > 0.7) label = "CRITICAL";
  else if (sis > 0.5) label = "HIGH";
  else if (sis > 0.3) label = "ELEVATED";

  return {
    sis: Math.round(sis * 1000) / 1000,
    sccFragilityWeighted: Math.round(sccFragilityWeighted * 1000) / 1000,
    networkDensity: Math.round(networkDensity * 1000) / 1000,
    concentrationIndex: Math.round(concentrationIndex * 1000) / 1000,
    label
  };
}

export default { computeSIS };
