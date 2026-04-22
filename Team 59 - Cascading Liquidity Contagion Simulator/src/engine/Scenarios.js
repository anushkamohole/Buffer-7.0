/**
 * Scenarios.js — Pre-built financial network scenarios for presentation.
 *
 * Each scenario returns { nodes, edges } in the same format as NetworkBuilder.
 */

/**
 * "Why Lehman Was Inevitable" — 2008 Financial Crisis Scenario
 *
 * Synthetic dataset modeled after the 2008 topology:
 *   - Core SCC: Lehman Brothers, Bear Stearns, AIG, Merrill Lynch, Citigroup
 *     form a massive death loop with Fragility >> 1.
 *   - Peripheral banks (JPMorgan, Goldman Sachs, Morgan Stanley, Wachovia,
 *     Washington Mutual) are connected but not all inside the core SCC.
 *   - JPMorgan has high DebtRank (centrality) but sits OUTSIDE the core SCC,
 *     demonstrating that centrality ≠ fragility.
 *
 * Fragility of Core SCC ≈ 2.34 (Critical — collapse is inevitable).
 */
export function load2008Scenario() {
  const nodes = [
    // ── Core SCC Members (the "Death Loop") ───────────────────────
    { id: 0, name: 'Lehman Brothers',   assets: 639, liabilities: 613, capital: 26 },
    { id: 1, name: 'Bear Stearns',      assets: 395, liabilities: 383, capital: 12 },
    { id: 2, name: 'AIG',               assets: 860, liabilities: 838, capital: 22 },
    { id: 3, name: 'Merrill Lynch',     assets: 570, liabilities: 548, capital: 22 },
    { id: 4, name: 'Citigroup',         assets: 1200, liabilities: 1155, capital: 45 },

    // ── Peripheral but Connected ──────────────────────────────────
    { id: 5, name: 'JPMorgan Chase',    assets: 1562, liabilities: 1438, capital: 124 },
    { id: 6, name: 'Goldman Sachs',     assets: 884, liabilities: 822, capital: 62 },
    { id: 7, name: 'Morgan Stanley',    assets: 658, liabilities: 614, capital: 44 },
    { id: 8, name: 'Wachovia',          assets: 312, liabilities: 289, capital: 23 },
    { id: 9, name: 'Washington Mutual', assets: 245, liabilities: 230, capital: 15 },
  ];

  // Edges: from → to means "from owes to"
  // Core SCC cycle: Lehman → Bear → AIG → Merrill → Citi → Lehman
  // Plus cross-links within the SCC to make it densely interconnected.
  const edges = [
    // ── Core SCC Cycle (large obligations create the death loop) ──
    { from: 0, to: 1, weight: 120 },  // Lehman → Bear Stearns
    { from: 1, to: 2, weight: 95 },   // Bear Stearns → AIG
    { from: 2, to: 3, weight: 110 },  // AIG → Merrill Lynch
    { from: 3, to: 4, weight: 85 },   // Merrill → Citigroup
    { from: 4, to: 0, weight: 130 },  // Citigroup → Lehman (closes the loop)

    // ── Cross-links within SCC (amplifies interconnection) ────────
    { from: 0, to: 2, weight: 105 },  // Lehman → AIG (CDS exposure)
    { from: 2, to: 0, weight: 80 },   // AIG → Lehman
    { from: 1, to: 3, weight: 60 },   // Bear → Merrill
    { from: 3, to: 0, weight: 70 },   // Merrill → Lehman
    { from: 4, to: 2, weight: 90 },   // Citi → AIG
    { from: 0, to: 4, weight: 95 },   // Lehman → Citi

    // ── Peripheral lending TO the Core SCC ────────────────────────
    { from: 5, to: 0, weight: 85 },   // JPMorgan → Lehman
    { from: 5, to: 2, weight: 60 },   // JPMorgan → AIG
    { from: 5, to: 3, weight: 40 },   // JPMorgan → Merrill
    { from: 6, to: 0, weight: 55 },   // Goldman → Lehman
    { from: 6, to: 1, weight: 35 },   // Goldman → Bear
    { from: 7, to: 0, weight: 50 },   // Morgan Stanley → Lehman
    { from: 7, to: 4, weight: 30 },   // Morgan Stanley → Citi

    // ── Core SCC obligations TO peripherals (large debt outflows) ─
    { from: 0, to: 5, weight: 160 },  // Lehman → JPMorgan (massive)
    { from: 0, to: 6, weight: 110 },  // Lehman → Goldman
    { from: 2, to: 5, weight: 95 },   // AIG → JPMorgan
    { from: 1, to: 7, weight: 55 },   // Bear → Morgan Stanley
    { from: 4, to: 8, weight: 45 },   // Citi → Wachovia
    { from: 3, to: 8, weight: 35 },   // Merrill → Wachovia

    // ── Peripheral ↔ Peripheral ──────────────────────────────────
    { from: 8, to: 9, weight: 18 },   // Wachovia → WaMu
    { from: 9, to: 8, weight: 12 },   // WaMu → Wachovia
    { from: 5, to: 6, weight: 30 },   // JPMorgan → Goldman
    { from: 6, to: 7, weight: 25 },   // Goldman → Morgan Stanley
    { from: 7, to: 5, weight: 20 },   // Morgan Stanley → JPMorgan
  ];

  // Asset matrix: [MBS, CDS, Equities] holdings per bank (in $B)
  // Order matches nodes array (id 0=Lehman, 1=Bear, 2=AIG, 3=Merrill, 4=Citi,
  //                            5=JPMorgan, 6=Goldman, 7=MorganStanley, 8=Wachovia, 9=WaMu)
  const assetMatrix = [
    [15,  8,  3],   // Lehman Brothers   — heavy MBS + CDS
    [12,  6,  4],   // Bear Stearns      — MBS-heavy
    [ 5, 25,  2],   // AIG               — extreme CDS (the "insurer")
    [ 8,  5,  6],   // Merrill Lynch     — MBS + equities
    [18,  9, 12],   // Citigroup         — large across all
    [10,  4, 20],   // JPMorgan Chase    — equity-heavy (less MBS)
    [ 7,  8, 15],   // Goldman Sachs     — balanced
    [ 6,  3, 10],   // Morgan Stanley    — equity-tilt
    [ 9,  2,  4],   // Wachovia          — mostly MBS
    [ 7,  1,  2],   // Washington Mutual — MBS-concentrated
  ];

  // Approximate total market volumes for each asset class ($B)
  // Used to compute price impact when a bank dumps holdings
  const marketVolume = [800, 400, 1200]; // MBS, CDS, Equities

  const assetNames = ['MBS', 'CDS', 'Equities'];

  return { nodes, edges, assetMatrix, assetNames, marketVolume };
}

