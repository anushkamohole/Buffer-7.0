/**
 * HeuristicAgent.js
 * 
 * "Systemic Savior" Strategy
 * 
 * The AI is now Strategically Intelligent:
 * - 50% Weight: Node's Risk Score (Likelihood to fail).
 * - 50% Weight: Node's Systemic Linkage / DebtRank (Impact if it fails).
 * 
 * This ensures the AI targets institutions that are both vulnerable 
 * and structurally dangerous to the entire network.
 */

export function getHeuristicRecommendation(nodes, vulnerabilityRanking, sccData, debtRanks) {
  const n = nodes.length;
  if (n === 0) return [];
  if (!vulnerabilityRanking || vulnerabilityRanking.length === 0) return new Array(n).fill(1/n);

  const scores = new Array(n).fill(0);
  
  // 1. Identify Critical SCC set (Fragility > 1.0)
  const criticalNodeIds = new Set();
  sccData.forEach(scc => {
    if (scc.fragility > 1.0) {
      scc.members.forEach(mId => criticalNodeIds.add(mId));
    }
  });

  // 2. Map risk ranking for easier lookup
  const riskMap = new Map();
  vulnerabilityRanking.forEach(r => riskMap.set(r.nodeId, r));

  nodes.forEach((node, i) => {
    const riskInfo = riskMap.get(node.id);
    if (!riskInfo) return;

    // Component 1: Risk Score (50%)
    // Normalized by max risk score in the list
    const maxRiskScore = vulnerabilityRanking[0]?.score || 1;
    const riskComponent = (riskInfo.score / maxRiskScore) * 0.5;

    // Component 2: Systemic Linkage (50%)
    // Based on DebtRank (normalized)
    // debtRanks is Map<nodeId, val>
    const drValue = debtRanks.get(node.id) || 0;
    const maxDR = Math.max(...Array.from(debtRanks.values()), 0.01);
    const systemicComponent = (drValue / maxDR) * 0.5;

    // Combined Score
    let finalScore = riskComponent + systemicComponent;

    // Strategy Multiplier: Contagion Containment
    // If in a critical death loop, the importance of saving it is amplified
    if (criticalNodeIds.has(node.id)) {
      finalScore *= 2.0;
    }

    scores[i] = finalScore;
  });

  // Normalize scores
  const sum = scores.reduce((a, b) => a + b, 0);
  if (sum > 1e-9) {
    return scores.map(s => s / sum);
  }

  return new Array(n).fill(0);
}
