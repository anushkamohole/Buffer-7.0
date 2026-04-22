/**
 * MonteCarlo.js — Monte Carlo stress distribution for systemic risk.
 *
 * Uses Box-Muller transform to sample gaussian shock/LGD pairs,
 * runs the Eisenberg-Noe cascade engine for each sample, and
 * aggregates default probability and systemic loss distributions.
 *
 * No external libraries used.
 */
import { simulateCascade } from './EisenbergNoe.js';

// ── Box-Muller Gaussian sampler ──────────────────────────────────
/**
 * Returns a sample from N(mean, stdDev) using Box-Muller transform.
 */
function gaussianSample(mean, stdDev) {
  // Box-Muller: two uniform [0,1] → two independent N(0,1) samples
  let u, v;
  do { u = Math.random(); } while (u === 0); // avoid log(0)
  v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + z * stdDev;
}

function clamp(val, lo, hi) {
  return Math.max(lo, Math.min(hi, val));
}

/**
 * Build n×n exposure matrix from an edge list.
 * @param {Array}  nodes
 * @param {Array}  edges  [{ from, to, weight }]
 * @returns {number[][]}
 */
function buildExposureMatrix(nodes, edges) {
  const n = nodes.length;
  const idToIdx = new Map(nodes.map((nd, i) => [nd.id, i]));
  const mat = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const e of edges) {
    const fi = idToIdx.get(e.from);
    const ti = idToIdx.get(e.to);
    if (fi !== undefined && ti !== undefined) mat[fi][ti] = e.weight;
  }
  return mat;
}

/**
 * Run Monte Carlo stress simulation.
 *
 * @param {Array}  nodes           Full node array.
 * @param {Array}  edges           Edge array (used to rebuild exposure matrix internally).
 * @param {Object} config
 * @param {number} config.iterations       Number of Monte Carlo runs (default 1000).
 * @param {number} config.shockMean        Mean shock amount.
 * @param {number} config.shockStdDev      Std dev of shock (0 = deterministic).
 * @param {number} config.lgdMean          Mean LGD, in [0,1].
 * @param {number} config.lgdStdDev        Std dev of LGD (0 = deterministic).
 * @param {number} config.targetNodeIndex  Index into nodes[] of the shocked bank.
 * @returns {{
 *   defaultProbabilities: Map<number, number>,  // nodeId → probability
 *   systemicLossDistribution: number[],          // one value per iteration
 *   worstCase: number,
 *   medianCase: number,
 *   var95: number,
 *   mostVulnerableId: number,
 * }}
 */
export function runMonteCarlo(nodes, edges, config) {
  const {
    iterations    = 1000,
    shockMean,
    shockStdDev   = 0,
    lgdMean       = 1.0,
    lgdStdDev     = 0,
    targetNodeIndex,
  } = config;

  if (targetNodeIndex === undefined || targetNodeIndex < 0 || targetNodeIndex >= nodes.length) {
    throw new Error('runMonteCarlo: invalid targetNodeIndex');
  }

  const targetNodeId = nodes[targetNodeIndex].id;

  // Accumulate default counts per node id
  const defaultCounts = new Map(nodes.map(n => [n.id, 0]));
  const lossDistribution = [];

  for (let i = 0; i < iterations; i++) {
    // Sample shock parameters
    const shock = clamp(gaussianSample(shockMean, shockStdDev), 0, Infinity);
    const lgd   = clamp(gaussianSample(lgdMean,   lgdStdDev),   0, 1);

    // Run cascade (no fire-sale for Monte Carlo — keeps it fast)
    let result;
    try {
      result = simulateCascade(nodes, edges, targetNodeId, shock, { lgd });
    } catch {
      continue; // skip degenerate samples
    }

    // Record defaults
    for (const ns of result.finalState) {
      if (ns.defaulted) {
        defaultCounts.set(ns.id, (defaultCounts.get(ns.id) ?? 0) + 1);
      }
    }

    lossDistribution.push(result.totalSystemicLoss);
  }

  const n = lossDistribution.length || 1;

  // Default probabilities
  const defaultProbabilities = new Map(
    [...defaultCounts.entries()].map(([id, count]) => [id, count / n])
  );

  // Sort losses for percentile calculations
  const sorted = [...lossDistribution].sort((a, b) => a - b);
  const worstCase  = sorted[sorted.length - 1] ?? 0;
  const medianCase = sorted[Math.floor(sorted.length * 0.5)] ?? 0;
  const var95      = sorted[Math.floor(sorted.length * 0.95)] ?? 0;

  // Most vulnerable: highest default probability (excluding the shocked node itself)
  let mostVulnerableId = -1;
  let maxProb = -1;
  for (const [id, prob] of defaultProbabilities) {
    if (id !== targetNodeId && prob > maxProb) {
      maxProb = prob;
      mostVulnerableId = id;
    }
  }

  return {
    defaultProbabilities,
    systemicLossDistribution: lossDistribution,
    worstCase:  Math.round(worstCase  * 100) / 100,
    medianCase: Math.round(medianCase * 100) / 100,
    var95:      Math.round(var95      * 100) / 100,
    mostVulnerableId,
    iterations: n,
  };
}
