/**
 * EisenbergNoe.js — Cascade Simulation Engine
 *
 * Implements a threshold cascade simulator based on the Eisenberg–Noe
 * clearing model. When a bank defaults, it pays creditors pro-rata
 * based on remaining assets. Unpaid amounts propagate as losses.
 *
 * Returns step-by-step history for animation purposes.
 */

/**
 * @typedef {Object} NodeState
 * @property {number}  id
 * @property {string}  name
 * @property {number}  assets
 * @property {number}  liabilities
 * @property {number}  capital
 * @property {boolean} defaulted
 * @property {number}  lossesReceived   Cumulative losses inflicted on this node.
 * @property {number}  roundDefaulted   Round in which the node defaulted (-1 if alive).
 */

/**
 * @typedef {Object} CascadeRound
 * @property {number}       round            Round number (0 = initial shock).
 * @property {Array<number>} newDefaults      Node IDs that defaulted this round.
 * @property {Array<Object>} lossesPropagated Array of { from, to, amount }.
 * @property {Array<NodeState>} snapshot      Full state of all nodes after this round.
 */

/**
 * @typedef {Object} CascadeResult
 * @property {Array<CascadeRound>} rounds          Step-by-step history.
 * @property {Array<NodeState>}    finalState       Final node states.
 * @property {number}              totalSystemicLoss Total capital destroyed.
 * @property {number}              totalDefaults     Number of defaulted institutions.
 * @property {number}              survivalRate      Fraction of nodes that survived.
 */

/**
 * Deep-clone a node state array.
 */
function cloneStates(states) {
  return states.map(s => ({ ...s }));
}

/**
 * Simulate a liquidity cascade starting from a shock event.
 *
 * @param {Array}  nodes         Array of bank node objects.
 * @param {Array}  edges         Array of { from, to, weight } edges.
 * @param {number} shockedNodeId ID of the node receiving the initial shock.
 * @param {number} shockAmount   Amount of asset loss to apply.
 * @param {Object} [options]
 * @param {number} [options.maxRounds=20]    Safety limit on cascade rounds.
 * @param {number} [options.lgd=1.0]         Loss Given Default (1.0 = total loss).
 * @param {Object} [options.fireSaleConfig]  Optional fire-sale channel config.
 * @param {boolean} [options.fireSaleConfig.enabled=false]
 * @param {number}  [options.fireSaleConfig.alpha=0.15]  Price elasticity of demand.
 * @param {number[][]} [options.fireSaleConfig.assetMatrix]  assetMatrix[i][asset] = holding value.
 * @param {string[]}   [options.fireSaleConfig.assetNames]   Label per asset class.
 * @param {number[]}   [options.fireSaleConfig.marketVolume] Total market volume per asset class.
 * @returns {CascadeResult}
 */
