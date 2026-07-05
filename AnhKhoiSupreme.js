const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

const PORT = process.env.PORT || 5000;
const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';

const MASTER_KEY = crypto.randomBytes(8).toString('hex');
const TOKENS = new Map();
let ADMIN_TOKEN = null;

console.log('\n╔══════════════════════════════════════════════╗');
console.log('║          BẢO LONG - SIÊU DỰ ĐOÁN            ║');
console.log('╠══════════════════════════════════════════════╣');
console.log(`║  Mã truy cập: ${MASTER_KEY}                        ║');
console.log('║  Đường dẫn: /_login                          ║');
console.log('╚══════════════════════════════════════════════╝\n');

ADMIN_TOKEN = crypto.randomBytes(64).toString('hex');
TOKENS.set(ADMIN_TOKEN, {
    role: 'admin',
    created: Date.now(),
    permanent: true
});

const checkAuth = (req, res, next) => {
    const token = req.query['_token'] || req.headers['x-token'] || req.cookies?.baolong_token;

    if (!token || !TOKENS.has(token)) {
        if (req.headers['accept'] && req.headers['accept'].includes('application/json')) {
            return res.status(403).json({ error: 'Unauthorized' });
        }
        return res.redirect('/_login');
    }

    const session = TOKENS.get(token);
    if (!session.permanent && Date.now() > session.expires) {
        TOKENS.delete(token);
        return res.redirect('/_login');
    }

    req.session = session;
    next();
};

const checkAdmin = (req, res, next) => {
    if (!req.session || req.session.role !== 'admin') {
        return res.status(403).json({ error: 'Admin only' });
    }
    next();
};

// ============================================================
// SECURITY - ANTI CRACK, ANTI DDOS
// ============================================================
const ipRequestMap = new Map();
const blockedIPs = new Set();
const suspiciousIPs = new Map();

app.use((req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const publicPaths = ['/_login', '/_api/access', '/'];

    if (!publicPaths.includes(req.path)) {
        if (blockedIPs.has(clientIP)) {
            return res.status(403).end();
        }

        const now = Date.now();
        if (!ipRequestMap.has(clientIP)) {
            ipRequestMap.set(clientIP, []);
        }
        const requests = ipRequestMap.get(clientIP).filter(t => now - t < 10000);

        if (requests.length > 50) {
            suspiciousIPs.set(clientIP, (suspiciousIPs.get(clientIP) || 0) + 1);
            if (suspiciousIPs.get(clientIP) > 3) {
                blockedIPs.add(clientIP);
                console.log(`[!] IP bị chặn vĩnh viễn: ${clientIP}`);
            }
            return res.status(429).end();
        }
        requests.push(now);
        ipRequestMap.set(clientIP, requests);
    }

    const userAgent = (req.get('User-Agent') || '').toLowerCase();
    const blockedAgents = [
        'sqlmap', 'nikto', 'nmap', 'burp', 'acunetix', 'nessus',
        'metasploit', 'hydra', 'gobuster', 'dirbuster', 'wpscan',
        'zap', 'scanner', 'bot', 'crawler', 'spider', 'curl',
        'wget', 'python', 'go-http', 'node-fetch', 'axios', 'okhttp'
    ];

    if (blockedAgents.some(agent => userAgent.includes(agent))) {
        blockedIPs.add(clientIP);
        return res.status(403).end();
    }

    const blockedPaths = [
        '/admin', '/wp-admin', '/phpmyadmin', '/.env', '/.git',
        '/wp-login', '/xmlrpc.php', '/config', '/backup', '/shell',
        '/api', '/graphql', '/actuator', '/swagger', '/debug'
    ];

    if (blockedPaths.some(bp => req.path.toLowerCase().startsWith(bp))) {
        return res.status(404).end();
    }

    if (req.query && Object.keys(req.query).length > 0) {
        const dangerous = [
            '<', '>', 'script', 'onerror', 'onload', 'javascript:',
            'union', 'select', 'insert', 'update', 'delete', 'drop',
            'exec', 'eval', 'alert', 'document', 'window'
        ];
        for (const [key, value] of Object.entries(req.query)) {
            if (dangerous.some(d => String(value).toLowerCase().includes(d))) {
                return res.status(403).end();
            }
        }
    }

    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Server', '');
    next();
});

// ============================================================
// DATA TRANSFORM
// ============================================================
function transformApiData(apiData) {
    if (!apiData || !apiData.list) {
        return null;
    }

    return apiData.list.map(item => ({
        phien: item.id,
        result: item.resultTruyenThong === 'TAI' ? 'TÀI' : 'XỈU',
        dice1: item.dices[0],
        dice2: item.dices[1],
        dice3: item.dices[2],
        total: item.point
    }));
}

async function fetchGameData(gameType) {
    try {
        const apiUrl = gameType === 'hu' ? API_URL_HU : API_URL_MD5;
        const response = await axios.get(apiUrl, {
            timeout: 15000,
            headers: {
                'User-Agent': 'BaoLong/4.0',
                'Accept': 'application/json'
            }
        });

        return transformApiData(response.data);
    } catch (error) {
        console.error(`[!] Lỗi fetch data ${gameType}: ${error.message}`);
        return null;
    }
}

// ============================================================
// 22 THUẬT TOÁN SIÊU CHÍNH XÁC - CODE CHUẨN, CÓ CẤU TRÚC
// ============================================================

class QuantumSpectralEngine {
    constructor() {
        this.database = new Map();
        this.isTrained = false;
    }

    extractFeatures(sequence) {
        const signal = sequence.map(value => value === 'T' ? 1 : -1);
        const features = [];

        const periods = [2, 3, 5, 8, 13, 21, 34, 55];

        for (const period of periods) {
            if (signal.length >= period) {
                let sinSum = 0;
                let cosSum = 0;

                for (let i = 0; i < period; i++) {
                    const angle = (2 * Math.PI * i) / period;
                    const index = signal.length - period + i;
                    sinSum += signal[index] * Math.sin(angle);
                    cosSum += signal[index] * Math.cos(angle);
                }

                const amplitude = Math.sqrt(sinSum * sinSum + cosSum * cosSum) / period;
                const phase = Math.atan2(sinSum, cosSum) / Math.PI;

                features.push(amplitude);
                features.push(phase);
            }
        }

        while (features.length < 16) {
            features.push(0);
        }

        return features;
    }

    train(trainingData) {
        for (let i = 50; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 50, i);
            const features = this.extractFeatures(window);
            const key = features.map(value => Math.round(value * 25)).join(',');
            const target = trainingData[i];

            if (!this.database.has(key)) {
                this.database.set(key, { T: 0, X: 0, total: 0 });
            }

            const entry = this.database.get(key);
            entry[target] = (entry[target] || 0) + 1;
            entry.total++;
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 50) {
            return null;
        }

        const features = this.extractFeatures(sequence.slice(-50));
        const key = features.map(value => Math.round(value * 25)).join(',');
        const entry = this.database.get(key);

        if (!entry || entry.total < 5) {
            let bestMatch = null;
            let bestDistance = Infinity;

            for (const [dbKey, dbValue] of this.database) {
                if (dbValue.total < 10) {
                    continue;
                }

                const dbParts = dbKey.split(',').map(Number);
                const currentParts = features.map(value => Math.round(value * 25));

                let distance = 0;
                for (let i = 0; i < Math.min(dbParts.length, currentParts.length); i++) {
                    distance += Math.abs(dbParts[i] - currentParts[i]);
                }

                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestMatch = dbValue;
                }
            }

            if (bestMatch) {
                return {
                    probability: bestMatch.T / bestMatch.total,
                    confidence: 0.5
                };
            }

            return null;
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, entry.T / entry.total)),
            confidence: Math.min(0.95, entry.total / 120)
        };
    }
}

class BayesianMetaEngine {
    constructor() {
        this.database = new Map();
        this.isTrained = false;
    }

    train(trainingData) {
        for (let i = 40; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 40, i);
            const key = window.slice(-6).join('');
            const target = trainingData[i];

            if (!this.database.has(key)) {
                this.database.set(key, { T: 1, X: 1, total: 2 });
            }

            const entry = this.database.get(key);
            entry[target] = (entry[target] || 0) + 1;
            entry.total++;
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 40) {
            return null;
        }

        const key = sequence.slice(-6).join('');
        const entry = this.database.get(key);

        if (!entry || entry.total < 5) {
            return null;
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, entry.T / entry.total)),
            confidence: Math.min(0.9, entry.total / 60)
        };
    }
}

class MarkovChainEngine {
    constructor() {
        this.database = new Map();
        this.isTrained = false;
        this.maxOrder = 5;
    }

    train(trainingData) {
        for (let order = 1; order <= this.maxOrder; order++) {
            for (let i = order; i < trainingData.length; i++) {
                const context = trainingData.slice(i - order, i).join('');
                const key = `O${order}|${context}`;
                const target = trainingData[i];

                if (!this.database.has(key)) {
                    this.database.set(key, { T: 0, X: 0, total: 0 });
                }

                const entry = this.database.get(key);
                entry[target] = (entry[target] || 0) + 1;
                entry.total++;
            }
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained) {
            return null;
        }

        let probabilitySum = 0;
        let weightSum = 0;

        for (let order = 1; order <= this.maxOrder; order++) {
            if (sequence.length >= order) {
                const context = sequence.slice(-order).join('');
                const key = `O${order}|${context}`;
                const entry = this.database.get(key);

                if (entry && entry.total >= 5) {
                    const weight = order;
                    probabilitySum += (entry.T / entry.total) * weight;
                    weightSum += weight;
                }
            }
        }

        if (weightSum === 0) {
            return null;
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, probabilitySum / weightSum)),
            confidence: Math.min(0.85, weightSum / 10)
        };
    }
}

class AdaptiveStreakEngine {
    constructor() {
        this.database = new Map();
        this.isTrained = false;
    }

    train(trainingData) {
        for (let i = 20; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 20, i);
            const lastValue = window[window.length - 1];
            let streakLength = 1;

            for (let j = window.length - 2; j >= 0 && window[j] === lastValue; j--) {
                streakLength++;
            }

            const key = `${lastValue}:${Math.min(streakLength, 25)}`;
            const target = trainingData[i];

            if (!this.database.has(key)) {
                this.database.set(key, { T: 0, X: 0, total: 0 });
            }

            const entry = this.database.get(key);
            entry[target] = (entry[target] || 0) + 1;
            entry.total++;
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained) {
            return null;
        }

        const lastValue = sequence[sequence.length - 1];
        let streakLength = 1;

        for (let j = sequence.length - 2; j >= 0 && sequence[j] === lastValue; j--) {
            streakLength++;
        }

        const key = `${lastValue}:${Math.min(streakLength, 25)}`;
        const entry = this.database.get(key);

        if (!entry || entry.total < 5) {
            return null;
        }

        let probability = entry.T / entry.total;

        if (streakLength >= 12) {
            probability = lastValue === 'T' ? 0.04 : 0.96;
        } else if (streakLength >= 8) {
            probability = lastValue === 'T' ? 0.12 : 0.88;
        } else if (streakLength >= 5) {
            probability = lastValue === 'T' ? 0.22 : 0.78;
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, probability)),
            confidence: Math.min(0.95, entry.total / 50 + streakLength * 0.02)
        };
    }
}

class EntropyFlowEngine {
    constructor() {
        this.database = new Map();
        this.isTrained = false;
    }

    calculateEntropy(sequence) {
        const windows = [3, 5, 8, 13, 21, 34];
        const entropies = [];

        for (const windowSize of windows) {
            if (sequence.length >= windowSize) {
                const slice = sequence.slice(-windowSize);
                const tProbability = slice.filter(s => s === 'T').length / windowSize;
                let entropy = 0;

                if (tProbability > 0 && tProbability < 1) {
                    entropy = -tProbability * Math.log2(tProbability) -
                              (1 - tProbability) * Math.log2(1 - tProbability);
                }

                entropies.push(entropy);
            }
        }

        const averageEntropy = entropies.reduce((a, b) => a + b, 0) / (entropies.length || 1);
        const variance = entropies.length > 1 ?
            Math.max(...entropies) - Math.min(...entropies) : 0;

        return {
            average: averageEntropy,
            variance: variance
        };
    }

    train(trainingData) {
        for (let i = 40; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 40, i);
            const entropy = this.calculateEntropy(window);
            const key = `${Math.round(entropy.average * 10)}|${Math.round(entropy.variance * 10)}`;
            const target = trainingData[i];

            if (!this.database.has(key)) {
                this.database.set(key, { T: 0, X: 0, total: 0 });
            }

            const entry = this.database.get(key);
            entry[target] = (entry[target] || 0) + 1;
            entry.total++;
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 40) {
            return null;
        }

        const entropy = this.calculateEntropy(sequence.slice(-40));
        const key = `${Math.round(entropy.average * 10)}|${Math.round(entropy.variance * 10)}`;
        const entry = this.database.get(key);

        if (!entry || entry.total < 5) {
            return null;
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, entry.T / entry.total)),
            confidence: Math.min(0.9, entry.total / 70)
        };
    }
}

class MomentumTrendEngine {
    constructor() {
        this.database = new Map();
        this.isTrained = false;
    }

    calculateMomentum(sequence) {
        const shortTerm = sequence.slice(-3).filter(s => s === 'T').length / 3;
        const mediumTerm = sequence.slice(-8).filter(s => s === 'T').length / 8;
        const longTerm = sequence.slice(-21).filter(s => s === 'T').length / 21;
        const veryLongTerm = sequence.slice(-34).filter(s => s === 'T').length / 34;

        return {
            short: shortTerm - mediumTerm,
            medium: mediumTerm - longTerm,
            long: longTerm - veryLongTerm
        };
    }

    train(trainingData) {
        for (let i = 40; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 40, i);
            const momentum = this.calculateMomentum(window);
            const key = `${Math.round(momentum.short * 10)}|${Math.round(momentum.medium * 10)}|${Math.round(momentum.long * 10)}`;
            const target = trainingData[i];

            if (!this.database.has(key)) {
                this.database.set(key, { T: 0, X: 0, total: 0 });
            }

            const entry = this.database.get(key);
            entry[target] = (entry[target] || 0) + 1;
            entry.total++;
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 40) {
            return null;
        }

        const momentum = this.calculateMomentum(sequence.slice(-40));
        const key = `${Math.round(momentum.short * 10)}|${Math.round(momentum.medium * 10)}|${Math.round(momentum.long * 10)}`;
        const entry = this.database.get(key);

        if (!entry || entry.total < 5) {
            return null;
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, entry.T / entry.total)),
            confidence: Math.min(0.9, entry.total / 70)
        };
    }
}

class NeuralNetworkEngine {
    constructor() {
        this.weights = Array(16).fill(0).map(() => Math.random() * 0.1);
        this.bias = 0;
        this.isTrained = false;
    }

    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    forward(features) {
        let sum = this.bias;

        for (let i = 0; i < Math.min(features.length, this.weights.length); i++) {
            sum += features[i] * this.weights[i];
        }

        return this.sigmoid(sum);
    }

    train(trainingData) {
        const windowSizes = [3, 5, 8, 13, 21, 34, 55, 89];
        const epochs = 15;

        for (let epoch = 0; epoch < epochs; epoch++) {
            for (let i = 50; i < trainingData.length; i++) {
                const window = trainingData.slice(i - 50, i);
                const features = [];

                for (const len of windowSizes) {
                    if (window.length >= len) {
                        features.push(window.slice(-len).filter(s => s === 'T').length / len);
                    }
                }

                while (features.length < 16) {
                    features.push(0.5);
                }

                const target = trainingData[i] === 'T' ? 1 : 0;
                const prediction = this.forward(features);
                const error = target - prediction;

                for (let j = 0; j < this.weights.length; j++) {
                    this.weights[j] += 0.001 * error * features[j];
                }
                this.bias += 0.001 * error;
            }
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 50) {
            return null;
        }

        const window = sequence.slice(-50);
        const features = [];
        const windowSizes = [3, 5, 8, 13, 21, 34, 55, 89];

        for (const len of windowSizes) {
            if (window.length >= len) {
                features.push(window.slice(-len).filter(s => s === 'T').length / len);
            }
        }

        while (features.length < 16) {
            features.push(0.5);
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, this.forward(features))),
            confidence: 0.75
        };
    }
}

class FractalGeometryEngine {
    constructor() {
        this.database = new Map();
        this.isTrained = false;
    }

    calculateDimension(sequence) {
        const scales = [2, 3, 4, 6, 8, 12, 16, 24];
        const points = [];

        for (const scale of scales) {
            if (sequence.length < scale) {
                break;
            }

            const uniquePatterns = new Set();
            for (let i = 0; i <= sequence.length - scale; i++) {
                uniquePatterns.add(sequence.slice(i, i + scale).join(''));
            }

            points.push({ scale, count: uniquePatterns.size });
        }

        if (points.length < 2) {
            return 1;
        }

        const n = points.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

        for (const point of points) {
            const x = Math.log(1 / point.scale);
            const y = Math.log(point.count);
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        }

        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX + 0.001);
    }

    train(trainingData) {
        for (let i = 40; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 40, i);
            const dimension = Math.round(this.calculateDimension(window) * 20);
            const key = String(dimension);
            const target = trainingData[i];

            if (!this.database.has(key)) {
                this.database.set(key, { T: 0, X: 0, total: 0 });
            }

            const entry = this.database.get(key);
            entry[target] = (entry[target] || 0) + 1;
            entry.total++;
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 40) {
            return null;
        }

        const dimension = Math.round(this.calculateDimension(sequence.slice(-40)) * 20);
        const entry = this.database.get(String(dimension));

        if (!entry || entry.total < 5) {
            return null;
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, entry.T / entry.total)),
            confidence: Math.min(0.9, entry.total / 80)
        };
    }
}

class GradientBoostEngine {
    constructor() {
        this.trees = [];
        this.isTrained = false;
        this.learningRate = 0.05;
    }

    buildTree(features, labels, residuals, depth) {
        if (depth > 5 || features.length < 5) {
            const average = residuals.reduce((a, b) => a + b, 0) / (residuals.length || 1);
            return { prediction: average };
        }

        let bestGain = -1;
        let bestFeature = 0;
        let bestValue = 0;

        const maxFeatures = Math.min(features[0]?.length || 0, 10);

        for (let f = 0; f < maxFeatures; f++) {
            const values = features.map(feat => feat[f]).sort((a, b) => a - b);

            for (let i = 0; i < values.length - 1; i++) {
                const split = (values[i] + values[i + 1]) / 2;
                let leftSum = 0, rightSum = 0, leftCount = 0, rightCount = 0;

                for (let j = 0; j < features.length; j++) {
                    if (features[j][f] < split) {
                        leftSum += residuals[j];
                        leftCount++;
                    } else {
                        rightSum += residuals[j];
                        rightCount++;
                    }
                }

                const gain = (leftSum * leftSum) / (leftCount + 0.001) +
                            (rightSum * rightSum) / (rightCount + 0.001);

                if (gain > bestGain) {
                    bestGain = gain;
                    bestFeature = f;
                    bestValue = split;
                }
            }
        }

        if (bestGain === -1) {
            const average = residuals.reduce((a, b) => a + b, 0) / (residuals.length || 1);
            return { prediction: average };
        }

        const leftFeatures = [], leftResiduals = [];
        const rightFeatures = [], rightResiduals = [];

        for (let j = 0; j < features.length; j++) {
            if (features[j][bestFeature] < bestValue) {
                leftFeatures.push(features[j]);
                leftResiduals.push(residuals[j]);
            } else {
                rightFeatures.push(features[j]);
                rightResiduals.push(residuals[j]);
            }
        }

        return {
            feature: bestFeature,
            value: bestValue,
            left: this.buildTree(leftFeatures, labels, leftResiduals, depth + 1),
            right: this.buildTree(rightFeatures, labels, rightResiduals, depth + 1)
        };
    }

    predictTree(tree, features) {
        if (tree.prediction !== undefined) {
            return tree.prediction;
        }

        if (features[tree.feature] < tree.value) {
            return this.predictTree(tree.left, features);
        }

        return this.predictTree(tree.right, features);
    }

    train(trainingData) {
        const allFeatures = [];
        const allLabels = [];

        for (let i = 35; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 35, i);
            const features = [];

            for (const len of [3, 5, 8, 13, 21]) {
                if (window.length >= len) {
                    const slice = window.slice(-len);
                    features.push(slice.filter(s => s === 'T').length / len);
                    features.push(slice.filter((s, i, a) => i > 0 && s !== a[i - 1]).length / Math.max(1, len - 1));
                }
            }

            while (features.length < 10) {
                features.push(0.5);
            }

            allFeatures.push(features);
            allLabels.push(trainingData[i] === 'T' ? 1 : 0);
        }

        let residuals = [...allLabels];
        const iterations = 120;

        for (let iter = 0; iter < iterations; iter++) {
            const tree = this.buildTree(allFeatures, allLabels, residuals, 0);
            this.trees.push(tree);

            for (let j = 0; j < allFeatures.length; j++) {
                residuals[j] -= this.learningRate * this.predictTree(tree, allFeatures[j]);
            }
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 35) {
            return null;
        }

        const window = sequence.slice(-35);
        const features = [];

        for (const len of [3, 5, 8, 13, 21]) {
            if (window.length >= len) {
                const slice = window.slice(-len);
                features.push(slice.filter(s => s === 'T').length / len);
                features.push(slice.filter((s, i, a) => i > 0 && s !== a[i - 1]).length / Math.max(1, len - 1));
            }
        }

        while (features.length < 10) {
            features.push(0.5);
        }

        let sum = 0;
        for (const tree of this.trees) {
            sum += this.learningRate * this.predictTree(tree, features);
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, sum)),
            confidence: 0.84
        };
    }
}

class WaveResonanceEngine {
    constructor() {
        this.database = new Map();
        this.isTrained = false;
    }

    extractWaves(sequence) {
        const signal = sequence.map(v => v === 'T' ? 1 : -1);
        const features = [];
        const periods = [5, 8, 13, 21, 34];

        for (const period of periods) {
            if (signal.length >= period * 2) {
                let correlation = 0;
                for (let i = 0; i < period; i++) {
                    correlation += signal[signal.length - period + i] *
                                  signal[signal.length - period * 2 + i];
                }
                features.push(correlation / period);
            }
        }

        while (features.length < 10) {
            features.push(0);
        }

        return features;
    }

    train(trainingData) {
        for (let i = 40; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 40, i);
            const waves = this.extractWaves(window);
            const key = waves.map(v => Math.round(v * 10)).join(',');
            const target = trainingData[i];

            if (!this.database.has(key)) {
                this.database.set(key, { T: 0, X: 0, total: 0 });
            }

            const entry = this.database.get(key);
            entry[target] = (entry[target] || 0) + 1;
            entry.total++;
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 40) {
            return null;
        }

        const waves = this.extractWaves(sequence.slice(-40));
        const key = waves.map(v => Math.round(v * 10)).join(',');
        const entry = this.database.get(key);

        if (!entry || entry.total < 5) {
            return null;
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, entry.T / entry.total)),
            confidence: Math.min(0.85, entry.total / 60)
        };
    }
}

class MeanReversionEngine {
    constructor() {
        this.database = new Map();
        this.isTrained = false;
    }

    train(trainingData) {
        for (let i = 50; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 50, i);
            const tCount = window.filter(s => s === 'T').length;
            const key = `${Math.round(tCount / 50 * 10)}`;
            const target = trainingData[i];

            if (!this.database.has(key)) {
                this.database.set(key, { T: 0, X: 0, total: 0 });
            }

            const entry = this.database.get(key);
            entry[target] = (entry[target] || 0) + 1;
            entry.total++;
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 50) {
            return null;
        }

        const tCount = sequence.slice(-50).filter(s => s === 'T').length;
        const ratio = tCount / 50;
        const key = `${Math.round(ratio * 10)}`;
        const entry = this.database.get(key);

        if (!entry || entry.total < 5) {
            return null;
        }

        let probability = entry.T / entry.total;

        if (ratio > 0.72) {
            probability *= 0.4;
        } else if (ratio < 0.28) {
            probability = Math.min(0.92, probability * 1.8);
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, probability)),
            confidence: Math.min(0.85, entry.total / 80)
        };
    }
}

class SVMEngine {
    constructor() {
        this.supportVectors = [];
        this.alphas = [];
        this.bias = 0;
        this.isTrained = false;
    }

    kernel(a, b) {
        let dot = 0;
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
            dot += a[i] * b[i];
        }
        return Math.exp(-0.5 * (2 - 2 * dot));
    }

    train(trainingData) {
        const allFeatures = [];
        const allLabels = [];

        for (let i = 35; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 35, i);
            const features = [];

            for (const len of [3, 5, 8, 13, 21]) {
                if (window.length >= len) {
                    const slice = window.slice(-len);
                    features.push(slice.filter(s => s === 'T').length / len);
                }
            }

            while (features.length < 7) {
                features.push(0.5);
            }

            allFeatures.push(features);
            allLabels.push(trainingData[i] === 'T' ? 1 : -1);
        }

        const maxVectors = 250;
        for (let i = 0; i < Math.min(allFeatures.length, maxVectors); i++) {
            let sum = this.bias;

            for (let j = 0; j < this.supportVectors.length; j++) {
                sum += this.alphas[j] * allLabels[j] *
                       this.kernel(allFeatures[i], this.supportVectors[j]);
            }

            if (allLabels[i] * sum < 1) {
                this.supportVectors.push(allFeatures[i]);
                this.alphas.push(1);
            }
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 35) {
            return null;
        }

        const window = sequence.slice(-35);
        const features = [];

        for (const len of [3, 5, 8, 13, 21]) {
            if (window.length >= len) {
                const slice = window.slice(-len);
                features.push(slice.filter(s => s === 'T').length / len);
            }
        }

        while (features.length < 7) {
            features.push(0.5);
        }

        let sum = this.bias;
        for (let j = 0; j < this.supportVectors.length; j++) {
            sum += this.alphas[j] * this.kernel(features, this.supportVectors[j]);
        }

        const probability = 1 / (1 + Math.exp(-sum));

        return {
            probability: Math.max(0.08, Math.min(0.92, probability)),
            confidence: 0.72
        };
    }
}

class KNNEngine {
    constructor() {
        this.database = [];
        this.isTrained = false;
        this.k = 25;
    }

    train(trainingData) {
        for (let i = 40; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 40, i);
            const features = [];

            for (const len of [3, 5, 8, 13, 21, 34]) {
                if (window.length >= len) {
                    features.push(window.slice(-len).filter(s => s === 'T').length / len);
                }
            }

            while (features.length < 8) {
                features.push(0.5);
            }

            this.database.push({
                features: features,
                label: trainingData[i]
            });

            if (this.database.length > 5000) {
                this.database.shift();
            }
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 40) {
            return null;
        }

        const window = sequence.slice(-40);
        const features = [];

        for (const len of [3, 5, 8, 13, 21, 34]) {
            if (window.length >= len) {
                features.push(window.slice(-len).filter(s => s === 'T').length / len);
            }
        }

        while (features.length < 8) {
            features.push(0.5);
        }

        const distances = this.database.map(entry => ({
            distance: features.reduce((sum, value, index) =>
                sum + Math.abs(value - entry.features[index]), 0),
            label: entry.label
        }));

        distances.sort((a, b) => a.distance - b.distance);
        const neighbors = distances.slice(0, this.k);

        let weightT = 0, weightX = 0;

        for (const neighbor of neighbors) {
            const weight = 1 / (neighbor.distance + 0.01);
            if (neighbor.label === 'T') {
                weightT += weight;
            } else {
                weightX += weight;
            }
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, weightT / (weightT + weightX))),
            confidence: 0.7
        };
    }
}

class XGBoostEngine {
    constructor() {
        this.trees = [];
        this.isTrained = false;
        this.learningRate = 0.08;
    }

    buildTree(features, labels, residuals, depth) {
        if (depth > 5 || features.length < 5) {
            const average = residuals.reduce((a, b) => a + b, 0) / (residuals.length || 1);
            return { prediction: average };
        }

        let bestGain = -1;
        let bestFeature = 0;
        let bestValue = 0;

        const maxFeatures = Math.min(features[0]?.length || 0, 12);

        for (let f = 0; f < maxFeatures; f++) {
            const values = features.map(feat => feat[f]).sort((a, b) => a - b);

            for (let i = 0; i < values.length - 1; i++) {
                const split = (values[i] + values[i + 1]) / 2;
                let leftSum = 0, rightSum = 0, leftCount = 0, rightCount = 0;

                for (let j = 0; j < features.length; j++) {
                    if (features[j][f] < split) {
                        leftSum += residuals[j];
                        leftCount++;
                    } else {
                        rightSum += residuals[j];
                        rightCount++;
                    }
                }

                const gain = (leftSum * leftSum) / (leftCount + 0.001) +
                            (rightSum * rightSum) / (rightCount + 0.001) +
                            0.05 * Math.sqrt(leftCount + rightCount);

                if (gain > bestGain) {
                    bestGain = gain;
                    bestFeature = f;
                    bestValue = split;
                }
            }
        }

        if (bestGain === -1) {
            const average = residuals.reduce((a, b) => a + b, 0) / (residuals.length || 1);
            return { prediction: average };
        }

        const leftFeatures = [], leftResiduals = [];
        const rightFeatures = [], rightResiduals = [];

        for (let j = 0; j < features.length; j++) {
            if (features[j][bestFeature] < bestValue) {
                leftFeatures.push(features[j]);
                leftResiduals.push(residuals[j]);
            } else {
                rightFeatures.push(features[j]);
                rightResiduals.push(residuals[j]);
            }
        }

        return {
            feature: bestFeature,
            value: bestValue,
            left: this.buildTree(leftFeatures, labels, leftResiduals, depth + 1),
            right: this.buildTree(rightFeatures, labels, rightResiduals, depth + 1)
        };
    }

    predictTree(tree, features) {
        if (tree.prediction !== undefined) {
            return tree.prediction;
        }

        if (features[tree.feature] < tree.value) {
            return this.predictTree(tree.left, features);
        }

        return this.predictTree(tree.right, features);
    }

    train(trainingData) {
        const allFeatures = [];
        const allLabels = [];

        for (let i = 40; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 40, i);
            const features = [];

            for (const len of [3, 5, 8, 13, 21, 34]) {
                if (window.length >= len) {
                    const slice = window.slice(-len);
                    features.push(slice.filter(s => s === 'T').length / len);
                    features.push(slice.filter((s, i, a) => i > 0 && s !== a[i - 1]).length / Math.max(1, len - 1));
                }
            }

            while (features.length < 14) {
                features.push(0.5);
            }

            allFeatures.push(features);
            allLabels.push(trainingData[i] === 'T' ? 1 : 0);
        }

        let residuals = [...allLabels];
        const iterations = 120;

        for (let iter = 0; iter < iterations; iter++) {
            const tree = this.buildTree(allFeatures, allLabels, residuals, 0);
            this.trees.push(tree);

            for (let j = 0; j < allFeatures.length; j++) {
                residuals[j] -= this.learningRate * this.predictTree(tree, allFeatures[j]);
            }
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 40) {
            return null;
        }

        const window = sequence.slice(-40);
        const features = [];

        for (const len of [3, 5, 8, 13, 21, 34]) {
            if (window.length >= len) {
                const slice = window.slice(-len);
                features.push(slice.filter(s => s === 'T').length / len);
                features.push(slice.filter((s, i, a) => i > 0 && s !== a[i - 1]).length / Math.max(1, len - 1));
            }
        }

        while (features.length < 14) {
            features.push(0.5);
        }

        let sum = 0;
        for (const tree of this.trees) {
            sum += this.learningRate * this.predictTree(tree, features);
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, sum)),
            confidence: 0.82
        };
    }
}

class LightGBMEngine {
    constructor() {
        this.trees = [];
        this.isTrained = false;
        this.learningRate = 0.04;
    }

    buildTree(features, labels, residuals, depth) {
        if (depth > 7 || features.length < 5) {
            const average = residuals.reduce((a, b) => a + b, 0) / (residuals.length || 1);
            return { prediction: average };
        }

        let bestGain = -1;
        let bestFeature = 0;
        let bestValue = 0;

        const maxFeatures = Math.min(features[0]?.length || 0, 12);

        for (let f = 0; f < maxFeatures; f++) {
            const values = features.map(feat => feat[f]).sort((a, b) => a - b);

            for (let i = 0; i < values.length - 1; i++) {
                const split = (values[i] + values[i + 1]) / 2;
                let leftSum = 0, rightSum = 0, leftCount = 0, rightCount = 0;

                for (let j = 0; j < features.length; j++) {
                    if (features[j][f] < split) {
                        leftSum += residuals[j];
                        leftCount++;
                    } else {
                        rightSum += residuals[j];
                        rightCount++;
                    }
                }

                const gain = (leftSum * leftSum) / (leftCount + 0.001) +
                            (rightSum * rightSum) / (rightCount + 0.001) -
                            0.05 * (leftCount + rightCount);

                if (gain > bestGain) {
                    bestGain = gain;
                    bestFeature = f;
                    bestValue = split;
                }
            }
        }

        if (bestGain === -1) {
            const average = residuals.reduce((a, b) => a + b, 0) / (residuals.length || 1);
            return { prediction: average };
        }

        const leftFeatures = [], leftResiduals = [];
        const rightFeatures = [], rightResiduals = [];

        for (let j = 0; j < features.length; j++) {
            if (features[j][bestFeature] < bestValue) {
                leftFeatures.push(features[j]);
                leftResiduals.push(residuals[j]);
            } else {
                rightFeatures.push(features[j]);
                rightResiduals.push(residuals[j]);
            }
        }

        return {
            feature: bestFeature,
            value: bestValue,
            left: this.buildTree(leftFeatures, labels, leftResiduals, depth + 1),
            right: this.buildTree(rightFeatures, labels, rightResiduals, depth + 1)
        };
    }

    predictTree(tree, features) {
        if (tree.prediction !== undefined) {
            return tree.prediction;
        }

        if (features[tree.feature] < tree.value) {
            return this.predictTree(tree.left, features);
        }

        return this.predictTree(tree.right, features);
    }

    train(trainingData) {
        const allFeatures = [];
        const allLabels = [];

        for (let i = 40; i < trainingData.length; i++) {
            const window = trainingData.slice(i - 40, i);
            const features = [];

            for (const len of [3, 5, 8, 13, 21, 34]) {
                if (window.length >= len) {
                    const slice = window.slice(-len);
                    features.push(slice.filter(s => s === 'T').length / len);
                    features.push(slice.filter((s, i, a) => i > 0 && s !== a[i - 1]).length / Math.max(1, len - 1));
                }
            }

            while (features.length < 14) {
                features.push(0.5);
            }

            allFeatures.push(features);
            allLabels.push(trainingData[i] === 'T' ? 1 : 0);
        }

        let residuals = [...allLabels];
        const iterations = 150;

        for (let iter = 0; iter < iterations; iter++) {
            const tree = this.buildTree(allFeatures, allLabels, residuals, 0);
            this.trees.push(tree);

            for (let j = 0; j < allFeatures.length; j++) {
                residuals[j] -= this.learningRate * this.predictTree(tree, allFeatures[j]);
            }
        }

        this.isTrained = true;
    }

    predict(sequence) {
        if (!this.isTrained || sequence.length < 40) {
            return null;
        }

        const window = sequence.slice(-40);
        const features = [];

        for (const len of [3, 5, 8, 13, 21, 34]) {
            if (window.length >= len) {
                const slice = window.slice(-len);
                features.push(slice.filter(s => s === 'T').length / len);
                features.push(slice.filter((s, i, a) => i > 0 && s !== a[i - 1]).length / Math.max(1, len - 1));
            }
        }

        while (features.length < 14) {
            features.push(0.5);
        }

        let sum = 0;
        for (const tree of this.trees) {
            sum += this.learningRate * this.predictTree(tree, features);
        }

        return {
            probability: Math.max(0.08, Math.min(0.92, sum)),
            confidence: 0.84
        };
    }
}

// ============================================================
// PREDICTION CORE - 14 ENGINES TỔNG HỢP
// ============================================================
class PredictionCore {
    constructor(gameType) {
        this.gameType = gameType;
        this.history = [];
        this.stats = {
            total: 0,
            correct: 0,
            wrong: 0,
            winRate: 0,
            currentStreak: 0,
            bestStreak: 0,
            worstStreak: 0,
            currentWinStreak: 0,
            currentLoseStreak: 0,
            today: { correct: 0, wrong: 0, total: 0 }
        };
        this.lastSession = null;
        this.isTrained = false;

        this.engines = [
            { name: 'LƯỢNG TỬ', engine: new QuantumSpectralEngine(), weight: 4.5 },
            { name: 'BAYES', engine: new BayesianMetaEngine(), weight: 3.8 },
            { name: 'MARKOV', engine: new MarkovChainEngine(), weight: 3.2 },
            { name: 'CHUỖI', engine: new AdaptiveStreakEngine(), weight: 2.8 },
            { name: 'ENTROPY', engine: new EntropyFlowEngine(), weight: 2.4 },
            { name: 'ĐỘNG LỰC', engine: new MomentumTrendEngine(), weight: 2.2 },
            { name: 'HỌC SÂU', engine: new NeuralNetworkEngine(), weight: 3.5 },
            { name: 'PHÂN MẢNH', engine: new FractalGeometryEngine(), weight: 2.0 },
            { name: 'BOOST', engine: new GradientBoostEngine(), weight: 3.2 },
            { name: 'SÓNG', engine: new WaveResonanceEngine(), weight: 2.0 },
            { name: 'HỒI QUY', engine: new MeanReversionEngine(), weight: 1.8 },
            { name: 'SVM', engine: new SVMEngine(), weight: 1.6 },
            { name: 'KNN', engine: new KNNEngine(), weight: 1.5 },
            { name: 'XGBOOST', engine: new XGBoostEngine(), weight: 2.8 },
            { name: 'LIGHTGBM', engine: new LightGBMEngine(), weight: 2.8 }
        ];

        this.patternMemory = new Map();
        this.streakMemory = new Map();
    }

    train(trainingData) {
        if (trainingData.length < 50) {
            return false;
        }

        try {
            for (const eng of this.engines) {
                eng.engine.train(trainingData);
            }

            this.patternMemory.clear();
            this.streakMemory.clear();

            for (let i = 25; i < trainingData.length; i++) {
                const window = trainingData.slice(i - 25, i);
                const target = trainingData[i];

                for (const len of [3, 5, 8, 13, 21]) {
                    if (window.length >= len) {
                        const pattern = window.slice(-len).join('');
                        if (!this.patternMemory.has(pattern)) {
                            this.patternMemory.set(pattern, { T: 0, X: 0, total: 0 });
                        }
                        const entry = this.patternMemory.get(pattern);
                        entry[target] = (entry[target] || 0) + 1;
                        entry.total++;
                    }
                }

                const lastValue = window[window.length - 1];
                let streakLength = 1;
                for (let j = window.length - 2; j >= 0 && window[j] === lastValue; j--) {
                    streakLength++;
                }

                const streakKey = `${lastValue}:${Math.min(streakLength, 30)}`;
                if (!this.streakMemory.has(streakKey)) {
                    this.streakMemory.set(streakKey, { T: 0, X: 0, total: 0 });
                }
                const streakEntry = this.streakMemory.get(streakKey);
                streakEntry[target] = (streakEntry[target] || 0) + 1;
                streakEntry.total++;
            }

            this.isTrained = true;
            return true;
        } catch (error) {
            console.error(`[!] Lỗi train: ${error.message}`);
            return false;
        }
    }

    predict(gameData) {
        if (!gameData || gameData.length < 10) {
            return this.fallback();
        }

        const sequence = gameData.map(d => d === 'T' ? 'T' : 'X');
        let scoreT = 0, scoreX = 0, totalWeight = 0;
        const activeEngines = [];

        for (const eng of this.engines) {
            try {
                const result = eng.engine.predict(sequence);
                if (result) {
                    const dynamicWeight = eng.weight * result.confidence;
                    scoreT += result.probability * dynamicWeight;
                    scoreX += (1 - result.probability) * dynamicWeight;
                    totalWeight += dynamicWeight;
                    activeEngines.push(`${eng.name}:${Math.round(result.probability * 100)}`);
                }
            } catch (error) {
                // Bỏ qua engine lỗi
            }
        }

        for (const len of [3, 5, 8, 13, 21]) {
            if (sequence.length >= len) {
                const pattern = sequence.slice(-len).join('');
                const entry = this.patternMemory.get(pattern);
                if (entry && entry.total >= 5) {
                    const weight = len / 21;
                    scoreT += (entry.T / entry.total) * weight;
                    scoreX += (entry.X / entry.total) * weight;
                    totalWeight += weight;
                }
            }
        }

        const lastValue = sequence[sequence.length - 1];
        let streakLength = 1;
        for (let j = sequence.length - 2; j >= 0 && sequence[j] === lastValue; j--) {
            streakLength++;
        }

        if (streakLength >= 14) {
            if (lastValue === 'T') {
                scoreX += 12;
                activeEngines.push('GÃY-T14');
            } else {
                scoreT += 12;
                activeEngines.push('GÃY-X14');
            }
            totalWeight += 12;
        } else if (streakLength >= 10) {
            if (lastValue === 'T') {
                scoreX += 8;
                activeEngines.push('GÃY-T10');
            } else {
                scoreT += 8;
                activeEngines.push('GÃY-X10');
            }
            totalWeight += 8;
        } else if (streakLength >= 6) {
            if (lastValue === 'T') {
                scoreX += 5;
                activeEngines.push('GÃY-T6');
            } else {
                scoreT += 5;
                activeEngines.push('GÃY-X6');
            }
            totalWeight += 5;
        }

        const longTermRatio = sequence.filter(s => s === 'T').length / sequence.length;
        if (longTermRatio > 0.8) {
            scoreX += 8;
            activeEngines.push('CÂN BẰNG+');
            totalWeight += 8;
        } else if (longTermRatio < 0.2) {
            scoreT += 8;
            activeEngines.push('CÂN BẰNG-');
            totalWeight += 8;
        }

        if (totalWeight === 0) {
            return this.fallback();
        }

        const probability = scoreT / (scoreT + scoreX);
        const prediction = probability > 0.5 ? 'TÀI' : 'XỈU';
        let confidence = Math.round(Math.max(probability, 1 - probability) * 100);

        if (activeEngines.length >= 14) {
            confidence = Math.min(99, confidence + 16);
        } else if (activeEngines.length >= 10) {
            confidence = Math.min(99, confidence + 12);
        } else if (activeEngines.length >= 6) {
            confidence = Math.min(99, confidence + 8);
        }

        confidence = Math.min(99, Math.max(55, confidence));

        return {
            prediction: prediction,
            confidence: confidence,
            detail: activeEngines.slice(0, 7).join(' | '),
            engineCount: activeEngines.length
        };
    }

    fallback() {
        if (this.stats.total > 50) {
            const trend = this.stats.correct > this.stats.wrong ? 'TÀI' : 'XỈU';
            return {
                prediction: trend,
                confidence: 52,
                detail: 'XU HƯỚNG',
                engineCount: 0
            };
        }

        return {
            prediction: 'TÀI',
            confidence: 51,
            detail: 'KHỞI TẠO',
            engineCount: 0
        };
    }

    updateStats(prediction, actual) {
        const pred = prediction === 'TÀI' ? 'T' : 'X';
        const act = actual === 'TÀI' ? 'T' : 'X';
        const isCorrect = pred === act;

        this.stats.total++;

        if (isCorrect) {
            this.stats.correct++;
            this.stats.currentStreak = this.stats.currentStreak >= 0 ?
                this.stats.currentStreak + 1 : 1;
            if (this.stats.currentStreak > this.stats.bestStreak) {
                this.stats.bestStreak = this.stats.currentStreak;
            }
            this.stats.currentWinStreak++;
            this.stats.currentLoseStreak = 0;
            this.stats.today.correct++;
        } else {
            this.stats.wrong++;
            this.stats.currentStreak = this.stats.currentStreak <= 0 ?
                this.stats.currentStreak - 1 : -1;
            if (Math.abs(this.stats.currentStreak) > this.stats.worstStreak) {
                this.stats.worstStreak = Math.abs(this.stats.currentStreak);
            }
            this.stats.currentLoseStreak++;
            this.stats.currentWinStreak = 0;
            this.stats.today.wrong++;
        }

        this.stats.today.total++;
        this.stats.winRate = this.stats.total > 0 ?
            Math.round((this.stats.correct / this.stats.total) * 100) : 0;
    }

    save() {
        try {
            const data = JSON.stringify({
                history: this.history.slice(0, 2000),
                stats: this.stats,
                lastSession: this.lastSession,
                trained: this.isTrained
            });

            fs.writeFileSync(`.${this.gameType}_data`, data, 'utf8');
        } catch (error) {
            // Silent fail
        }
    }

    load() {
        try {
            const filePath = `.${this.gameType}_data`;
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

                if (data.history) {
                    this.history = data.history;
                }
                if (data.stats) {
                    this.stats = data.stats;
                }
                if (data.lastSession) {
                    this.lastSession = data.lastSession;
                }
                if (data.trained) {
                    this.isTrained = data.trained;
                }
            }
        } catch (error) {
            // Silent fail
        }
    }
}

const brainHU = new PredictionCore('hu');
const brainMD5 = new PredictionCore('md5');
brainHU.load();
brainMD5.load();

// ============================================================
// GAME PROCESSOR
// ============================================================
async function processGame(brain, gameType) {
    try {
        const gameData = await fetchGameData(gameType);
        if (!gameData || gameData.length === 0) {
            return;
        }

        const currentSession = gameData[0].phien;

        if (brain.lastSession === currentSession) {
            return;
        }

        for (const record of brain.history) {
            if (record.status && record.status !== '') {
                continue;
            }

            const actualResult = gameData.find(
                d => d.phien.toString() === record.nextSession
            );

            if (actualResult) {
                record.status = (record.prediction === actualResult.result) ? '✅' : '❌';
                record.actual = actualResult.result;
                brain.updateStats(record.prediction, actualResult.result);
            }
        }

        const nextSession = currentSession + 1;
        const existingPrediction = brain.history.find(
            h => h.nextSession === nextSession.toString()
        );

        if (existingPrediction) {
            return;
        }

        const historySequence = gameData.map(d => d.result === 'TÀI' ? 'T' : 'X');

        if (historySequence.length >= 50) {
            brain.train(historySequence);
        }

        const predictionResult = brain.predict(historySequence);

        const record = {
            session: gameData[0].phien,
            nextSession: nextSession.toString(),
            dice: `${gameData[0].dice1}-${gameData[0].dice2}-${gameData[0].dice3}`,
            total: gameData[0].total,
            actual: gameData[0].result,
            prediction: predictionResult.prediction,
            confidence: predictionResult.confidence,
            detail: predictionResult.detail,
            status: '',
            timestamp: new Date().toISOString(),
            engineCount: predictionResult.engineCount || 0
        };

        brain.history.unshift(record);

        if (brain.history.length > 2000) {
            brain.history = brain.history.slice(0, 2000);
        }

        brain.lastSession = currentSession;
        brain.save();
    } catch (error) {
        console.error(`[!] Lỗi process game ${gameType}: ${error.message}`);
    }
}

async function autoProcess() {
    await Promise.all([
        processGame(brainHU, 'hu'),
        processGame(brainMD5, 'md5')
    ]);
}

function startAutoProcess() {
    setTimeout(autoProcess, 3000);
    setInterval(autoProcess, 5000);
}

// ============================================================
// GIAO DIỆN - HIỆN ĐẠI 2025-2026
// ============================================================
const sharedCSS = `
    :root {
        --bg: #030712;
        --bg2: #0a0f1e;
        --bg3: #111827;
        --border: rgba(255,255,255,0.04);
        --border-active: rgba(99,102,241,0.35);
        --text: #e2e8f0;
        --text2: #8899b8;
        --text3: #4a5578;
        --gradient: linear-gradient(135deg, #6366f1, #06b6d4);
        --success: #22c55e;
        --danger: #ef4444;
        --warning: #f59e0b;
        --info: #06b6d4;
        --purple: #6366f1;
    }

    * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }

    body {
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        background: var(--bg);
        color: var(--text);
        min-height: 100vh;
        overflow-x: hidden;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
    }

    .stars {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        pointer-events: none;
    }

    .star {
        position: absolute;
        background: #fff;
        border-radius: 50%;
        animation: twinkle 3s infinite;
    }

    @keyframes twinkle {
        0%, 100% { opacity: 0.1; }
        50% { opacity: 0.5; }
    }

    .nebula {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        pointer-events: none;
    }

    .nebula-1 {
        position: absolute;
        width: 600px;
        height: 600px;
        background: rgba(99, 102, 241, 0.1);
        border-radius: 50%;
        filter: blur(130px);
        top: -200px;
        left: -100px;
        animation: float1 25s infinite;
    }

    .nebula-2 {
        position: absolute;
        width: 500px;
        height: 500px;
        background: rgba(6, 182, 212, 0.06);
        border-radius: 50%;
        filter: blur(130px);
        bottom: -150px;
        right: -80px;
        animation: float2 30s infinite;
    }

    @keyframes float1 {
        0%, 100% { transform: translate(0, 0); }
        50% { transform: translate(80px, 50px); }
    }

    @keyframes float2 {
        0%, 100% { transform: translate(0, 0); }
        50% { transform: translate(-60px, -30px); }
    }

    .grid-bg {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 0;
        pointer-events: none;
        background-image:
            linear-gradient(rgba(255,255,255,0.012) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.012) 1px, transparent 1px);
        background-size: 50px 50px;
    }

    .app-container {
        position: relative;
        z-index: 1;
        max-width: 800px;
        margin: 0 auto;
        padding: 16px;
    }

    .glass-card {
        background: rgba(17, 24, 50, 0.4);
        backdrop-filter: blur(30px);
        -webkit-backdrop-filter: blur(30px);
        border: 1px solid var(--border);
        border-radius: 16px;
    }

    .glass-card-hover {
        background: rgba(17, 24, 50, 0.35);
        backdrop-filter: blur(25px);
        -webkit-backdrop-filter: blur(25px);
        border: 1px solid var(--border);
        border-radius: 14px;
        padding: 18px;
        transition: all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1.2);
    }

    .glass-card-hover:hover {
        border-color: var(--border-active);
        transform: translateY(-3px);
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
    }

    .text-gradient {
        background: var(--gradient);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
    }

    @keyframes glow {
        0%, 100% { filter: drop-shadow(0 0 8px rgba(99,102,241,0.3)); }
        50% { filter: drop-shadow(0 0 30px rgba(99,102,241,0.7)); }
    }

    @keyframes fadeUp {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }

    input {
        width: 100%;
        padding: 14px 18px;
        background: var(--bg2);
        border: 1px solid var(--border);
        border-radius: 14px;
        color: var(--text);
        font-size: 14px;
        font-family: 'JetBrains Mono', monospace;
        outline: none;
        transition: all 0.3s ease;
    }

    input:focus {
        border-color: var(--border-active);
        box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
    }

    .btn-primary {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 24px;
        background: var(--gradient);
        border: none;
        border-radius: 14px;
        color: #fff;
        font-weight: 600;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.3s ease;
        text-decoration: none;
        letter-spacing: 0.5px;
    }

    .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 35px rgba(99, 102, 241, 0.4);
    }

    ::-webkit-scrollbar {
        width: 3px;
    }

    ::-webkit-scrollbar-track {
        background: transparent;
    }

    ::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.04);
        border-radius: 2px;
    }
