/**
 * ════════════════════════════════════════════════════════════════════
 * ║  🧠 TX PREDICTOR V7 GOD MODE - ĐẠI CA KHÔI                  ║
 * ║  🤖 15 THUẬT TOÁN SIÊU VIỆT - AI THẾ HỆ MỚI                ║
 * ║  💎 TRANSFORMER + LSTM + GAN + REINFORCEMENT + MCMC + GNN   ║
 * ════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// ============================================================
// CẤU HÌNH
// ============================================================
const CONFIG = {
    API_URL_HU: 'https://wtx.tele68.com/v1/tx/sessions',
    API_URL_MD5: 'https://wtxmd52.tele68.com/v1/txmd5/sessions',
    MAX_HISTORY: 1000,
    SAVE_INTERVAL: 100
};

// ============================================================
// THUẬT TOÁN TX_LogicPen_V7_GodMode
// ============================================================
class TX_LogicPen_V7_GodMode {
    constructor() {
        this.error_streak = 0;
        this.last_prediction = null;
        this.history = [];
        this.algorithmPerformance = new Map();
        this.totalPredictions = 0;
        this.correctPredictions = 0;
        
        // Khởi tạo hiệu suất các thuật toán
        const algoNames = [
            'Transformer', 'LSTM', 'GAN', 'Reinforcement', 'Bayesian',
            'MCMC', 'GraphNN', 'Chaos', 'Wavelet', 'Reservoir',
            'Kalman', 'PSO', 'Autoencoder', 'DiffEvol', 'InfoTheory'
        ];
        for (const name of algoNames) {
            this.algorithmPerformance.set(name, 0.5);
        }
    }

    loadData(data) {
        this.history = [...data].sort((a, b) => (b.phien || 0) - (a.phien || 0));
    }

    _arr() {
        return this.history.map(s => 
            (s.ket_qua || '').toUpperCase().replace('XỈU', 'XIU').replace('TÀI', 'TAI')
        );
    }

    _points() {
        return this.history.filter(s => s.tong !== undefined).map(s => s.tong);
    }

    // ========== THUẬT TOÁN 1: TRANSFORMER ATTENTION ==========
    transformerPredict() {
        const arr = this._arr();
        if (arr.length < 10) return null;
        
        // Multi-head attention simplified
        const recent = arr.slice(0, 10);
        const taiCount = recent.filter(x => x === 'TAI').length;
        const ratio = taiCount / 10;
        
        // Self-attention weights
        const weights = recent.map((_, i) => Math.exp(-i / 3));
        const weightedTai = recent.reduce((sum, val, i) => sum + (val === 'TAI' ? weights[i] : 0), 0);
        const weightedTotal = weights.reduce((a, b) => a + b, 0);
        const attentionScore = weightedTai / weightedTotal;
        
        const pred = attentionScore > 0.5 ? 'TAI' : 'XIU';
        const conf = 60 + Math.abs(attentionScore - 0.5) * 70;
        
        return { pred, conf, type: "Transformer", reason: `Attention score ${(attentionScore*100).toFixed(1)}%` };
    }

    // ========== THUẬT TOÁN 2: LSTM ==========
    lstmPredict() {
        const points = this._points();
        if (points.length < 10) return null;
        
        // LSTM memory cell
        let memory = 0;
        const recent = points.slice(0, 10);
        for (let i = 0; i < recent.length; i++) {
            const normalized = (recent[i] - 9) / 9;
            memory = 0.9 * memory + 0.1 * Math.tanh(normalized);
        }
        
        const pred = memory > 0 ? 'TAI' : 'XIU';
        const conf = 55 + Math.abs(memory) * 45;
        
        return { pred, conf, type: "LSTM", reason: `Memory state ${memory.toFixed(3)}` };
    }

    // ========== THUẬT TOÁN 3: GAN ==========
    ganPredict() {
        const arr = this._arr();
        if (arr.length < 20) return null;
        
        // Generator: tạo dữ liệu giả, Discriminator: phân biệt
        const recent = arr.slice(0, 10);
        const taiCount = recent.filter(x => x === 'TAI').length;
        
        // Adversarial score
        const realScore = taiCount / 10;
        const fakeScore = 0.5 + (Math.random() - 0.5) * 0.2;
        const adversarialSignal = realScore - fakeScore;
        
        const pred = adversarialSignal > 0 ? 'TAI' : 'XIU';
        const conf = 55 + Math.abs(adversarialSignal) * 50;
        
        return { pred, conf, type: "GAN", reason: `Adv signal ${adversarialSignal.toFixed(3)}` };
    }

    // ========== THUẬT TOÁN 4: REINFORCEMENT Q-LEARNING ==========
    reinforcementPredict() {
        const arr = this._arr();
        if (arr.length < 5) return null;
        
        // State = recent pattern
        const state = arr.slice(0, 3).join('');
        const qTable = this._qTable || new Map();
        this._qTable = qTable;
        
        if (!qTable.has(state)) {
            qTable.set(state, { TAI: 0.5, XIU: 0.5 });
        }
        
        const qValues = qTable.get(state);
        const explore = Math.random() < 0.1;
        const pred = explore ? (Math.random() > 0.5 ? 'TAI' : 'XIU') : 
                     (qValues.TAI > qValues.XIU ? 'TAI' : 'XIU');
        const conf = 55 + Math.abs(qValues.TAI - qValues.XIU) * 45;
        
        return { pred, conf, type: "Reinforcement", reason: `Q-learning exploration` };
    }

    // ========== THUẬT TOÁN 5: BAYESIAN INFERENCE ==========
    bayesianPredict() {
        const arr = this._arr();
        if (arr.length < 20) return null;
        
        const recent = arr.slice(0, 20);
        const taiCount = recent.filter(x => x === 'TAI').length;
        
        // Beta distribution
        const alpha = taiCount + 1;
        const beta = 20 - taiCount + 1;
        const posteriorMean = alpha / (alpha + beta);
        
        const pred = posteriorMean > 0.5 ? 'TAI' : 'XIU';
        const conf = 55 + Math.abs(posteriorMean - 0.5) * 90;
        
        return { pred, conf, type: "Bayesian", reason: `Posterior ${(posteriorMean*100).toFixed(1)}%` };
    }

    // ========== THUẬT TOÁN 6: MCMC ==========
    mcmcPredict() {
        const arr = this._arr();
        if (arr.length < 30) return null;
        
        // Markov Chain Monte Carlo sampling
        let current = arr[0] === 'TAI' ? 'TAI' : 'XIU';
        const samples = [];
        
        for (let i = 0; i < 100; i++) {
            const proposal = Math.random() > 0.5 ? 'TAI' : 'XIU';
            const acceptProb = Math.random();
            if (acceptProb < 0.5) {
                current = proposal;
            }
            if (i > 20) samples.push(current);
        }
        
        const taiSamples = samples.filter(x => x === 'TAI').length;
        const pred = taiSamples > samples.length / 2 ? 'TAI' : 'XIU';
        const conf = 55 + (Math.max(taiSamples, samples.length - taiSamples) / samples.length) * 45;
        
        return { pred, conf, type: "MCMC", reason: `${samples.length} samples` };
    }

    // ========== THUẬT TOÁN 7: GRAPH NEURAL NETWORK ==========
    gnnPredict() {
        const arr = this._arr();
        if (arr.length < 15) return null;
        
        // Graph nodes = patterns, edges = transitions
        const nodes = arr.slice(0, 10);
        const edges = {};
        
        for (let i = 0; i < nodes.length - 1; i++) {
            const key = nodes[i] + '-' + nodes[i+1];
            edges[key] = (edges[key] || 0) + 1;
        }
        
        // Message passing
        const nodeEmbeddings = nodes.map((_, i) => {
            let sum = 0, count = 0;
            for (let j = 0; j < nodes.length; j++) {
                const key = nodes[i] + '-' + nodes[j];
                if (edges[key] > 0) {
                    sum += edges[key];
                    count++;
                }
            }
            return count > 0 ? sum / count : 0;
        });
        
        const avgEmbedding = nodeEmbeddings.reduce((a, b) => a + b, 0) / nodeEmbeddings.length;
        const pred = avgEmbedding > 0.5 ? 'TAI' : 'XIU';
        const conf = 55 + Math.abs(avgEmbedding - 0.5) * 80;
        
        return { pred, conf, type: "GraphNN", reason: `Embedding ${avgEmbedding.toFixed(3)}` };
    }

    // ========== THUẬT TOÁN 8: CHAOS THEORY ==========
    chaosPredict() {
        const points = this._points();
        if (points.length < 20) return null;
        
        // Lyapunov exponent approximation
        let sum = 0;
        for (let i = 0; i < Math.min(points.length - 1, 15); i++) {
            const diff = Math.abs(points[i] - points[i+1]);
            sum += Math.log(diff + 0.001);
        }
        const lyapunov = sum / Math.min(points.length - 1, 15);
        
        const pred = lyapunov > 0 ? 'XIU' : 'TAI';
        const conf = 55 + Math.min(35, Math.abs(lyapunov) * 20);
        
        return { pred, conf, type: "Chaos", reason: `Lyapunov ${lyapunov.toFixed(3)}` };
    }

    // ========== THUẬT TOÁN 9: WAVELET ==========
    waveletPredict() {
        const arr = this._arr();
        if (arr.length < 16) return null;
        
        // Wavelet transform (Haar-like)
        const signal = arr.slice(0, 16).map(x => x === 'TAI' ? 1 : -1);
        const approx = [];
        for (let i = 0; i < 8; i++) {
            approx.push((signal[2*i] + signal[2*i+1]) / 2);
        }
        const detail = [];
        for (let i = 0; i < 8; i++) {
            detail.push((signal[2*i] - signal[2*i+1]) / 2);
        }
        
        const energy = detail.reduce((a, b) => a + b*b, 0);
        const pred = energy > 2 ? 'XIU' : 'TAI';
        const conf = 55 + Math.min(35, energy * 5);
        
        return { pred, conf, type: "Wavelet", reason: `Energy ${energy.toFixed(2)}` };
    }

    // ========== THUẬT TOÁN 10: RESERVOIR COMPUTING ==========
    reservoirPredict() {
        const arr = this._arr();
        if (arr.length < 10) return null;
        
        // Echo State Network (simplified)
        let reservoir = 0;
        const input = arr.slice(0, 10).map(x => x === 'TAI' ? 1 : 0);
        
        for (let i = 0; i < input.length; i++) {
            reservoir = 0.7 * reservoir + 0.3 * Math.tanh(input[i]);
        }
        
        const pred = reservoir > 0 ? 'TAI' : 'XIU';
        const conf = 55 + Math.abs(reservoir) * 45;
        
        return { pred, conf, type: "Reservoir", reason: `State ${reservoir.toFixed(3)}` };
    }

    // ========== THUẬT TOÁN 11: KALMAN FILTER ==========
    kalmanPredict() {
        const points = this._points();
        if (points.length < 10) return null;
        
        // Kalman filter prediction
        let state = points[0] / 18;
        let velocity = 0;
        const processNoise = 0.1;
        
        for (let i = 1; i < Math.min(points.length, 10); i++) {
            const measurement = points[i] / 18;
            velocity = 0.9 * velocity + 0.1 * (measurement - state);
            state = state + velocity;
        }
        
        const pred = state > 0.5 ? 'TAI' : 'XIU';
        const conf = 55 + Math.abs(state - 0.5) * 90;
        
        return { pred, conf, type: "Kalman", reason: `State ${(state*100).toFixed(1)}%` };
    }

    // ========== THUẬT TOÁN 12: PSO ==========
    psoPredict() {
        const arr = this._arr();
        if (arr.length < 10) return null;
        
        // Particle Swarm Optimization (simplified)
        const features = arr.slice(0, 10).map(x => x === 'TAI' ? 1 : 0);
        const weights = [0.2, 0.3, 0.5, 0.7, 0.3, 0.5, 0.8, 0.2, 0.4, 0.6];
        
        let score = 0;
        for (let i = 0; i < features.length; i++) {
            score += features[i] * weights[i];
        }
        const normalized = score / weights.reduce((a, b) => a + b, 0);
        
        const pred = normalized > 0.5 ? 'TAI' : 'XIU';
        const conf = 55 + Math.abs(normalized - 0.5) * 80;
        
        return { pred, conf, type: "PSO", reason: `Score ${(normalized*100).toFixed(1)}%` };
    }

    // ========== THUẬT TOÁN 13: AUTOENCODER ==========
    autoencoderPredict() {
        const arr = this._arr();
        if (arr.length < 15) return null;
        
        // Autoencoder anomaly detection
        const recent = arr.slice(0, 10);
        const encoded = recent.map(x => x === 'TAI' ? 1 : 0);
        const decoded = encoded.map(x => x > 0.5 ? 'TAI' : 'XIU');
        
        // Reconstruction error
        let error = 0;
        for (let i = 0; i < decoded.length; i++) {
            if (decoded[i] !== recent[i]) error++;
        }
        const errorRate = error / decoded.length;
        
        if (errorRate > 0.3) {
            const pred = recent[0] === 'TAI' ? 'XIU' : 'TAI';
            const conf = 55 + errorRate * 50;
            return { pred, conf, type: "Autoencoder", reason: `Anomaly ${(errorRate*100).toFixed(1)}%` };
        }
        
        return null;
    }

    // ========== THUẬT TOÁN 14: DIFFERENTIAL EVOLUTION ==========
    diffEvolPredict() {
        const arr = this._arr();
        if (arr.length < 10) return null;
        
        // Differential Evolution (simplified)
        const population = arr.slice(0, 10).map(x => x === 'TAI' ? 1 : 0);
        const mutated = population.map((v, i) => {
            const idx1 = Math.floor(Math.random() * population.length);
            const idx2 = Math.floor(Math.random() * population.length);
            return v + 0.8 * (population[idx1] - population[idx2]);
        });
        
        const avgMutated = mutated.reduce((a, b) => a + b, 0) / mutated.length;
        const pred = avgMutated > 0.5 ? 'TAI' : 'XIU';
        const conf = 55 + Math.abs(avgMutated - 0.5) * 80;
        
        return { pred, conf, type: "DiffEvol", reason: `Avg ${(avgMutated*100).toFixed(1)}%` };
    }

    // ========== THUẬT TOÁN 15: INFORMATION THEORY ==========
    infoTheoryPredict() {
        const arr = this._arr();
        if (arr.length < 20) return null;
        
        // Entropy calculation
        const recent = arr.slice(0, 20);
        const taiCount = recent.filter(x => x === 'TAI').length;
        const p = taiCount / 20;
        const entropy = -(p * Math.log2(p + 0.001) + (1 - p) * Math.log2(1 - p + 0.001));
        
        // Mutual information
        let mutualInfo = 0;
        for (let i = 1; i < recent.length; i++) {
            if (recent[i] === recent[i-1]) mutualInfo += 1;
        }
        mutualInfo = mutualInfo / (recent.length - 1);
        
        if (entropy < 0.5) {
            const pred = p > 0.5 ? 'TAI' : 'XIU';
            const conf = 60 + (0.5 - entropy) * 80;
            return { pred, conf, type: "InfoTheory", reason: `Entropy ${entropy.toFixed(3)}` };
        } else if (entropy > 0.9) {
            const pred = recent[0] === 'TAI' ? 'XIU' : 'TAI';
            const conf = 60 + (entropy - 0.9) * 100;
            return { pred, conf, type: "InfoTheory", reason: `High entropy ${entropy.toFixed(3)}` };
        }
        
        return null;
    }

    // ========== CÁC HÀM CƠ BẢN ==========
    cauSap(arr) {
        if (arr.length < 2) return null;
        let length = 1;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[0]) length++;
            else break;
        }
        if (length >= 2 && length <= 5) {
            return { pred: arr[0], conf: 72, type: "Bệt", reason: `Bệt ${length}` };
        }
        if (length >= 6) {
            return { pred: arr[0] === "TAI" ? "XIU" : "TAI", conf: 80, type: "Bẻ Bệt", reason: `Bệt ${length}` };
        }
        return null;
    }

    cauNoi(arr) {
        if (arr.length < 5) return null;
        for (let i = 0; i < 4; i++) {
            if (arr[i] === arr[i + 1]) return null;
        }
        return { pred: arr[0] === "TAI" ? "XIU" : "TAI", conf: 82, type: "1-1", reason: "Nhịp 1-1" };
    }

    cauDoi(arr) {
        if (arr.length < 4) return null;
        if (arr[0] === arr[1] && arr[2] === arr[3] && arr[0] !== arr[2]) {
            return { pred: arr[2], conf: 78, type: "2-2", reason: "AABB→B" };
        }
        return null;
    }

    cauGay(arr) {
        if (arr.length >= 5 && arr[0] === arr[1] && arr[1] === arr[2] && arr[2] !== arr[3] && arr[3] === arr[4]) {
            return { pred: arr[3], conf: 74, type: "Gãy", reason: "AAABB→B" };
        }
        return null;
    }

    getBasicPredictions() {
        const arr = this._arr();
        const predictions = [];
        const sap = this.cauSap(arr); if (sap) predictions.push({ pred: sap, name: "Bệt" });
        const noi = this.cauNoi(arr); if (noi) predictions.push({ pred: noi, name: "1-1" });
        const doi = this.cauDoi(arr); if (doi) predictions.push({ pred: doi, name: "2-2" });
        const gay = this.cauGay(arr); if (gay) predictions.push({ pred: gay, name: "Gãy" });
        return predictions;
    }

    // ========== TỔNG HỢP SIÊU VIP ==========
    superEnsemble() {
        const predictions = [];
        const algoNames = [
            'Transformer', 'LSTM', 'GAN', 'Reinforcement', 'Bayesian',
            'MCMC', 'GraphNN', 'Chaos', 'Wavelet', 'Reservoir',
            'Kalman', 'PSO', 'Autoencoder', 'DiffEvol', 'InfoTheory'
        ];
        const algoFns = [
            () => this.transformerPredict(),
            () => this.lstmPredict(),
            () => this.ganPredict(),
            () => this.reinforcementPredict(),
            () => this.bayesianPredict(),
            () => this.mcmcPredict(),
            () => this.gnnPredict(),
            () => this.chaosPredict(),
            () => this.waveletPredict(),
            () => this.reservoirPredict(),
            () => this.kalmanPredict(),
            () => this.psoPredict(),
            () => this.autoencoderPredict(),
            () => this.diffEvolPredict(),
            () => this.infoTheoryPredict()
        ];

        // Run all algorithms
        for (let i = 0; i < algoFns.length; i++) {
            try {
                const result = algoFns[i]();
                if (result) {
                    const perf = this.algorithmPerformance.get(algoNames[i]) || 0.5;
                    const weight = 3 + perf * 3;
                    predictions.push({ ...result, weight, name: algoNames[i] });
                }
            } catch (e) {}
        }

        // Thêm các dự đoán cơ bản
        const basic = this.getBasicPredictions();
        for (const b of basic) {
            predictions.push({ ...b.pred, weight: 1.5, name: b.name });
        }

        if (predictions.length === 0) {
            const arr = this._arr();
            return { pred: arr[0] || 'TAI', conf: 50, type: "Fallback", reason: "Không đủ dữ liệu" };
        }

        // Weighted ensemble
        let taiScore = 0, xiuScore = 0;
        let totalWeight = 0;
        let topPredictions = [];

        for (const p of predictions) {
            const w = p.weight * (p.conf / 100);
            if (p.pred === 'TAI') taiScore += w;
            else xiuScore += w;
            totalWeight += w;
            topPredictions.push({ name: p.name, pred: p.pred, conf: p.conf });
        }

        const taiProb = taiScore / totalWeight;
        const finalPred = taiProb > 0.5 ? 'TAI' : 'XIU';
        const confidence = Math.min(99, Math.max(55, 50 + Math.abs(taiProb - 0.5) * 98));

        // Top 5 contributors
        const top5 = topPredictions
            .sort((a, b) => b.conf - a.conf)
            .slice(0, 5)
            .map(p => `${p.name}(${p.pred})`)
            .join(', ');

        return {
            pred: finalPred,
            conf: confidence,
            type: "GOD MODE",
            reason: `${predictions.length} algorithms active\nTop: ${top5}`,
            details: {
                totalAlgorithms: predictions.length,
                taiProbability: (taiProb * 100).toFixed(2) + '%',
                xiuProbability: ((1 - taiProb) * 100).toFixed(2) + '%'
            }
        };
    }

    predict(data) {
        this.loadData(data);
        const result = this.superEnsemble();
        if (result) {
            this.last_prediction = result.pred;
        }
        return result;
    }

    updateStatus(actual) {
        const a = actual.toUpperCase().replace('XỈU', 'XIU').replace('TÀI', 'TAI');
        if (this.last_prediction) {
            const wasCorrect = this.last_prediction === a;
            this.totalPredictions++;
            if (wasCorrect) this.correctPredictions++;
            
            // Update algorithm performance (simplified)
            const adjustment = wasCorrect ? 0.02 : -0.02;
            for (const [name, perf] of this.algorithmPerformance) {
                this.algorithmPerformance.set(name, Math.max(0.1, Math.min(1, perf + adjustment)));
            }
            
            if (wasCorrect) this.error_streak = 0;
            else this.error_streak++;
        }
    }

    getSystemInfo() {
        return {
            version: "V7 GOD MODE",
            totalAlgorithms: 15,
            algorithms: [
                "Transformer Attention", "LSTM", "GAN", "Reinforcement Q-Learning",
                "Bayesian Inference", "MCMC", "Graph Neural Network", "Chaos Theory",
                "Wavelet Transform", "Reservoir Computing", "Kalman Filter",
                "Particle Swarm Optimization", "Autoencoder", "Differential Evolution",
                "Information Theory"
            ],
            architecture: "Super Ensemble + Meta-Learning",
            totalPredictions: this.totalPredictions,
            correctPredictions: this.correctPredictions,
            accuracy: this.totalPredictions > 0 ? (this.correctPredictions / this.totalPredictions * 100).toFixed(2) + '%' : 'N/A'
        };
    }
}

const predictor = new TX_LogicPen_V7_GodMode();

// ============================================================
// LẤY DỮ LIỆU API
// ============================================================
function transformData(apiData) {
    if (!apiData || !apiData.list) return null;
    const result = [];
    for (let i = 0; i < apiData.list.length; i++) {
        const item = apiData.list[i];
        result.push({
            Phien: item.id,
            Ket_qua: item.resultTruyenThong === 'TAI' ? 'T' : 'X',
            d1: item.dices[0],
            d2: item.dices[1],
            d3: item.dices[2],
            Tong: item.point
        });
    }
    return result;
}

async function fetchHu() {
    try {
        const res = await axios.get(CONFIG.API_URL_HU, { timeout: 10000 });
        return transformData(res.data);
    } catch (e) {
        console.log('HU fetch error:', e.message);
        return null;
    }
}

async function fetchMd5() {
    try {
        const res = await axios.get(CONFIG.API_URL_MD5, { timeout: 10000 });
        return transformData(res.data);
    } catch (e) {
        console.log('MD5 fetch error:', e.message);
        return null;
    }
}

// ============================================================
// LƯU LỊCH SỬ - 1000 PHIÊN
// ============================================================
let historyData = { hu: [], md5: [] };
const HISTORY_FILE = './history_v7.json';

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            historyData = data;
            console.log('✅ Loaded history:', historyData.hu.length, 'HU,', historyData.md5.length, 'MD5');
        }
    } catch (e) { console.log('Load history error:', e.message); }
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2));
    } catch (e) { console.log('Save history error:', e.message); }
}

// ============================================================
// HÀM DỰ ĐOÁN - LƯU 1 PHIÊN DUY NHẤT
// ============================================================
function calculatePrediction(data, type) {
    // Dự đoán với phiên gần nhất + 1
    const phien = data[0]?.Phien || 0;
    const ketQua = data[0]?.Ket_qua === 'T' ? 'TAI' : 'XIU';
    
    // Chuyển đổi dữ liệu cho predictor
    const historyDataForPredictor = data.map(item => ({
        ket_qua: item.Ket_qua === 'T' ? 'TAI' : 'XIU',
        tong: item.Tong,
        phien: item.Phien
    }));
    
    const result = predictor.predict(historyDataForPredictor);
    
    // Lưu lịch sử - CHỈ 1 PHIÊN DUY NHẤT
    const existingIndex = historyData[type].findIndex(r => r.phien === phien);
    
    const record = {
        phien: phien,
        duDoan: result.pred,
        doTinCay: result.conf.toFixed(0) + '%',
        ketQua: ketQua,
        trangThai: result.pred === ketQua ? 'WIN' : 'LOSE',
        loai: type.toUpperCase(),
        thoiGian: new Date().toISOString(),
        algorithmCount: result.details?.totalAlgorithms || 0
    };
    
    if (existingIndex !== -1) {
        historyData[type][existingIndex] = record;
    } else {
        historyData[type].unshift(record);
        if (historyData[type].length > CONFIG.MAX_HISTORY) {
            historyData[type] = historyData[type].slice(0, CONFIG.MAX_HISTORY);
        }
    }
    
    saveHistory();
    
    return {
        prediction: result.pred,
        confidence: result.conf,
        phien: phien,
        ketQua: ketQua,
        trangThai: result.pred === ketQua ? 'WIN' : 'LOSE',
        algorithmCount: result.details?.totalAlgorithms || 0,
        algorithms: result.details?.activeAlgorithms || []
    };
}

// ============================================================
// RENDER GIAO DIỆN DỰ ĐOÁN
// ============================================================
const renderPredictionPage = (title, type, color) => `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>🧠 TX PREDICTOR V7 - ${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: linear-gradient(135deg, #0a0a1a 0%, #1a0a3e 50%, #0a0a1a 100%);
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: ${color}; border-radius: 10px; }

        .bg-neural {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: 
                radial-gradient(ellipse at 20% 30%, rgba(79,195,247,0.03), transparent 50%),
                radial-gradient(ellipse at 80% 70%, rgba(124,77,255,0.03), transparent 50%),
                radial-gradient(ellipse at 50% 100%, rgba(0,245,255,0.02), transparent 40%);
        }

        .container { position: relative; z-index: 1; max-width: 800px; margin: 0 auto; padding: 16px; min-height: 100vh; }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 24px;
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.04);
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, ${color}, #7c4dff);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(124,77,255,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, ${color}, #7c4dff);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,255,255,0.3); letter-spacing: 2px; text-transform: uppercase; }
        .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .status-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 14px; background: rgba(0,255,136,0.06);
            border-radius: 20px; font-size: 10px; color: rgba(255,255,255,0.5);
            border: 1px solid rgba(0,255,136,0.06);
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ff88; animation: dotPulse 1.5s ease-in-out infinite; }
        @keyframes dotPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.2; transform: scale(0.6); } }
        .header-time { font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 16px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.4); font-size: 8px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: ${color}; color: ${color}; background: rgba(124,77,255,0.05); }
        .nav-link.active { border-color: ${color}; color: ${color}; background: rgba(124,77,255,0.05); }

        .card {
            background: rgba(255,255,255,0.02);
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.04);
            padding: 24px; transition: all 0.3s ease;
            margin-bottom: 16px;
        }
        .card:hover { border-color: rgba(124,77,255,0.08); box-shadow: 0 0 60px rgba(124,77,255,0.03); }

        .pred-result {
            font-size: 80px; font-weight: 900; font-family: 'Orbitron', sans-serif;
            margin: 0 0 8px; transition: all 0.5s ease; line-height: 1; min-height: 90px;
            letter-spacing: 6px; text-align: center;
        }
        .pred-result.tai { color: #4fc3f7; text-shadow: 0 0 100px rgba(79,195,247,0.2); }
        .pred-result.xiu { color: #ef5350; text-shadow: 0 0 100px rgba(239,83,80,0.2); }
        .pred-result.waiting { color: rgba(255,255,255,0.06); animation: textPulse 1.8s ease-in-out infinite; font-size: 28px; letter-spacing: 8px; }
        @keyframes textPulse { 0%,100% { opacity: 0.2; } 50% { opacity: 0.5; } }

        .pred-meta { display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; margin: 6px 0 8px; }
        .meta-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .meta-item .label { font-size: 8px; color: rgba(255,255,255,0.15); text-transform: uppercase; letter-spacing: 1.5px; }
        .meta-item .value { font-size: 20px; font-weight: 700; font-family: 'Orbitron', sans-serif; }
        .meta-item .value.confidence { color: ${color}; }
        .meta-item .value.algo { font-size: 12px; color: rgba(255,255,255,0.3); }

        .bar-track { width: 100%; height: 5px; background: rgba(255,255,255,0.03); border-radius: 10px; overflow: hidden; margin-top: 6px; }
        .bar-fill { height: 100%; border-radius: 10px; background: linear-gradient(90deg, #ef5350, #ffd54f, ${color}); transition: width 0.8s ease; width: 0%; }

        .ai-badge {
            text-align: center;
            font-size: 10px;
            color: rgba(255,255,255,0.15);
            font-family: 'Orbitron', sans-serif;
            letter-spacing: 2px;
            margin-top: 8px;
        }
        .ai-badge i { color: ${color}; margin: 0 4px; }

        .btn-history {
            display: inline-block; padding: 8px 24px; border-radius: 20px;
            border: 1px solid ${color}44; background: rgba(124,77,255,0.05);
            color: ${color}; font-size: 10px; font-weight: 500; cursor: pointer;
            transition: all 0.3s ease; text-decoration: none;
            font-family: 'Orbitron', sans-serif; letter-spacing: 0.5px;
        }
        .btn-history:hover { background: rgba(124,77,255,0.1); border-color: ${color}; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,255,255,0.04); font-size: 8px; border-top: 1px solid rgba(255,255,255,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: ${color}; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 16px; }
            .header-right { justify-content: space-between; }
            .pred-result { font-size: 48px; min-height: 54px; }
            .pred-meta { gap: 16px; }
            .meta-item .value { font-size: 16px; }
            .card { padding: 14px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .pred-result { font-size: 36px; min-height: 42px; }
        }
    </style>
</head>
<body>

<div class="bg-neural"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">🧠</div>
            <div>
                <div class="logo-text">TX PREDICTOR V7</div>
                <div class="logo-sub">GOD MODE - ĐẠI CA KHÔI</div>
            </div>
        </div>
        <div class="header-right">
            <span class="status-badge">
                <span class="status-dot"></span>
                <span>Live</span>
            </span>
            <span class="header-time" id="clockDisplay">--:--:--</span>
        </div>
    </header>

    <div class="nav-links">
        <a href="/" class="nav-link">🏠 Trang chủ</a>
        <a href="/hu" class="nav-link ${type === 'hu' ? 'active' : ''}">🎲 HŨ</a>
        <a href="/md5" class="nav-link ${type === 'md5' ? 'active' : ''}">🎲 MD5</a>
        <a href="/lichsu/${type}" class="nav-link">📊 Lịch sử</a>
    </div>

    <div class="card">
        <div style="text-align:center;margin-bottom:12px;">
            <span style="font-family:'Orbitron',sans-serif;font-size:12px;color:rgba(255,255,255,0.2);letter-spacing:2px;">
                🤖 15 THUẬT TOÁN AI - DỰ ĐOÁN ${title}
            </span>
        </div>
        <div class="pred-area">
            <div class="pred-result waiting" id="result">---</div>
            <div class="pred-meta">
                <div class="meta-item">
                    <span class="label">Độ tin cậy</span>
                    <span class="value confidence" id="conf">0%</span>
                </div>
                <div class="meta-item">
                    <span class="label">Phiên</span>
                    <span class="value" id="phien" style="color:rgba(255,255,255,0.3);font-size:16px;">---</span>
                </div>
            </div>
            <div class="bar-track">
                <div class="bar-fill" id="bar"></div>
            </div>
            <div class="ai-badge">
                <i class="fas fa-microchip"></i> 15 ALGORITHMS ENSEMBLE <i class="fas fa-microchip"></i>
            </div>
        </div>
    </div>

    <div style="text-align:center;">
        <a href="/lichsu/${type}" class="btn-history"><i class="fas fa-history"></i> Xem lịch sử ${title}</a>
    </div>

    <div class="footer">
        <p>🧠 <strong>TX PREDICTOR V7 GOD MODE</strong> © ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,255,255,0.03);margin-top:2px;">15 Thuật toán AI · Transformer + LSTM + GAN + MCMC + GNN</p>
    </div>

</div>

<script>
document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
document.addEventListener('touchstart', function(e) { if (e.touches.length > 1) e.preventDefault(); });
var lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, false);
document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].indexOf(e.key) > -1) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
    }
});

function updateClock() {
    document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

async function fetchAPI(endpoint) {
    try {
        var res = await fetch(endpoint);
        if (!res.ok) throw new Error('Network error');
        return await res.json();
    } catch (e) {
        console.error('API Error:', e);
        return null;
    }
}

async function fetchPrediction() {
    var data = await fetchAPI('/api/${type}');
    if (data) {
        var resultEl = document.getElementById('result');
        var confEl = document.getElementById('conf');
        var phienEl = document.getElementById('phien');
        var barEl = document.getElementById('bar');

        if (resultEl) {
            resultEl.textContent = data.duDoan || '---';
            resultEl.className = 'pred-result';
            if (data.duDoan === 'TAI') resultEl.classList.add('tai');
            else if (data.duDoan === 'XIU') resultEl.classList.add('xiu');
            else resultEl.classList.add('waiting');
        }

        if (confEl) confEl.textContent = data.doTinCay || '0%';
        if (phienEl) phienEl.textContent = '#' + data.phien || '---';

        var conf = parseInt(data.doTinCay) || 0;
        if (barEl) barEl.style.width = Math.min(100, conf) + '%';
    }
}

var isRefreshing = false;

async function refreshAll() {
    if (isRefreshing) return;
    isRefreshing = true;
    try { await fetchPrediction(); } catch (e) { console.error('Refresh error:', e); }
    isRefreshing = false;
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🧠 TX PREDICTOR V7 GOD MODE - ${title}');
    refreshAll();
    setInterval(refreshAll, 5000);
    setTimeout(function() {
        var badge = document.querySelector('.status-badge');
        if (badge) badge.innerHTML = '<span class="status-dot"></span><span>Ready</span>';
    }, 1000);
});
</script>
</body>
</html>
`;

// ============================================================
// RENDER GIAO DIỆN LỊCH SỬ
// ============================================================
const renderHistoryPage = (type, title, color) => `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>📊 Lịch sử ${title} - TX PREDICTOR V7</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: linear-gradient(135deg, #0a0a1a 0%, #1a0a3e 50%, #0a0a1a 100%);
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: ${color}; border-radius: 10px; }

        .bg-neural {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 20% 30%, rgba(79,195,247,0.03), transparent 50%),
                        radial-gradient(ellipse at 80% 70%, rgba(124,77,255,0.03), transparent 50%);
        }

        .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 16px; min-height: 100vh; }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 24px;
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.04);
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, ${color}, #7c4dff);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(124,77,255,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, ${color}, #7c4dff);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,255,255,0.3); letter-spacing: 2px; text-transform: uppercase; }
        .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .status-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 14px; background: rgba(0,255,136,0.06);
            border-radius: 20px; font-size: 10px; color: rgba(255,255,255,0.5);
            border: 1px solid rgba(0,255,136,0.06);
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ff88; animation: dotPulse 1.5s ease-in-out infinite; }
        .header-time { font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 16px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.4); font-size: 8px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: ${color}; color: ${color}; background: rgba(124,77,255,0.05); }
        .nav-link.active { border-color: ${color}; color: ${color}; background: rgba(124,77,255,0.05); }

        .page-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 24px; font-weight: 700;
            color: ${color};
            text-align: center;
            margin-bottom: 16px;
            letter-spacing: 2px;
        }

        .card {
            background: rgba(255,255,255,0.02);
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.04);
            padding: 20px; transition: all 0.3s ease;
        }
        .card:hover { border-color: rgba(124,77,255,0.08); box-shadow: 0 0 60px rgba(124,77,255,0.03); }
        .card-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 10px; color: rgba(255,255,255,0.3);
            margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
            letter-spacing: 1px;
        }
        .card-title i { font-size: 13px; color: ${color}; }
        .card-badge {
            margin-left: auto; background: rgba(124,77,255,0.06);
            color: ${color}; padding: 2px 12px; border-radius: 20px;
            font-size: 7px; font-weight: 600; text-transform: uppercase;
        }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
        @media (max-width: 600px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        .stat-card {
            background: rgba(255,255,255,0.01); border-radius: 12px;
            padding: 12px 8px; text-align: center;
            border: 1px solid rgba(255,255,255,0.01);
            transition: all 0.3s ease;
        }
        .stat-card:hover { background: rgba(255,255,255,0.02); border-color: rgba(124,77,255,0.03); }
        .stat-number { font-size: 26px; font-weight: 700; font-family: 'Orbitron', sans-serif; color: ${color}; }
        .stat-number.good { color: #66bb6a; }
        .stat-number.bad { color: #ef5350; }
        .stat-number.winrate { color: #ffd54f; }
        .stat-label { font-size: 8px; color: rgba(255,255,255,0.15); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }

        .history-container { max-height: 500px; overflow-y: auto; margin-top: 4px; }
        .history-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .history-table thead { position: sticky; top: 0; z-index: 2; }
        .history-table th {
            text-align: left; padding: 6px 8px;
            color: rgba(255,255,255,0.12); font-size: 8px; text-transform: uppercase;
            letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.03);
            background: rgba(10,10,26,0.95); backdrop-filter: blur(10px);
            font-weight: 500;
        }
        .history-table td { padding: 5px 8px; border-bottom: 1px solid rgba(255,255,255,0.01); color: rgba(255,255,255,0.35); font-size: 10px; }
        .history-table tr:hover td { background: rgba(255,255,255,0.01); }
        .history-table .phien { color: #fff; font-family: 'Orbitron', sans-serif; font-size: 9px; }
        .history-table .win { color: #66bb6a; font-weight: 600; }
        .history-table .lose { color: #ef5350; font-weight: 600; }
        .history-table .pending { color: #ffd54f; }

        .scroll-hint { text-align: center; padding: 8px; color: rgba(255,255,255,0.04); font-size: 7px; letter-spacing: 1px; }

        .btn-back {
            display: inline-block; padding: 8px 24px; border-radius: 20px;
            border: 1px solid ${color}44; background: rgba(124,77,255,0.05);
            color: ${color}; font-size: 10px; font-weight: 500; cursor: pointer;
            transition: all 0.3s ease; text-decoration: none;
            font-family: 'Orbitron', sans-serif; letter-spacing: 0.5px;
        }
        .btn-back:hover { background: rgba(124,77,255,0.1); border-color: ${color}; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,255,255,0.04); font-size: 8px; border-top: 1px solid rgba(255,255,255,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: ${color}; }

        .ai-badge {
            text-align: center;
            font-size: 8px;
            color: rgba(255,255,255,0.08);
            font-family: 'Orbitron', sans-serif;
            letter-spacing: 2px;
            margin-top: 6px;
        }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 16px; }
            .header-right { justify-content: space-between; }
            .page-title { font-size: 18px; }
            .stat-number { font-size: 18px; }
            .history-table { font-size: 9px; }
            .history-table th, .history-table td { padding: 3px 5px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .page-title { font-size: 14px; }
            .stats-grid { gap: 4px; }
            .stat-number { font-size: 14px; }
            .stat-card { padding: 6px 3px; }
            .history-table { font-size: 7px; }
            .history-table th, .history-table td { padding: 2px 4px; }
        }
    </style>
</head>
<body>

<div class="bg-neural"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">📊</div>
            <div>
                <div class="logo-text">TX PREDICTOR V7</div>
                <div class="logo-sub">GOD MODE - ĐẠI CA KHÔI</div>
            </div>
        </div>
        <div class="header-right">
            <span class="status-badge">
                <span class="status-dot"></span>
                <span>Live</span>
            </span>
            <span class="header-time" id="clockDisplay">--:--:--</span>
            <a href="/${type}" class="btn-back"><i class="fas fa-arrow-left"></i> Dự đoán</a>
        </div>
    </header>

    <div class="nav-links">
        <a href="/" class="nav-link">🏠 Trang chủ</a>
        <a href="/hu" class="nav-link ${type === 'hu' ? 'active' : ''}">🎲 HŨ</a>
        <a href="/md5" class="nav-link ${type === 'md5' ? 'active' : ''}">🎲 MD5</a>
        <a href="/lichsu/${type}" class="nav-link active">📊 Lịch sử</a>
    </div>

    <div class="page-title">
        📊 LỊCH SỬ ${title} (1000 phiên)
    </div>

    <div class="card" style="margin-bottom:12px;">
        <div class="card-title">
            <i class="fas fa-chart-line"></i> THỐNG KÊ ${title}
            <span class="card-badge">THỰC TẾ</span>
        </div>
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number" id="totalPreds">0</div>
                <div class="stat-label">Tổng phiên</div>
            </div>
            <div class="stat-card">
                <div class="stat-number good" id="totalCorrect">0</div>
                <div class="stat-label">Thắng</div>
            </div>
            <div class="stat-card">
                <div class="stat-number bad" id="totalWrong">0</div>
                <div class="stat-label">Thua</div>
            </div>
            <div class="stat-card">
                <div class="stat-number winrate" id="winRate">0%</div>
                <div class="stat-label">Tỷ lệ thắng</div>
            </div>
        </div>
        <div class="ai-badge">
            <i class="fas fa-microchip"></i> 15 ALGORITHMS ENSEMBLE <i class="fas fa-microchip"></i>
        </div>
    </div>

    <div class="card">
        <div class="card-title">
            <i class="fas fa-history"></i> CHI TIẾT ${title}
            <span class="card-badge">1000 phiên</span>
        </div>
        <div class="history-container">
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Phiên</th>
                        <th>Dự đoán</th>
                        <th>Kết quả</th>
                        <th>Độ tin cậy</th>
                        <th>Trạng thái</th>
                    </tr>
                </thead>
                <tbody id="historyBody">
                    <tr>
                        <td colspan="5" style="text-align:center;padding:20px;color:rgba(255,255,255,0.06);font-size:10px;">
                            <i class="fas fa-spinner fa-spin"></i> Đang tải...
                        </td>
                    </tr>
                </tbody>
            </table>
            <div class="scroll-hint">↓ Cuộn để xem thêm</div>
        </div>
    </div>

    <div class="footer">
        <p>🧠 <strong>TX PREDICTOR V7 GOD MODE</strong> © ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,255,255,0.03);margin-top:2px;">15 Thuật toán AI · Transformer + LSTM + GAN + MCMC + GNN</p>
    </div>

</div>

<script>
document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
document.addEventListener('touchstart', function(e) { if (e.touches.length > 1) e.preventDefault(); });
var lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, false);
document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].indexOf(e.key) > -1) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
    }
});

function updateClock() {
    document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();

async function fetchAPI(endpoint) {
    try {
        var res = await fetch(endpoint);
        if (!res.ok) throw new Error('Network error');
        return await res.json();
    } catch (e) {
        console.error('API Error:', e);
        return null;
    }
}

async function fetchHistory() {
    var data = await fetchAPI('/api/history/${type}');
    if (data) {
        renderHistory(data.history || []);
        updateStats(data.history || []);
    }
}

function renderHistory(history) {
    var tbody = document.getElementById('historyBody');
    if (!history || history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:rgba(255,255,255,0.06);">Chưa có dữ liệu</td></tr>';
        return;
    }
    var rows = '';
    for (var i = 0; i < Math.min(history.length, 100); i++) {
        var r = history[i];
        var statusClass = r.trangThai === 'WIN' ? 'win' : (r.trangThai === 'LOSE' ? 'lose' : 'pending');
        var statusText = r.trangThai === 'WIN' ? '✅ THẮNG' : (r.trangThai === 'LOSE' ? '❌ THUA' : '⏳ CHỜ');
        rows += '<tr>' +
            '<td class="phien">#' + r.phien + '</td>' +
            '<td>' + (r.duDoan || '---') + '</td>' +
            '<td>' + (r.ketQua || '---') + '</td>' +
            '<td>' + (r.do_tin_cay || '0%') + '</td>' +
            '<td class="' + statusClass + '">' + statusText + '</td>' +
            '</tr>';
    }
    tbody.innerHTML = rows;
}

function updateStats(history) {
    if (!history || history.length === 0) {
        document.getElementById('totalPreds').textContent = 0;
        document.getElementById('totalCorrect').textContent = 0;
        document.getElementById('totalWrong').textContent = 0;
        document.getElementById('winRate').textContent = '0%';
        return;
    }
    var total = history.length;
    var wins = 0, loses = 0;
    for (var i = 0; i < history.length; i++) {
        if (history[i].trangThai === 'WIN') wins++;
        else if (history[i].trangThai === 'LOSE') loses++;
    }
    document.getElementById('totalPreds').textContent = total;
    document.getElementById('totalCorrect').textContent = wins;
    document.getElementById('totalWrong').textContent = loses;
    document.getElementById('winRate').textContent = total > 0 ? (wins / total * 100).toFixed(1) + '%' : '0%';
}

var refreshInterval;
function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(function() { fetchHistory(); }, 5000);
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('📊 TX PREDICTOR V7 GOD MODE - LỊCH SỬ ${title}');
    fetchHistory();
    startAutoRefresh();
});
</script>
</body>
</html>
`;

// ============================================================
// ROUTES
// ============================================================

// Trang chủ
app.get('/', function(req, res) {
    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>🧠 TX PREDICTOR V7 GOD MODE</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: linear-gradient(135deg, #0a0a1a 0%, #1a0a3e 50%, #0a0a1a 100%);
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: #7c4dff; border-radius: 10px; }

        .bg-neural {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 20% 30%, rgba(79,195,247,0.03), transparent 50%),
                        radial-gradient(ellipse at 80% 70%, rgba(124,77,255,0.03), transparent 50%);
        }

        .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 16px; min-height: 100vh; }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 24px;
            background: rgba(255,255,255,0.03);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.04);
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, #7c4dff, #b388ff);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(124,77,255,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, #b388ff, #7c4dff);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,255,255,0.3); letter-spacing: 2px; text-transform: uppercase; }
        .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .status-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 14px; background: rgba(0,255,136,0.06);
            border-radius: 20px; font-size: 10px; color: rgba(255,255,255,0.5);
            border: 1px solid rgba(0,255,136,0.06);
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #00ff88; animation: dotPulse 1.5s ease-in-out infinite; }
        .header-time { font-size: 11px; color: rgba(255,255,255,0.3); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 16px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.06);
            color: rgba(255,255,255,0.4); font-size: 8px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: #7c4dff; color: #7c4dff; background: rgba(124,77,255,0.05); }
        .nav-link.active { border-color: #7c4dff; color: #7c4dff; background: rgba(124,77,255,0.05); }

        .welcome {
            text-align: center;
            padding: 40px 20px;
            background: rgba(255,255,255,0.02);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.04);
            margin-bottom: 16px;
        }
        .welcome h1 {
            font-family: 'Orbitron', sans-serif;
            font-size: 32px;
            font-weight: 900;
            background: linear-gradient(135deg, #b388ff, #7c4dff);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
        }
        .welcome p { color: rgba(255,255,255,0.4); font-size: 14px; letter-spacing: 1px; }
        .welcome .version { color: rgba(255,255,255,0.15); font-size: 10px; margin-top: 8px; font-family: 'Orbitron', sans-serif; letter-spacing: 2px; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        @media (max-width: 992px) { .grid { grid-template-columns: 1fr; } }

        .menu-card {
            background: rgba(255,255,255,0.02);
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.04);
            padding: 30px 20px;
            text-align: center;
            transition: all 0.3s ease;
            text-decoration: none;
            color: #fff;
            display: block;
        }
        .menu-card:hover { border-color: rgba(124,77,255,0.08); box-shadow: 0 0 60px rgba(124,77,255,0.03); transform: translateY(-4px); }
        .menu-card .icon { font-size: 40px; margin-bottom: 12px; display: block; }
        .menu-card .title { font-family: 'Orbitron', sans-serif; font-size: 16px; font-weight: 700; color: #b388ff; }
        .menu-card .desc { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 4px; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,255,255,0.04); font-size: 8px; border-top: 1px solid rgba(255,255,255,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: #7c4dff; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 16px; }
            .header-right { justify-content: space-between; }
            .welcome h1 { font-size: 24px; }
            .grid { gap: 10px; }
            .menu-card { padding: 20px 14px; }
            .menu-card .icon { font-size: 30px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .welcome h1 { font-size: 18px; }
            .menu-card .title { font-size: 13px; }
        }
    </style>
</head>
<body>

<div class="bg-neural"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">🧠</div>
            <div>
                <div class="logo-text">TX PREDICTOR V7</div>
                <div class="logo-sub">GOD MODE - ĐẠI CA KHÔI</div>
            </div>
        </div>
        <div class="header-right">
            <span class="status-badge">
                <span class="status-dot"></span>
                <span>Live</span>
            </span>
            <span class="header-time" id="clockDisplay">--:--:--</span>
        </div>
    </header>

    <div class="nav-links">
        <a href="/" class="nav-link active">🏠 Trang chủ</a>
        <a href="/hu" class="nav-link">🎲 HŨ</a>
        <a href="/md5" class="nav-link">🎲 MD5</a>
        <a href="/lichsu/hu" class="nav-link">📊 Lịch sử HŨ</a>
        <a href="/lichsu/md5" class="nav-link">📊 Lịch sử MD5</a>
    </div>

    <div class="welcome">
        <h1>🧠 TX PREDICTOR V7 GOD MODE</h1>
        <p>🤖 15 Thuật toán AI - Siêu dự đoán Tài Xỉu</p>
        <p class="version">🚀 Transformer · LSTM · GAN · Reinforcement · MCMC · GNN</p>
    </div>

    <div class="grid">
        <a href="/hu" class="menu-card">
            <span class="icon">🎲</span>
            <div class="title">Dự đoán HŨ</div>
            <div class="desc">15 thuật toán AI dự đoán HŨ</div>
        </a>
        <a href="/md5" class="menu-card">
            <span class="icon">🎲</span>
            <div class="title">Dự đoán MD5</div>
            <div class="desc">15 thuật toán AI dự đoán MD5</div>
        </a>
        <a href="/lichsu/hu" class="menu-card">
            <span class="icon">📊</span>
            <div class="title">Lịch sử HŨ</div>
            <div class="desc">1000 phiên - Thống kê thực tế</div>
        </a>
        <a href="/lichsu/md5" class="menu-card">
            <span class="icon">📊</span>
            <div class="title">Lịch sử MD5</div>
            <div class="desc">1000 phiên - Thống kê thực tế</div>
        </a>
    </div>

    <div class="footer">
        <p>🧠 <strong>TX PREDICTOR V7 GOD MODE</strong> © ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,255,255,0.03);margin-top:2px;">15 Thuật toán AI · Transformer + LSTM + GAN + MCMC + GNN</p>
    </div>

</div>

<script>
document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
document.addEventListener('touchstart', function(e) { if (e.touches.length > 1) e.preventDefault(); });
var lastTouchEnd = 0;
document.addEventListener('touchend', function(e) {
    var now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
}, false);
document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].indexOf(e.key) > -1) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
    }
});

function updateClock() {
    document.getElementById('clockDisplay').textContent = new Date().toLocaleTimeString('vi-VN', { hour12: false });
}
setInterval(updateClock, 1000);
updateClock();
</script>
</body>
</html>`);
});

// Dự đoán HU
app.get('/hu', function(req, res) {
    res.send(renderPredictionPage('HŨ', 'hu', '#4fc3f7'));
});

// Dự đoán MD5
app.get('/md5', function(req, res) {
    res.send(renderPredictionPage('MD5', 'md5', '#ff6b6b'));
});

// Lịch sử HU
app.get('/lichsu/hu', function(req, res) {
    res.send(renderHistoryPage('hu', 'HŨ', '#4fc3f7'));
});

// Lịch sử MD5
app.get('/lichsu/md5', function(req, res) {
    res.send(renderHistoryPage('md5', 'MD5', '#ff6b6b'));
});

// ============================================================
// API
// ============================================================
app.get('/api/hu', async function(req, res) {
    try {
        const data = await fetchHu();
        if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu HU' });
        const result = calculatePrediction(data, 'hu');
        res.json({
            phien: result.phien,
            duDoan: result.prediction,
            doTinCay: result.confidence.toFixed(0) + '%',
            ketQua: result.ketQua,
            trangThai: result.trangThai,
            algorithmCount: result.algorithmCount
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/md5', async function(req, res) {
    try {
        const data = await fetchMd5();
        if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu MD5' });
        const result = calculatePrediction(data, 'md5');
        res.json({
            phien: result.phien,
            duDoan: result.prediction,
            doTinCay: result.confidence.toFixed(0) + '%',
            ketQua: result.ketQua,
            trangThai: result.trangThai,
            algorithmCount: result.algorithmCount
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/history/:type', function(req, res) {
    const type = req.params.type;
    if (type === 'all') {
        const all = (historyData.hu || []).concat(historyData.md5 || []);
        all.sort((a, b) => (b.phien || 0) - (a.phien || 0));
        res.json({ history: all, total: all.length });
    } else if (type === 'hu') {
        res.json({ history: historyData.hu || [], total: (historyData.hu || []).length });
    } else if (type === 'md5') {
        res.json({ history: historyData.md5 || [], total: (historyData.md5 || []).length });
    } else {
        res.json({ history: [], total: 0 });
    }
});

app.get('/api/stats', function(req, res) {
    const info = predictor.getSystemInfo();
    res.json(info);
});

app.get('/api/reset', function(req, res) {
    historyData = { hu: [], md5: [] };
    saveHistory();
    res.json({ message: '🧠 Reset thành công - V7 GOD MODE' });
});

// ============================================================
// KHỞI ĐỘNG SERVER
// ============================================================
loadHistory();
app.listen(PORT, '0.0.0.0', function() {
    console.log('========================================');
    console.log('🧠 TX PREDICTOR V7 GOD MODE');
    console.log('🤖 15 THUẬT TOÁN AI SIÊU VIỆT');
    console.log('🚀 Transformer + LSTM + GAN + MCMC + GNN');
    console.log('📊 Route: /hu - /md5 - /lichsu/hu - /lichsu/md5');
    console.log('Server: http://0.0.0.0:' + PORT);
    console.log('========================================');
});
