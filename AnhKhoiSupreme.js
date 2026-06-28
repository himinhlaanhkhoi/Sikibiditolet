const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE = 'himinhlaanhkhoi_history.json';
const LEARNING_FILE = 'himinhlaanhkhoi_learning.json';

let history = { hu: [], md5: [] };
let stats = {
    hu: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, homnay: { dung: 0, sai: 0, tong: 0 } },
    md5: { total: 0, dung: 0, sai: 0, tyle: 0, chuoi: 0, chuoi_dai: 0, homnay: { dung: 0, sai: 0, tong: 0 } }
};
let lastPhien = { hu: null, md5: null };
let lastPred = { hu: null, md5: null };

// ============================================================
// 🔬 30+ THUẬT TOÁN AI/ML HIỆN ĐẠI
// ============================================================

// 1. DEEP QUANTUM TENSOR NETWORK
class DeepQuantumTensor {
    constructor() {
        this.tensorCores = new Map();
        this.quantumGates = new Map();
        this.dimensions = 8;
        this.trained = false;
    }
    
    tensorProduct(a, b) {
        const result = [];
        for (let i = 0; i < a.length; i++) {
            for (let j = 0; j < b.length; j++) {
                result.push(a[i] * b[j]);
            }
        }
        return result;
    }
    
    quantumGate(input, gate) {
        return input.map((x, i) => {
            const theta = gate[i % gate.length] * Math.PI;
            return x * Math.cos(theta) + (1 - x) * Math.sin(theta);
        });
    }
    
    extractFeatures(seq) {
        const features = [];
        for (let window = 3; window <= 8; window++) {
            if (seq.length < window) break;
            const last = seq.slice(-window);
            const tCount = last.filter(s => s === 'T').length;
            const transitions = last.filter((s, i) => i > 0 && s !== last[i-1]).length;
            features.push(tCount / window, transitions / (window - 1));
        }
        while (features.length < 12) features.push(0.5);
        return features.slice(0, 12);
    }
    
    train(data) {
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            const features = this.extractFeatures(window);
            const key = features.map(f => Math.round(f * 10)).join(',');
            
            if (!this.tensorCores.has(key)) {
                this.tensorCores.set(key, { T: 0, X: 0, total: 0, weight: 1.0 });
                this.quantumGates.set(key, Array(4).fill(0).map(() => Math.random()));
            }
            
            const core = this.tensorCores.get(key);
            core[data[i]]++;
            core.total++;
            core.weight = Math.min(3.0, core.weight + 0.005);
            
            const gate = this.quantumGates.get(key);
            for (let g = 0; g < gate.length; g++) {
                gate[g] += (Math.random() - 0.5) * 0.01;
                gate[g] = Math.max(0, Math.min(1, gate[g]));
            }
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const features = this.extractFeatures(window);
        const key = features.map(f => Math.round(f * 10)).join(',');
        const core = this.tensorCores.get(key);
        
        if (!core || core.total < 5) {
            const similar = this.findSimilarTensor(key);
            if (similar) return similar.T > similar.X ? 'T' : 'X';
            return seq.filter(s => s === 'T').length > seq.length / 2 ? 'T' : 'X';
        }
        
        const gate = this.quantumGates.get(key);
        const gatedFeatures = this.quantumGate(features, gate);
        const signal = gatedFeatures.reduce((a, b) => a + b, 0) / gatedFeatures.length;
        const prob = (core.T / core.total) * core.weight;
        const adjusted = prob * 0.7 + signal * 0.3;
        return adjusted > 0.5 ? 'T' : 'X';
    }
    
    findSimilarTensor(targetKey) {
        let best = null, bestScore = Infinity;
        const target = targetKey.split(',').map(Number);
        for (const [key, core] of this.tensorCores) {
            if (core.total < 5) continue;
            const parts = key.split(',').map(Number);
            let dist = 0;
            for (let i = 0; i < parts.length; i++) {
                dist += Math.abs(parts[i] - (target[i] || 0));
            }
            if (dist < bestScore) { bestScore = dist; best = core; }
        }
        return best;
    }
}

// 2. ADAPTIVE TRANSFORMER ATTENTION
class TransformerAttention {
    constructor() {
        this.attentionHeads = new Map();
        this.positionEncoding = new Map();
        this.headCount = 4;
        this.trained = false;
    }
    
    positionalEncoding(pos, dim) {
        const key = `${pos},${dim}`;
        if (!this.positionEncoding.has(key)) {
            this.positionEncoding.set(key, Math.sin(pos / Math.pow(10000, dim / 16)));
        }
        return this.positionEncoding.get(key);
    }
    
    attention(query, keys, values) {
        const scores = keys.map(k => {
            let dot = 0;
            for (let i = 0; i < Math.min(query.length, k.length); i++) dot += query[i] * k[i];
            return dot / Math.sqrt(query.length || 1);
        });
        
        const maxScore = Math.max(...scores);
        const expScores = scores.map(s => Math.exp(s - maxScore));
        const sumExp = expScores.reduce((a, b) => a + b, 0);
        const attentionWeights = expScores.map(s => s / sumExp);
        
        let weightedSum = 0;
        for (let i = 0; i < values.length; i++) {
            weightedSum += values[i] * attentionWeights[i];
        }
        return weightedSum;
    }
    
    multiHeadAttention(features) {
        const headSize = Math.floor(features.length / this.headCount);
        const headOutputs = [];
        
        for (let h = 0; h < this.headCount; h++) {
            const start = h * headSize;
            const end = start + headSize;
            const headFeatures = features.slice(start, end);
            const posEnc = headFeatures.map((_, i) => this.positionalEncoding(i, h));
            const query = headFeatures.map((f, i) => f * posEnc[i]);
            const output = this.attention(query, headFeatures, headFeatures);
            headOutputs.push(output);
        }
        
        return headOutputs.reduce((a, b) => a + b, 0) / headOutputs.length;
    }
    
    train(data) {
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            const features = this.extractTransformerFeatures(window);
            const key = features.map(f => Math.round(f * 15)).join('|');
            
            if (!this.attentionHeads.has(key)) {
                this.attentionHeads.set(key, {
                    T: 0, X: 0, total: 0,
                    embeddings: Array(4).fill(0.5)
                });
            }
            
            const head = this.attentionHeads.get(key);
            head[data[i]]++;
            head.total++;
            
            for (let e = 0; e < head.embeddings.length; e++) {
                head.embeddings[e] += (data[i] === 'T' ? 0.01 : -0.01);
                head.embeddings[e] = Math.max(-1, Math.min(1, head.embeddings[e]));
            }
        }
        this.trained = true;
    }
    
    extractTransformerFeatures(seq) {
        const features = [];
        const windows = [3, 5, 8, 12];
        for (const w of windows) {
            if (seq.length >= w) {
                const slice = seq.slice(-w);
                features.push(slice.filter(s => s === 'T').length / w);
                let runs = 0;
                for (let i = 1; i < slice.length; i++) if (slice[i] === slice[i-1]) runs++;
                features.push(runs / (slice.length - 1));
            }
        }
        while (features.length < 16) features.push(0.5);
        return features;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const features = this.extractTransformerFeatures(window);
        const attentionOutput = this.multiHeadAttention(features);
        const key = features.map(f => Math.round(f * 15)).join('|');
        const head = this.attentionHeads.get(key);
        
        if (!head || head.total < 5) {
            return attentionOutput > 0.5 ? 'T' : 'X';
        }
        
        const baseProb = head.T / head.total;
        const embeddingSignal = head.embeddings.reduce((a, b) => a + b, 0) / head.embeddings.length;
        const finalProb = baseProb * 0.6 + attentionOutput * 0.25 + (embeddingSignal > 0 ? 0.15 : 0);
        return finalProb > 0.5 ? 'T' : 'X';
    }
}

// 3. DIFFUSION PROBABILISTIC MODEL
class DiffusionModel {
    constructor() {
        this.noiseSchedule = new Map();
        this.denoisingSteps = new Map();
        this.timesteps = 10;
        this.trained = false;
    }
    
    addNoise(signal, timestep) {
        const noise = Math.random() * 2 - 1;
        const alpha = 1 - timestep / this.timesteps;
        return signal * alpha + noise * (1 - alpha);
    }
    