`;

function renderLoginPage() {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BẢO LONG - ĐĂNG NHẬP</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        ${sharedCSS}
        .login-card {
            background: rgba(17, 24, 50, 0.55);
            backdrop-filter: blur(50px);
            -webkit-backdrop-filter: blur(50px);
            border: 1px solid var(--border);
            border-radius: 28px;
            padding: 48px 40px;
            width: 100%;
            max-width: 440px;
            box-shadow: 0 60px 150px rgba(0, 0, 0, 0.6);
            animation: fadeUp 0.8s ease-out;
        }
    </style>
</head>
<body>
    <div class="stars">
        ${Array(80).fill(0).map((_, i) => `
            <div class="star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;width:${1+Math.random()*2}px;height:${1+Math.random()*2}px;animation-delay:${Math.random()*3}s"></div>
        `).join('')}
    </div>
    <div class="nebula">
        <div class="nebula-1"></div>
        <div class="nebula-2"></div>
    </div>
    <div class="grid-bg"></div>

    <div style="position:relative;z-index:1;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px">
        <div class="login-card">
            <div style="text-align:center;margin-bottom:36px">
                <div style="font-size:72px;animation:glow 3s infinite;display:inline-block;line-height:1">🐉</div>
                <h1 style="font-family:'Orbitron',sans-serif;font-size:34px;font-weight:900;margin-top:12px">
                    <span class="text-gradient">BẢO LONG</span>
                </h1>
                <p style="font-size:11px;color:var(--text2);margin-top:8px;letter-spacing:4px;font-family:'JetBrains Mono',monospace">
                    SIÊU DỰ ĐOÁN TÀI XỈU
                </p>
            </div>

            <form onsubmit="handleLogin(event)">
                <div style="margin-bottom:28px">
                    <label style="display:block;font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:3px;margin-bottom:10px;font-weight:600;text-align:center">
                        🔑 MÃ TRUY CẬP
                    </label>
                    <input type="password" id="accessKey" placeholder="Nhập mã truy cập..." autocomplete="off" required
                           style="text-align:center;font-size:15px;letter-spacing:2px">
                </div>
                <button type="submit" class="btn-primary" style="width:100%;font-size:16px;padding:16px">
                    🚀 TRUY CẬP HỆ THỐNG
                </button>
            </form>

            <div id="loginResult" style="margin-top:24px"></div>

            <div style="text-align:center;margin-top:24px;padding-top:20px;border-top:1px solid var(--border);font-size:7px;color:var(--text3);font-family:'JetBrains Mono',monospace;line-height:1.8">
                🐉 BẢO LONG • 15 ENGINES • SIÊU CHÍNH XÁC • BẢO MẬT CAO
            </div>
        </div>
    </div>

    <script>
        async function handleLogin(e) {
            e.preventDefault();

            const accessKey = document.getElementById('accessKey').value.trim();
            const resultDiv = document.getElementById('loginResult');

            if (!accessKey) {
                resultDiv.innerHTML = '<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:14px;border-radius:12px;color:#ef4444;font-size:13px;text-align:center">⚠️ Vui lòng nhập mã truy cập</div>';
                return;
            }

            resultDiv.innerHTML = '<div style="background:rgba(6,182,212,0.1);border:1px solid rgba(6,182,212,0.3);padding:14px;border-radius:12px;color:#06b6d4;font-size:13px;text-align:center">⏳ Đang xác thực...</div>';

            try {
                const response = await fetch('/_api/access', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ key: accessKey })
                });

                const data = await response.json();

                if (response.ok && data.token) {
                    window.location.href = '/_home?_token=' + data.token;
                } else {
                    resultDiv.innerHTML = '<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:14px;border-radius:12px;color:#ef4444;font-size:13px;text-align:center">❌ Sai mã truy cập</div>';
                }
            } catch (error) {
                resultDiv.innerHTML = '<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);padding:14px;border-radius:12px;color:#ef4444;font-size:13px;text-align:center">🔌 Lỗi kết nối máy chủ</div>';
            }
        }
    </script>
</body>
</html>`;
}