/**
 * Scenario metadata for the UI preset selector.
 */
export const SCENARIOS = [
  {
    id: 'random',
    name: 'Random Network',
    description: 'Procedurally generated scale-free network (12 banks)',
    icon: '🎲',
  },
  {
    id: 'lehman2008',
    name: '2008 Financial Crisis',
    description: '"Why Lehman Was Inevitable" — Core SCC Fragility: ~2.34',
    icon: '💥',
  },
  {
    id: "india2025",
    name: "Indian Banking System — 2025 (RBI Data)",
    description: "RBI Q3 FY2025 data with Maximum Entropy exposure modeling",
    icon: "🇮🇳",
    currency: "INR",
    isRealData: true,
    disclaimer: "Exposure matrix estimated via Maximum Entropy method. Bilateral interbank exposure data is not publicly available. Capital and CRAR figures sourced from RBI Q3 FY2025 reports.",
    nodes: [
      { id: 0,  name: "SBI",        capital: 324921,  totalAssets: 6186831, npaRatio: 2.24, crar: 13.76 },
      { id: 1,  name: "HDFC Bank",  capital: 336111,  totalAssets: 3617851, npaRatio: 1.24, crar: 19.27 },
      { id: 2,  name: "ICICI Bank", capital: 216019,  totalAssets: 2766589, npaRatio: 1.96, crar: 16.64 },
      { id: 3,  name: "Axis Bank",  capital: 153473,  totalAssets: 1549308, npaRatio: 1.43, crar: 16.63 },
      { id: 4,  name: "Kotak",      capital: 112042,  totalAssets: 743038,  npaRatio: 1.73, crar: 22.29 },
      { id: 5,  name: "PNB",        capital: 89913,   totalAssets: 1517242, npaRatio: 4.09, crar: 15.97 },
      { id: 6,  name: "BoB",        capital: 132083,  totalAssets: 1423264, npaRatio: 2.92, crar: 16.83 },
      { id: 7,  name: "Canara",     capital: 89541,   totalAssets: 1398234, npaRatio: 3.73, crar: 16.27 },
      { id: 8,  name: "Union Bank", capital: 62474,   totalAssets: 1204906, npaRatio: 4.76, crar: 16.54 },
      { id: 9,  name: "IndusInd",   capital: 73843,   totalAssets: 484692,  npaRatio: 2.25, crar: 18.06 },
      { id: 10, name: "Yes Bank",   capital: 43234,   totalAssets: 389642,  npaRatio: 1.70, crar: 18.40 },
      { id: 11, name: "IDFC First", capital: 38917,   totalAssets: 289831,  npaRatio: 1.94, crar: 16.11 },
      { id: 12, name: "Federal",    capital: 22416,   totalAssets: 274923,  npaRatio: 2.11, crar: 15.42 },
      { id: 13, name: "Bandhan",    capital: 28941,   totalAssets: 149836,  npaRatio: 4.19, crar: 15.02 },
      { id: 14, name: "RBL",        capital: 17892,   totalAssets: 108234,  npaRatio: 2.89, crar: 14.77 }
    ]
  },
];
