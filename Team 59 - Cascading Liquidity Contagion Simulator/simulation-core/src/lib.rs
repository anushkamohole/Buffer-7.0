use wasm_bindgen::prelude::*;
use ndarray::{Array1, Array2};
use serde::{Deserialize, Serialize};

pub mod algorithms {
    pub mod eisenberg_noe;
    pub mod tarjan_scc;
    pub mod debtrank;
}
pub mod engine {
    pub mod monte_carlo;
}

use algorithms::eisenberg_noe::calculate_clearing_vector;
use algorithms::tarjan_scc::find_sccs;
use algorithms::debtrank::calculate_debtrank;
use engine::monte_carlo::run_stochastic_simulation;

#[derive(Serialize, Deserialize)]
pub struct SimulationInput {
    pub assets: Vec<f64>,
    pub liabilities_matrix: Vec<Vec<f64>>,
    pub max_iter: Option<usize>,
    pub tolerance: Option<f64>,
}

#[derive(Serialize, Deserialize)]
pub struct SimulationOutput {
    pub clearing_vector: Vec<f64>,
    pub default_status: Vec<bool>,
    pub sccs: Vec<Vec<usize>>,
    pub debtranks: Vec<f64>,
}

#[wasm_bindgen]
pub fn simulate_contagion(input_json: &str) -> Result<String, JsValue> {
    let input: SimulationInput = serde_json::from_str(input_json)
        .map_err(|e| JsValue::from_str(&format!("Parsing error: {}", e)))?;

    let n = input.assets.len();
    let assets = Array1::from_vec(input.assets);
    
    // Convert 2D vec to ndarray
    let mut liabilities = Array2::zeros((n, n));
    for i in 0..n {
        for j in 0..n {
            liabilities[[i, j]] = input.liabilities_matrix[i][j];
        }
    }

    // 1. Eisenberg-Noe Clearing Vector
    let cv = calculate_clearing_vector(
        &liabilities, 
        &assets, 
        input.max_iter.unwrap_or(100), 
        input.tolerance.unwrap_or(1e-6)
    );

    // 2. Default Status
    let total_liabilities: Array1<f64> = liabilities.sum_axis(ndarray::Axis(1));
    let defaults: Vec<bool> = cv.iter().zip(total_liabilities.iter())
        .map(|(&c, &t)| t > 1e-9 && c < t - 1e-4)
        .collect();

    // 3. Tarjan SCCs
    let mut adj = vec![vec![]; n];
    for i in 0..n {
        for j in 0..n {
            if liabilities[[i, j]] > 1e-9 {
                adj[i].push(j);
            }
        }
    }
    let sccs = find_sccs(n, &adj);

    // 4. DebtRank
    let initial_shock = Array1::zeros(n); // Can be customized
    let dr = calculate_debtrank(n, &liabilities, &assets, &initial_shock);

    let output = SimulationOutput {
        clearing_vector: cv.to_vec(),
        default_status: defaults,
        sccs,
        debtranks: dr.to_vec(),
    };

    serde_json::to_string(&output)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}

#[wasm_bindgen]
pub fn run_monte_carlo(input_json: &str, iterations: usize, volatility: f64) -> Result<String, JsValue> {
    let input: SimulationInput = serde_json::from_str(input_json)
        .map_err(|e| JsValue::from_str(&format!("Parsing error: {}", e)))?;

    let n = input.assets.len();
    let assets = Array1::from_vec(input.assets);
    let mut liabilities = Array2::zeros((n, n));
    for i in 0..n {
        for j in 0..n {
            liabilities[[i, j]] = input.liabilities_matrix[i][j];
        }
    }

    let default_counts = run_stochastic_simulation(iterations, &assets, &liabilities, volatility);

    serde_json::to_string(&default_counts)
        .map_err(|e| JsValue::from_str(&format!("Serialization error: {}", e)))
}