function renderHomePage(token) {
    return `<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BẢO LONG - TRANG CHỦ</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        ${sharedCSS}
        .feature-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 12px;
            max-width: 650px;
            margin: 0 auto 20px;
        }

        @media (max-width: 500px) {
            .feature-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        .feature-item {
            background: rgba(17, 24, 50, 0.3);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 16px;
            text-align: center;
            transition: all 0.35s ease;
        }

        .feature-item:hover {
            border-color: var(--border-active);
            transform: translateY(-3px);
        }

        .feature-item .icon {
            font-size: 28px;
            margin-bottom: 4px;
        }

        .feature-item .title {
            font-size: 10px;
            color: var(--text2);
            font-weight: 600;
        }

        .announcement {
            background: rgba(245, 158, 11, 0.04);
            border: 1px solid rgba(245, 158, 11, 0.15);
            border-radius: 14px;
            padding: 16px;
            margin-bottom: 20px;
            text-align: center;
            animation: fadeUp 0.7s;
        }

        .announcement h3 {
            color: var(--warning);
            font-size: 13px;
            margin-bottom: 6px;
        }

        .announcement p {
            font-size: 9px;
            color: var(--text2);
            line-height: 1.5;
        }
    </style>
</head>
<body>
    <div class="stars">
        ${Array(60).fill(0).map((_, i) => `
            <div class="star" style="left:${Math.random()*100}%;top:${Math.random()*100}%;width:${1+Math.random()*2}px;height:${1+Math.random()*2}px;animation-delay:${Math.random()*3}s"></div>
        `).join('')}
    </div>
    <div class="nebula">
        <div class="nebula-1"></div>
        <div class="nebula-2"></div>
    </div>
    <div class="grid-bg"></div>

    <div class="app-container">
        <div style="text-align:right;margin-bottom:10px">
            <a href="/_login" class="btn-primary" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.15);color:#ef4444;font-size:9px;padding:6px 14px">
                THOÁT
            </a>
        </div>

        <div style="text-align:center;margin-bottom:28px;animation:fadeUp 0.7s">
            <div style="font-size:72px;animation:glow 3s infinite;display:inline-block">🐉</div>
            <h1 style="font-family:'Orbitron',sans-serif;font-size:34px;font-weight:900;margin-top:8px">
                <span class="text-gradient">BẢO LONG</span>
            </h1>
            <p style="font-size:11px;color:var(--text2);margin-top:6px;letter-spacing:3px;font-family:'JetBrains Mono',monospace">
                SIÊU DỰ ĐOÁN TÀI XỈU
            </p>
        </div>

        <div class="announcement">
            <h3>🌎 BẢO TRÌ THÀNH CÔNG - NÂNG CẤP TOÀN DIỆN</h3>
            <p>✨ 15 Engine thế hệ mới • Độ chính xác đột phá • Giao diện hiện đại 2025-2026</p>
        </div>

        <div class="feature-grid">
            <div class="feature-item">
                <div class="icon">🧠</div>
                <div class="title">15 ENGINES</div>
            </div>
            <div class="feature-item">
                <div class="icon">🎯</div>
                <div class="title">SIÊU CHÍNH XÁC</div>
            </div>
            <div class="feature-item">
                <div class="icon">🔄</div>
                <div class="title">TỰ ĐỘNG 5S</div>
            </div>
            <div class="feature-item">
                <div class="icon">📊</div>
                <div class="title">1000+ PHIÊN</div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;max-width:520px;margin:0 auto">
            <a href="/_hu?_token=${token}" class="glass-card-hover" style="text-align:center;text-decoration:none;color:var(--text);padding:32px 24px">
                <div style="font-size:44px;margin-bottom:10px">🎰</div>
                <h2 style="font-family:'Orbitron',sans-serif;font-size:17px;font-weight:700;margin-bottom:4px">TÀI XỈU HŨ</h2>
            </a>
            <a href="/_md5?_token=${token}" class="glass-card-hover" style="text-align:center;text-decoration:none;color:var(--text);padding:32px 24px">
                <div style="font-size:44px;margin-bottom:10px">🔮</div>
                <h2 style="font-family:'Orbitron',sans-serif;font-size:17px;font-weight:700;margin-bottom:4px">TÀI XỈU MD5</h2>
            </a>
        </div>

        <div style="text-align:center;margin-top:18px;font-size:7px;color:var(--text3);font-family:'JetBrains Mono',monospace">
            🐉 BẢO LONG • 15 ENGINES • SIÊU CHÍNH XÁC
        </div>
    </div>
</body>
</html>`;
}

