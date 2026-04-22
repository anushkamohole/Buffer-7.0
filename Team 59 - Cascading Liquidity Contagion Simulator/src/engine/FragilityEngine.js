/**
 * FragilityEngine.js — SCC Fragility Scoring
 *
 * For each SCC with size > 1, calculates:
 *   Fragility = Total Internal Exposure / Total Capital
 *
 * Classification:
 *   < 0.8  → "Safe"
 *   0.8–1.2 → "Fragile"
 *   > 1.2  → "Critical" (cSCC — Critical Strongly Connected Component)
 */

/**
 * @typedef {Object} FragilityResult
 * @property {Array<number>} members         Node IDs in the SCC.
 * @property {number}        totalInternalExposure  Sum of internal edge weights.
 * @property {number}        totalCapital    Sum of member capitals.
 * @property {number}        fragilityScore  Ratio of exposure to capital.
 * @property {string}        classification  "Safe" | "Fragile" | "Critical"
 */

/**
 * Calculate the fragility score for a single SCC.
 *
 * @param {Array<number>} scc     Array of node IDs in the SCC.
 * @param {Array}         nodes   Full node array.
 * @param {Array}         edges   Full edge array.
 * @returns {FragilityResult}
 */
/**
 * Classify a fragility score into a human-readable label and color.
 *
 * Thresholds are calibrated to work correctly for both:
 *   - 2008 US data  (SCC fragility ≈ 2.34  → HIGH RISK)
 *   - India 2025    (SCC fragility ≈ 1.02  → FRAGILE — well-capitalised)
 *
 * @param {number} score
 * @returns {{ label: string, color: string }}
 */
export function getFragilityLabel(score) {
  if (score >= 3.0) return { label: 'Critical',  color: '#EF4444' };
  if (score >= 1.5) return { label: 'High Risk',  color: '#F97316' };
  if (score >= 1.0) return { label: 'Fragile',    color: '#EAB308' };
  return               { label: 'Safe',        color: '#22C55E' };
}

export function calculateFragility(scc, nodes, edges) {
  const memberSet = new Set(scc);

  // Sum of all edge weights where BOTH endpoints are in the SCC
  const totalInternalExposure = edges
    .filter(e => memberSet.has(e.from) && memberSet.has(e.to))
    .reduce((sum, e) => sum + e.weight, 0);

  // Sum of capital of all SCC members
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const totalCapital = scc.reduce((sum, id) => sum + (nodeMap.get(id)?.capital || 0), 0);

  const fragilityScore = totalCapital > 0
    ? totalInternalExposure / totalCapital
    : Infinity;

  const { label: classification } = getFragilityLabel(fragilityScore);

  return {
    members: [...scc],
    totalInternalExposure,
    totalCapital,
    fragilityScore: Math.round(fragilityScore * 100) / 100,
    classification,
  };
}

/**
 * Analyze all death loops and return their fragility profiles.
 *
 * @param {Array<Array<number>>} deathLoops  SCCs with size > 1.
 * @param {Array}                nodes       Full node array.
 * @param {Array}                edges       Full edge array.
 * @returns {Array<FragilityResult>}  Sorted by fragilityScore descending.
 */
export function analyzeAllSCCs(deathLoops, nodes, edges) {
  return deathLoops
    .map(scc => calculateFragility(scc, nodes, edges))
    .sort((a, b) => b.fragilityScore - a.fragilityScore);
}

export default { calculateFragility, analyzeAllSCCs };