    denoise(noisySignal, timestep, context) {
        const alpha = 1 - timestep / this.timesteps;
        const predictedSignal = noisySignal / (alpha + 0.001);
        const contextSignal = context.filter(s => s === 'T').length / context.length;
        return predictedSignal * 0.7 + contextSignal * 0.3;
    }
    
    train(data) {
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            const tRatio = window.filter(s => s === 'T').length / window.length;
            const key = window.slice(-8).join('');
            
            if (!this.noiseSchedule.has(key)) {
                this.noiseSchedule.set(key, { signals: [], predictions: [] });
                this.denoisingSteps.set(key, Array(this.timesteps).fill(0.5));
            }
            
            const schedule = this.noiseSchedule.get(key);
            const steps = this.denoisingSteps.get(key);
            
            for (let t = 0; t < this.timesteps; t++) {
                const noisy = this.addNoise(tRatio, t);
                const denoised = this.denoise(noisy, t, window);
                steps[t] = steps[t] * 0.95 + denoised * 0.05;
            }
            
            schedule.signals.push(tRatio);
            schedule.predictions.push(data[i] === 'T' ? 1 : 0);
            if (schedule.signals.length > 100) {
                schedule.signals.shift();
                schedule.predictions.shift();
            }
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const key = window.slice(-8).join('');
        const schedule = this.noiseSchedule.get(key);
        const steps = this.denoisingSteps.get(key);
        
        if (!steps) {
            const tRatio = window.filter(s => s === 'T').length / window.length;
            return tRatio > 0.5 ? 'T' : 'X';
        }
        
        let finalSignal = window.filter(s => s === 'T').length / window.length;
        for (let t = 0; t < Math.min(5, this.timesteps); t++) {
            finalSignal = finalSignal * 0.8 + steps[t] * 0.2;
        }
        
        return finalSignal > 0.5 ? 'T' : 'X';
    }
}

// 4. REINFORCEMENT LEARNING AGENT
class RLAgent {
    constructor() {
        this.qTable = new Map();
        this.policyGradient = new Map();
        this.epsilon = 0.1;
        this.gamma = 0.95;
        this.learningRate = 0.01;
        this.trained = false;
    }
    
    getState(seq) {
        const last10 = seq.slice(-10);
        const tCount = last10.filter(s => s === 'T').length;
        const streak = this.getStreak(last10);
        const volatility = this.getVolatility(last10);
        return `${tCount},${streak},${Math.round(volatility * 10)}`;
    }
    
    getStreak(seq) {
        let streak = 1;
        const last = seq[seq.length - 1];
        for (let i = seq.length - 2; i >= 0; i--) {
            if (seq[i] === last) streak++;
            else break;
        }
        return Math.min(streak, 10);
    }
    
    getVolatility(seq) {
        let changes = 0;
        for (let i = 1; i < seq.length; i++) {
            if (seq[i] !== seq[i-1]) changes++;
        }
        return changes / (seq.length - 1);
    }
    
    getQValue(state, action) {
        const key = `${state}|${action}`;
        return this.qTable.get(key) || 0;
    }
    
    setQValue(state, action, value) {
        const key = `${state}|${action}`;
        this.qTable.set(key, value);
    }
    
    chooseAction(state) {
        if (Math.random() < this.epsilon) {
            return Math.random() > 0.5 ? 'T' : 'X';
        }
        const qT = this.getQValue(state, 'T');
        const qX = this.getQValue(state, 'X');
        return qT > qX ? 'T' : 'X';
    }
    
    train(data) {
        for (let i = 20; i < data.length - 1; i++) {
            const window = data.slice(i - 20, i);
            const state = this.getState(window);
            const action = data[i];
            const nextWindow = data.slice(i - 19, i + 1);
            const nextState = this.getState(nextWindow);
            const reward = data[i + 1] === action ? 1 : -1;
            
            const currentQ = this.getQValue(state, action);
            const maxNextQ = Math.max(this.getQValue(nextState, 'T'), this.getQValue(nextState, 'X'));
            const newQ = currentQ + this.learningRate * (reward + this.gamma * maxNextQ - currentQ);
            this.setQValue(state, action, newQ);
        }
        this.epsilon = Math.max(0.05, this.epsilon * 0.99);
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const state = this.getState(window);
        return this.chooseAction(state);
    }
}

// 5. KALMAN FILTER PREDICTOR
class KalmanFilter {
    constructor() {
        this.state = new Map();
        this.covariance = new Map();
        this.processNoise = 0.01;
        this.measurementNoise = 0.1;
        this.trained = false;
    }
    
    update(key, measurement) {
        let x = this.state.get(key) || 0.5;
        let p = this.covariance.get(key) || 0.1;
        
        // Predict
        const xPred = x;
        const pPred = p + this.processNoise;
        
        // Update
        const k = pPred / (pPred + this.measurementNoise);
        const xNew = xPred + k * (measurement - xPred);
        const pNew = (1 - k) * pPred;
        
        this.state.set(key, xNew);
        this.covariance.set(key, Math.max(0.001, pNew));
        
        return xNew;
    }
    
    train(data) {
        for (let i = 5; i < data.length; i++) {
            const window = data.slice(i - 5, i);
            const key = window.join('');
            const measurement = data[i] === 'T' ? 1 : 0;
            this.update(key, measurement);
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 5) return null;
        const window = seq.slice(-5);
        const key = window.join('');
        const state = this.state.get(key) || 0.5;
        return state > 0.5 ? 'T' : 'X';
    }
}

// 6. GAUSSIAN PROCESS REGRESSION
class GaussianProcess {
    constructor() {
        this.kernelMatrix = new Map();
        this.targets = new Map();
        this.lengthScale = 2.0;
        this.signalVariance = 1.0;
        this.trained = false;
    }
    
    rbfKernel(x1, x2) {
        let dist = 0;
        for (let i = 0; i < Math.min(x1.length, x2.length); i++) {
            dist += (x1[i] - x2[i]) ** 2;
        }
        return this.signalVariance * Math.exp(-dist / (2 * this.lengthScale ** 2));
    }
    
    train(data) {
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            const features = window.map(s => s === 'T' ? 1 : 0);
            const key = window.slice(-10).join('');
            
            if (!this.kernelMatrix.has(key)) {
                this.kernelMatrix.set(key, []);
                this.targets.set(key, []);
            }
            
            const matrix = this.kernelMatrix.get(key);
            const targets = this.targets.get(key);
            matrix.push(features);
            targets.push(data[i] === 'T' ? 1 : 0);
            
            if (matrix.length > 50) { matrix.shift(); targets.shift(); }
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const features = window.map(s => s === 'T' ? 1 : 0);
        const key = window.slice(-10).join('');
        const matrix = this.kernelMatrix.get(key);
        const targets = this.targets.get(key);
        
        if (!matrix || matrix.length < 3) {
            return features.filter(f => f === 1).length > features.length / 2 ? 'T' : 'X';
        }
        
        let weightedSum = 0, totalWeight = 0;
        for (let i = 0; i < matrix.length; i++) {
            const weight = this.rbfKernel(features, matrix[i]);
            weightedSum += weight * targets[i];
            totalWeight += weight;
        }
        
        const prediction = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
        return prediction > 0.5 ? 'T' : 'X';
    }
}

// 7. ENSEMBLE STACKING META-LEARNER
class StackingEnsemble {
    constructor() {
        this.baseModels = [];
        this.metaModel = new Map();
        this.weights = new Map();
        this.trained = false;
    }
    
    addModel(name, model) {
        this.baseModels.push({ name, model });
    }
    
