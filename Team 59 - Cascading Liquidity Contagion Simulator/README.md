# Cascading Liquidity Contagion Simulator

## Problem Statement

In 2008, the global financial system collapsed not because of one bad bank —
but because banks were so deeply entangled in mutual debt that one failure
guaranteed many others. Nobody had mapped this web. Nobody saw it coming.

This project asks: what if we ran graph theory on the financial system before
a crisis hits?

The Cascading Liquidity Contagion Simulator models a network of financial
institutions as a weighted directed graph — banks as nodes, debt obligations
as edges. It detects dangerous clusters of mutually entangled banks using
Tarjan's Algorithm, simulates how a shock cascades through the system round
by round, computes how much rescue capital can actually reach a failing bank,
and uses a Deep Reinforcement Learning agent trained on thousands of simulated
crises to recommend optimal bailout strategies.

It turns abstract systemic risk theory into an interactive, visual,
browser-based crisis lab — where you can trigger a collapse, watch it unfold,
and test whether you can stop it.

## Data Structures & Algorithms Used

| What it does | Algorithm / Structure |
|---|---|
| Detect death loops — clusters guaranteed to fail together | Tarjan's Algorithm (SCC Detection) |
| Simulate cascade round by round | Eisenberg-Noe Contagion Model |
| Find fastest contagion path | Dijkstra's Shortest Path |
| Compute rescue capacity & bottlenecks | Ford-Fulkerson Max Flow |
| Rank most dangerous institutions | DebtRank Propagation |
| Probabilistic worst-case analysis | Monte Carlo Simulation |
| Optimal bailout recommendations | Deep Reinforcement Learning (Gymnasium + PyTorch + ONNX) |

### Custom Data Structures Designed for this Domain

- **Financial Graph Node** — Each bank carries capital, exposure,
  health score, SCC membership, and DebtRank. A purpose-built node
  object designed for this domain, not a generic graph vertex.

- **SCC Fragility Engine** — Built on top of Tarjan's output.
  Scores each detected cluster by comparing internal debt exposure
  versus available capital buffer. This scoring model does not exist
  in any textbook — designed from scratch for this project.

- **Systemic Instability Score (SIS)** — A custom composite index
  combining cluster fragility, network density, and risk concentration
  into one single health rating for the entire financial system.

## Tech Stack

- Frontend: React 19, Vite
- Graph Visualization: vis-network, Framer Motion
- Simulation Engine: Custom JavaScript modules (Tarjan, Dijkstra,
  Ford-Fulkerson, DebtRank, Monte Carlo, Fragility)
- Performance: Rust compiled to WebAssembly via Web Worker
- AI Layer: ONNX Runtime Web, Python (Gymnasium + PyTorch)
- Export: jsPDF

## Demo Video

[▶ Watch Demo Video] https://drive.google.com/file/d/12NX5_QcEGa89rRud7_DZFc1fPGsWVdbg/view?usp=sharing

> Video covers: network loading, death loop detection, shock simulation,
> cascade animation, rescue max-flow, capital injection, Monte Carlo
> stress testing, and RL-based bailout recommendations.


