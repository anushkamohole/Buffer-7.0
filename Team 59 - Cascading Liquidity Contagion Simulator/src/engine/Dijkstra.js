/**
 * Dijkstra.js — Implementation of Dijkstra's algorithm for finding the fastest contagion path.
 *
 * Weight of edge (i -> j) = 1 / capital[j].
 * This models that banks with lower capital are "closer" to collapse.
 */

export class MinHeap {
  constructor() {
    this.heap = [];
  }

  insert(node, priority) {
    this.heap.push({ node, priority });
    this.bubbleUp();
  }

  extractMin() {
    if (this.isEmpty()) return null;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    this.heap[0] = this.heap.pop();
    this.bubbleDown();
    return min;
  }

  bubbleUp() {
    let index = this.heap.length - 1;
    while (index > 0) {
      let parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[index].priority >= this.heap[parentIndex].priority) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  bubbleDown() {
    let index = 0;
    while (true) {
      let left = 2 * index + 1;
      let right = 2 * index + 2;
      let smallest = index;

      if (left < this.heap.length && this.heap[left].priority < this.heap[smallest].priority) {
        smallest = left;
      }
      if (right < this.heap.length && this.heap[right].priority < this.heap[smallest].priority) {
        smallest = right;
      }

      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }

  isEmpty() {
    return this.heap.length === 0;
  }
}

/**
 * findShortestContagionPaths
 * @param {Array} nodes - Array of bank node objects.
 * @param {Array<Array<number>>} exposureMatrix - Matrix where [i][j] is the exposure from i to j (i owes j).
 * @param {number} shockedNodeIndex - Index of the node where the contagion starts.
 */
export default function findShortestContagionPaths(nodes, exposureMatrix, shockedNodeIndex) {
  const n = nodes.length;
  if (n === 0 || shockedNodeIndex < 0 || shockedNodeIndex >= n) {
    return { distances: [], paths: [], fastestVictim: -1 };
  }
  const distances = new Array(n).fill(Infinity);
  const paths = new Array(n).fill(null).map(() => []);
  const pq = new MinHeap();

  distances[shockedNodeIndex] = 0;
  paths[shockedNodeIndex] = [shockedNodeIndex];
  pq.insert(shockedNodeIndex, 0);

  while (!pq.isEmpty()) {
    const { node: u, priority: d } = pq.extractMin();

    if (d > distances[u]) continue;

    // Iterate through neighbors (nodes v that node u owes)
    for (let v = 0; v < n; v++) {
      const exposure = exposureMatrix[u][v];
      if (exposure > 0) {
        // Weight is 1 / capital of the target node
        const weight = 1 / Math.max(0.0001, nodes[v].capital);
        const newDist = d + weight;

        if (newDist < distances[v]) {
          distances[v] = newDist;
          paths[v] = [...paths[u], v];
          pq.insert(v, newDist);
        }
      }
    }
  }

  let minDistance = Infinity;
  let fastestVictim = -1;

  for (let i = 0; i < n; i++) {
    if (i !== shockedNodeIndex && distances[i] < minDistance) {
      minDistance = distances[i];
      fastestVictim = i;
    }
  }

  return {
    distances,
    paths,
    fastestVictim
  };
}