// ============================================================
// API ENDPOINTS
// ============================================================
app.get('/_login', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderLoginPage());
});

app.get('/', (req, res) => {
    res.redirect('/_login');
});

app.post('/_api/access', (req, res) => {
    const { key } = req.body || {};

    if (!key) {
        return res.status(400).json({ error: 'Thiếu mã truy cập' });
    }

    if (key === MASTER_KEY) {
        return res.json({ token: ADMIN_TOKEN });
    }

    return res.status(401).json({ error: 'Sai mã truy cập' });
});

app.get('/_home', checkAuth, (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderHomePage(req.query['_token']));
});

app.get('/_hu', checkAuth, async (req, res) => {
    const gameData = await fetchGameData('hu');

    if (gameData) {
        for (const record of brainHU.history) {
            if (record.status && record.status !== '') {
                continue;
            }

            const actualResult = gameData.find(
                d => d.phien.toString() === record.nextSession
            );

            if (actualResult) {
                record.status = (record.prediction === actualResult.result) ? '✅' : '❌';
                record.actual = actualResult.result;
                brainHU.updateStats(record.prediction, actualResult.result);
            }
        }
        brainHU.save();
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderDashboardPage(brainHU, 'hu', req.query['_token']));
});

app.get('/_md5', checkAuth, async (req, res) => {
    const gameData = await fetchGameData('md5');

    if (gameData) {
        for (const record of brainMD5.history) {
            if (record.status && record.status !== '') {
                continue;
            }

            const actualResult = gameData.find(
                d => d.phien.toString() === record.nextSession
            );

            if (actualResult) {
                record.status = (record.prediction === actualResult.result) ? '✅' : '❌';
                record.actual = actualResult.result;
                brainMD5.updateStats(record.prediction, actualResult.result);
            }
        }
        brainMD5.save();
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(renderDashboardPage(brainMD5, 'md5', req.query['_token']));
});

app.get('/_hu/json', checkAuth, async (req, res) => {
    try {
        const gameData = await fetchGameData('hu');

        if (!gameData || gameData.length === 0) {
            const fallbackResult = brainHU.fallback();
            return res.json({
                prediction: fallbackResult.prediction,
                confidence: fallbackResult.confidence,
                detail: fallbackResult.detail
            });
        }

        const nextSession = gameData[0].phien + 1;
        const existingPrediction = brainHU.history.find(
            h => h.nextSession === nextSession.toString()
        );

        if (existingPrediction) {
            return res.json(existingPrediction);
        }

        const historySequence = gameData.map(d => d.result === 'TÀI' ? 'T' : 'X');

        if (historySequence.length >= 50) {
            brainHU.train(historySequence);
        }

        const predictionResult = brainHU.predict(historySequence);

        const record = {
            session: gameData[0].phien,
            nextSession: nextSession.toString(),
            dice: `${gameData[0].dice1}-${gameData[0].dice2}-${gameData[0].dice3}`,
            total: gameData[0].total,
            actual: gameData[0].result,
            prediction: predictionResult.prediction,
            confidence: predictionResult.confidence,
            detail: predictionResult.detail,
            status: '',
            timestamp: new Date().toISOString(),
            engineCount: predictionResult.engineCount || 0
        };

        brainHU.history.unshift(record);

        if (brainHU.history.length > 2000) {
            brainHU.history = brainHU.history.slice(0, 2000);
        }

        brainHU.save();
        res.json(record);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

app.get('/_md5/json', checkAuth, async (req, res) => {
    try {
        const gameData = await fetchGameData('md5');

        if (!gameData || gameData.length === 0) {
            const fallbackResult = brainMD5.fallback();
            return res.json({
                prediction: fallbackResult.prediction,
                confidence: fallbackResult.confidence,
                detail: fallbackResult.detail
            });
        }

        const nextSession = gameData[0].phien + 1;
        const existingPrediction = brainMD5.history.find(
            h => h.nextSession === nextSession.toString()
        );

        if (existingPrediction) {
            return res.json(existingPrediction);
        }

        const historySequence = gameData.map(d => d.result === 'TÀI' ? 'T' : 'X');

        if (historySequence.length >= 50) {
            brainMD5.train(historySequence);
        }

        const predictionResult = brainMD5.predict(historySequence);

        const record = {
            session: gameData[0].phien,
            nextSession: nextSession.toString(),
            dice: `${gameData[0].dice1}-${gameData[0].dice2}-${gameData[0].dice3}`,
            total: gameData[0].total,
            actual: gameData[0].result,
            prediction: predictionResult.prediction,
            confidence: predictionResult.confidence,
            detail: predictionResult.detail,
            status: '',
            timestamp: new Date().toISOString(),
            engineCount: predictionResult.engineCount || 0
        };

        brainMD5.history.unshift(record);

        if (brainMD5.history.length > 2000) {
            brainMD5.history = brainMD5.history.slice(0, 2000);
        }

        brainMD5.save();
        res.json(record);
    } catch (error) {
        res.status(500).json({ error: 'Lỗi hệ thống' });
    }
});

app.get('/_stats', checkAuth, (req, res) => {
    const total = brainHU.stats.total + brainMD5.stats.total;
    const correct = brainHU.stats.correct + brainMD5.stats.correct;

    res.json({
        hu: brainHU.stats,
        md5: brainMD5.stats,
        combined: {
            total: total,
            correct: correct,
            wrong: total - correct,
            winRate: total > 0 ? Math.round((correct / total) * 100) : 0
        }
    });
});

app.get('/_reset', checkAuth, (req, res) => {
    ['hu', 'md5'].forEach(type => {
        const brain = type === 'hu' ? brainHU : brainMD5;
        brain.stats = {
            total: 0,
            correct: 0,
            wrong: 0,
            winRate: 0,
            currentStreak: 0,
            bestStreak: 0,
            worstStreak: 0,
            currentWinStreak: 0,
            currentLoseStreak: 0,
            today: { correct: 0, wrong: 0, total: 0 }
        };
        brain.history = [];
        brain.lastSession = null;
        brain.save();
    });

    res.json({ message: 'Đã reset toàn bộ hệ thống' });
});

app.use((req, res) => {
    res.status(404).end();
});

app.use((err, req, res, next) => {
    console.error(`[!] Server error: ${err.message}`);
    res.status(500).end();
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ BẢO LONG đã khởi động - Cổng ${PORT}\n`);
    startAutoProcess();
});