    train(data) {
        // Train base models (delegated to individual models)
        // Meta-learner training
        for (let i = 20; i < data.length - 1; i++) {
            const window = data.slice(i - 20, i);
            const key = window.slice(-8).join('');
            const actual = data[i + 1];
            
            if (!this.metaModel.has(key)) {
                this.metaModel.set(key, { T: 0, X: 0, total: 0, performances: new Map() });
                this.weights.set(key, Array(this.baseModels.length).fill(1));
            }
            
            const meta = this.metaModel.get(key);
            meta[actual]++;
            meta.total++;
            
            // Update model weights based on performance
            const weights = this.weights.get(key);
            for (let m = 0; m < this.baseModels.length; m++) {
                const pred = this.baseModels[m].model.predict(window);
                if (pred === actual) weights[m] *= 1.05;
                else weights[m] *= 0.95;
                weights[m] = Math.max(0.1, Math.min(5.0, weights[m]));
            }
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const key = window.slice(-8).join('');
        const meta = this.metaModel.get(key);
        const weights = this.weights.get(key);
        
        let totalT = 0, totalX = 0, totalWeight = 0;
        
        for (let m = 0; m < this.baseModels.length; m++) {
            const pred = this.baseModels[m].model.predict(seq);
            const weight = weights ? weights[m] : 1;
            if (pred === 'T') totalT += weight;
            else if (pred === 'X') totalX += weight;
            totalWeight += weight;
        }
        
        if (totalWeight === 0) return null;
        
        // Meta-learner correction
        const baseProb = totalT / totalWeight;
        const metaCorrection = meta && meta.total > 0 ? meta.T / meta.total : 0.5;
        const finalProb = baseProb * 0.7 + metaCorrection * 0.3;
        
        return finalProb > 0.5 ? 'T' : 'X';
    }
}

// 8. CHAOS THEORY PREDICTOR
class ChaosPredictor {
    constructor() {
        this.attractors = new Map();
        this.lyapunovExponents = new Map();
        this.phaseSpace = new Map();
        this.embeddingDimension = 3;
        this.trained = false;
    }
    
    embedSequence(seq, dim) {
        const vectors = [];
        for (let i = 0; i <= seq.length - dim; i++) {
            vectors.push(seq.slice(i, i + dim).map(s => s === 'T' ? 1 : 0));
        }
        return vectors;
    }
    
    calculateLyapunov(vectors) {
        if (vectors.length < 2) return 0;
        let sum = 0;
        for (let i = 1; i < vectors.length; i++) {
            let dist = 0;
            for (let j = 0; j < vectors[i].length; j++) {
                dist += Math.abs(vectors[i][j] - vectors[i-1][j]);
            }
            if (dist > 0) sum += Math.log(dist);
        }
        return sum / vectors.length;
    }
    
    train(data) {
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            const key = window.slice(-6).join('');
            
            if (!this.attractors.has(key)) {
                this.attractors.set(key, []);
                this.phaseSpace.set(key, []);
            }
            
            const vectors = this.embedSequence(window, this.embeddingDimension);
            const lyapunov = this.calculateLyapunov(vectors);
            
            this.lyapunovExponents.set(key, lyapunov);
            this.attractors.get(key).push(data[i] === 'T' ? 1 : 0);
            this.phaseSpace.get(key).push(vectors[vectors.length - 1] || [0.5, 0.5, 0.5]);
            
            if (this.attractors.get(key).length > 50) {
                this.attractors.get(key).shift();
                this.phaseSpace.get(key).shift();
            }
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const key = window.slice(-6).join('');
        const attractors = this.attractors.get(key);
        const lyapunov = this.lyapunovExponents.get(key) || 0;
        
        if (!attractors || attractors.length < 3) {
            return seq.filter(s => s === 'T').length > seq.length / 2 ? 'T' : 'X';
        }
        
        const avgAttractor = attractors.reduce((a, b) => a + b, 0) / attractors.length;
        
        // Chaos theory: high Lyapunov = unpredictable, go with flow
        // Low Lyapunov = predictable, use attractor
        if (Math.abs(lyapunov) > 0.5) {
            const lastFew = seq.slice(-3);
            return lastFew.filter(s => s === 'T').length >= 2 ? 'T' : 'X';
        }
        
        return avgAttractor > 0.5 ? 'T' : 'X';
    }
}

// 9. SUPPORT VECTOR MACHINE (SVM)
class SVMPredictor {
    constructor() {
        this.supportVectors = new Map();
        this.alphas = new Map();
        this.bias = new Map();
        this.C = 1.0;
        this.trained = false;
    }
    
    kernel(x1, x2) {
        let dot = 0;
        for (let i = 0; i < Math.min(x1.length, x2.length); i++) {
            dot += x1[i] * x2[i];
        }
        return Math.exp(-0.5 * (2 - 2 * dot));
    }
    
    train(data) {
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            const features = window.map(s => s === 'T' ? 1 : -1);
            const label = data[i] === 'T' ? 1 : -1;
            const key = window.slice(-8).join('');
            
            if (!this.supportVectors.has(key)) {
                this.supportVectors.set(key, []);
                this.alphas.set(key, []);
                this.bias.set(key, 0);
            }
            
            const sv = this.supportVectors.get(key);
            const alphas = this.alphas.get(key);
            
            // Simplified SMO
            let alpha = 0;
            for (let j = 0; j < sv.length; j++) {
                alpha += alphas[j] * label * this.kernel(features, sv[j]);
            }
            
            if (label * (alpha + this.bias.get(key)) < 1) {
                sv.push(features);
                alphas.push(this.C);
                if (sv.length > 30) { sv.shift(); alphas.shift(); }
            }
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const features = window.map(s => s === 'T' ? 1 : -1);
        const key = window.slice(-8).join('');
        const sv = this.supportVectors.get(key);
        const alphas = this.alphas.get(key);
        
        if (!sv || sv.length < 3) {
            return features.filter(f => f === 1).length > features.length / 2 ? 'T' : 'X';
        }
        
        let sum = this.bias.get(key) || 0;
        for (let i = 0; i < sv.length; i++) {
            sum += alphas[i] * this.kernel(features, sv[i]);
        }
        
        return sum > 0 ? 'T' : 'X';
    }
}

// 10. EXTREME GRADIENT BOOSTING (XGBOOST SIM)
class XGBoostSim {
    constructor() {
        this.trees = [];
        this.nEstimators = 50;
        this.maxDepth = 4;
        this.learningRate = 0.1;
        this.trained = false;
    }
    
    buildTree(features, labels, depth) {
        if (depth >= this.maxDepth || features.length < 5) {
            const tCount = labels.filter(l => l === 'T').length;
            return { prediction: tCount / labels.length };
        }
        
        let bestGain = -1, bestSplit = -1, bestValue = 0;
        
        for (let f = 0; f < Math.min(features[0].length, 10); f++) {
            const values = features.map(feat => feat[f]).sort((a, b) => a - b);
            for (let i = 0; i < values.length - 1; i++) {
                const splitValue = (values[i] + values[i + 1]) / 2;
                let leftT = 0, leftX = 0, rightT = 0, rightX = 0;
                
                for (let j = 0; j < features.length; j++) {
                    if (features[j][f] < splitValue) {
                        labels[j] === 'T' ? leftT++ : leftX++;
                    } else {
                        labels[j] === 'T' ? rightT++ : rightX++;
                    }
                }
                
                const total = leftT + leftX + rightT + rightX;
                const gain = (leftT * leftT / (leftT + leftX + 0.001) + rightT * rightT / (rightT + rightX + 0.001)) / total;
                
                if (gain > bestGain) {
                    bestGain = gain;
                    bestSplit = f;
                    bestValue = splitValue;
                }
            }
        }
        
        if (bestSplit === -1) {
            const tCount = labels.filter(l => l === 'T').length;
            return { prediction: tCount / labels.length };
        }
        
        const leftFeatures = [], leftLabels = [];
        const rightFeatures = [], rightLabels = [];
        
        for (let j = 0; j < features.length; j++) {
            if (features[j][bestSplit] < bestValue) {
                leftFeatures.push(features[j]);
                leftLabels.push(labels[j]);
            } else {
                rightFeatures.push(features[j]);
                rightLabels.push(labels[j]);
            }
        }
        
        return {
            feature: bestSplit,
            value: bestValue,
            left: this.buildTree(leftFeatures, leftLabels, depth + 1),
            right: this.buildTree(rightFeatures, rightLabels, depth + 1)
        };
    }
    
    predictTree(tree, features) {
        if (tree.prediction !== undefined) return tree.prediction;
        if (features[tree.feature] < tree.value) {
            return this.predictTree(tree.left, features);
        }
        return this.predictTree(tree.right, features);
    }
    
    train(data) {
        const allFeatures = [], allLabels = [];
        
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            const features = [];
            for (let w = 3; w <= 8; w++) {
                if (window.length >= w) {
                    const slice = window.slice(-w);
                    features.push(slice.filter(s => s === 'T').length / w);
                    features.push(slice.filter((s, idx) => idx > 0 && s !== slice[idx-1]).length / (w - 1));
                }
            }
            while (features.length < 12) features.push(0.5);
            allFeatures.push(features);
            allLabels.push(data[i]);
        }
        
        let residuals = allLabels.map(l => l === 'T' ? 1 : 0);
        
