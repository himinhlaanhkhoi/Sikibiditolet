/**
 * ════════════════════════════════════════════════════════════════════
 * ║  🌌 TX PREDICTOR GALAXY ULTIMATE - GOD DESTROYER             ║
 * ║  🚀 HỆ THỐNG DỰ ĐOÁN TÀI XỈU THẾ HỆ MỚI                    ║
 * ║  📊 LƯU 1000 PHIÊN - TỰ ĐỘNG +1 - BẢO MẬT TỐI ĐA          ║
 * ════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// 🛡️ BẢO MẬT TỐI ĐA
// ============================================================
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"]
        }
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'no-referrer' },
    noSniff: true,
    xssFilter: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Quá nhiều request, vui lòng thử lại sau 15 phút'
});
app.use('/api/', limiter);

// Security headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
});

app.use(express.json({ limit: '1mb' }));

// ============================================================
// ⏰ HÀM THỜI GIAN VIỆT NAM
// ============================================================
function vnNow() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 420);
    return now.toISOString();
}

function getVNTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 420);
    return now;
}

function formatVNTime(date) {
    const d = date || getVNTime();
    return d.toLocaleString('vi-VN', { hour12: false });
}

// ============================================================
// 📊 STATS TOÀN CỤC
// ============================================================
let stats = {
    total: 0, correct: 0, wrong: 0,
    last_prediction: null,
    start_time: vnNow(),
    history: [],
    total_predictions_made: 0,
    streak_correct: 0, streak_wrong: 0,
    best_streak: 0, worst_streak: 0,
    confidence_stats: { high: 0, medium: 0, low: 0 },
    hourly_stats: {},
    daily_profit: 0,
    accuracy_curve: [],
    profit_curve: [],
    learning_progress: 0,
    model_version: "GOD_DESTROYER_v3.0",
    last_phien: 0
};

// ============================================================
// 💀 TX_LogicPen_GOD_DESTROYER — SIÊU HỦY DIỆT
// ============================================================

// ===== LSTM NEURAL NETWORK =====
class MiniLSTM {
    constructor(inputSize = 10, hiddenSize = 20) {
        this.inputSize = inputSize;
        this.hiddenSize = hiddenSize;
        this.Wf = this.initMatrix(hiddenSize, inputSize + hiddenSize);
        this.Wi = this.initMatrix(hiddenSize, inputSize + hiddenSize);
        this.Wc = this.initMatrix(hiddenSize, inputSize + hiddenSize);
        this.Wo = this.initMatrix(hiddenSize, inputSize + hiddenSize);
        this.Wy = this.initMatrix(2, hiddenSize);
        this.hiddenState = new Array(hiddenSize).fill(0);
        this.cellState = new Array(hiddenSize).fill(0);
        this.learningRate = 0.01;
    }
    
    initMatrix(rows, cols) {
        return Array.from({length: rows}, () => 
            Array.from({length: cols}, () => (Math.random() - 0.5) * 0.1)
        );
    }
    
    sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    tanh(x) { return Math.tanh(x); }
    
    forward(input) {
        const combined = [...input, ...this.hiddenState];
        const forgetGate = this.Wf.map(row => this.sigmoid(row.reduce((sum, w, i) => sum + w * combined[i], 0)));
        const inputGate = this.Wi.map(row => this.sigmoid(row.reduce((sum, w, i) => sum + w * combined[i], 0)));
        const candidateCell = this.Wc.map(row => this.tanh(row.reduce((sum, w, i) => sum + w * combined[i], 0)));
        this.cellState = this.cellState.map((c, i) => forgetGate[i] * c + inputGate[i] * candidateCell[i]);
        const outputGate = this.Wo.map(row => this.sigmoid(row.reduce((sum, w, i) => sum + w * combined[i], 0)));
        this.hiddenState = outputGate.map((o, i) => o * this.tanh(this.cellState[i]));
        const output = this.Wy.map(row => row.reduce((sum, w, i) => sum + w * this.hiddenState[i], 0));
        const maxOutput = Math.max(...output);
        const expOutput = output.map(o => Math.exp(o - maxOutput));
        const sumExp = expOutput.reduce((a, b) => a + b, 0);
        return expOutput.map(e => e / sumExp);
    }
    
    predict(sequence) {
        this.hiddenState = new Array(this.hiddenSize).fill(0);
        this.cellState = new Array(this.hiddenSize).fill(0);
        for (const input of sequence) this.forward(input);
        return this.forward(sequence[sequence.length - 1]);
    }
    
    train(sequence, target) {
        const prediction = this.predict(sequence);
        const error = [target[0] - prediction[0], target[1] - prediction[1]];
        for (let i = 0; i < this.Wy.length; i++) {
            for (let j = 0; j < this.Wy[i].length; j++) {
                this.Wy[i][j] += this.learningRate * error[i] * this.hiddenState[j];
            }
        }
        return error;
    }
}

// ===== TRANSFORMER ATTENTION =====
class TransformerAttention {
    constructor(dim = 10, heads = 4) {
        this.dim = dim;
        this.heads = heads;
        this.headDim = Math.floor(dim / heads);
        this.Wq = this.initMatrix(dim, dim);
        this.Wk = this.initMatrix(dim, dim);
        this.Wv = this.initMatrix(dim, dim);
        this.Wo = this.initMatrix(dim, dim);
    }
    
    initMatrix(rows, cols) {
        return Array.from({length: rows}, () => 
            Array.from({length: cols}, () => (Math.random() - 0.5) * 0.1)
        );
    }
    
    softmax(arr) {
        const max = Math.max(...arr);
        const exp = arr.map(x => Math.exp(x - max));
        const sum = exp.reduce((a, b) => a + b, 0);
        return exp.map(e => e / sum);
    }
    
    attention(query, key, value) {
        const scores = [];
        const dim = this.headDim;
        for (let i = 0; i < query.length; i++) {
            const scoreRow = [];
            for (let j = 0; j < key.length; j++) {
                let dotProduct = 0;
                for (let d = 0; d < dim; d++) dotProduct += query[i][d] * key[j][d];
                scoreRow.push(dotProduct / Math.sqrt(dim));
            }
            scores.push(this.softmax(scoreRow));
        }
        const output = [];
        for (let i = 0; i < scores.length; i++) {
            const outRow = new Array(dim).fill(0);
            for (let j = 0; j < value.length; j++) {
                for (let d = 0; d < dim; d++) outRow[d] += scores[i][j] * value[j][d];
            }
            output.push(outRow);
        }
        return output;
    }
    
    forward(sequence) {
        const vectors = sequence.map(s => {
            const vec = new Array(this.dim).fill(0);
            vec[s] = 1;
            return vec;
        });
        const attended = this.attention(vectors, vectors, vectors);
        const pooled = new Array(this.dim).fill(0);
        for (const vec of attended) {
            for (let d = 0; d < this.dim; d++) pooled[d] += vec[d];
        }
        return pooled.map(p => p / attended.length);
    }
}

// ===== MONTE CARLO TREE SEARCH =====
class MonteCarloTreeSearch {
    constructor() {
        this.tree = new Map();
        this.explorationConstant = 1.414;
    }
    
    getNodeKey(state) { return state.join(''); }
    
    ucb1(node, parentVisits) {
        if (node.visits === 0) return Infinity;
        return (node.wins / node.visits) + this.explorationConstant * Math.sqrt(Math.log(parentVisits) / node.visits);
    }
    
    select(state) {
        const key = this.getNodeKey(state);
        if (!this.tree.has(key)) {
            this.tree.set(key, { visits: 0, wins: 0, children: new Map() });
        }
        return this.tree.get(key);
    }
    
    simulate(arr, depth = 10) {
        let wins = 0;
        const simulations = 50;
        for (let s = 0; s < simulations; s++) {
            let simArr = [...arr];
            for (let d = 0; d < depth; d++) {
                const node = this.select(simArr.slice(0, 10));
                let bestAction = 'TAI';
                let bestScore = -Infinity;
                for (const action of ['TAI', 'XIU']) {
                    const childKey = this.getNodeKey([action, ...simArr.slice(0, 9)]);
                    const child = this.tree.get(childKey) || { visits: 0, wins: 0 };
                    const score = this.ucb1(child, node.visits);
                    if (score > bestScore) { bestScore = score; bestAction = action; }
                }
                const randomResult = Math.random() < 0.5 ? 'TAI' : 'XIU';
                if (bestAction === randomResult) wins++;
                simArr.unshift(bestAction);
            }
        }
        return { 
            pred: wins > simulations * depth / 2 ? 'TAI' : 'XIU',
            conf: 55 + Math.abs(wins - simulations * depth / 2) / (simulations * depth) * 80,
            type: 'Monte Carlo',
            simulations
        };
    }
    
    predict(arr) { return this.simulate(arr); }
}

// ===== GENETIC ALGORITHM =====
class GeneticOptimizer {
    constructor() {
        this.population = [];
        this.populationSize = 20;
        this.generations = 0;
        this.bestFitness = 0;
        this.bestGenome = null;
        this.initializePopulation();
    }
    
    initializePopulation() {
        for (let i = 0; i < this.populationSize; i++) {
            this.population.push({
                confidenceThreshold: 55 + Math.random() * 25,
                patternWeight: Math.random(),
                sequenceWeight: Math.random(),
                trendWeight: Math.random(),
                volatilityThreshold: 0.3 + Math.random() * 0.4,
                reversalProbability: Math.random() * 0.3,
                fitness: 0
            });
        }
    }
    
    fitness(genome, history) {
        let correct = 0, total = 0;
        for (let i = history.length - 1; i >= 10; i--) {
            const pastData = history.slice(i - 10, i);
            const actual = history[i];
            const prediction = this.predictWithGenome(genome, pastData);
            if (prediction === actual) correct++;
            total++;
        }
        return total > 0 ? correct / total : 0;
    }
    
    predictWithGenome(genome, pastData) {
        const taiCount = pastData.filter(x => x === 'TAI').length;
        const taiRatio = taiCount / pastData.length;
        const score = taiRatio * genome.patternWeight + (1 - taiRatio) * genome.trendWeight;
        if (score > genome.confidenceThreshold / 100) return 'TAI';
        if (score < (1 - genome.confidenceThreshold / 100)) return 'XIU';
        return Math.random() < genome.reversalProbability ? 
            (pastData[pastData.length - 1] === 'TAI' ? 'XIU' : 'TAI') : 
            pastData[pastData.length - 1];
    }
    
    evolve(history) {
        for (const genome of this.population) genome.fitness = this.fitness(genome, history);
        this.population.sort((a, b) => b.fitness - a.fitness);
        if (this.population[0].fitness > this.bestFitness) {
            this.bestFitness = this.population[0].fitness;
            this.bestGenome = { ...this.population[0] };
        }
        const newPopulation = [];
        const eliteCount = Math.floor(this.populationSize * 0.2);
        for (let i = 0; i < eliteCount; i++) newPopulation.push({ ...this.population[i] });
        while (newPopulation.length < this.populationSize) {
            const parent1 = this.population[Math.floor(Math.random() * this.populationSize / 2)];
            const parent2 = this.population[Math.floor(Math.random() * this.populationSize / 2)];
            const child = {};
            for (const key of Object.keys(parent1)) {
                if (key === 'fitness') continue;
                child[key] = Math.random() < 0.5 ? parent1[key] : parent2[key];
            }
            if (Math.random() < 0.1) {
                const mutationKeys = ['confidenceThreshold', 'patternWeight', 'sequenceWeight', 'trendWeight'];
                const key = mutationKeys[Math.floor(Math.random() * mutationKeys.length)];
                child[key] += (Math.random() - 0.5) * 0.2;
                child[key] = Math.max(0, Math.min(1, child[key]));
            }
            child.fitness = 0;
            newPopulation.push(child);
        }
        this.population = newPopulation;
        this.generations++;
    }
    
    getBestGenome() { return this.bestGenome || this.population[0]; }
}

// ===== CHAOS THEORY =====
class ChaosTheoryAnalyzer {
    constructor() {
        this.lyapunovExponent = 0;
        this.fractalDimension = 0;
        this.strangeAttractors = [];
    }
    
    calculateLyapunovExponent(arr) {
        if (arr.length < 20) return 0;
        const binary = arr.map(x => x === 'TAI' ? 1 : 0);
        let divergence = 0;
        for (let i = 1; i < binary.length; i++) {
            const diff = Math.abs(binary[i] - binary[i-1]);
            divergence += Math.log(diff + 0.001);
        }
        this.lyapunovExponent = divergence / binary.length;
        return this.lyapunovExponent;
    }
    
    detectStrangeAttractors(arr) {
        if (arr.length < 30) return [];
        const attractors = [];
        const binary = arr.map(x => x === 'TAI' ? 1 : 0);
        for (let i = 2; i < binary.length - 3; i++) {
            const pattern = binary.slice(i, i + 3);
            let matches = 0;
            for (let j = 0; j < binary.length - 3; j++) {
                const compare = binary.slice(j, j + 3);
                if (pattern.every((p, k) => p === compare[k])) matches++;
            }
            if (matches >= 3) {
                attractors.push({
                    pattern: pattern.map(p => p === 1 ? 'TAI' : 'XIU'),
                    frequency: matches,
                    prediction: pattern[2] === 1 ? 'XIU' : 'TAI'
                });
            }
        }
        this.strangeAttractors = attractors.sort((a, b) => b.frequency - a.frequency);
        return this.strangeAttractors;
    }
    
    predict(arr) {
        this.calculateLyapunovExponent(arr);
        this.detectStrangeAttractors(arr);
        if (this.strangeAttractors.length > 0) {
            const strongest = this.strangeAttractors[0];
            if (strongest.frequency >= 4) {
                return {
                    pred: strongest.prediction,
                    conf: 65 + strongest.frequency * 5,
                    type: 'Chaos Attractor',
                    reason: `Attractor: ${strongest.pattern.join('')} → ${strongest.prediction} (${strongest.frequency}x)`
                };
            }
        }
        if (this.lyapunovExponent > 0) {
            return {
                pred: arr[0] === 'TAI' ? 'XIU' : 'TAI',
                conf: 60 + Math.min(20, Math.abs(this.lyapunovExponent) * 50),
                type: 'Chaos Theory',
                reason: `Lyapunov=${this.lyapunovExponent.toFixed(3)} → Chaos`
            };
        }
        return null;
    }
}

// ===== REAL-TIME BACKTESTER =====
class RealTimeBacktester {
    constructor() {
        this.backtestResults = [];
        this.optimalStrategy = null;
        this.maxDrawdown = 0;
        this.sharpeRatio = 0;
    }
    
    backtest(predictor, historicalData) {
        const results = { trades: [], wins: 0, losses: 0, profit: 0, maxDrawdown: 0, winRate: 0 };
        let balance = 1000, peak = 1000;
        for (let i = historicalData.length - 50; i >= 1; i--) {
            const pastData = historicalData.slice(i);
            const actual = historicalData[i - 1];
            const prediction = predictor.predict(pastData);
            if (prediction && prediction.conf >= 70) {
                const betSize = this.kellyCriterion(prediction.conf / 100, 0.95);
                const bet = balance * betSize * 0.1;
                if (prediction.pred === actual.ket_qua) {
                    balance += bet * 0.95;
                    results.wins++;
                    results.profit += bet * 0.95;
                } else {
                    balance -= bet;
                    results.losses++;
                    results.profit -= bet;
                }
                results.trades.push({
                    prediction: prediction.pred,
                    actual: actual.ket_qua,
                    correct: prediction.pred === actual.ket_qua,
                    balance,
                    confidence: prediction.conf
                });
                peak = Math.max(peak, balance);
                const drawdown = (peak - balance) / peak;
                results.maxDrawdown = Math.max(results.maxDrawdown, drawdown);
            }
        }
        results.winRate = results.trades.length > 0 ? results.wins / results.trades.length : 0;
        if (results.trades.length > 0) {
            const returns = results.trades.map(t => t.correct ? 0.95 : -1);
            const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
            const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
            const stdDev = Math.sqrt(variance);
            results.sharpeRatio = stdDev > 0 ? avgReturn / stdDev : 0;
        }
        this.backtestResults.push(results);
        return results;
    }
    
    kellyCriterion(winProb, payout) {
        const q = 1 - winProb;
        const kelly = (payout * winProb - q) / payout;
        return Math.max(0, Math.min(0.25, kelly));
    }
    
    getOptimalConfidence() {
        if (this.backtestResults.length === 0) return 70;
        let bestThreshold = 70, bestProfit = -Infinity;
        for (let threshold = 60; threshold <= 85; threshold += 5) {
            let profit = 0, trades = 0;
            for (const result of this.backtestResults) {
                for (const trade of result.trades) {
                    if (trade.confidence >= threshold) {
                        profit += trade.correct ? 0.95 : -1;
                        trades++;
                    }
                }
            }
            if (profit > bestProfit && trades >= 10) {
                bestProfit = profit;
                bestThreshold = threshold;
            }
        }
        return bestThreshold;
    }
}

// ============================================================
// 💀 TX_LogicPen_GOD_DESTROYER — SIÊU HỦY DIỆT
// ============================================================
class TX_LogicPen_GOD_DESTROYER {
    constructor() {
        this.error_streak = 0;
        this.consecutive_correct = 0;
        this.last_prediction = null;
        this.history = [];
        this.sessionData = [];
        this.lstm = new MiniLSTM(10, 20);
        this.transformer = new TransformerAttention(10, 4);
        this.monteCarlo = new MonteCarloTreeSearch();
        this.genetic = new GeneticOptimizer();
        this.chaos = new ChaosTheoryAnalyzer();
        this.backtester = new RealTimeBacktester();
        this.qTable = new Map();
        this.qLearningRate = 0.1;
        this.qDiscount = 0.95;
        this.qExploration = 0.05;
        this.markovChains = new Map();
        this.bayesianPriors = { TAI: 0.5, XIU: 0.5 };
        this.bayesianHistory = [];
        this.weights = {
            lstm: 1.5, transformer: 1.5, monteCarlo: 1.2,
            chaos: 1.0, markov: 0.8, bayesian: 0.8,
            genetic: 1.3, pattern: 0.7, trend: 0.6, statistical: 0.5
        };
        this.algoPerformance = new Map();
        for (const algo of Object.keys(this.weights)) {
            this.algoPerformance.set(algo, {
                correct: 0, total: 0,
                recentCorrect: 0, recentTotal: 0,
                streak: 0, weight: this.weights[algo]
            });
        }
        this.patternMemory = new Map();
        this.sequenceMemory = [];
        this.winPatterns = new Set();
        this.losePatterns = new Set();
        this.marketState = 'UNKNOWN';
        this.volatilityIndex = 0;
        this.trendStrength = 0;
        this.optimalConfidence = 70;
        this.predictionHistory = [];
        this.errorPatterns = new Map();
        this.backtestInterval = 50;
        this.predictionCount = 0;
        this.phien_counter = 0;
    }
    
    loadData(data) {
        this.history = [...data].sort((a, b) => (b.phien || 0) - (a.phien || 0));
        this.sessionData = this.history.slice(0, 100);
        const arr = this._arr();
        const points = this._points();
        if (arr.length >= 10) {
            this.trainLSTM(arr);
            this.trainMarkov(arr);
            this.updateBayesian(arr, points);
            this.analyzeMarket(arr, points);
            this.updateWeights();
        }
        this.predictionCount++;
        if (this.predictionCount % this.backtestInterval === 0) this.autoBacktest();
        
        // Update phien counter
        if (this.history.length > 0) {
            const latestPhien = this.history[0]?.phien || 0;
            if (latestPhien > this.phien_counter) this.phien_counter = latestPhien;
        }
    }
    
    _arr() {
        return this.history.map(s => 
            (s.ket_qua || '').toUpperCase().replace('XỈU', 'XIU').replace('TÀI', 'TAI')
        );
    }
    
    _points() {
        return this.history.filter(s => s.tong !== undefined && s.tong !== null).map(s => s.tong);
    }
    
    trainLSTM(arr) {
        if (arr.length < 15) return;
        for (let i = 0; i < arr.length - 10; i++) {
            const sequence = arr.slice(i, i + 10).map(x => x === 'TAI' ? 1 : 0);
            const target = arr[i + 10] === 'TAI' ? [1, 0] : [0, 1];
            const inputs = sequence.map(s => {
                const vec = new Array(10).fill(0);
                vec[s] = 1;
                return vec;
            });
            try { this.lstm.train(inputs, target); } catch (e) {}
        }
    }
    
    trainMarkov(arr) {
        for (let order = 1; order <= 5; order++) {
            for (let i = 0; i < arr.length - order; i++) {
                const state = arr.slice(i, i + order).join('');
                const next = arr[i + order];
                if (!this.markovChains.has(state)) {
                    this.markovChains.set(state, { TAI: 0, XIU: 0, total: 0 });
                }
                const data = this.markovChains.get(state);
                data[next]++;
                data.total++;
            }
        }
    }
    
    updateBayesian(arr, points) {
        if (arr.length < 5) return;
        const last5 = arr.slice(0, 5);
        const taiCount = last5.filter(x => x === 'TAI').length;
        const likelihoodTAI = (taiCount + 1) / 7;
        const likelihoodXIU = (6 - taiCount) / 7;
        const evidence = likelihoodTAI * this.bayesianPriors.TAI + likelihoodXIU * this.bayesianPriors.XIU;
        this.bayesianPriors.TAI = (likelihoodTAI * this.bayesianPriors.TAI) / evidence;
        this.bayesianPriors.XIU = (likelihoodXIU * this.bayesianPriors.XIU) / evidence;
        this.bayesianHistory.push({ ...this.bayesianPriors });
        if (this.bayesianHistory.length > 100) this.bayesianHistory.shift();
    }
    
    analyzeMarket(arr, points) {
        if (arr.length < 20) return;
        let changes = 0;
        for (let i = 1; i < Math.min(arr.length, 20); i++) {
            if (arr[i] !== arr[i-1]) changes++;
        }
        this.volatilityIndex = changes / Math.min(arr.length - 1, 19);
        const taiRatio = arr.slice(0, 10).filter(x => x === 'TAI').length / 10;
        this.trendStrength = Math.abs(taiRatio - 0.5) * 2;
        if (this.volatilityIndex > 0.7) this.marketState = 'VOLATILE';
        else if (this.trendStrength > 0.6) this.marketState = 'TRENDING';
        else if (this.volatilityIndex < 0.3) this.marketState = 'CALM';
        else this.marketState = 'NORMAL';
        switch (this.marketState) {
            case 'VOLATILE': this.weights.chaos = 2.0; this.weights.monteCarlo = 1.5; this.weights.trend = 0.3; break;
            case 'TRENDING': this.weights.trend = 1.5; this.weights.pattern = 1.3; this.weights.statistical = 1.0; break;
            case 'CALM': this.weights.markov = 1.5; this.weights.bayesian = 1.3; this.weights.lstm = 1.8; break;
            case 'NORMAL': this.weights.transformer = 1.8; this.weights.genetic = 1.5; break;
        }
    }
    
    updateWeights() {
        for (const [algo, perf] of this.algoPerformance) {
            if (perf.recentTotal >= 10) {
                const accuracy = perf.recentCorrect / perf.recentTotal;
                let newWeight = this.weights[algo] * (0.3 + accuracy * 0.7);
                if (perf.streak >= 3) newWeight *= 1.3;
                if (perf.streak >= 5) newWeight *= 1.5;
                if (perf.streak <= -3) newWeight *= 0.6;
                this.weights[algo] = Math.max(0.1, Math.min(3.0, newWeight));
                perf.weight = this.weights[algo];
                if (perf.recentTotal >= 20) {
                    perf.correct += perf.recentCorrect;
                    perf.total += perf.recentTotal;
                    perf.recentCorrect = 0;
                    perf.recentTotal = 0;
                }
            }
        }
    }
    
    autoBacktest() {
        if (this.history.length < 30) return;
        const results = this.backtester.backtest(this, this.history);
        this.optimalConfidence = this.backtester.getOptimalConfidence();
        if (results.winRate > 0.7) {
            for (const [algo, perf] of this.algoPerformance) {
                if (perf.recentCorrect / Math.max(1, perf.recentTotal) > 0.7) {
                    this.weights[algo] *= 1.1;
                }
            }
        }
        if (this.history.length >= 50) this.genetic.evolve(this._arr());
    }
    
    lstmPredict(arr) {
        if (arr.length < 10) return null;
        const recent10 = arr.slice(0, 10).map(x => x === 'TAI' ? 1 : 0);
        const inputs = recent10.map(s => {
            const vec = new Array(10).fill(0);
            vec[s] = 1;
            return vec;
        });
        try {
            const output = this.lstm.predict(inputs);
            const taiProb = output[0], xiuProb = output[1];
            return {
                pred: taiProb > xiuProb ? 'TAI' : 'XIU',
                conf: 55 + Math.abs(taiProb - xiuProb) * 80,
                type: 'LSTM Neural',
                reason: `T=${(taiProb*100).toFixed(1)}% X=${(xiuProb*100).toFixed(1)}%`
            };
        } catch (e) { return null; }
    }
    
    transformerPredict(arr) {
        if (arr.length < 10) return null;
        const recent10 = arr.slice(0, 10).map(x => x === 'TAI' ? 1 : 0);
        try {
            const attention = this.transformer.forward(recent10);
            const taiScore = attention.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
            const xiuScore = attention.filter((_, i) => i % 2 === 1).reduce((a, b) => a + b, 0);
            return {
                pred: taiScore > xiuScore ? 'TAI' : 'XIU',
                conf: 55 + Math.abs(taiScore - xiuScore) / (taiScore + xiuScore) * 80,
                type: 'Transformer Attention',
                reason: `Attention: T=${taiScore.toFixed(2)} X=${xiuScore.toFixed(2)}`
            };
        } catch (e) { return null; }
    }
    
    markovPredict(arr) {
        let bestPred = null, bestConf = 0;
        for (let order = 5; order >= 1; order--) {
            if (arr.length < order) continue;
            const state = arr.slice(0, order).join('');
            const data = this.markovChains.get(state);
            if (data && data.total >= 5) {
                const taiProb = data.TAI / data.total;
                const xiuProb = data.XIU / data.total;
                const confidence = 55 + Math.abs(taiProb - 0.5) * 80;
                if (confidence > bestConf) {
                    bestConf = confidence;
                    bestPred = {
                        pred: taiProb > xiuProb ? 'TAI' : 'XIU',
                        conf: confidence,
                        type: `Markov Bậc ${order}`,
                        reason: `${data.total} mẫu: T=${(taiProb*100).toFixed(0)}%`
                    };
                }
            }
        }
        return bestPred;
    }
    
    patternDetect(arr) {
        if (arr.length < 4) return null;
        let perfect = true;
        for (let i = 0; i < 5 && i < arr.length - 1; i++) {
            if (arr[i] === arr[i+1]) perfect = false;
        }
        if (perfect) return { pred: arr[0] === 'TAI' ? 'XIU' : 'TAI', conf: 85, type: '1-1 Pattern' };
        if (arr.length >= 6 && arr[0] === arr[1] && arr[2] === arr[3] && arr[0] !== arr[2]) {
            return { pred: arr[2], conf: 80, type: '2-2 Pattern' };
        }
        let streak = 1;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[0]) streak++;
            else break;
        }
        if (streak >= 5) return { pred: arr[0] === 'TAI' ? 'XIU' : 'TAI', conf: 80, type: 'Break Streak' };
        if (streak >= 3) return { pred: arr[0], conf: 75, type: 'Follow Streak' };
        return null;
    }
    
    trendPredict(arr, points) {
        if (arr.length < 20) return null;
        const shortTAI = arr.slice(0, 5).filter(x => x === 'TAI').length / 5;
        const longTAI = arr.slice(0, 20).filter(x => x === 'TAI').length / 20;
        const diff = shortTAI - longTAI;
        if (Math.abs(diff) > 0.25) {
            return {
                pred: diff > 0 ? 'XIU' : 'TAI',
                conf: 60 + Math.abs(diff) * 80,
                type: 'Trend Reversion',
                reason: `Short=${(shortTAI*100).toFixed(0)}% Long=${(longTAI*100).toFixed(0)}%`
            };
        }
        return null;
    }
    
    viPredict(points) {
        if (points.length < 10) return null;
        const last = points[0];
        const avg = points.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
        const std = Math.sqrt(points.slice(0, 10).reduce((a, b) => a + Math.pow(b - avg, 2), 0) / 10);
        if (last >= avg + 2 * std) return { pred: 'XIU', conf: 85, type: 'Bollinger High' };
        if (last <= avg - 2 * std) return { pred: 'TAI', conf: 85, type: 'Bollinger Low' };
        if (last >= 16) return { pred: 'XIU', conf: 90, type: 'Extreme High' };
        if (last <= 5) return { pred: 'TAI', conf: 90, type: 'Extreme Low' };
        return null;
    }
    
    statisticalPredict(arr) {
        if (arr.length < 30) return null;
        const total30 = arr.slice(0, 30);
        const taiCount = total30.filter(x => x === 'TAI').length;
        const imbalance = Math.abs(taiCount - 15);
        if (imbalance >= 7) {
            return {
                pred: taiCount > 15 ? 'XIU' : 'TAI',
                conf: 65 + imbalance * 3,
                type: 'Statistical Balance',
                reason: `${taiCount}T-${30-taiCount}X → Cân bằng`
            };
        }
        return null;
    }
    
    tongHopHuyDiet() {
        const arr = this._arr();
        const points = this._points();
        if (arr.length < 2) return { pred: 'TAI', conf: 50, type: 'Default' };
        
        const allPredictions = [];
        const lstmResult = this.lstmPredict(arr);
        if (lstmResult) allPredictions.push({ ...lstmResult, priority: this.weights.lstm });
        
        const transformerResult = this.transformerPredict(arr);
        if (transformerResult) allPredictions.push({ ...transformerResult, priority: this.weights.transformer });
        
        const monteCarloResult = this.monteCarlo.predict(arr);
        if (monteCarloResult) allPredictions.push({ ...monteCarloResult, priority: this.weights.monteCarlo });
        
        const chaosResult = this.chaos.predict(arr);
        if (chaosResult) allPredictions.push({ ...chaosResult, priority: this.weights.chaos });
        
        const markovResult = this.markovPredict(arr);
        if (markovResult) allPredictions.push({ ...markovResult, priority: this.weights.markov });
        
        if (this.bayesianHistory.length > 0) {
            const bayes = this.bayesianPriors;
            allPredictions.push({
                pred: bayes.TAI > bayes.XIU ? 'TAI' : 'XIU',
                conf: 50 + Math.abs(bayes.TAI - bayes.XIU) * 80,
                type: 'Bayesian',
                priority: this.weights.bayesian,
                reason: `P(T)=${(bayes.TAI*100).toFixed(1)}%`
            });
        }
        
        const bestGenome = this.genetic.getBestGenome();
        if (bestGenome) {
            const geneticPred = this.genetic.predictWithGenome(bestGenome, arr.slice(0, 10));
            allPredictions.push({
                pred: geneticPred,
                conf: bestGenome.confidenceThreshold,
                type: 'Genetic Optimized',
                priority: this.weights.genetic,
                reason: `Gen ${this.genetic.generations}, Fitness=${(bestGenome.fitness*100).toFixed(1)}%`
            });
        }
        
        const patternResult = this.patternDetect(arr);
        if (patternResult) allPredictions.push({ ...patternResult, priority: this.weights.pattern });
        
        const trendResult = this.trendPredict(arr, points);
        if (trendResult) allPredictions.push({ ...trendResult, priority: this.weights.trend });
        
        const viResult = this.viPredict(points);
        if (viResult) allPredictions.push({ ...viResult, priority: 1.0 });
        
        const statResult = this.statisticalPredict(arr);
        if (statResult) allPredictions.push({ ...statResult, priority: this.weights.statistical });
        
        if (allPredictions.length === 0) {
            return { pred: arr[0], conf: 55, type: 'Last Follow' };
        }
        
        let taiScore = 0, xiuScore = 0;
        for (const pred of allPredictions) {
            const weight = pred.priority * (pred.conf / 100);
            if (pred.pred === 'TAI') taiScore += weight;
            else xiuScore += weight;
        }
        
        const taiProb = taiScore / (taiScore + xiuScore);
        const xiuProb = xiuScore / (taiScore + xiuScore);
        let confidence = 50 + Math.abs(taiProb - xiuProb) * 90;
        if (Math.abs(taiProb - 0.5) > 0.3) confidence += 5;
        if (allPredictions.length >= 5) confidence += 3;
        if (this.volatilityIndex > 0.7) confidence -= 5;
        confidence = Math.min(95, Math.max(55, confidence));
        
        const finalPred = taiProb > xiuProb ? 'TAI' : 'XIU';
        const sorted = allPredictions.sort((a, b) => b.priority * (b.conf/100) - a.priority * (a.conf/100));
        const top3 = sorted.slice(0, 3);
        
        return {
            pred: finalPred,
            conf: confidence,
            type: '💀 GOD DESTROYER',
            reason: `${allPredictions.length} algorithms → ${finalPred} (${(Math.max(taiProb,xiuProb)*100).toFixed(1)}%)`,
            details: {
                totalAlgos: allPredictions.length,
                taiProbability: (taiProb * 100).toFixed(1) + '%',
                xiuProbability: (xiuProb * 100).toFixed(1) + '%',
                consensus: Math.abs(taiProb - 0.5) > 0.3 ? 'SIÊU MẠNH' : 
                          Math.abs(taiProb - 0.5) > 0.15 ? 'MẠNH' : 'TRUNG BÌNH',
                marketState: this.marketState,
                volatility: (this.volatilityIndex * 100).toFixed(1) + '%',
                optimalConfidence: this.optimalConfidence,
                topAlgorithms: top3.map(a => ({
                    name: a.type,
                    prediction: a.pred,
                    confidence: a.conf.toFixed(0) + '%',
                    weight: a.priority.toFixed(2)
                }))
            }
        };
    }
    
    apDungDaoChieu(p) {
        if (!p || this.history.length < 1) return p;
        const currentResult = this._arr()[0];
        if (this.error_streak >= 2) {
            const arr = this._arr();
            const errorPattern = arr.slice(0, 3).join('');
            this.errorPatterns.set(errorPattern, (this.errorPatterns.get(errorPattern) || 0) + 1);
            if (this.errorPatterns.get(errorPattern) >= 3) {
                return {
                    ...p,
                    pred: p.pred === 'TAI' ? 'XIU' : 'TAI',
                    conf: Math.min(92, p.conf + 8),
                    type: '🔄 AUTO-CORRECT',
                    reason: `Error pattern "${errorPattern}" → Reverse`
                };
            }
        }
        if (this.marketState === 'VOLATILE' && p.conf < 75) {
            return {
                ...p,
                pred: p.pred === 'TAI' ? 'XIU' : 'TAI',
                conf: Math.min(90, p.conf + 5),
                type: '🌊 VOLATILE REVERSE',
                reason: `Volatility=${(this.volatilityIndex*100).toFixed(0)}% → Reverse`
            };
        }
        return p;
    }
    
    predict(data) {
        this.loadData(data);
        let result = this.tongHopHuyDiet();
        if (result) result = this.apDungDaoChieu(result);
        else result = { pred: this._arr()[0] || 'TAI', conf: 50, type: 'Default' };
        this.last_prediction = result.pred;
        this.predictionHistory.push(result);
        if (this.predictionHistory.length > 100) this.predictionHistory.shift();
        stats.total_predictions_made++;
        stats.last_prediction = result.pred;
        return result;
    }
    
    updateStatus(actual) {
        if (!this.last_prediction) return;
        const a = actual.toUpperCase().replace('XỈU', 'XIU').replace('TÀI', 'TAI');
        const wasCorrect = this.last_prediction === a;
        if (wasCorrect) {
            this.error_streak = 0;
            this.consecutive_correct++;
            stats.streak_correct++;
            stats.streak_wrong = 0;
            stats.best_streak = Math.max(stats.best_streak, stats.streak_correct);
            stats.correct++;
        } else {
            this.error_streak++;
            this.consecutive_correct = 0;
            stats.streak_wrong++;
            stats.streak_correct = 0;
            stats.worst_streak = Math.max(stats.worst_streak, stats.streak_wrong);
            stats.wrong++;
        }
        stats.total++;
        if (this.predictionHistory.length > 0) {
            const lastPred = this.predictionHistory[this.predictionHistory.length - 1];
            if (lastPred.details && lastPred.details.topAlgorithms) {
                for (const algo of lastPred.details.topAlgorithms) {
                    const perf = this.algoPerformance.get(algo.name);
                    if (perf) {
                        perf.recentTotal++;
                        if (algo.prediction === a) { perf.recentCorrect++; perf.streak = Math.max(0, perf.streak) + 1; }
                        else { perf.streak = Math.min(0, perf.streak) - 1; }
                    }
                }
            }
        }
        if (this.predictionHistory.length > 0) {
            const lastConf = this.predictionHistory[this.predictionHistory.length - 1].conf;
            if (lastConf >= 80) stats.confidence_stats.high++;
            else if (lastConf >= 65) stats.confidence_stats.medium++;
            else stats.confidence_stats.low++;
        }
        const hour = new Date().getHours();
        if (!stats.hourly_stats[hour]) stats.hourly_stats[hour] = { correct: 0, total: 0, profit: 0 };
        stats.hourly_stats[hour].total++;
        if (wasCorrect) {
            stats.hourly_stats[hour].correct++;
            stats.hourly_stats[hour].profit += 0.95;
        } else {
            stats.hourly_stats[hour].profit -= 1;
        }
        stats.history.push({
            time: vnNow(),
            prediction: this.last_prediction,
            actual: a,
            correct: wasCorrect,
            streak: stats.streak_correct
        });
        if (stats.history.length > 1000) stats.history.shift();
        stats.accuracy_curve.push(stats.total > 0 ? stats.correct / stats.total : 0);
        if (stats.accuracy_curve.length > 100) stats.accuracy_curve.shift();
        stats.learning_progress = Math.min(100, 
            (this.markovChains.size / 500) * 40 +
            (this.bayesianHistory.length / 100) * 30 +
            (this.predictionHistory.length / 100) * 30
        );
        this.updateWeights();
        stats.daily_profit = stats.correct * 0.95 - stats.wrong;
    }
    
    getDetailedStats() {
        const accuracy = stats.total > 0 ? (stats.correct / stats.total * 100).toFixed(2) : 0;
        const recentHistory = stats.history.slice(-20);
        const recentAccuracy = recentHistory.length > 0 ?
            (recentHistory.filter(h => h.correct).length / recentHistory.length * 100).toFixed(2) : 0;
        return {
            ...stats,
            accuracy: accuracy + '%',
            recent_accuracy: recentAccuracy + '%',
            profit_rate: this.calculateProfitRate(),
            best_hour: this.getBestHour(),
            current_streak: stats.streak_correct > 0 ?
                `✅ Đúng ${stats.streak_correct} liên tiếp` :
                `❌ Sai ${stats.streak_wrong} liên tiếp`,
            recommendation: this.getRecommendation(),
            model_version: stats.model_version,
            learning_progress: stats.learning_progress.toFixed(1) + '%',
            market_state: this.marketState,
            volatility: (this.volatilityIndex * 100).toFixed(1) + '%',
            optimal_confidence: this.optimalConfidence,
            genetic_generation: this.genetic.generations,
            markov_states: this.markovChains.size,
            error_patterns: this.errorPatterns.size,
            top_weights: Object.entries(this.weights)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, weight]) => ({ name, weight: weight.toFixed(2) }))
        };
    }
    
    calculateProfitRate() {
        if (stats.total === 0) return '0%';
        const profit = stats.correct * 0.95 - stats.wrong;
        return (profit / stats.total * 100).toFixed(2) + '%';
    }
    
    getBestHour() {
        let bestHour = null, bestAccuracy = 0;
        for (const [hour, data] of Object.entries(stats.hourly_stats)) {
            if (data.total >= 5) {
                const acc = data.correct / data.total;
                if (acc > bestAccuracy) { bestAccuracy = acc; bestHour = hour; }
            }
        }
        return bestHour ? `${bestHour}h (${(bestAccuracy*100).toFixed(1)}%)` : 'Chưa đủ';
    }
    
    getRecommendation() {
        const accuracy = stats.total > 0 ? stats.correct / stats.total : 0;
        const streak = stats.streak_correct;
        const learning = stats.learning_progress;
        if (accuracy >= 0.80 && streak >= 5 && learning > 80) return '👑 GOD MODE - CHUẨN TUYỆT ĐỐI';
        if (accuracy >= 0.75 && streak >= 3) return '🔥 SIÊU NÓNG - TỰ TIN CAO';
        if (accuracy >= 0.70) return '✅ RẤT TỐT - TIẾP TỤC';
        if (accuracy >= 0.65) return '📈 TỐT - ĐANG CẢI THIỆN';
        if (accuracy >= 0.55) return '⚠️ TRUNG BÌNH - ĐANG HỌC';
        return '🛑 ĐANG HỌC - CHỜ THÊM DỮ LIỆU';
    }
}

// ============================================================
// 💀 KHỞI TẠO GLOBAL PREDICTOR
// ============================================================
const predictor = new TX_LogicPen_GOD_DESTROYER();

// ============================================================
// 📡 LẤY DỮ LIỆU API
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
        const res = await axios.get('https://wtx.tele68.com/v1/tx/sessions', { timeout: 10000 });
        return transformData(res.data);
    } catch (e) {
        console.log('HU fetch error:', e.message);
        return null;
    }
}

async function fetchMd5() {
    try {
        const res = await axios.get('https://wtxmd52.tele68.com/v1/txmd5/sessions', { timeout: 10000 });
        return transformData(res.data);
    } catch (e) {
        console.log('MD5 fetch error:', e.message);
        return null;
    }
}

// ============================================================
// 💾 LƯU LỊCH SỬ - 1000 PHIÊN
// ============================================================
let historyData = { hu: [], md5: [] };
const HISTORY_FILE = './history_galaxy.json';

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            historyData = data;
            if (historyData.hu && historyData.hu.length > 0) {
                stats.last_phien = historyData.hu[0]?.phien || 0;
            }
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
// 🎯 HÀM DỰ ĐOÁN - TỰ ĐỘNG +1
// ============================================================
function calculatePrediction(data, type) {
    const phien = data[0]?.Phien || 0;
    const ketQua = data[0]?.Ket_qua === 'T' ? 'TAI' : 'XIU';
    
    const historyDataForPredictor = data.map(item => ({
        ket_qua: item.Ket_qua === 'T' ? 'TAI' : 'XIU',
        tong: item.Tong,
        phien: item.Phien
    }));
    
    const result = predictor.predict(historyDataForPredictor);
    
    // Tự động +1 phiên
    if (phien > stats.last_phien) {
        stats.last_phien = phien;
    }
    
    const existingIndex = historyData[type].findIndex(r => r.phien === phien);
    
    const record = {
        phien: phien,
        duDoan: result.pred,
        doTinCay: result.conf.toFixed(0) + '%',
        ketQua: ketQua,
        trangThai: result.pred === ketQua ? 'WIN' : 'LOSE',
        loai: type.toUpperCase(),
        thoiGian: vnNow(),
        algorithmCount: result.details?.totalAlgos || 0,
        reason: result.reason || '',
        marketState: result.details?.marketState || 'UNKNOWN',
        confidence: result.conf.toFixed(0)
    };
    
    if (existingIndex !== -1) {
        historyData[type][existingIndex] = record;
    } else {
        historyData[type].unshift(record);
        if (historyData[type].length > 1000) {
            historyData[type] = historyData[type].slice(0, 1000);
        }
    }
    
    predictor.updateStatus(ketQua);
    saveHistory();
    
    return {
        prediction: result.pred,
        confidence: result.conf,
        phien: phien,
        ketQua: ketQua,
        trangThai: result.pred === ketQua ? 'WIN' : 'LOSE',
        algorithmCount: result.details?.totalAlgos || 0,
        reason: result.reason || '',
        marketState: result.details?.marketState || 'UNKNOWN',
        details: result.details || {}
    };
}

// ============================================================
// 🌌 RENDER GIAO DIỆN GALAXY
// ============================================================
const renderGalaxyPage = (title, type) => `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>🌌 TX PREDICTOR GALAXY - ${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: #0a0a1a;
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
        }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: #ffd700; border-radius: 10px; }

        /* 🌌 Galaxy Background */
        .galaxy-bg {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: 
                radial-gradient(ellipse at 20% 50%, rgba(88, 101, 242, 0.08) 0%, transparent 50%),
                radial-gradient(ellipse at 80% 20%, rgba(255, 215, 0, 0.04) 0%, transparent 40%),
                radial-gradient(ellipse at 50% 80%, rgba(255, 0, 128, 0.03) 0%, transparent 40%),
                #0a0a1a;
        }
        .galaxy-bg::before {
            content: '';
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-image: 
                radial-gradient(2px 2px at 20px 30px, #eee, transparent),
                radial-gradient(2px 2px at 40px 70px, #fff, transparent),
                radial-gradient(1px 1px at 90px 40px, #fff, transparent),
                radial-gradient(1px 1px at 130px 80px, #fff, transparent),
                radial-gradient(2px 2px at 160px 30px, #eee, transparent);
            background-size: 200px 100px;
            background-repeat: repeat;
            opacity: 0.15;
            animation: twinkle 4s ease-in-out infinite alternate;
        }
        @keyframes twinkle {
            0% { opacity: 0.1; }
            100% { opacity: 0.25; }
        }

        /* 🌟 Shooting Stars */
        .shooting-star {
            position: fixed;
            width: 100px;
            height: 1px;
            background: linear-gradient(to right, rgba(255,255,255,0), rgba(255,215,0,0.4), rgba(255,255,255,0));
            animation: shoot 8s linear infinite;
            z-index: 0;
        }
        .shooting-star:nth-child(1) { top: 10%; left: -100px; animation-delay: 0s; }
        .shooting-star:nth-child(2) { top: 30%; left: -100px; animation-delay: 3s; }
        .shooting-star:nth-child(3) { top: 60%; left: -100px; animation-delay: 6s; }
        @keyframes shoot {
            0% { transform: translateX(0) rotate(-35deg); opacity: 0; }
            10% { opacity: 1; }
            80% { opacity: 1; }
            100% { transform: translateX(120vw) rotate(-35deg); opacity: 0; }
        }

        .container { position: relative; z-index: 1; max-width: 800px; margin: 0 auto; padding: 16px; min-height: 100vh; }

        /* 🪐 Header Galaxy */
        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 20px;
            background: rgba(255,255,255,0.02);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,215,0,0.06);
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(255,215,0,0.15);
            animation: glowPulse 2s ease-in-out infinite;
        }
        @keyframes glowPulse {
            0%, 100% { box-shadow: 0 0 20px rgba(255,215,0,0.1); }
            50% { box-shadow: 0 0 60px rgba(255,215,0,0.25); }
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 18px; font-weight: 700;
            background: linear-gradient(135deg, #ffd700, #ff6b35, #ff1493);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 8px; color: rgba(255,215,0,0.2); letter-spacing: 2px; text-transform: uppercase; }
        .header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .status-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 12px; background: rgba(0,255,136,0.04);
            border-radius: 20px; font-size: 9px; color: rgba(255,255,255,0.4);
            border: 1px solid rgba(0,255,136,0.04);
        }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: #00ff88; animation: dotPulse 1.5s ease-in-out infinite; }
        @keyframes dotPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.2; transform: scale(0.6); } }
        .header-time { font-size: 10px; color: rgba(255,255,255,0.2); font-family: 'Orbitron', sans-serif; }
        .phien-counter {
            font-size: 10px; color: rgba(255,215,0,0.3);
            font-family: 'Orbitron', sans-serif;
            padding: 2px 10px;
            border: 1px solid rgba(255,215,0,0.05);
            border-radius: 12px;
        }

        .nav-links { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 14px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.03);
            color: rgba(255,255,255,0.2); font-size: 7px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: #ffd70044; color: #ffd70088; background: rgba(255,215,0,0.02); }
        .nav-link.active { border-color: #ffd70066; color: #ffd700; background: rgba(255,215,0,0.04); }

        /* 💎 Card Galaxy */
        .card {
            background: rgba(255,255,255,0.01);
            border-radius: 20px; border: 1px solid rgba(255,255,255,0.02);
            padding: 24px; transition: all 0.4s ease;
            margin-bottom: 16px;
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '🌌';
            position: absolute;
            top: -30px;
            right: -10px;
            font-size: 80px;
            opacity: 0.02;
            transform: rotate(15deg);
        }
        .card:hover { border-color: rgba(255,215,0,0.04); box-shadow: 0 0 60px rgba(255,215,0,0.02); transform: translateY(-1px); }

        .pred-result {
            font-size: 72px; font-weight: 900; font-family: 'Orbitron', sans-serif;
            margin: 0 0 4px; transition: all 0.6s ease; line-height: 1; min-height: 80px;
            letter-spacing: 4px; text-align: center;
        }
        .pred-result.tai { color: #4fc3f7; text-shadow: 0 0 80px rgba(79,195,247,0.15); }
        .pred-result.xiu { color: #ef5350; text-shadow: 0 0 80px rgba(239,83,80,0.15); }
        .pred-result.waiting { color: rgba(255,255,255,0.03); animation: textPulse 1.8s ease-in-out infinite; font-size: 24px; letter-spacing: 6px; }
        @keyframes textPulse { 0%,100% { opacity: 0.2; } 50% { opacity: 0.5; } }

        .pred-meta { display: flex; justify-content: center; gap: 24px; flex-wrap: wrap; margin: 4px 0 6px; }
        .meta-item { display: flex; flex-direction: column; align-items: center; gap: 1px; }
        .meta-item .label { font-size: 7px; color: rgba(255,255,255,0.08); text-transform: uppercase; letter-spacing: 1.5px; }
        .meta-item .value { font-size: 18px; font-weight: 700; font-family: 'Orbitron', sans-serif; }
        .meta-item .value.confidence { color: #ffd700; }

        .bar-track { width: 100%; height: 3px; background: rgba(255,255,255,0.02); border-radius: 10px; overflow: hidden; margin-top: 4px; }
        .bar-fill { height: 100%; border-radius: 10px; background: linear-gradient(90deg, #ef5350, #ffd54f, #ffd700); transition: width 1.2s ease; width: 0%; }

        .vip-badge {
            text-align: center;
            font-size: 8px;
            color: rgba(255,215,0,0.06);
            font-family: 'Orbitron', sans-serif;
            letter-spacing: 2px;
            margin-top: 6px;
        }
        .vip-badge i { color: #ffd70033; margin: 0 3px; }

        .btn-history {
            display: inline-block; padding: 6px 20px; border-radius: 20px;
            border: 1px solid #ffd70022; background: rgba(255,215,0,0.02);
            color: #ffd70088; font-size: 9px; font-weight: 500; cursor: pointer;
            transition: all 0.3s ease; text-decoration: none;
            font-family: 'Orbitron', sans-serif; letter-spacing: 0.5px;
        }
        .btn-history:hover { background: rgba(255,215,0,0.04); border-color: #ffd70044; }

        .footer { text-align: center; padding: 12px 20px 4px; color: rgba(255,255,255,0.02); font-size: 7px; border-top: 1px solid rgba(255,255,255,0.01); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: #ffd70033; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 12px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 14px; }
            .logo-icon { width: 32px; height: 32px; font-size: 14px; }
            .header-right { justify-content: space-between; }
            .pred-result { font-size: 44px; min-height: 50px; }
            .pred-meta { gap: 14px; }
            .meta-item .value { font-size: 14px; }
            .card { padding: 14px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .pred-result { font-size: 32px; min-height: 38px; }
            .phien-counter { font-size: 8px; }
        }
    </style>
</head>
<body>

<!-- 🌌 Galaxy Background -->
<div class="galaxy-bg"></div>
<div class="shooting-star"></div>
<div class="shooting-star"></div>
<div class="shooting-star"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">🌌</div>
            <div>
                <div class="logo-text">GALAXY PREDICTOR</div>
                <div class="logo-sub">ĐẠI CA KHÔI · GOD DESTROYER</div>
            </div>
        </div>
        <div class="header-right">
            <span class="phien-counter">#<span id="phienDisplay">---</span></span>
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
        <div style="text-align:center;margin-bottom:8px;">
            <span style="font-family:'Orbitron',sans-serif;font-size:10px;color:rgba(255,215,0,0.06);letter-spacing:2px;">
                💀 GOD DESTROYER · DỰ ĐOÁN ${title}
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
                    <span class="label">Thuật toán</span>
                    <span class="value" id="algos" style="color:rgba(255,255,255,0.15);font-size:13px;">0</span>
                </div>
                <div class="meta-item">
                    <span class="label">Thị trường</span>
                    <span class="value" id="market" style="color:rgba(255,255,255,0.1);font-size:11px;">---</span>
                </div>
            </div>
            <div class="bar-track">
                <div class="bar-fill" id="bar"></div>
            </div>
            <div class="vip-badge">
                <i class="fas fa-crown"></i> 10+ THUẬT TOÁN GOD DESTROYER <i class="fas fa-crown"></i>
            </div>
            <div style="text-align:center;margin-top:6px;">
                <span id="reason" style="font-size:7px;color:rgba(255,255,255,0.05);font-family:'Orbitron',sans-serif;">---</span>
            </div>
        </div>
    </div>

    <div style="text-align:center;">
        <a href="/lichsu/${type}" class="btn-history"><i class="fas fa-history"></i> Xem lịch sử ${title}</a>
    </div>

    <div class="footer">
        <p>🌌 <strong>GALAXY PREDICTOR ULTIMATE</strong> © ĐẠI CA KHÔI</p>
        <p style="font-size:5px;color:rgba(255,255,255,0.01);margin-top:2px;">10+ Thuật toán · AI · LSTM · Transformer · MCTS · Genetic · Chaos</p>
    </div>

</div>

<script>
// 🛡️ Bảo mật tối đa
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
// Chống console
console.log = function() {};
console.warn = function() {};
console.error = function() {};
console.info = function() {};
console.debug = function() {};

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
    } catch (e) { return null; }
}

async function fetchPrediction() {
    var data = await fetchAPI('/api/${type}');
    if (data) {
        var resultEl = document.getElementById('result');
        var confEl = document.getElementById('conf');
        var phienEl = document.getElementById('phienDisplay');
        var barEl = document.getElementById('bar');
        var algosEl = document.getElementById('algos');
        var marketEl = document.getElementById('market');
        var reasonEl = document.getElementById('reason');

        if (resultEl) {
            resultEl.textContent = data.duDoan || '---';
            resultEl.className = 'pred-result';
            if (data.duDoan === 'TAI') resultEl.classList.add('tai');
            else if (data.duDoan === 'XIU') resultEl.classList.add('xiu');
            else resultEl.classList.add('waiting');
        }

        if (confEl) confEl.textContent = data.doTinCay || '0%';
        if (phienEl) phienEl.textContent = data.phien || '---';
        if (algosEl) algosEl.textContent = (data.algorithmCount || 0) + ' algos';
        if (marketEl) marketEl.textContent = data.marketState || '---';
        if (reasonEl) reasonEl.textContent = data.reason || '---';

        var conf = parseInt(data.doTinCay) || 0;
        if (barEl) barEl.style.width = Math.min(100, conf) + '%';
    }
}

var isRefreshing = false;
async function refreshAll() {
    if (isRefreshing) return;
    isRefreshing = true;
    try { await fetchPrediction(); } catch (e) {}
    isRefreshing = false;
}

document.addEventListener('DOMContentLoaded', function() {
    refreshAll();
    setInterval(refreshAll, 5000);
});
</script>
</body>
</html>
`;

// ============================================================
// 📊 RENDER LỊCH SỬ GALAXY
// ============================================================
const renderGalaxyHistory = (type, title) => `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>📊 Lịch sử ${title} - GALAXY PREDICTOR</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: #0a0a1a;
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
        }
        ::-webkit-scrollbar { width: 2px; }
        ::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
        ::-webkit-scrollbar-thumb { background: #ffd700; border-radius: 10px; }

        .galaxy-bg {
            position: fixed;
            top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 20% 50%, rgba(88,101,242,0.06), transparent 50%),
                        radial-gradient(ellipse at 80% 20%, rgba(255,215,0,0.03), transparent 40%),
                        #0a0a1a;
        }
        .galaxy-bg::before {
            content: '';
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            background-image: radial-gradient(1px 1px at 20px 30px, #eee, transparent),
                              radial-gradient(1px 1px at 40px 70px, #fff, transparent);
            background-size: 200px 100px;
            background-repeat: repeat;
            opacity: 0.08;
        }

        .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 16px; min-height: 100vh; }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 20px;
            background: rgba(255,255,255,0.01);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,215,0,0.04);
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon {
            width: 40px; height: 40px;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 18px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 16px; font-weight: 700;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 7px; color: rgba(255,215,0,0.15); letter-spacing: 2px; text-transform: uppercase; }
        .header-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .header-time { font-size: 10px; color: rgba(255,255,255,0.15); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 14px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.02);
            color: rgba(255,255,255,0.15); font-size: 7px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: #ffd70033; color: #ffd70066; }
        .nav-link.active { border-color: #ffd70044; color: #ffd700; }

        .page-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            color: #ffd70066;
            text-align: center;
            margin-bottom: 16px;
            letter-spacing: 2px;
        }

        .card {
            background: rgba(255,255,255,0.01);
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.02);
            padding: 16px; transition: all 0.3s ease;
            margin-bottom: 12px;
        }
        .card:hover { border-color: rgba(255,215,0,0.03); }
        .card-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 9px; color: rgba(255,255,255,0.1);
            margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
            letter-spacing: 1px;
        }
        .card-title i { color: #ffd70044; }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin-bottom: 12px; }
        @media (max-width: 600px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        .stat-card {
            background: rgba(255,255,255,0.005); border-radius: 10px;
            padding: 10px 6px; text-align: center;
            border: 1px solid rgba(255,255,255,0.005);
        }
        .stat-number { font-size: 22px; font-weight: 700; font-family: 'Orbitron', sans-serif; color: #ffd70066; }
        .stat-number.good { color: #66bb6a88; }
        .stat-number.bad { color: #ef535088; }
        .stat-number.winrate { color: #ffd54f88; }
        .stat-label { font-size: 7px; color: rgba(255,255,255,0.06); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }

        .history-container { max-height: 500px; overflow-y: auto; margin-top: 4px; }
        .history-table { width: 100%; border-collapse: collapse; font-size: 10px; }
        .history-table thead { position: sticky; top: 0; z-index: 2; }
        .history-table th {
            text-align: left; padding: 4px 6px;
            color: rgba(255,255,255,0.06); font-size: 7px; text-transform: uppercase;
            letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.01);
            background: rgba(10,10,26,0.95);
            font-weight: 500;
        }
        .history-table td { padding: 3px 6px; border-bottom: 1px solid rgba(255,255,255,0.005); color: rgba(255,255,255,0.2); font-size: 9px; }
        .history-table .phien { color: rgba(255,255,255,0.3); font-family: 'Orbitron', sans-serif; font-size: 8px; }
        .history-table .win { color: #66bb6a88; font-weight: 600; }
        .history-table .lose { color: #ef535088; font-weight: 600; }

        .btn-back {
            display: inline-block; padding: 6px 18px; border-radius: 20px;
            border: 1px solid #ffd70022; background: rgba(255,215,0,0.02);
            color: #ffd70066; font-size: 9px; font-weight: 500; cursor: pointer;
            transition: all 0.3s ease; text-decoration: none;
            font-family: 'Orbitron', sans-serif; letter-spacing: 0.5px;
        }
        .btn-back:hover { background: rgba(255,215,0,0.03); border-color: #ffd70033; }

        .footer { text-align: center; padding: 12px 20px 4px; color: rgba(255,255,255,0.02); font-size: 7px; border-top: 1px solid rgba(255,255,255,0.01); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 12px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 14px; }
            .page-title { font-size: 16px; }
            .stat-number { font-size: 18px; }
            .history-table { font-size: 8px; }
            .history-table th, .history-table td { padding: 2px 4px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .page-title { font-size: 13px; }
            .stat-number { font-size: 14px; }
            .history-table { font-size: 7px; }
            .history-table th, .history-table td { padding: 1px 3px; }
        }
    </style>
</head>
<body>

<div class="galaxy-bg"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">📊</div>
            <div>
                <div class="logo-text">GALAXY PREDICTOR</div>
                <div class="logo-sub">ĐẠI CA KHÔI · GOD DESTROYER</div>
            </div>
        </div>
        <div class="header-right">
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

    <div class="page-title">📊 LỊCH SỬ ${title} (1000 phiên)</div>

    <div class="card">
        <div class="card-title"><i class="fas fa-chart-line"></i> THỐNG KÊ ${title}</div>
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
    </div>

    <div class="card">
        <div class="card-title"><i class="fas fa-history"></i> CHI TIẾT ${title}</div>
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
                    <tr><td colspan="5" style="text-align:center;padding:20px;color:rgba(255,255,255,0.03);font-size:9px;"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>
                </tbody>
            </table>
        </div>
    </div>

    <div class="footer">
        <p>🌌 <strong>GALAXY PREDICTOR ULTIMATE</strong> © ĐẠI CA KHÔI</p>
    </div>

</div>

<script>
// 🛡️ Bảo mật
document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
document.addEventListener('touchstart', function(e) { if (e.touches.length > 1) e.preventDefault(); });
document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].indexOf(e.key) > -1) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault(); return false;
    }
});
console.log = function() {}; console.warn = function() {}; console.error = function() {}; console.info = function() {};

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
    } catch (e) { return null; }
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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:rgba(255,255,255,0.03);">Chưa có dữ liệu</td></tr>';
        return;
    }
    var rows = '';
    for (var i = 0; i < Math.min(history.length, 200); i++) {
        var r = history[i];
        var statusClass = r.trangThai === 'WIN' ? 'win' : 'lose';
        var statusText = r.trangThai === 'WIN' ? '✅ THẮNG' : '❌ THUA';
        rows += '<tr>' +
            '<td class="phien">#' + r.phien + '</td>' +
            '<td>' + (r.duDoan || '---') + '</td>' +
            '<td>' + (r.ketQua || '---') + '</td>' +
            '<td>' + (r.doTinCay || '0%') + '</td>' +
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
    var wins = history.filter(h => h.trangThai === 'WIN').length;
    var loses = history.filter(h => h.trangThai === 'LOSE').length;
    document.getElementById('totalPreds').textContent = total;
    document.getElementById('totalCorrect').textContent = wins;
    document.getElementById('totalWrong').textContent = loses;
    document.getElementById('winRate').textContent = total > 0 ? (wins / total * 100).toFixed(1) + '%' : '0%';
}

document.addEventListener('DOMContentLoaded', function() {
    fetchHistory();
    setInterval(fetchHistory, 5000);
});
</script>
</body>
</html>
`;

// ============================================================
// 🚀 ROUTES
// ============================================================

// Trang chủ Galaxy
app.get('/', function(req, res) {
    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>🌌 GALAXY PREDICTOR ULTIMATE</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: #0a0a1a;
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
        }
        .galaxy-bg {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 20% 50%, rgba(88,101,242,0.06), transparent 50%),
                        radial-gradient(ellipse at 80% 20%, rgba(255,215,0,0.03), transparent 40%),
                        #0a0a1a;
        }
        .galaxy-bg::before {
            content: ''; position: absolute; top: 0; left: 0;
            width: 100%; height: 100%;
            background-image: radial-gradient(1px 1px at 20px 30px, #eee, transparent),
                              radial-gradient(1px 1px at 40px 70px, #fff, transparent);
            background-size: 200px 100px;
            background-repeat: repeat;
            opacity: 0.06;
        }
        .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 16px; min-height: 100vh; }
        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 20px;
            background: rgba(255,255,255,0.01);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,215,0,0.03);
            margin-bottom: 16px;
            flex-wrap: wrap;
            gap: 10px;
        }
        .logo { display: flex; align-items: center; gap: 12px; }
        .logo-icon {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, #ffd700, #ff6b35, #ff1493);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 8px; color: rgba(255,215,0,0.15); letter-spacing: 2px; text-transform: uppercase; }
        .header-time { font-size: 10px; color: rgba(255,255,255,0.15); font-family: 'Orbitron', sans-serif; }
        .nav-links { display: flex; gap: 6px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 14px; border-radius: 20px;
            border: 1px solid rgba(255,255,255,0.02);
            color: rgba(255,255,255,0.15); font-size: 7px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: #ffd70033; color: #ffd70066; }
        .nav-link.active { border-color: #ffd70044; color: #ffd700; }
        .welcome {
            text-align: center;
            padding: 40px 20px;
            background: rgba(255,255,255,0.01);
            border-radius: 16px;
            border: 1px solid rgba(255,255,255,0.01);
            margin-bottom: 16px;
        }
        .welcome h1 {
            font-family: 'Orbitron', sans-serif;
            font-size: 32px; font-weight: 900;
            background: linear-gradient(135deg, #ffd700, #ff6b35, #ff1493);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            margin-bottom: 8px;
        }
        .welcome p { color: rgba(255,215,0,0.2); font-size: 12px; letter-spacing: 1px; }
        .welcome .version { color: rgba(255,215,0,0.06); font-size: 8px; margin-top: 6px; font-family: 'Orbitron', sans-serif; letter-spacing: 2px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
        @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
        .menu-card {
            background: rgba(255,255,255,0.005);
            border-radius: 16px; border: 1px solid rgba(255,255,255,0.01);
            padding: 24px 16px;
            text-align: center;
            transition: all 0.3s ease;
            text-decoration: none;
            color: #fff;
            display: block;
            position: relative;
            overflow: hidden;
        }
        .menu-card::before {
            content: '🌌';
            position: absolute; top: -10px; right: -10px;
            font-size: 50px; opacity: 0.02;
        }
        .menu-card:hover { border-color: rgba(255,215,0,0.04); transform: translateY(-2px); }
        .menu-card .icon { font-size: 32px; margin-bottom: 8px; display: block; }
        .menu-card .title { font-family: 'Orbitron', sans-serif; font-size: 14px; font-weight: 700; color: #ffd70066; }
        .menu-card .desc { font-size: 9px; color: rgba(255,215,0,0.08); margin-top: 3px; }
        .footer { text-align: center; padding: 12px 20px 4px; color: rgba(255,255,255,0.02); font-size: 7px; border-top: 1px solid rgba(255,255,255,0.01); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: #ffd70022; }
        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 12px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 16px; }
            .welcome h1 { font-size: 24px; }
        }
    </style>
</head>
<body>
<div class="galaxy-bg"></div>
<div class="container">
    <header class="header">
        <div class="logo">
            <div class="logo-icon">🌌</div>
            <div>
                <div class="logo-text">GALAXY PREDICTOR</div>
                <div class="logo-sub">ĐẠI CA KHÔI · GOD DESTROYER</div>
            </div>
        </div>
        <div class="header-right">
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
        <h1>🌌 GALAXY PREDICTOR ULTIMATE</h1>
        <p>🚀 Hệ thống dự đoán Tài Xỉu thế hệ mới</p>
        <p class="version">💀 GOD DESTROYER · 10+ Thuật toán · LSTM · Transformer · MCTS · Genetic · Chaos</p>
    </div>
    <div class="grid">
        <a href="/hu" class="menu-card"><span class="icon">🎲</span><div class="title">Dự đoán HŨ</div><div class="desc">10+ thuật toán GOD DESTROYER</div></a>
        <a href="/md5" class="menu-card"><span class="icon">🎲</span><div class="title">Dự đoán MD5</div><div class="desc">10+ thuật toán GOD DESTROYER</div></a>
        <a href="/lichsu/hu" class="menu-card"><span class="icon">📊</span><div class="title">Lịch sử HŨ</div><div class="desc">1000 phiên - Thống kê thực tế</div></a>
        <a href="/lichsu/md5" class="menu-card"><span class="icon">📊</span><div class="title">Lịch sử MD5</div><div class="desc">1000 phiên - Thống kê thực tế</div></a>
    </div>
    <div class="footer"><p>🌌 <strong>GALAXY PREDICTOR ULTIMATE</strong> © ĐẠI CA KHÔI</p></div>
</div>
<script>
document.addEventListener('gesturestart', function(e) { e.preventDefault(); });
document.addEventListener('touchstart', function(e) { if (e.touches.length > 1) e.preventDefault(); });
document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
document.addEventListener('keydown', function(e) {
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].indexOf(e.key) > -1) || (e.ctrlKey && e.key === 'U')) {
        e.preventDefault(); return false;
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

app.get('/hu', function(req, res) {
    res.send(renderGalaxyPage('HŨ', 'hu'));
});

app.get('/md5', function(req, res) {
    res.send(renderGalaxyPage('MD5', 'md5'));
});

app.get('/lichsu/hu', function(req, res) {
    res.send(renderGalaxyHistory('hu', 'HŨ'));
});

app.get('/lichsu/md5', function(req, res) {
    res.send(renderGalaxyHistory('md5', 'MD5'));
});

// ============================================================
// 📡 API
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
            reason: result.reason || '',
            algorithmCount: result.algorithmCount || 0,
            marketState: result.marketState || 'UNKNOWN'
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
            reason: result.reason || '',
            algorithmCount: result.algorithmCount || 0,
            marketState: result.marketState || 'UNKNOWN'
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
    const detailedStats = predictor.getDetailedStats();
    res.json(detailedStats);
});

app.get('/api/reset', function(req, res) {
    historyData = { hu: [], md5: [] };
    stats = {
        total: 0, correct: 0, wrong: 0,
        last_prediction: null,
        start_time: vnNow(),
        history: [],
        total_predictions_made: 0,
        streak_correct: 0, streak_wrong: 0,
        best_streak: 0, worst_streak: 0,
        confidence_stats: { high: 0, medium: 0, low: 0 },
        hourly_stats: {},
        daily_profit: 0,
        accuracy_curve: [],
        profit_curve: [],
        learning_progress: 0,
        model_version: "GOD_DESTROYER_v3.0",
        last_phien: 0
    };
    saveHistory();
    res.json({ message: '🌌 Reset thành công - GALAXY PREDICTOR' });
});

// ============================================================
// 🚀 KHỞI ĐỘNG SERVER
// ============================================================
loadHistory();
app.listen(PORT, '0.0.0.0', function() {
    console.log('========================================');
    console.log('🌌 GALAXY PREDICTOR ULTIMATE');
    console.log('💀 GOD DESTROYER - 10+ THUẬT TOÁN SIÊU HỦY DIỆT');
    console.log('📊 1000 PHIÊN - TỰ ĐỘNG +1 - LƯU TRỮ ĐẦY ĐỦ');
    console.log('🛡️ BẢO MẬT TỐI ĐA');
    console.log('Server: http://0.0.0.0:' + PORT);
    console.log('========================================');
});