export function simulateCascade(nodes, edges, shockedNodeId, shockAmount, options = {}) {
  const { maxRounds = 20, lgd = 1.0, fireSaleConfig = {} } = options;
  const fireSaleEnabled = fireSaleConfig.enabled === true;
  const fsAlpha = fireSaleConfig.alpha ?? 0.15;
  const fsAssetMatrix = fireSaleConfig.assetMatrix ?? null;
  const fsAssetNames  = fireSaleConfig.assetNames  ?? [];
  const fsMarketVol   = fireSaleConfig.marketVolume ?? null;

  // ── Initialize State ────────────────────────────────────────────────
  /** @type {Map<number, NodeState>} */
  const stateMap = new Map();
  for (const node of nodes) {
    stateMap.set(node.id, {
      id: node.id,
      name: node.name,
      assets: node.assets,
      liabilities: node.liabilities,
      capital: node.capital,
      defaulted: false,
      lossesReceived: 0,
      roundDefaulted: -1,
    });
  }

  // Build creditor map: for each debtor, who are its creditors and how much?
  // Edge: from → to means "from owes to", so creditors of `from` are all `to` nodes.
  const debtorToCreditors = new Map();
  for (const { from, to, weight } of edges) {
    if (!debtorToCreditors.has(from)) debtorToCreditors.set(from, []);
    debtorToCreditors.get(from).push({ creditorId: to, obligation: weight });
  }

  const rounds = [];
  const alreadyDefaulted = new Set();
  // Tracks fire-sale events per round for ExplanationLog
  const fireSaleEventsLog = [];

  // ── Round 0: Apply Initial Shock ───────────────────────────────────
  const shockedNode = stateMap.get(shockedNodeId);
  if (!shockedNode) {
    throw new Error(`Node ${shockedNodeId} not found in the network.`);
  }

  shockedNode.assets -= shockAmount;
  shockedNode.capital = shockedNode.assets - shockedNode.liabilities;
  shockedNode.lossesReceived = shockAmount;

  let newDefaultsThisRound = [];
  if (shockedNode.capital <= 0) {
    shockedNode.defaulted = true;
    shockedNode.roundDefaulted = 0;
    alreadyDefaulted.add(shockedNodeId);
    newDefaultsThisRound.push(shockedNodeId);
  }

  rounds.push({
    round: 0,
    newDefaults: [...newDefaultsThisRound],
    lossesPropagated: [{ from: 'SHOCK', to: shockedNodeId, amount: shockAmount }],
    snapshot: cloneStates([...stateMap.values()]),
  });

  // ── Cascade Rounds ─────────────────────────────────────────────────
  for (let round = 1; round <= maxRounds; round++) {
    if (newDefaultsThisRound.length === 0) break;

    const lossesPropagated = [];
    const nextDefaults = [];

    // For each node that defaulted last round, propagate losses
    for (const defaultedId of newDefaultsThisRound) {
      const dState = stateMap.get(defaultedId);
      const creditors = debtorToCreditors.get(defaultedId) || [];

      // Total obligations from this debtor
      const totalObligation = creditors.reduce((s, c) => s + c.obligation, 0);
      if (totalObligation === 0) continue;

      // Remaining assets available to pay (capped at 0)
      const availableAssets = Math.max(0, dState.assets);

      // Payment ratio (Eisenberg-Noe clearing vector)
      const paymentRatio = Math.min(availableAssets / totalObligation, 1.0);

      for (const { creditorId, obligation } of creditors) {
        const creditorState = stateMap.get(creditorId);
        if (!creditorState || creditorState.defaulted) continue;

        // Amount the creditor actually receives
        const payment = obligation * paymentRatio;

        // Loss = what was owed minus what was paid, scaled by LGD
        const loss = (obligation - payment) * lgd;

        if (loss > 0) {
          creditorState.assets -= loss;
          creditorState.capital = creditorState.assets - creditorState.liabilities;
          creditorState.lossesReceived += loss;

          lossesPropagated.push({
            from: defaultedId,
            to: creditorId,
            amount: Math.round(loss * 100) / 100,
          });

          // Check if creditor now defaults
          if (creditorState.capital <= 0 && !alreadyDefaulted.has(creditorId)) {
            creditorState.defaulted = true;
            creditorState.roundDefaulted = round;
            alreadyDefaulted.add(creditorId);
            nextDefaults.push(creditorId);
          }
        }
      }
    }

    // ── Fire-Sale Channel ───────────────────────────────────────────
    // After credit losses: each newly defaulted bank is forced to dump
    // its asset holdings. This depresses prices, inflicting mark-to-market
    // losses on ALL surviving banks that hold the same asset class.
    const roundFireSaleEvents = [];
    if (fireSaleEnabled && fsAssetMatrix && fsMarketVol && newDefaultsThisRound.length > 0) {
      const numAssets = fsMarketVol.length;

      // Step 1: aggregate sold volume per asset across all new defaults
      const soldVolume = new Array(numAssets).fill(0);
      for (const defId of newDefaultsThisRound) {
        const defIdx = nodes.findIndex(n => n.id === defId);
        if (defIdx === -1) continue;
        for (let a = 0; a < numAssets; a++) {
          soldVolume[a] += (fsAssetMatrix[defIdx]?.[a] ?? 0);
        }
      }

      // Step 2: compute price impact per asset
      const priceImpact = soldVolume.map(
        (vol, a) => fsMarketVol[a] > 0 ? (vol / fsMarketVol[a]) * fsAlpha : 0
      );

      // Step 3: apply mark-to-market losses to surviving banks
      for (let jIdx = 0; jIdx < nodes.length; jIdx++) {
        const jId = nodes[jIdx].id;
        const jState = stateMap.get(jId);
        if (!jState || jState.defaulted) continue;

        let mtmLoss = 0;
        for (let a = 0; a < numAssets; a++) {
          mtmLoss += (fsAssetMatrix[jIdx]?.[a] ?? 0) * priceImpact[a];
        }

        if (mtmLoss > 1e-6) {
          jState.assets  -= mtmLoss;
          jState.capital  = jState.assets - jState.liabilities;
          jState.lossesReceived += mtmLoss;

          // Check if this MTM loss tips the bank into default
          if (jState.capital <= 0 && !alreadyDefaulted.has(jId)) {
            jState.defaulted     = true;
            jState.roundDefaulted = round;
            alreadyDefaulted.add(jId);
            nextDefaults.push(jId);
          }
        }
      }

      // Step 4: log fire-sale events for ExplanationLog
      for (let a = 0; a < numAssets; a++) {
        if (soldVolume[a] > 1e-6) {
          roundFireSaleEvents.push({
            round,
            asset:       fsAssetNames[a] ?? `Asset ${a}`,
            soldVolume:  Math.round(soldVolume[a] * 100) / 100,
            priceImpact: priceImpact[a],
            sellers: newDefaultsThisRound
              .filter(defId => {
                const defIdx = nodes.findIndex(n => n.id === defId);
                return (fsAssetMatrix[defIdx]?.[a] ?? 0) > 0;
              })
              .map(defId => nodes.find(n => n.id === defId)?.name ?? defId),
          });
        }
      }
      fireSaleEventsLog.push(...roundFireSaleEvents);
    }

    rounds.push({
      round,
      newDefaults:     [...nextDefaults],
      lossesPropagated,
      fireSaleEvents:  roundFireSaleEvents,
      snapshot: cloneStates([...stateMap.values()]),
    });

    newDefaultsThisRound = nextDefaults;
  }

  // ── Compute Summary ────────────────────────────────────────────────
  const finalState = [...stateMap.values()];
  const totalDefaults = finalState.filter(n => n.defaulted).length;
  const originalCapital = nodes.reduce((s, n) => s + n.capital, 0);
  const remainingCapital = finalState
    .filter(n => !n.defaulted)
    .reduce((s, n) => s + Math.max(0, n.capital), 0);
  const totalSystemicLoss = originalCapital - remainingCapital;

  return {
    rounds,
    finalState,
    totalSystemicLoss: Math.round(totalSystemicLoss * 100) / 100,
    totalDefaults,
    survivalRate: Math.round(((nodes.length - totalDefaults) / nodes.length) * 100) / 100,
  };
}

export default { simulateCascade };
