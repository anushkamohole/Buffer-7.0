import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useSimulation Hook
 * 
 * Provides a high-level API to interact with the high-performance Rust core
 * and the DRL bailout agent using Web Workers.
 * 
 * Updated with robust error handling to unlock UI buttons on failure.
 */

export interface SimulationResult {
    clearing_vector: number[];
    default_status: boolean[];
    sccs: number[][];
    debtranks: number[];
}

export const useSimulation = () => {
    const workerRef = useRef<Worker | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    
    const pendingCalls = useRef<Map<string, { resolve: Function; reject: Function }>>(new Map());

    useEffect(() => {
        const worker = new Worker(
            new URL('../worker/simulation.worker.ts', import.meta.url), 
            { type: 'module' }
        );

        worker.postMessage({ type: 'INIT' });

        worker.onmessage = (e: MessageEvent) => {
            const { id, type, data, error } = e.data || {};
            
            if (type === 'READY') {
                setIsReady(true);
                return;
            }

            // UNLOCK UI: Set isProcessing to false immediately if the worker sends an error
            if (type === 'ERROR' || error) {
                console.error("🚨 WASM Worker Error:", error || e.data.error);
                setIsProcessing(false); // Force unlock for general errors
            }

            if (id && pendingCalls.current.has(id)) {
                const { resolve, reject } = pendingCalls.current.get(id)!;
                
                if (type.endsWith('_SUCCESS') || type === 'SUCCESS') {
                    resolve(data);
                } else {
                    reject(new Error(error || 'Worker execution failed'));
                }
                
                pendingCalls.current.delete(id);
                
                if (pendingCalls.current.size === 0) {
                    setIsProcessing(false);
                }
            }
        };

        workerRef.current = worker;

        return () => {
            worker.terminate();
        };
    }, []);

    const callWorker = useCallback((type: string, payload: any): Promise<any> => {
        if (!workerRef.current) return Promise.reject(new Error('Simulation Worker not initialized'));
        
        setIsProcessing(true);
        const id = Math.random().toString(36).substring(2, 11);
        
        return new Promise((resolve, reject) => {
            pendingCalls.current.set(id, { resolve, reject });
            workerRef.current!.postMessage({ id, type, payload });
        });
    }, []);

    const runSimulation = useCallback(async (nodes: any[], edges: any[], shockNodeId: number = -1, shockAmount: number = 0): Promise<SimulationResult> => {
        const input = { nodes, edges, shockNodeId, shockAmount };
        return callWorker('SIMULATE', input);
    }, [callWorker]);

    const runMonteCarlo = useCallback(async (nodes: any[], edges: any[], iterations: number, volatility: number) => {
        const input = { nodes, edges };
        return callWorker('MONTE_CARLO', { input, iterations, volatility });
    }, [callWorker]);

    const getBailoutRecommendation = useCallback(async (nodes: any[], liabilities: number[][], sis: number): Promise<number[]> => {
        const normalized_capitals = nodes.map(n => n.capital / 50.0);
        const exposure_density = nodes.map((_, i) => liabilities[i].reduce((a, b) => a + b, 0) / 100.0);
        const observation = [...normalized_capitals, ...exposure_density, sis];
        return callWorker('INFER_BAILOUT', observation);
    }, [callWorker]);

    return {
        isReady,
        isProcessing,
        runSimulation,
        runMonteCarlo,
        getBailoutRecommendation
    };
};
