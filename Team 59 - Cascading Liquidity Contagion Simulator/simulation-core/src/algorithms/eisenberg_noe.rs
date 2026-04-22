use ndarray::{Array1, Array2, Axis};

/**
 * Eisenberg-Noe clearing algorithm implementation in Rust.
 * Calculates the equilibrium clearing vector representing how much each bank
 * can fulfill its obligations.
 */
pub fn calculate_clearing_vector(
    liabilities: &Array2<f64>,
    external_assets: &Array1<f64>,
    max_iter: usize,
    tol: f64,
) -> Array1<f64> {
    let n = external_assets.len();
    if n == 0 { return Array1::zeros(0); }

    // Total liabilities per bank (row sum)
    let total_liabilities: Array1<f64> = liabilities.sum_axis(Axis(1));
    
    // Initial guess: all banks fulfill their total liabilities
    let mut p = total_liabilities.clone();
    
    for _ in 0..max_iter {
        let p_prev = p.clone();
        
        for i in 0..n {
            if total_liabilities[i] < 1e-9 {
                p[i] = 0.0;
                continue;
            }

            // Income = external assets + payments from other banks
            let mut income = external_assets[i];
            for j in 0..n {
                if i != j && total_liabilities[j] > 1e-9 {
                    // Payment from j to i = (liabilities j->i / total_liabilities j) * actual payment j
                    income += (liabilities[[j, i]] / total_liabilities[j]) * p_prev[j];
                }
            }
            // Bank i pays the minimum of its incoming liquidity or its total obligations
            p[i] = income.min(total_liabilities[i]);
        }
        
        // Check for convergence (L1 norm)
        let diff = (&p - &p_prev).mapv(|x| x.abs()).sum();
        if diff < tol { 
            break; 
        }
    }
    
    p
}