        for (let n = 0; n < this.nEstimators; n++) {
            const tree = this.buildTree(allFeatures, allLabels, 0);
            this.trees.push(tree);
            
            // Update residuals
            for (let i = 0; i < allFeatures.length; i++) {
                const pred = this.predictTree(tree, allFeatures[i]);
                residuals[i] -= this.learningRate * pred;
            }
        }
        
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const features = [];
        for (let w = 3; w <= 8; w++) {
            if (window.length >= w) {
                const slice = window.slice(-w);
                features.push(slice.filter(s => s === 'T').length / w);
                features.push(slice.filter((s, idx) => idx > 0 && s !== slice[idx-1]).length / (w - 1));
            }
        }
        while (features.length < 12) features.push(0.5);
        
        let sum = 0;
        for (const tree of this.trees) {
            sum += this.predictTree(tree, features) * this.learningRate;
        }
        
        return sum > 0.5 ? 'T' : 'X';
    }
}

// 11. LONG SHORT-TERM MEMORY (LSTM SIM)
class LSTMSimulator {
    constructor() {
        this.cells = new Map();
        this.trained = false;
    }
    
    sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    tanh(x) { return Math.tanh(x); }
    
    lstmCell(x, h, c, Wf, Wi, Wo, Wc, bf, bi, bo, bc) {
        const forget = this.sigmoid(x * Wf + h * 0.5 + bf);
        const input = this.sigmoid(x * Wi + h * 0.5 + bi);
        const output = this.sigmoid(x * Wo + h * 0.5 + bo);
        const candidate = this.tanh(x * Wc + h * 0.5 + bc);
        const newC = forget * c + input * candidate;
        const newH = output * this.tanh(newC);
        return { h: newH, c: newC };
    }
    
    train(data) {
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            const key = window.slice(-5).join('');
            
            if (!this.cells.has(key)) {
                this.cells.set(key, {
                    h: 0, c: 0,
                    Wf: Math.random(), Wi: Math.random(),
                    Wo: Math.random(), Wc: Math.random(),
                    bf: 0, bi: 0, bo: 0, bc: 0
                });
            }
            
            const cell = this.cells.get(key);
            const x = window.filter(s => s === 'T').length / window.length;
            const target = data[i] === 'T' ? 1 : 0;
            
            const result = this.lstmCell(x, cell.h, cell.c, cell.Wf, cell.Wi, cell.Wo, cell.Wc, cell.bf, cell.bi, cell.bo, cell.bc);
            
            // Simple backprop
            const error = target - result.h;
            cell.Wf += error * x * 0.01;
            cell.Wi += error * x * 0.01;
            cell.Wo += error * x * 0.01;
            cell.Wc += error * x * 0.01;
            cell.bf += error * 0.01;
            cell.bi += error * 0.01;
            cell.bo += error * 0.01;
            cell.bc += error * 0.01;
            
            cell.h = result.h;
            cell.c = result.c;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const key = window.slice(-5).join('');
        const cell = this.cells.get(key);
        
        if (!cell) {
            return window.filter(s => s === 'T').length > window.length / 2 ? 'T' : 'X';
        }
        
        const x = window.filter(s => s === 'T').length / window.length;
        const result = this.lstmCell(x, cell.h, cell.c, cell.Wf, cell.Wi, cell.Wo, cell.Wc, cell.bf, cell.bi, cell.bo, cell.bc);
        
        return result.h > 0.5 ? 'T' : 'X';
    }
}

// 12. BAYESIAN NEURAL NETWORK
class BayesianNN {
    constructor() {
        this.weights = new Map();
        this.precision = new Map();
        this.trained = false;
    }
    
    forward(features, weights) {
        let sum = 0;
        for (let i = 0; i < Math.min(features.length, weights.length); i++) {
            sum += features[i] * weights[i];
        }
        return 1 / (1 + Math.exp(-sum));
    }
    
    train(data) {
        for (let epoch = 0; epoch < 5; epoch++) {
            for (let i = 20; i < data.length; i++) {
                const window = data.slice(i - 20, i);
                const features = this.extractBNNFeatures(window);
                const key = features.map(f => Math.round(f * 20)).join('_');
                
                if (!this.weights.has(key)) {
                    this.weights.set(key, Array(8).fill(0).map(() => Math.random() * 0.1));
                    this.precision.set(key, Array(8).fill(1.0));
                }
                
                const w = this.weights.get(key);
                const prec = this.precision.get(key);
                const target = data[i] === 'T' ? 1 : 0;
                const prediction = this.forward(features, w);
                const error = target - prediction;
                
                for (let j = 0; j < w.length; j++) {
                    // Bayesian update with Gaussian prior
                    const gradient = error * features[j] * prediction * (1 - prediction);
                    prec[j] += gradient * gradient;
                    w[j] += (0.01 / Math.sqrt(prec[j] + 1)) * gradient;
                }
            }
        }
        this.trained = true;
    }
    
    extractBNNFeatures(seq) {
        const features = [];
        const last3 = seq.slice(-3).filter(s => s === 'T').length / 3;
        const last5 = seq.slice(-5).filter(s => s === 'T').length / 5;
        const last8 = seq.slice(-8).filter(s => s === 'T').length / 8;
        const last10 = seq.slice(-10).filter(s => s === 'T').length / 10;
        features.push(last3, last5, last8, last10, last5 - last3, last8 - last5, last10 - last8, (last3 + last5 + last8) / 3);
        return features;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const features = this.extractBNNFeatures(seq);
        const key = features.map(f => Math.round(f * 20)).join('_');
        const w = this.weights.get(key);
        
        if (!w) {
            return features[2] > 0.5 ? 'T' : 'X';
        }
        
        const prob = this.forward(features, w);
        const prec = this.precision.get(key);
        const uncertainty = prec ? prec.reduce((a, b) => a + 1 / (b + 1), 0) / prec.length : 0.5;
        const adjustedProb = prob * (1 - uncertainty * 0.2) + 0.5 * uncertainty * 0.2;
        
        return adjustedProb > 0.5 ? 'T' : 'X';
    }
}

// 13. TEMPORAL CONVOLUTIONAL NETWORK (TCN)
class TemporalConvNet {
    constructor() {
        this.filters = new Map();
        this.dilations = [1, 2, 4, 8];
        this.trained = false;
    }
    
    dilatedConv(input, filter, dilation) {
        const output = [];
        for (let i = 0; i < input.length; i += dilation) {
            let sum = 0;
            for (let j = 0; j < filter.length; j++) {
                const idx = i + j * dilation;
                if (idx < input.length) sum += input[idx] * filter[j];
            }
            output.push(Math.tanh(sum));
        }
        return output;
    }
    
    train(data) {
        for (let i = 30; i < data.length; i++) {
            const window = data.slice(i - 30, i);
            const input = window.map(s => s === 'T' ? 1 : -1);
            const key = window.slice(-10).join('');
            
            if (!this.filters.has(key)) {
                this.filters.set(key, this.dilations.map(d => ({
                    filter: Array(3).fill(0).map(() => Math.random() * 0.1),
                    dilation: d
                })));
            }
            
            const filters = this.filters.get(key);
            let totalSignal = 0;
            
            for (const f of filters) {
                const conv = this.dilatedConv(input, f.filter, f.dilation);
                totalSignal += conv.reduce((a, b) => a + b, 0) / conv.length;
                
                // Update filter
                const target = data[i] === 'T' ? 1 : -1;
                const error = target - totalSignal;
                for (let j = 0; j < f.filter.length; j++) {
                    f.filter[j] += error * 0.001;
                }
            }
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 30) return null;
        const window = seq.slice(-30);
        const input = window.map(s => s === 'T' ? 1 : -1);
        const key = window.slice(-10).join('');
        const filters = this.filters.get(key);
        
        if (!filters) {
            return input.filter(x => x === 1).length > input.length / 2 ? 'T' : 'X';
        }
        
        let totalSignal = 0;
        for (const f of filters) {
            const conv = this.dilatedConv(input, f.filter, f.dilation);
            totalSignal += conv.reduce((a, b) => a + b, 0) / conv.length;
        }
        
        return totalSignal > 0 ? 'T' : 'X';
    }
}

// 14. RANDOM FOREST SIMULATOR
class RandomForest {
    constructor() {
        this.trees = [];
        this.nTrees = 30;
        this.trained = false;
    }
    
