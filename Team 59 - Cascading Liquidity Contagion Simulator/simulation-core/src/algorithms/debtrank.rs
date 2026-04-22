use ndarray::{Array1, Array2};

/**
 * DebtRank algorithm implementation.
 * Measures the 'destructive potential' of each node by propagating distress.
 */
pub fn calculate_debtrank(
    n: usize,
    exposure_matrix: &Array2<f64>,
    capital: &Array1<f64>,
    initial_distress: &Array1<f64>,
) -> Array1<f64> {
    // Relative impact matrix W_ij = exposure_ji / capital_i
    let mut w = Array2::zeros((n, n));
    for i in 0..n {
        if capital[i] > 1e-9 {
            for j in 0..n {
                w[[i, j]] = exposure_matrix[[j, i]] / capital[i];
            }
        }
    }

    let mut h = initial_distress.clone();
    let mut h_prev = Array1::zeros(n);
    let mut status = initial_distress.mapv(|x| if x > 0.0 { 1 } else { 0 }); // 0: inactive, 1: distressed, 2: inactive-after-distressed

    let max_iter = 100;
    for _ in 0..max_iter {
        let h_current = h.clone();
        let mut changed = false;

        for i in 0..n {
            if status[i] == 2 { continue; }

            let mut impact = 0.0;
            for j in 0..n {
                if status[j] == 1 {
                    impact += w[[i, j]] * (h_current[j] - h_prev[j]);
                }
            }

            if impact > 1e-9 {
                h[i] = (h[i] + impact).min(1.0);
                changed = true;
            }
        }

        h_prev = h_current;

        // Update status
        for i in 0..n {
            if status[i] == 1 {
                status[i] = 2; // Was distressed, now inactive
            } else if status[i] == 0 && h[i] > 0.0 {
                status[i] = 1; // Now distressed
            }
        }

        if !changed && status.iter().all(|&s| s != 1) { break; }
    }

    h
}
