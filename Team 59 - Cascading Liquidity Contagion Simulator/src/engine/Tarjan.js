/**
 * Tarjan.js — Tarjan's Algorithm for Strongly Connected Components
 *
 * Finds all SCCs in a directed graph in O(V + E).
 * An SCC is a maximal set of nodes where every node is reachable
 * from every other node. SCCs with size > 1 are "Death Loops".
 */

/**
 * Find all Strongly Connected Components using Tarjan's algorithm.
 *
 * @param {Array} nodes  Array of node objects with `id` property.
 * @param {Array} edges  Array of { from, to, weight }.
 * @returns {Array<Array<number>>}  Array of SCCs, each an array of node IDs.
 */
export function findSCCs(nodes, edges) {
  // Build adjacency list
  const adj = new Map();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const { from, to } of edges) {
    if (adj.has(from)) {
      adj.get(from).push(to);
    }
  }

  let index = 0;
  const indices = new Map();
  const lowlinks = new Map();
  const onStack = new Set();
  const stack = [];
  const sccs = [];

  function strongconnect(v) {
    indices.set(v, index);
    lowlinks.set(v, index);
    index++;
    stack.push(v);
    onStack.add(v);

    // Consider successors of v
    const successors = adj.get(v) || [];
    for (const w of successors) {
      if (!indices.has(w)) {
        // w has not been visited; recurse
        strongconnect(w);
        lowlinks.set(v, Math.min(lowlinks.get(v), lowlinks.get(w)));
      } else if (onStack.has(w)) {
        // w is on the stack → in the current SCC
        lowlinks.set(v, Math.min(lowlinks.get(v), indices.get(w)));
      }
    }

    // If v is a root node, pop the SCC
    if (lowlinks.get(v) === indices.get(v)) {
      const scc = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        scc.push(w);
      } while (w !== v);
      sccs.push(scc);
    }
  }

  // Run for all unvisited nodes
  for (const node of nodes) {
    if (!indices.has(node.id)) {
      strongconnect(node.id);
    }
  }

  return sccs;
}

/**
 * Filter SCCs to only those with size > 1 ("Death Loops").
 *
 * @param {Array<Array<number>>} sccs  Array of SCCs from findSCCs.
 * @returns {Array<Array<number>>}  Only multi-node SCCs.
 */
export function getDeathLoops(sccs) {
  return sccs.filter(scc => scc.length > 1);
}

export default { findSCCs, getDeathLoops };