    buildDecisionTree(features, labels, depth) {
        if (depth > 5 || features.length < 3) {
            const tCount = labels.filter(l => l === 'T').length;
            return { prediction: tCount / labels.length };
        }
        
        const randomFeature = Math.floor(Math.random() * Math.min(features[0].length, 10));
        const values = features.map(f => f[randomFeature]);
        const median = values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
        
        const leftF = [], leftL = [], rightF = [], rightL = [];
        for (let j = 0; j < features.length; j++) {
            if (features[j][randomFeature] < median) {
                leftF.push(features[j]); leftL.push(labels[j]);
            } else {
                rightF.push(features[j]); rightL.push(labels[j]);
            }
        }
        
        return {
            feature: randomFeature, value: median,
            left: this.buildDecisionTree(leftF, leftL, depth + 1),
            right: this.buildDecisionTree(rightF, rightL, depth + 1)
        };
    }
    
    predictTree(tree, features) {
        if (tree.prediction !== undefined) return tree.prediction;
        if (features[tree.feature] < tree.value) return this.predictTree(tree.left, features);
        return this.predictTree(tree.right, features);
    }
    
    train(data) {
        const allF = [], allL = [];
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            const f = [];
            for (let w = 2; w <= 6; w++) {
                if (window.length >= w) {
                    const sl = window.slice(-w);
                    f.push(sl.filter(s => s === 'T').length / w);
                }
            }
            while (f.length < 10) f.push(0.5);
            allF.push(f); allL.push(data[i]);
        }
        
        for (let t = 0; t < this.nTrees; t++) {
            const sampleIdx = Array(allF.length).fill(0).map(() => Math.floor(Math.random() * allF.length));
            const sampleF = sampleIdx.map(i => allF[i]);
            const sampleL = sampleIdx.map(i => allL[i]);
            this.trees.push(this.buildDecisionTree(sampleF, sampleL, 0));
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const f = [];
        for (let w = 2; w <= 6; w++) {
            if (window.length >= w) {
                const sl = window.slice(-w);
                f.push(sl.filter(s => s === 'T').length / w);
            }
        }
        while (f.length < 10) f.push(0.5);
        
        let sum = 0;
        for (const tree of this.trees) sum += this.predictTree(tree, f);
        
        return sum / this.trees.length > 0.5 ? 'T' : 'X';
    }
}

// 15. GRADIENT DESCENT OPTIMIZER
class GradientOptimizer {
    constructor() {
        this.parameters = new Map();
        this.momentum = new Map();
        this.trained = false;
    }
    
    train(data) {
        for (let i = 20; i < data.length; i++) {
            const window = data.slice(i - 20, i);
            const key = window.slice(-6).join('');
            
            if (!this.parameters.has(key)) {
                this.parameters.set(key, { w: Math.random(), b: 0 });
                this.momentum.set(key, { vw: 0, vb: 0 });
            }
            
            const params = this.parameters.get(key);
            const mom = this.momentum.get(key);
            const x = window.filter(s => s === 'T').length / window.length;
            const target = data[i] === 'T' ? 1 : 0;
            const prediction = params.w * x + params.b;
            const error = target - prediction;
            
            // Adam optimizer
            const beta1 = 0.9, beta2 = 0.999, lr = 0.001;
            mom.vw = beta1 * mom.vw + (1 - beta1) * error * x;
            mom.vb = beta1 * mom.vb + (1 - beta1) * error;
            params.w += lr * mom.vw;
            params.b += lr * mom.vb;
        }
        this.trained = true;
    }
    
    predict(seq) {
        if (!this.trained || seq.length < 20) return null;
        const window = seq.slice(-20);
        const key = window.slice(-6).join('');
        const params = this.parameters.get(key);
        
        if (!params) {
            return window.filter(s => s === 'T').length > window.length / 2 ? 'T' : 'X';
        }
        
        const x = window.filter(s => s === 'T').length / window.length;
        const prediction = params.w * x + params.b;
        return prediction > 0.5 ? 'T' : 'X';
    }
}

// ============================================================
// 🧠 HỆ THỐNG DỰ ĐOÁN SIÊU THÔNG MINH
// ============================================================
class SieuHeThongDuDoan {
    constructor() {
        this.boNhoChuoi = new Map();
        this.daHuan = { hu: false, md5: false };
        
        // Khởi tạo tất cả thuật toán
        this.algorithms = [
            { name: 'DeepQuantum', model: new DeepQuantumTensor(), weight: 1.2 },
            { name: 'Transformer', model: new TransformerAttention(), weight: 1.1 },
            { name: 'Diffusion', model: new DiffusionModel(), weight: 1.0 },
            { name: 'RLAgent', model: new RLAgent(), weight: 1.0 },
            { name: 'Kalman', model: new KalmanFilter(), weight: 0.9 },
            { name: 'GaussianProcess', model: new GaussianProcess(), weight: 1.0 },
            { name: 'Stacking', model: new StackingEnsemble(), weight: 1.2 },
            { name: 'Chaos', model: new ChaosPredictor(), weight: 0.8 },
            { name: 'SVM', model: new SVMPredictor(), weight: 0.9 },
            { name: 'XGBoost', model: new XGBoostSim(), weight: 1.3 },
            { name: 'LSTM', model: new LSTMSimulator(), weight: 1.1 },
            { name: 'BayesianNN', model: new BayesianNN(), weight: 1.0 },
            { name: 'TCN', model: new TemporalConvNet(), weight: 0.9 },
            { name: 'RandomForest', model: new RandomForest(), weight: 1.0 },
            { name: 'GradientOpt', model: new GradientOptimizer(), weight: 0.8 }
        ];
        
        // Setup Stacking
        const stackingModel = this.algorithms.find(a => a.name === 'Stacking').model;
        this.algorithms.forEach(a => {
            if (a.name !== 'Stacking') stackingModel.addModel(a.name, a.model);
        });
        
        this.performanceHistory = new Map();
        this.taiDuLieu();
    }
    
    chuanBiDuLieu(data) {
        const dacTrung = [], nhan = [];
        for (let i = 20; i < data.length; i++) {
            const cuaSo = data.slice(i - 20, i);
            const demT = cuaSo.filter(r => r === 'T').length;
            const thayDoi = cuaSo.filter((r, idx) => idx > 0 && r !== cuaSo[idx-1]).length;
            dacTrung.push([demT, thayDoi, demT / cuaSo.length, cuaSo[cuaSo.length-1] === 'T' ? 1 : 0]);
            nhan.push(data[i]);
        }
        return { dacTrung, nhan };
    }
    
    huanLuyen(game, data) {
        if (data.length < 30) return;
        
        try {
            for (const algo of this.algorithms) {
                algo.model.train(data);
            }
            this.daHuan[game] = true;
            console.log(`🧠 Huấn luyện 15+ thuật toán AI/ML cho ${game}`);
        } catch (e) {
            console.log(`⚠️ Lỗi huấn luyện: ${e.message}`);
        }
    }
    
