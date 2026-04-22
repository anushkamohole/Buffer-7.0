import * as ort from 'onnxruntime-web';
import init, { simulate_contagion, run_monte_carlo } from '../../simulation-core/pkg/simulation_core';

ort.env.wasm.wasmPaths = {
    'ort-wasm.wasm': '/ort-wasm/ort-wasm.wasm',
    'ort-wasm-simd.wasm': '/ort-wasm/ort-wasm-simd.wasm',
    'ort-wasm-threaded.wasm': '/ort-wasm/ort-wasm-threaded.wasm',
};

ort.env.wasm.numThreads = 1;
ort.env.wasm.simd = true;
ort.env.executionProviders = ['wasm'];

let wasmReady = false;
let aiSession: ort.InferenceSession | null = null;

async function initialize() {
    try {
        console.log("🔧 Worker: Starting initialization...");
        await init();
        wasmReady = true;
        console.log("✅ Rust Simulation Core Initialized");

        try {
            const modelUrl = '/models/drl_model.onnx';
            aiSession = await ort.InferenceSession.create(modelUrl, {
                executionProviders: ['wasm'],
                graphOptimizationLevel: 'all',
                executionMode: 'sequential',
            });
            console.log("✅ DRL Bailout Agent LOADED SUCCESSFULLY");
        } catch (aiError) {
            aiSession = null;
        }

        self.postMessage({ type: 'READY' });
    } catch (error) {
        console.error("❌ Critical Worker Error:", error);
    }
}

self.onmessage = async (e: MessageEvent) => {
    const rawData = e.data || {};
    const { type, id } = rawData;
    const payload = rawData.payload || {};

    if (type === 'INIT') {
        await initialize();
        return;
    }

    if (!wasmReady) {
        if (id) self.postMessage({ id, type: 'ERROR', error: "WASM not ready" });
        return;
    }

    try {
        switch (type) {
            case 'SIMULATE': {
                try {
                    // SENIOR ARCHITECT FIX: Schema Enforcement
                    // The 'missing field assets' error indicates that one or more node objects
                    // are incomplete. We MUST sanitize and supply defaults for Rust's strictly typed structs.
                    
                    const nodes = (payload.nodes || []).map((n: any) => ({
                        id: Number(n.id ?? 0),
                        name: n.name || `Node ${n.id}`,
                        assets: Number(n.assets ?? n.totalAssets ?? n.total_assets ?? 0),
                        liabilities: Number(n.liabilities ?? 0),
                        capital: Number(n.capital ?? 0),
                        initialCapital: Number(n.initialCapital ?? n.capital ?? 0)
                    }));

                    const edges = (payload.edges || []).map((e: any) => ({
                        from: Number(e.from ?? 0),
                        to: Number(e.to ?? 0),
                        weight: Number(e.weight ?? 1)
                    }));

                    const n = nodes.length;
                    const assets = nodes.map((nd: any) => {
                        let a = nd.assets;
                        if (nd.id === Number(payload.shockNodeId)) {
                            a = Math.max(0, a - Number(payload.shockAmount ?? 0));
                        }
                        return a;
                    });
                    
                    const liabilities_matrix = Array.from({ length: n }, () => Array(n).fill(0));
                    const idToIndex = new Map(nodes.map((nd: any, i: number) => [nd.id, i]));
                    
                    edges.forEach((e: any) => {
                        const fromIdx = idToIndex.get(e.from);
                        const toIdx = idToIndex.get(e.to);
                        if (fromIdx !== undefined && toIdx !== undefined) {
                            liabilities_matrix[fromIdx][toIdx] = e.weight;
                        }
                    });

                    const fullConfig = {
                        assets,
                        liabilities_matrix,
                        max_iter: 100,
                        tolerance: 1e-6
                    };
                    
                    const inputJson = JSON.stringify(fullConfig);
                    const rawResult = simulate_contagion(inputJson);

                    const finalData = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;

                    self.postMessage({
                        id,
                        type: 'SIMULATE_SUCCESS',
                        data: finalData
                    });
                } catch (err: any) {
                    self.postMessage({ id, type: 'ERROR', error: err.message || err.toString() });
                }
                break;
            }

            case 'MONTE_CARLO': {
                try {
                    const nodes = (payload.input?.nodes || []).map((n: any) => ({
                        id: Number(n.id ?? 0),
                        assets: Number(n.assets ?? n.totalAssets ?? n.total_assets ?? 0),
                    }));

                    const edges = (payload.input?.edges || []).map((e: any) => ({
                        from: Number(e.from ?? 0),
                        to: Number(e.to ?? 0),
                        weight: Number(e.weight ?? 1)
                    }));
                    
                    const n = nodes.length;
                    const assets = nodes.map((nd: any) => nd.assets);
                    const liabilities_matrix = Array.from({ length: n }, () => Array(n).fill(0));
                    const idToIndex = new Map(nodes.map((nd: any, i: number) => [nd.id, i]));
                    
                    edges.forEach((e: any) => {
                        const fromIdx = idToIndex.get(e.from);
                        const toIdx = idToIndex.get(e.to);
                        if (fromIdx !== undefined && toIdx !== undefined) {
                            liabilities_matrix[fromIdx][toIdx] = e.weight;
                        }
                    });

                    const fullConfig = {
                        assets,
                        liabilities_matrix,
                        max_iter: 100,
                        tolerance: 1e-6
                    };
                    
                    const inputJson = JSON.stringify(fullConfig);
                    const iters = Number(payload.iterations || 1000);
                    const vol = Number(payload.volatility || 0.15);
                    const rawResult = run_monte_carlo(inputJson, iters, vol);

                    const finalData = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult;

                    self.postMessage({
                        id,
                        type: 'MONTE_CARLO_SUCCESS',
                        data: finalData
                    });
                } catch (err: any) {
                    self.postMessage({ id, type: 'ERROR', error: err.message || err.toString() });
                }
                break;
            }

            case 'INFER_BAILOUT': {
                try {
                    if (!aiSession) throw new Error("AI Agent Offline");
                    const observation = Array.isArray(payload) ? payload : [0];
                    const inputArray = new Float32Array(observation.length).fill(0);
                    observation.forEach((v: number, i: number) => inputArray[i] = v);

                    const tensor = new ort.Tensor('float32', inputArray, [1, inputArray.length]);
                    const results = await aiSession.run({ observation: tensor });
                    const probs = Array.from(results.action_probs?.data as Float32Array || []);

                    self.postMessage({ id, type: 'INFERENCE_SUCCESS', data: probs });
                } catch (err: any) {
                    self.postMessage({ id, type: 'ERROR', error: err.message });
                }
                break;
            }

            default:
                console.warn(`[Worker] Unknown command: ${type}`);
        }
    } catch (err: any) {
        if (id) self.postMessage({ id, type: 'ERROR', error: err.message || "Execution Failure" });
    }
};