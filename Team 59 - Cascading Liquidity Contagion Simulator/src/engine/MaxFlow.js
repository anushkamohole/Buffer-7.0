/**
 * MaxFlow.js — Edmonds-Karp (BFS-based Ford-Fulkerson) for rescue capacity analysis.
 *
 * Models the interbank network as a flow network:
 *   - Edge capacity from i→j = exposureMatrix[i][j]
 *   - Virtual super-source (node index n) connects to each safeNodeIndex with ∞ capacity.
 *   - Sink = distressedNodeIndex.
 *
 * Returns:
 *   maxFlow        — total liquidity flow reachable at the distressed bank.
 *   bottleneckEdge — [fromIdx, toIdx] of the edge whose removal hurts max flow most.
 *   flowPaths      — array of { path: number[], flow: number } objects.
 */

const INF = 1e15;

/**
 * Standard BFS to find an augmenting path in the residual graph.
 * Returns the parent array (or null if no path exists).
 */
function bfs(residual, source, sink, parent) {
  const n = residual.length;
  const visited = new Array(n).fill(false);
  const queue = [source];
  visited[source] = true;

  while (queue.length > 0) {
    const u = queue.shift();
    for (let v = 0; v < n; v++) {
      if (!visited[v] && residual[u][v] > 1e-9) {
        parent[v] = u;
        if (v === sink) return true;
        visited[v] = true;
        queue.push(v);
      }
    }
  }
  return false;
}

/**
 * Reconstruct the path from source to sink using parent array.
 */
function reconstructPath(parent, source, sink) {
  const path = [];
  let cur = sink;
  while (cur !== source) {
    path.unshift(cur);
    cur = parent[cur];
  }
  path.unshift(source);
  return path;
}

/**
 * Compute maximum rescue liquidity available to a distressed bank.
 *
 * @param {Array}    nodes                 — full node array (indexed 0..n-1).
 * @param {number[][]} exposureMatrix      — n×n adjacency matrix (weight = interbank exposure).
 * @param {number}   distressedNodeIndex   — index of the bank in crisis.
 * @param {number[]} safeNodeIndices       — indices of banks that can route liquidity.
 * @returns {{ maxFlow, bottleneckEdge, flowPaths }}
 */
export function computeRescueCapacity(nodes, exposureMatrix, distressedNodeIndex, safeNodeIndices) {
  const n = nodes.length;
  // Total nodes in extended graph: real nodes + virtual super-source
  const SUPER_SOURCE = n;
  const total = n + 1;

  // ── Build initial capacity matrix ────────────────────────────────
  const capacity = Array.from({ length: total }, (_, i) =>
    Array.from({ length: total }, (_, j) => {
      if (i < n && j < n) return exposureMatrix[i][j] || 0;
      return 0;
    })
  );

  // Connect super-source → each safe node with infinite capacity
  for (const si of safeNodeIndices) {
    capacity[SUPER_SOURCE][si] = INF;
  }

  // ── Build residual graph ─────────────────────────────────────────
  const residual = capacity.map(row => [...row]);

  // ── Edmonds-Karp: BFS augmentation ──────────────────────────────
  let maxFlow = 0;
  const flowPaths = [];
  const parent = new Array(total).fill(-1);

  while (bfs(residual, SUPER_SOURCE, distressedNodeIndex, parent)) {
    // Find bottleneck along the found path
    let pathFlow = INF;
    let v = distressedNodeIndex;
    while (v !== SUPER_SOURCE) {
      const u = parent[v];
      pathFlow = Math.min(pathFlow, residual[u][v]);
      v = u;
    }

    // Update residual capacities
    v = distressedNodeIndex;
    while (v !== SUPER_SOURCE) {
      const u = parent[v];
      residual[u][v] -= pathFlow;
      residual[v][u] += pathFlow;
      v = u;
    }

    maxFlow += pathFlow;

    // Record this augmenting path (excluding virtual super-source)
    const fullPath = reconstructPath(parent, SUPER_SOURCE, distressedNodeIndex);
    const realPath = fullPath.filter(idx => idx < n); // strip SUPER_SOURCE
    if (realPath.length > 1) {
      flowPaths.push({ path: realPath, flow: pathFlow });
    }

    // Reset parent for next BFS
    parent.fill(-1);
  }

  // ── Find bottleneck edge ─────────────────────────────────────────
  // The binding constraint is the real (non-super-source) edge that:
  //   (a) has capacity > 0 in the original graph, AND
  //   (b) is fully saturated in the residual (residual[i][j] ≈ 0)
  // Among those, we pick the one with the largest original capacity
  // (doubling it would give the biggest improvement).
  let bottleneckEdge = null;
  let bestCap = -1;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const origCap = capacity[i][j];
      if (origCap > 1e-9 && residual[i][j] <= 1e-9) {
        if (origCap > bestCap) {
          bestCap = origCap;
          bottleneckEdge = [i, j];
        }
      }
    }
  }

  return {
    maxFlow: Math.round(maxFlow * 100) / 100,
    bottleneckEdge,
    flowPaths,
  };
}