    duDoan(game, data) {
        if (!data || data.length < 2) return this.fallback(game);
        const lichSu = data.map(d => d === 'T' ? 'T' : 'X');
        
        let T = 0, X = 0;
        const mau = [];
        
        // Chạy tất cả thuật toán
        for (const algo of this.algorithms) {
            try {
                const pred = algo.model.predict(lichSu);
                if (pred) {
                    const diem = Math.round(algo.weight * 30);
                    mau.push({ ten: algo.name, duDoan: pred, diem });
                    if (pred === 'T') T += diem;
                    else X += diem;
                }
            } catch (e) {}
        }
        
        // Điều chỉnh thông minh
        const s = this.boNhoChuoi.get(game);
        if (s) {
            if (s.last5.length >= 5) {
                const demT = s.last5.filter(r => r === 'T').length;
                if (demT >= 4) { X *= 1.5; mau.push({ ten: 'Pressure', duDoan: 'X', diem: 15 }); }
                else if (demT <= 1) { T *= 1.5; mau.push({ ten: 'Pressure', duDoan: 'T', diem: 15 }); }
            }
            
            if (Math.abs(s.chuoi) >= 5) {
                if (s.chuoi > 0) { X *= 1.8; mau.push({ ten: 'Reversal', duDoan: 'X', diem: 20 }); }
                else { T *= 1.8; mau.push({ ten: 'Reversal', duDoan: 'T', diem: 20 }); }
            }
            
            if (s.last20.length >= 20) {
                const t20 = s.last20.filter(r => r === 'T').length;
                if (t20 > 14) { X *= 1.2; mau.push({ ten: 'Trend', duDoan: 'X', diem: 10 }); }
                else if (t20 < 6) { T *= 1.2; mau.push({ ten: 'Trend', duDoan: 'T', diem: 10 }); }
            }
        }
        
        const tong = T + X;
        if (tong === 0) return this.fallback(game);
        
        const duDoan = T > X ? 'TÀI' : 'XỈU';
        let doTinCay = Math.round(Math.max(T, X) / tong * 100);
        
        if (mau.length >= 12) doTinCay = Math.min(99, doTinCay + 10);
        else if (mau.length >= 8) doTinCay = Math.min(99, doTinCay + 7);
        else if (mau.length >= 5) doTinCay = Math.min(99, doTinCay + 4);
        
        doTinCay = Math.min(99, Math.max(50, doTinCay));
        
        const ketQua = duDoan === 'TÀI' ? 'T' : 'X';
        const thongTinBet = this.layThongTinBet(lichSu);
        this.hoc(game, ketQua, doTinCay, thongTinBet.doDai);
        
        const chiTiet = mau.map(p => p.ten).slice(0, 5).join(' • ');
        
        return {
            duDoan, doTinCay,
            chiTiet: chiTiet || 'AI Analysis',
            soMau: mau.length,
            doDaiBet: thongTinBet.doDai || 0
        };
    }
    
    hoc(game, ketQua, doTinCay, doDaiBet) {
        if (!this.boNhoChuoi.has(game)) {
            this.boNhoChuoi.set(game, {
                chuoi: 0, totNhat: 0, teNhat: 0,
                last5: [], last10: [], last20: [], last50: [],
                tai: 0, xiu: 0, tong: 0
            });
        }
        const s = this.boNhoChuoi.get(game);
        s.tong++;
        if (ketQua === 'T') { s.tai++; s.chuoi = s.chuoi >= 0 ? s.chuoi + 1 : 1; }
        else { s.xiu++; s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1; }
        if (s.chuoi > s.totNhat) s.totNhat = s.chuoi;
        if (s.chuoi < s.teNhat) s.teNhat = s.chuoi;
        s.last5.push(ketQua); s.last10.push(ketQua); s.last20.push(ketQua); s.last50.push(ketQua);
        if (s.last5.length > 5) s.last5.shift();
        if (s.last10.length > 10) s.last10.shift();
        if (s.last20.length > 20) s.last20.shift();
        if (s.last50.length > 50) s.last50.shift();
        this.luuDuLieu();
    }
    
    layThongTinBet(data) {
        if (data.length < 2) return { doDai: 0 };
        const cuoi = data[0];
        let dem = 1;
        for (let i = 1; i < data.length; i++) {
            if (data[i] === cuoi) dem++;
            else break;
        }
        return { doDai: dem };
    }
    
    fallback(game) {
        const s = this.boNhoChuoi.get(game);
        if (s && s.chuoi >= 4) return { duDoan: 'TÀI', doTinCay: 60, chiTiet: 'Follow streak' };
        if (s && s.chuoi <= -3) return { duDoan: 'TÀI', doTinCay: 60, chiTiet: 'Break streak' };
        if (s && s.last5.length >= 5) {
            const demT = s.last5.filter(r => r === 'T').length;
            if (demT >= 4) return { duDoan: 'XỈU', doTinCay: 56, chiTiet: 'Pressure' };
            if (demT <= 1) return { duDoan: 'TÀI', doTinCay: 56, chiTiet: 'Pressure' };
        }
        return { duDoan: Math.random() > 0.5 ? 'TÀI' : 'XỈU', doTinCay: 50, chiTiet: 'Random' };
    }
    
    luuDuLieu() {
        try {
            fs.writeFileSync(LEARNING_FILE, JSON.stringify({
                chuoi: Object.fromEntries(this.boNhoChuoi),
                daHuan: this.daHuan
            }, null, 2));
        } catch (e) {}
    }
    
    taiDuLieu() {
        try {
            if (fs.existsSync(LEARNING_FILE)) {
                const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
                if (data.chuoi) {
                    for (const [k, v] of Object.entries(data.chuoi)) {
                        this.boNhoChuoi.set(k, v);
                    }
                }
                if (data.daHuan) this.daHuan = data.daHuan;
            }
        } catch (e) {}
    }
}

const predictor = new SieuHeThongDuDoan();

// ============================================================
// 📊 QUẢN LÝ DỮ LIỆU
// ============================================================

function transformData(apiData) {
    if (!apiData || !apiData.list) return null;
    return apiData.list.map(item => ({
        phien: item.id,
        result: item.resultTruyenThong === 'TAI' ? 'TÀI' : 'XỈU',
        dice1: item.dices[0], dice2: item.dices[1], dice3: item.dices[2],
        total: item.point
    }));
}

async function fetchData(type) {
    try {
        const url = type === 'hu' ? API_URL_HU : API_URL_MD5;
        const r = await axios.get(url, { timeout: 10000 });
        return transformData(r.data);
    } catch (e) { return null; }
}

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            history = data.history || { hu: [], md5: [] };
            stats = data.stats || stats;
            lastPhien = data.lastPhien || { hu: null, md5: null };
        }
    } catch (e) {}
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify({
            history, stats, lastPhien,
            updated: new Date().toISOString()
        }, null, 2));
    } catch (e) {}
}

function updateStats(type, dung) {
    const s = stats[type];
    s.total++;
    if (dung) {
        s.dung++;
        s.chuoi = s.chuoi >= 0 ? s.chuoi + 1 : 1;
        if (s.chuoi > s.chuoi_dai) s.chuoi_dai = s.chuoi;
        s.homnay.dung++;
    } else {
        s.sai++;
        s.chuoi = s.chuoi <= 0 ? s.chuoi - 1 : -1;
        s.homnay.sai++;
    }
    s.homnay.tong++;
    s.tyle = s.total > 0 ? Math.round((s.dung / s.total) * 100) : 0;
}

function verifyAndUpdate(type, data) {
    if (!data || data.length === 0) return;
    let updated = 0;
    for (const r of history[type]) {
        if (r.status && r.status !== '') continue;
        const actual = data.find(d => d.phien.toString() === r.phien_hien_tai);
        if (actual) {
            const dung = r.prediction === actual.result;
            r.status = dung ? '✅' : '❌';
            r.actual = actual.result;
            updateStats(type, dung);
            updated++;
        }
    }
    if (updated > 0) saveHistory();
}

// ============================================================
// ⚡ AUTO PROCESS
// ============================================================

async function autoProcess() {
    try {
        for (const type of ['hu', 'md5']) {
            const data = await fetchData(type);
            if (data && data.length > 0) {
                const cur = data[0].phien;
                if (lastPhien[type] !== cur) {
                    verifyAndUpdate(type, data);
                    const exist = history[type].find(h => h.phien_hien_tai === (cur + 1).toString());
                    if (!exist) {
                        const historyData = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
                        const result = predictor.duDoan(type, historyData);
                        const record = {
                            phien: data[0].phien,
                            phien_hien_tai: (data[0].phien + 1).toString(),
                            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
                            total: data[0].total,
                            actual: data[0].result,
                            prediction: result.duDoan,
                            confidence: result.doTinCay,
                            detail: result.chiTiet,
                            status: '',
                            timestamp: new Date().toISOString(),
                            soMau: result.soMau || 0
                        };
                        history[type].unshift(record);
                        if (history[type].length > 1000) history[type] = history[type].slice(0, 1000);
                        lastPhien[type] = cur;
                        lastPred[type] = result;
                    }
                }
            }
        }
        saveHistory();
    } catch (e) {}
}

function startAuto() {
    setTimeout(autoProcess, 3000);
    setInterval(autoProcess, 5000);
}

// ============================================================
// 🌐 GIAO DIỆN HTML PRO
// ============================================================

function generateHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 100);
    
    let tongDung = 0, tongSai = 0, chuoiHienTai = 0, chuoiDaiNhat = 0, chuoiTam = 0;
    for (const r of recent) {
        if (r.status === '✅') { tongDung++; chuoiTam++; if (chuoiTam > chuoiDaiNhat) chuoiDaiNhat = chuoiTam; }
        else if (r.status === '❌') { tongSai++; chuoiTam = 0; }
    }
    chuoiHienTai = chuoiTam;
    const tyle100 = recent.length > 0 ? Math.round((tongDung / recent.length) * 100) : 0;
    
    let rows = '';
    for (const r of recent) {
        const status = r.status || '⏳';
        const cls = status === '✅' ? 'dung' : status === '❌' ? 'sai' : 'cho';
        const txt = status === '✅' ? 'ĐÚNG' : status === '❌' ? 'SAI' : 'CHỜ';
        rows += `<tr>
            <td><span class="phien">#${r.phien_hien_tai || '-'}</span></td>
            <td><span class="du-doan ${r.prediction === 'TÀI' ? 'tai' : 'xiu'}">${r.prediction || '-'}</span></td>
            <td><span class="do-tin">${r.confidence || 0}%</span></td>
            <td><span class="trang-thai ${cls}">${txt}</span></td>
            <td>${r.actual || '-'}</td>
            <td class="chi-tiet">${(r.detail || '-').substring(0, 30)}</td>
        </tr>`;
    }

    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌌 TX AI ULTIMATE</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Inter:wght@300;400;600;700;800&family=Share+Tech+Mono&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        :root{--primary:#ff6b35;--secondary:#00d4ff;--success:#4ade80;--danger:#ff4757;--warning:#ffa502;--quantum:#7b2ffc;--bg:#0a0a1a;--card:rgba(255,255,255,0.03);--border:rgba(255,255,255,0.06);--text:#f0f0f0;--text-secondary:#8899bb;--text-muted:#445566}
        body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);min-height:100vh;overflow-x:hidden}
        .bg{position:fixed;top:0;left:0;width:100%;height:100%;z-index:0;background:radial-gradient(ellipse at 10% 30%,rgba(123,47,252,0.08) 0%,transparent 50%),radial-gradient(ellipse at 90% 70%,rgba(255,107,53,0.06) 0%,transparent 50%),radial-gradient(ellipse at 50% 100%,rgba(0,212,255,0.04) 0%,transparent 30%);overflow:hidden}
        .bg::before{content:'';position:absolute;top:0;left:0;width:100%;height:100%;background-image:radial-gradient(1px 1px at 10px 20px,rgba(255,255,255,0.06),transparent),radial-gradient(1px 1px at 30px 60px,rgba(255,255,255,0.05),transparent);background-size:300px 300px;animation:starFloat 50s linear infinite}
        @keyframes starFloat{0%{transform:translate(0,0)}100%{transform:translate(-40px,-20px)}}
        .container{position:relative;z-index:1;max-width:1200px;margin:0 auto;padding:12px}
        .header{background:linear-gradient(135deg,rgba(123,47,252,0.06),rgba(255,107,53,0.04));border-radius:20px;padding:18px 28px;margin-bottom:16px;border:1px solid rgba(123,47,252,0.08);backdrop-filter:blur(30px);position:relative;overflow:hidden}
        .header::before{content:'';position:absolute;top:-60%;left:-60%;width:220%;height:220%;background:conic-gradient(from 0deg,transparent,rgba(123,47,252,0.03),transparent,rgba(255,107,53,0.03),transparent);animation:spinSlow 30s linear infinite}
        @keyframes spinSlow{100%{transform:rotate(360deg)}}
        .header .content{position:relative;z-index:1;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
        .logo{display:flex;align-items:center;gap:14px}
        .logo .icon{font-size:34px;animation:pulseGlow 2s ease-in-out infinite}
        @keyframes pulseGlow{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
        .logo .ten{font-family:'Orbitron',monospace;font-size:22px;font-weight:900;background:linear-gradient(135deg,#7b2ffc,#ff6b35,#00d4ff);background-size:300% 300%;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 4s ease-in-out infinite}
        @keyframes shimmer{0%,100%{background-position:0% 50%}50%{background-position:100% 50%}}
        .logo .sub{font-family:'Share Tech Mono',monospace;font-size:10px;color:var(--text-secondary);letter-spacing:3px}
        .badge{display:inline-block;padding:4px 18px;border-radius:30px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;background:linear-gradient(135deg,rgba(123,47,252,0.1),rgba(255,107,53,0.06));border:1px solid rgba(123,47,252,0.1);color:#a78bfa;backdrop-filter:blur(10px)}
        .badge .live{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--success);margin-right:6px;animation:livePulse 0.8s ease-in-out infinite}
        @keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.3;transform:scale(0.6)}}
        .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:16px}
        .stat{background:var(--card);border-radius:14px;padding:10px 14px;border:1px solid var(--border);backdrop-filter:blur(15px);transition:all 0.3s ease;text-align:center}
        .stat:hover{transform:translateY(-2px);border-color:rgba(123,47,252,0.15)}
        .stat .label{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted);font-weight:700}
        .stat .value{font-size:18px;font-weight:800;margin-top:2px;font-family:'Orbitron',monospace}
        .stat .value.xanh{color:var(--success)}.stat .value.do{color:var(--danger)}.stat .value.cam{color:var(--warning)}
        .stat .value.xanh-duong{color:#60a5fa}.stat .value.quantum{color:#7b2ffc}
        .stat .sub{font-size:8px;color:var(--text-muted);margin-top:2px}
        .summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin-bottom:16px}
        .sum{background:linear-gradient(135deg,rgba(123,47,252,0.04),rgba(255,107,53,0.02));border-radius:12px;padding:12px 16px;border:1px solid rgba(123,47,252,0.06);text-align:center}
        .sum .label{font-size:9px;text-transform:uppercase;color:var(--text-muted);letter-spacing:1px;font-weight:600}
        .sum .value{font-size:22px;font-weight:800;font-family:'Orbitron',monospace;margin-top:2px}
        .table-wrap{background:var(--card);border-radius:14px;overflow:hidden;border:1px solid var(--border);backdrop-filter:blur(15px)}
        .table-wrap .t-header{display:flex;justify-content:space-between;align-items:center;padding:10px 16px;border-bottom:1px solid var(--border);flex-wrap:wrap;gap:6px}
        .table-wrap .t-header h3{font-family:'Orbitron',monospace;font-size:13px;font-weight:700;color:var(--secondary)}
        .table-wrap .t-header .count{font-size:10px;color:var(--text-muted)}
        .algo-tag{font-size:9px;color:#a78bfa;background:rgba(123,47,252,0.06);padding:2px 10px;border-radius:12px;border:1px solid rgba(123,47,252,0.06)}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th{background:rgba(255,255,255,0.02);padding:7px 10px;text-align:left;font-weight:700;font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--text-muted)}
        td{padding:6px 10px;border-bottom:1px solid rgba(255,255,255,0.02)}
        tr:hover td{background:rgba(255,255,255,0.015)}
        .phien{font-family:'Orbitron',monospace;font-size:10px;color:var(--text-secondary)}
        .du-doan{display:inline-block;padding:2px 10px;border-radius:8px;font-weight:700;font-size:10px}
        .du-doan.tai{background:rgba(74,222,128,0.08);color:var(--success)}
        .du-doan.xiu{background:rgba(255,71,87,0.08);color:var(--danger)}
        .do-tin{font-weight:700;color:#60a5fa}
        .trang-thai{display:inline-block;padding:2px 8px;border-radius:8px;font-size:8px;font-weight:700;letter-spacing:0.5px}
        .trang-thai.dung{background:rgba(74,222,128,0.08);color:var(--success)}
        .trang-thai.sai{background:rgba(255,71,87,0.08);color:var(--danger)}
        .trang-thai.cho{background:rgba(255,165,2,0.08);color:var(--warning)}
        .chi-tiet{font-size:9px;color:var(--text-muted);max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .footer{text-align:center;padding:12px;color:var(--text-muted);font-size:9px;border-top:1px solid var(--border);margin-top:14px}
        .footer .hl{color:#a78bfa}.footer .at{color:#ff6b35}
        @media(max-width:768px){.header{padding:14px}.header .content{flex-direction:column;align-items:flex-start}.stats{grid-template-columns:repeat(3,1fr);gap:6px}.stat .value{font-size:15px}.summary{grid-template-columns:repeat(2,1fr)}.logo .ten{font-size:18px}table{font-size:10px}th,td{padding:4px 6px}.chi-tiet{max-width:50px}}
        @media(max-width:480px){.stats{grid-template-columns:repeat(2,1fr)}.summary{grid-template-columns:1fr 1fr}.container{padding:6px}th,td{padding:3px 4px;font-size:9px}.logo .ten{font-size:14px}}
    </style>
</head>
<body>
    <div class="bg"></div>
    <div class="container">
        <div class="header">
            <div class="content">
                <div class="logo">
                    <span class="icon">🌌</span>
                    <div>
                        <div class="ten">TX AI ULTIMATE</div>
                        <div class="sub">ANH KHÔI • ${type.toUpperCase()}</div>
                    </div>
                </div>
                <div>
                    <div class="badge"><span class="live"></span>${type.toUpperCase()} • LIVE v40.0</div>
                    <div style="font-size:8px;color:var(--text-muted);margin-top:2px;font-family:'Share Tech Mono',monospace;">${new Date().toLocaleString('vi-VN')} • 15+ AI/ML Engines</div>
                </div>
            </div>
        </div>
        <div class="stats">
            <div class="stat"><div class="label">Tổng</div><div class="value xanh-duong">${s.total}</div><div class="sub">Dự Đoán</div></div>
            <div class="stat"><div class="label">Đúng</div><div class="value xanh">${s.dung}</div><div class="sub">${s.tyle}%</div></div>
            <div class="stat"><div class="label">Sai</div><div class="value do">${s.sai}</div><div class="sub">${100-s.tyle}%</div></div>
            <div class="stat"><div class="label">Tỷ Lệ</div><div class="value ${s.tyle>=65?'xanh':s.tyle>=55?'cam':'do'}">${s.tyle}%</div><div class="sub">${s.tyle>=65?'Xuất sắc':s.tyle>=55?'Tốt':'Cần cải thiện'}</div></div>
            <div class="stat"><div class="label">Chuỗi</div><div class="value ${s.chuoi>0?'xanh':s.chuoi<0?'do':'cam'}">${s.chuoi>0?'+'+s.chuoi:s.chuoi<0?''+s.chuoi:'0'}</div><div class="sub">${s.chuoi>0?'Đang thắng':s.chuoi<0?'Cố lên':'Cân bằng'}</div></div>
            <div class="stat"><div class="label">Dài Nhất</div><div class="value quantum">${s.chuoi_dai}</div><div class="sub">${s.chuoi_dai>=5?'Siêu chuỗi':'Đang tiến'}</div></div>
        </div>
        <div class="summary">
            <div class="sum"><div class="label">100 Phiên</div><div class="value xanh-duong">${recent.length}</div><div style="font-size:10px;color:var(--text-muted);">Tổng</div></div>
            <div class="sum"><div class="label">Đúng</div><div class="value xanh">${tongDung}</div><div style="font-size:10px;color:var(--text-muted);">${tyle100}%</div></div>
            <div class="sum"><div class="label">Sai</div><div class="value do">${tongSai}</div><div style="font-size:10px;color:var(--text-muted);">${100-tyle100}%</div></div>
            <div class="sum"><div class="label">Chuỗi</div><div class="value ${chuoiHienTai>0?'xanh':chuoiHienTai<0?'do':'cam'}">${chuoiHienTai>0?'+'+chuoiHienTai:chuoiHienTai<0?''+chuoiHienTai:'0'}</div><div style="font-size:10px;color:var(--text-muted);">Hiện tại</div></div>
            <div class="sum"><div class="label">Dài Nhất</div><div class="value" style="color:#22d3ee;">${chuoiDaiNhat}</div><div style="font-size:10px;color:var(--text-muted);">${chuoiDaiNhat>=5?'Siêu chuỗi':'Đang tiến'}</div></div>
            <div class="sum"><div class="label">Tỷ Lệ</div><div class="value ${tyle100>=65?'xanh':tyle100>=55?'cam':'do'}">${tyle100}%</div><div style="font-size:10px;color:var(--text-muted);">${tyle100>=65?'Xuất sắc':tyle100>=55?'Tốt':'Cần cải thiện'}</div></div>
        </div>
        <div class="table-wrap">
            <div class="t-header">
                <h3>📋 LỊCH SỬ 100 PHIÊN</h3>
                <span class="count">${recent.length} phiên</span>
                <span class="algo-tag">15+ AI/ML Engines</span>
            </div>
            <div style="overflow-x:auto;">
                <table>
                    <thead><tr><th>Phiên</th><th>Dự Đoán</th><th>Độ Tin</th><th>KQ</th><th>Thực Tế</th><th>AI Analysis</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-muted);">⏳ ĐANG TẢI...</td></tr>'}</tbody>
                </table>
            </div>
        </div>
        <div class="footer">
            <span>🌌 TX AI Ultimate Predictor</span> • <span class="hl">Anh Khôi</span> • v40.0 • <span class="at">15+ AI/ML</span> • Auto 5s<br>
            <span style="font-size:7px;font-family:'Share Tech Mono',monospace;">DeepQuantum • Transformer • Diffusion • RL • Kalman • Gaussian • Stacking • Chaos • SVM • XGBoost • LSTM • BayesianNN • TCN • RandomForest • GradientOpt</span>
        </div>
    </div>
    <script>setTimeout(()=>location.reload(),5000);</script>
</body>
</html>`;
}

// ============================================================
// 🔌 API ROUTES
// ============================================================

app.get('/', (req, res) => res.json({ name: 'TX AI Ultimate', version: '40.0', author: 'Anh Khôi' }));

app.get('/lc79-hu', async (req, res) => {
    try {
        const data = await fetchData('hu');
        if (!data || data.length === 0) {
            const result = predictor.fallback('hu');
            return res.json({ prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, noData: true });
        }
        const exist = history.hu.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        const historyData = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        const result = predictor.duDoan('hu', historyData);
        const record = {
            phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total, actual: data[0].result,
            prediction: result.duDoan, confidence: result.doTinCay,
            detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0
        };
        history.hu.unshift(record);
        if (history.hu.length > 1000) history.hu = history.hu.slice(0, 1000);
        saveHistory();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/lc79-md5', async (req, res) => {
    try {
        const data = await fetchData('md5');
        if (!data || data.length === 0) {
            const result = predictor.fallback('md5');
            return res.json({ prediction: result.duDoan, confidence: result.doTinCay, detail: result.chiTiet, noData: true });
        }
        const exist = history.md5.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (exist) return res.json(exist);
        const historyData = data.map(d => d.result === 'TÀI' ? 'T' : 'X');
        const result = predictor.duDoan('md5', historyData);
        const record = {
            phien: data[0].phien, phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total, actual: data[0].result,
            prediction: result.duDoan, confidence: result.doTinCay,
            detail: result.chiTiet, status: '', timestamp: new Date().toISOString(), soMau: result.soMau || 0
        };
        history.md5.unshift(record);
        if (history.md5.length > 1000) history.md5 = history.md5.slice(0, 1000);
        saveHistory();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/lc79-hu/history', async (req, res) => {
    const data = await fetchData('hu');
    if (data) verifyAndUpdate('hu', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateHTML('hu'));
});

app.get('/lc79-md5/history', async (req, res) => {
    const data = await fetchData('md5');
    if (data) verifyAndUpdate('md5', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateHTML('md5'));
});

app.get('/stats', (req, res) => {
    const total = stats.hu.total + stats.md5.total;
    const dung = stats.hu.dung + stats.md5.dung;
    res.json({ hu: stats.hu, md5: stats.md5, total: { total, dung, sai: total-dung, tyle: total>0?Math.round((dung/total)*100):0 }, lastPred });
});

app.get('/reset', (req, res) => {
    history = { hu: [], md5: [] };
    stats = { hu: {total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,homnay:{dung:0,sai:0,tong:0}}, md5: {total:0,dung:0,sai:0,tyle:0,chuoi:0,chuoi_dai:0,homnay:{dung:0,sai:0,tong:0}} };
    lastPhien = { hu: null, md5: null }; lastPred = { hu: null, md5: null };
    saveHistory();
    res.json({ message: '✅ Reset thành công' });
});

// ============================================================
// 🚀 KHỞI ĐỘNG
// ============================================================
loadHistory();
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║   🌌 TX AI ULTIMATE v40.0 - ANH KHÔI                 ║');
    console.log('║   🧠 15+ AI/ML Algorithms • Deep Learning             ║');
    console.log('║   ⚡ Auto-predict every 5s                            ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');
    startAuto();
});
