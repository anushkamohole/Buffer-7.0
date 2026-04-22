/**
 * ExplanationEngine.js — Human-readable cascade failure explanations.
 *
 * Generates step-by-step narratives explaining *why* each node failed
 * during a cascade simulation, suitable for real-time display.
 */

/**
 * @typedef {Object} FailureExplanation
 * @property {number}  round        Round number the failure occurred.
 * @property {number}  nodeId       ID of the failed node.
 * @property {string}  nodeName     Name of the failed node.
 * @property {string}  narrative    Human-readable explanation.
 * @property {Array}   lossBreakdown  Individual losses that caused the failure.
 * @property {number}  capitalBefore  Capital before the losses hit.
 * @property {number}  capitalAfter   Capital after (negative = insolvent).
 */

import { formatCurrency } from '../utils/formatCurrency';

/**
 * Generate explanations for every failure in a cascade result.
 *
 * @param {Object} cascadeResult  Result from simulateCascade().
 * @param {Array}  originalNodes  Original (pre-shock) node array.
 * @param {string} currency       Currency code ('USD' or 'INR').
 * @returns {Array<FailureExplanation>}
 */
export function generateExplanations(cascadeResult, originalNodes, currency = 'USD') {
  const { rounds } = cascadeResult;
  const nodeMap = new Map(originalNodes.map(n => [n.id, n]));
  const explanations = [];

  // Track running capital state across rounds
  const capitalState = new Map(originalNodes.map(n => [n.id, n.capital]));

  for (const round of rounds) {
    // Gather losses received by each node this round
    const lossesForNode = new Map();
    for (const loss of round.lossesPropagated) {
      if (!lossesForNode.has(loss.to)) lossesForNode.set(loss.to, []);
      lossesForNode.get(loss.to).push(loss);
    }

    for (const nodeId of round.newDefaults) {
      const node = nodeMap.get(nodeId);
      const losses = lossesForNode.get(nodeId) || [];
      const capitalBefore = capitalState.get(nodeId) || 0;

      // Calculate total loss this round
      const totalLoss = losses.reduce((s, l) => s + l.amount, 0);
      const capitalAfter = capitalBefore - totalLoss;

      // Build the narrative
      let narrative;
      if (round.round === 0) {
        // Initial shock
        const shockLoss = losses.find(l => l.from === 'SHOCK');
        narrative = `⚡ ${node.name} collapsed from a direct shock of ${formatCurrency(shockLoss?.amount || 0, currency)}, `
          + `wiping out its entire capital buffer of ${formatCurrency(capitalBefore, currency)}.`;
      } else {
        // Contagion failure
        const lossDescriptions = losses.map(l => {
          const fromName = l.from === 'SHOCK' ? 'SHOCK' : (nodeMap.get(l.from)?.name || `Node ${l.from}`);
          return `${formatCurrency(l.amount, currency)} from ${fromName}`;
        });

        narrative = `💀 ${node.name} failed because it lost ${lossDescriptions.join(' + ')} `
          + `(total: ${formatCurrency(totalLoss, currency)}), exceeding its remaining capital buffer of ${formatCurrency(Math.max(0, capitalBefore), currency)}.`;
      }

      explanations.push({
        round: round.round,
        nodeId,
        nodeName: node.name,
        narrative,
        lossBreakdown: losses,
        capitalBefore: Math.round(capitalBefore * 100) / 100,
        capitalAfter: Math.round(capitalAfter * 100) / 100,
      });
    }

    // Update capital state from this round's snapshot
    for (const ns of round.snapshot) {
      capitalState.set(ns.id, ns.capital);
    }
  }

  return explanations;
}

export default { generateExplanations };
