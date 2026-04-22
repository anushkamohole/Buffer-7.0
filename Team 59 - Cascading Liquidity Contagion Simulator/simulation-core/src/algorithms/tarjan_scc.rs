/**
 * Tarjan's Strongly Connected Components (SCC) algorithm.
 * Identifies 'death loops' where mutual exposures create recursive default paths.
 */
pub fn find_sccs(n: usize, adj: &Vec<Vec<usize>>) -> Vec<Vec<usize>> {
    let mut indices = vec![None; n];
    let mut lowlinks = vec![0; n];
    let mut on_stack = vec![false; n];
    let mut stack = Vec::new();
    let mut sccs = Vec::new();
    let mut index = 0;

    fn strongconnect(
        v: usize,
        index: &mut usize,
        adj: &Vec<Vec<usize>>,
        indices: &mut Vec<Option<usize>>,
        lowlinks: &mut Vec<usize>,
        on_stack: &mut Vec<bool>,
        stack: &mut Vec<usize>,
        sccs: &mut Vec<Vec<usize>>,
    ) {
        indices[v] = Some(*index);
        lowlinks[v] = *index;
        *index += 1;
        stack.push(v);
        on_stack[v] = true;

        for &w in &adj[v] {
            if indices[w].is_none() {
                strongconnect(w, index, adj, indices, lowlinks, on_stack, stack, sccs);
                lowlinks[v] = lowlinks[v].min(lowlinks[w]);
            } else if on_stack[w] {
                lowlinks[v] = lowlinks[v].min(indices[w].unwrap());
            }
        }

        if lowlinks[v] == indices[v].unwrap() {
            let mut scc = Vec::new();
            while let Some(w) = stack.pop() {
                on_stack[w] = false;
                scc.push(w);
                if w == v { break; }
            }
            sccs.push(scc);
        }
    }

    let mut local_indices = indices;
    let mut local_lowlinks = lowlinks;
    let mut local_on_stack = on_stack;
    let mut local_stack = stack;
    let mut local_index = index;

    for i in 0..n {
        if local_indices[i].is_none() {
            strongconnect(
                i,
                &mut local_index,
                adj,
                &mut local_indices,
                &mut local_lowlinks,
                &mut local_on_stack,
                &mut local_stack,
                &mut sccs,
            );
        }
    }

    sccs
}
