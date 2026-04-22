use rand::prelude::*;
use std::f64::consts::PI;
use ndarray::{Array1, Array2};
use crate::algorithms::eisenberg_noe::calculate_clearing_vector;

/**
 * Monte Carlo engine for stress testing.
 * Includes Gaussian number generation via Box-Muller transform.
 */

/**
 * Generates two independent standard normal random variables using 
 * the Box-Muller polar transform.
 */
pub fn box_muller_transform() -> (f64, f64) {
    let mut rng = thread_rng();
    let u1: f64 = rng.gen(); // Uniform(0,1)
    let u2: f64 = rng.gen();

    let r = (-2.0 * u1.ln()).sqrt();
    let theta = 2.0 * PI * u2;

    let z0 = r * theta.cos();
    let z1 = r * theta.sin();

    (z0, z1)
}

/**
 * Runs a Monte Carlo simulation for contagion.
 * Varies external assets by a random walk and calculates systemic defaults.
 */
pub fn run_stochastic_simulation(
    iterations: usize,
    base_assets: &Array1<f64>,
    liabilities: &Array2<f64>,
    volatility: f64,
) -> Vec<usize> {
    let n = base_assets.len();
    let mut default_counts = vec![0; n];

    for _ in 0..iterations {
        // Apply random shock to assets
        let mut shocked_assets = base_assets.clone();
        for i in 0..n {
            let (z, _) = box_muller_transform();
            shocked_assets[i] *= (volatility * z).exp();
        }

        // Run clearing algorithm
        let clearing_vector = calculate_clearing_vector(liabilities, &shocked_assets, 100, 1e-6);
        
        // Total obligations per bank
        let total_liabilities: Array1<f64> = liabilities.sum_axis(ndarray::Axis(1));
        
        // Check for defaults
        for i in 0..n {
            if total_liabilities[i] > 1e-9 && clearing_vector[i] < total_liabilities[i] - 1e-4 {
                default_counts[i] += 1;
            }
        }
    }

    default_counts
}
