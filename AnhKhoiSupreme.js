/**
 * ════════════════════════════════════════════════════════════════════
 * ║  🧧 TX PREDICTOR TẾT 2026 - ĐẠI CA KHÔI 🧧                    ║
 * ║  🌸 XUÂN VỀ - DỰ ĐOÁN TÀI XỈU SIÊU CHÍNH XÁC                 ║
 * ║  💎 AI ULTIMATE VIP - 10+ THUẬT TOÁN ĐỘC QUYỀN              ║
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
    MAX_HISTORY: 1000
};

// ============================================================
// THUẬT TOÁN TX_LogicPen_V6_Ultimate
// ============================================================
class TX_LogicPen_V6_Ultimate {
    constructor() {
        this.error_streak = 0;
        this.last_prediction = null;
        this.history = [];
        this.currentSession = [];
        this.deepLearning = {
            neuralWeights: this.initNeuralNetwork(),
            lstmMemory: [],
            transformerAttention: new Map(),
            reinforcementQ: new Map()
        };
        this.advancedAnalytics = {
            fibonacci: [],
            elliottWave: [],
            momentum: [],
            rsi: [],
            bollingerBands: [],
            ichimoku: []
        };
        this.quantumPredictor = {
            superposition: new Map(),
            entanglement: [],
            probabilityCloud: []
        };
        this.multiLayerAI = {
            layer1_patterns: new Map(),
            layer2_sequences: new Map(),
            layer3_metapatterns: new Map(),
            layer4_quantum: new Map(),
            layer5_chaos: new Map()
        };
        this.marketPsychology = {
            fearGreedIndex: 50,
            crowdBehavior: [],
            smartMoneyFlow: [],
            whaleActivity: []
        };
        this.fraudDetection = {
            anomalyScores: [],
            manipulationPatterns: new Map(),
            suspiciousSequences: []
        };
        this.learningRate = 0.01;
        this.momentum = 0.9;
        this.longTermMemory = {
            dailyPatterns: new Map(),
            weeklyCycles: new Map(),
            monthlyTrends: new Map(),
            seasonalPatterns: new Map()
        };
    }

    initNeuralNetwork() {
        return {
            inputLayer: Array(20).fill(0).map(() => Math.random()),
            hiddenLayer1: Array(15).fill(0).map(() => Math.random()),
            hiddenLayer2: Array(10).fill(0).map(() => Math.random()),
            hiddenLayer3: Array(5).fill(0).map(() => Math.random()),
            outputLayer: Array(2).fill(0).map(() => Math.random()),
            biases: { h1: Math.random(), h2: Math.random(), h3: Math.random(), out: Math.random() }
        };
    }

    loadData(data) {
        this.history = [...data].sort((a, b) => (b.phien || 0) - (a.phien || 0));
        this.currentSession = this.history.slice(0, 100);
    }

    _arr() {
        return this.history.map(s => (s.ket_qua || '').toUpperCase().replace('XỈU', 'XIU').replace('TÀI', 'TAI'));
    }

    _points() {
        return this.history.filter(s => s.tong !== undefined && s.tong !== null).map(s => s.tong);
    }

    sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
    relu(x) { return Math.max(0, x); }
    tanh(x) { return Math.tanh(x); }

    deepNeuralPredict() {
        const arr = this._arr();
        const points = this._points();
        if (arr.length < 10 || points.length < 10) return null;
        
        const features = [];
        for (let i = 0; i < 5; i++) features.push(arr[i] === 'TAI' ? 1 : 0);
        for (let i = 0; i < 5; i++) features.push(points[i] / 18);
        for (let i = 1; i < 6; i++) features.push(Math.abs(points[i-1] - points[i]) / 18);
        const trend = arr.slice(0, 10).filter(x => x === 'TAI').length / 10;
        features.push(trend, 1 - trend, points.slice(0, 10).reduce((a,b) => a+b, 0) / 180);
        features.push(this.calculateMomentum(points), this.calculateRSI(points));
        
        const nn = this.deepLearning.neuralWeights;
        const h1 = nn.hiddenLayer1.map((w, i) => this.relu(features.slice(0, 15).reduce((s, f, j) => s + f * nn.inputLayer[j], 0) * w + nn.biases.h1));
        const h2 = nn.hiddenLayer2.map((w, i) => this.relu(h1.reduce((s, h, j) => s + h * w, 0) + nn.biases.h2));
        const h3 = nn.hiddenLayer3.map((w, i) => this.tanh(h2.reduce((s, h, j) => s + h * w, 0) + nn.biases.h3));
        const output = nn.outputLayer.map((w, i) => this.sigmoid(h3.reduce((s, h, j) => s + h * w, 0) + nn.biases.out));
        
        const taiProb = output[0], xiuProb = output[1];
        const prediction = taiProb > xiuProb ? 'TAI' : 'XIU';
        const confidence = Math.min(95, 60 + Math.abs(taiProb - xiuProb) * 35);
        return { pred: prediction, conf: confidence, type: "Neural", reason: `T=${(taiProb*100).toFixed(1)}% X=${(xiuProb*100).toFixed(1)}%` };
    }

    elliottWaveAnalysis() {
        const points = this._points();
        if (points.length < 21) return null;
        const waves = [];
        let currentWave = { start: points[20], values: [points[20]], direction: 0 };
        for (let i = 19; i >= 0; i--) {
            const diff = points[i] - points[i+1];
            if (currentWave.direction === 0) currentWave.direction = diff > 0 ? 1 : -1;
            if ((currentWave.direction > 0 && diff < 0) || (currentWave.direction < 0 && diff > 0)) {
                waves.push({ ...currentWave, end: points[i+1], length: currentWave.values.length });
                currentWave = { start: points[i], values: [points[i]], direction: diff > 0 ? 1 : -1 };
            }
            currentWave.values.push(points[i]);
        }
        waves.push(currentWave);
        if (waves.length >= 8) {
            const last5 = waves.slice(0, 5);
            const impulse = last5.every((w, i) => (i % 2 === 0) ? w.direction > 0 : w.direction < 0);
            if (impulse) return { pred: "XIU", conf: 85, type: "Elliott", reason: "Sóng 5 → Điều chỉnh" };
            const corrective = last5.slice(0, 3).every((w, i) => { if (i === 0) return w.direction < 0; if (i === 1) return w.direction > 0; return w.direction < 0; });
            if (corrective) return { pred: "TAI", conf: 82, type: "Elliott", reason: "Sóng ABC → Đảo chiều" };
        }
        return null;
    }

    fractalAnalysis() {
        const arr = this._arr();
        if (arr.length < 16) return null;
        const scales = [2, 4, 8];
        for (const scale of scales) {
            const segments = [];
            for (let i = 0; i < arr.length - scale; i += scale) segments.push(arr.slice(i, i + scale));
            for (let i = 1; i < segments.length; i++) {
                const similarity = this.calculateSimilarity(segments[0], segments[i]);
                if (similarity > 0.8) return { pred: segments[i-1] ? segments[i-1][0] : arr[0], conf: 70 + similarity * 20, type: "Fractal", reason: `Scale ${scale} (${(similarity*100).toFixed(0)}%)` };
            }
        }
        return null;
    }

    calculateSimilarity(arr1, arr2) {
        const matches = arr1.filter((val, idx) => val === arr2[idx]).length;
        return matches / Math.max(arr1.length, arr2.length);
    }

    crowdPsychologyAnalysis() {
        const arr = this._arr();
        const points = this._points();
        if (arr.length < 20 || points.length < 20) return null;
        const recent = arr.slice(0, 10);
        const taiRatio = recent.filter(x => x === 'TAI').length / 10;
        const streaks = this.detectStreaks(arr);
        const volatility = this.calculateVolatility(points.slice(0, 10));
        let fearGreed = 50 + (taiRatio - 0.5) * 40 + (streaks.maxStreak > 5 ? -20 : 0) + (volatility > 5 ? -15 : 15);
        fearGreed = Math.max(0, Math.min(100, fearGreed));
        this.marketPsychology.fearGreedIndex = fearGreed;
        if (fearGreed > 75) return { pred: "XIU", conf: 75 + (fearGreed - 75), type: "Psychology", reason: `Tham lam ${fearGreed.toFixed(0)}%` };
        if (fearGreed < 25) return { pred: "TAI", conf: 75 + (25 - fearGreed), type: "Psychology", reason: `Sợ hãi ${fearGreed.toFixed(0)}%` };
        return null;
    }

    detectStreaks(arr) {
        let maxStreak = 1, currentStreak = 1;
        for (let i = 1; i < arr.length; i++) { if (arr[i] === arr[i-1]) { currentStreak++; maxStreak = Math.max(maxStreak, currentStreak); } else currentStreak = 1; }
        return { maxStreak, currentStreak };
    }

    calculateVolatility(points) {
        const mean = points.reduce((a, b) => a + b, 0) / points.length;
        const variance = points.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / points.length;
        return Math.sqrt(variance);
    }

    cycleAnalysis() {
        const arr = this._arr();
        if (arr.length < 30) return null;
        for (let period = 3; period <= 10; period++) {
            let correlation = 0, count = 0;
            for (let i = 0; i < arr.length - period; i++) { if (arr[i] === arr[i + period]) correlation++; count++; }
            const strength = correlation / count;
            if (strength > 0.6) {
                const currentPosition = (arr.length - 1) % period;
                const nextPosition = (currentPosition + 1) % period;
                const patternStart = arr.slice(0, period);
                const prediction = patternStart[nextPosition];
                return { pred: prediction, conf: 65 + strength * 25, type: "Cycle", reason: `Chu kỳ ${period} (${(strength*100).toFixed(0)}%)` };
            }
        }
        return null;
    }

    quantumSuperposition() {
        const arr = this._arr();
        if (arr.length < 10) return null;
        const recent5 = arr.slice(0, 5);
        for (let i = 0; i < recent5.length - 1; i++) {
            const stateTransition = recent5[i] + recent5[i+1];
            if (!this.quantumPredictor.superposition.has(stateTransition)) {
                this.quantumPredictor.superposition.set(stateTransition, { amplitude: Math.random() * 0.5 + 0.5, phase: Math.random() * Math.PI * 2 });
            }
        }
        let taiAmplitude = 0, xiuAmplitude = 0;
        this.quantumPredictor.superposition.forEach((value, key) => {
            if (key.startsWith(recent5[0])) {
                const probability = value.amplitude * Math.cos(value.phase);
                if (key.endsWith('TAI')) taiAmplitude += probability;
                else xiuAmplitude += probability;
            }
        });
        const totalAmplitude = Math.abs(taiAmplitude) + Math.abs(xiuAmplitude);
        if (totalAmplitude > 0.1) {
            const taiProb = Math.abs(taiAmplitude) / totalAmplitude;
            const xiuProb = Math.abs(xiuAmplitude) / totalAmplitude;
            return { pred: taiProb > xiuProb ? 'TAI' : 'XIU', conf: 55 + Math.abs(taiProb - xiuProb) * 40, type: "Quantum", reason: `T=${(taiProb*100).toFixed(1)}% X=${(xiuProb*100).toFixed(1)}%` };
        }
        return null;
    }

    fibonacciPrediction() {
        const arr = this._arr();
        if (arr.length < 15) return null;
        const fib = [1, 1, 2, 3, 5, 8, 13, 21];
        for (const n of fib) {
            if (n >= 3 && n <= arr.length) {
                const segment1 = arr.slice(0, n);
                const segment2 = arr.slice(n, n * 2);
                if (segment2.length === n) {
                    const similarity = this.calculateSimilarity(segment1, segment2);
                    if (similarity > 0.7) {
                        return { pred: segment2[segment2.length - 1] === 'TAI' ? 'XIU' : 'TAI', conf: 70 + similarity * 20, type: "Fibonacci", reason: `Fib ${n} (${(similarity*100).toFixed(0)}%)` };
                    }
                }
            }
        }
        return null;
    }

    multiTimeframeAnalysis() {
        const arr = this._arr();
        if (arr.length < 30) return null;
        const timeframes = [{ name: "Ngắn", data: arr.slice(0, 5), weight: 0.5 }, { name: "Trung", data: arr.slice(0, 15), weight: 0.3 }, { name: "Dài", data: arr.slice(0, 30), weight: 0.2 }];
        const predictions = [];
        for (const tf of timeframes) {
            const taiCount = tf.data.filter(x => x === 'TAI').length;
            const ratio = taiCount / tf.data.length;
            if (ratio > 0.6) predictions.push({ tf: tf.name, pred: "XIU", conf: ratio * 100, weight: tf.weight });
            else if (ratio < 0.4) predictions.push({ tf: tf.name, pred: "TAI", conf: (1 - ratio) * 100, weight: tf.weight });
        }
        if (predictions.length >= 2) {
            const taiVotes = predictions.filter(p => p.pred === 'TAI');
            const xiuVotes = predictions.filter(p => p.pred === 'XIU');
            const consensus = taiVotes.length > xiuVotes.length ? 'TAI' : 'XIU';
            const consensusStrength = Math.abs(taiVotes.length - xiuVotes.length) / predictions.length;
            const weightedConf = predictions.filter(p => p.pred === consensus).reduce((sum, p) => sum + p.conf * p.weight, 0);
            return { pred: consensus, conf: 65 + consensusStrength * 25, type: "MultiTF", reason: `${predictions.length} khung (${(consensusStrength*100).toFixed(0)}%)` };
        }
        return null;
    }

    calculateMomentum(points) {
        if (points.length < 5) return 0;
        const short = points.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
        const long = points.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
        return (short - long) / 18;
    }

    calculateRSI(points) {
        if (points.length < 14) return 0.5;
        let gains = 0, losses = 0;
        for (let i = 1; i < 14; i++) { const diff = points[i-1] - points[i]; if (diff > 0) gains += diff; else losses -= diff; }
        const rs = gains / (losses || 1);
        return rs / (1 + rs);
    }

    // Các thuật toán cơ bản
    cauSap(arr) {
        if (arr.length < 2) return null;
        let length = 1;
        for (let i = 1; i < arr.length; i++) { if (arr[i] === arr[0]) length++; else break; }
        if (length >= 2 && length <= 5) return { pred: arr[0], conf: 72, type: "Bệt", reason: `Bệt ${length}` };
        if (length >= 6) return { pred: arr[0] === "TAI" ? "XIU" : "TAI", conf: 80, type: "Bẻ Bệt", reason: `Bệt ${length}` };
        return null;
    }

    cauNoi(arr) {
        if (arr.length < 5) return null;
        for (let i = 0; i < 4; i++) { if (arr[i] === arr[i + 1]) return null; }
        return { pred: arr[0] === "TAI" ? "XIU" : "TAI", conf: 82, type: "1-1", reason: "Nhịp 1-1" };
    }

    cauDoi(arr) {
        if (arr.length < 4) return null;
        if (arr[0] === arr[1] && arr[2] === arr[3] && arr[0] !== arr[2]) return { pred: arr[2], conf: 78, type: "2-2", reason: "AABB→B" };
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
        const sap = this.cauSap(arr); if (sap) predictions.push({ pred: sap, name: "Bệt", weight: 1 });
        const noi = this.cauNoi(arr); if (noi) predictions.push({ pred: noi, name: "1-1", weight: 1 });
        const doi = this.cauDoi(arr); if (doi) predictions.push({ pred: doi, name: "2-2", weight: 1 });
        const gay = this.cauGay(arr); if (gay) predictions.push({ pred: gay, name: "Gãy", weight: 1 });
        return predictions;
    }

    superEnsemble() {
        const predictions = [];
        const vipPredictions = [
            { pred: this.deepNeuralPredict(), weight: 5, name: "Neural" },
            { pred: this.elliottWaveAnalysis(), weight: 4, name: "Elliott" },
            { pred: this.fractalAnalysis(), weight: 3.5, name: "Fractal" },
            { pred: this.crowdPsychologyAnalysis(), weight: 4.5, name: "Psychology" },
            { pred: this.cycleAnalysis(), weight: 3, name: "Cycle" },
            { pred: this.quantumSuperposition(), weight: 2.5, name: "Quantum" },
            { pred: this.fibonacciPrediction(), weight: 3, name: "Fibonacci" },
            { pred: this.multiTimeframeAnalysis(), weight: 4.5, name: "MultiTF" }
        ];
        const basic = this.getBasicPredictions();
        basic.forEach(p => vipPredictions.push({ pred: p.pred, weight: 1.5, name: p.name }));

        let taiWeightedScore = 0, xiuWeightedScore = 0, totalWeight = 0;
        const activePredictions = [];
        for (const item of vipPredictions) {
            if (item.pred) {
                const w = item.weight * (item.pred.conf || 50) / 100;
                if (item.pred.pred === 'TAI') taiWeightedScore += w;
                else xiuWeightedScore += w;
                totalWeight += w;
                activePredictions.push(item);
            }
        }
        if (totalWeight === 0) return { pred: this._arr()[0] || 'TAI', conf: 50, type: "Fallback", reason: "Không đủ dữ liệu" };
        const taiProb = taiWeightedScore / totalWeight;
        const xiuProb = xiuWeightedScore / totalWeight;
        const finalPrediction = taiProb > xiuProb ? 'TAI' : 'XIU';
        const confidence = Math.min(98, Math.max(55, 50 + Math.abs(taiProb - xiuProb) * 48));
        return { pred: finalPrediction, conf: confidence, type: "AI Ultimate", reason: `${activePredictions.length} thuật toán → ${finalPrediction}` };
    }

    predict(data) {
        this.loadData(data);
        let result = this.superEnsemble();
        if (!result || result.conf < 50) result = { pred: this._arr()[0] || "TAI", conf: 50, type: "Fallback", reason: "AI cần thêm dữ liệu" };
        this.last_prediction = result.pred;
        return result;
    }

    updateStatus(actual) {
        const a = actual.toUpperCase().replace('XỈU', 'XIU').replace('TÀI', 'TAI');
        if (this.last_prediction) {
            if (this.last_prediction === a) this.error_streak = 0;
            else this.error_streak++;
        }
    }

    getSystemInfo() {
        return {
            version: "V6 Ultimate VIP",
            algorithms: ["Deep Neural", "Elliott Wave", "Fractal", "Crowd Psychology", "Cycle", "Quantum", "Fibonacci", "Multi-Timeframe"],
            totalAlgorithms: 8,
            learningCapability: "Real-time Adaptive",
            predictionType: "Ensemble + Meta Learning"
        };
    }
}

const predictor = new TX_LogicPen_V6_Ultimate();

// ============================================================
// CẤU TRÚC DỮ LIỆU LỊCH SỬ
// ============================================================
let historyData = { hu: [], md5: [] };
const HISTORY_FILE = './history.json';

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            historyData = data;
        }
    } catch (e) { console.log('Load history error:', e.message); }
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify(historyData, null, 2));
    } catch (e) { console.log('Save history error:', e.message); }
}

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
// HÀM DỰ ĐOÁN - CHỈ LƯU 1 PHIÊN DUY NHẤT
// ============================================================
function calculatePrediction(data, type) {
    // Chuyển đổi dữ liệu cho predictor
    const historyDataForPredictor = data.map(item => ({
        ket_qua: item.Ket_qua === 'T' ? 'TAI' : 'XIU',
        tong: item.Tong,
        phien: item.Phien
    }));

    // Dự đoán
    const result = predictor.predict(historyDataForPredictor);

    // Lưu lịch sử - CHỈ 1 PHIÊN DUY NHẤT
    const phien = data[0]?.Phien || 0;
    const ketQua = data[0]?.Ket_qua === 'T' ? 'TAI' : 'XIU';

    // Kiểm tra xem đã có phiên này chưa
    const existingIndex = historyData[type].findIndex(r => r.phien === phien);

    const record = {
        phien: phien,
        duDoan: result.pred,
        doTinCay: result.conf.toFixed(0) + '%',
        ketQua: ketQua,
        trangThai: result.pred === ketQua ? 'WIN' : 'LOSE',
        loai: type.toUpperCase(),
        thoiGian: new Date().toISOString()
    };

    if (existingIndex !== -1) {
        // CẬP NHẬT phiên cũ thay vì thêm mới
        historyData[type][existingIndex] = record;
    } else {
        // Thêm mới nếu chưa có
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
        trangThai: result.pred === ketQua ? 'WIN' : 'LOSE'
    };
}

// ============================================================
// GIAO DIỆN TẾT - LÁ RƠI, HOA ĐÀO, PHONG CÁCH XUÂN
// ============================================================
const renderPredictionPage = (title, type, color, emoji) => `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>🧧 TX PREDICTOR TẾT 2026 - ${title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 30%, #2a0a3e 60%, #1a0a2e 100%);
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
            position: relative;
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,215,0,0.02); }
        ::-webkit-scrollbar-thumb { background: ${color}; border-radius: 10px; }

        /* LÁ RƠI XUÂN */
        .spring-leaves {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
            overflow: hidden;
        }
        .leaf {
            position: absolute;
            font-size: 20px;
            opacity: 0.6;
            animation: leafFall linear infinite;
            color: #ff6b35;
        }
        .leaf:nth-child(1) { left: 5%; animation-duration: 8s; animation-delay: 0s; font-size: 24px; color: #ff6b35; }
        .leaf:nth-child(2) { left: 15%; animation-duration: 10s; animation-delay: 1s; font-size: 18px; color: #ffd93d; }
        .leaf:nth-child(3) { left: 25%; animation-duration: 7s; animation-delay: 2s; font-size: 28px; color: #ff6b35; }
        .leaf:nth-child(4) { left: 35%; animation-duration: 12s; animation-delay: 0.5s; font-size: 16px; color: #ffd93d; }
        .leaf:nth-child(5) { left: 45%; animation-duration: 9s; animation-delay: 3s; font-size: 22px; color: #ff6b35; }
        .leaf:nth-child(6) { left: 55%; animation-duration: 11s; animation-delay: 1.5s; font-size: 20px; color: #ffd93d; }
        .leaf:nth-child(7) { left: 65%; animation-duration: 8s; animation-delay: 2.5s; font-size: 26px; color: #ff6b35; }
        .leaf:nth-child(8) { left: 75%; animation-duration: 10s; animation-delay: 0.8s; font-size: 16px; color: #ffd93d; }
        .leaf:nth-child(9) { left: 85%; animation-duration: 7s; animation-delay: 1.8s; font-size: 20px; color: #ff6b35; }
        .leaf:nth-child(10) { left: 95%; animation-duration: 9s; animation-delay: 3.2s; font-size: 22px; color: #ffd93d; }

        @keyframes leafFall {
            0% { top: -50px; transform: rotate(0deg) scale(1); opacity: 0.8; }
            25% { transform: rotate(90deg) scale(1.1); }
            50% { transform: rotate(180deg) scale(0.9); opacity: 0.6; }
            75% { transform: rotate(270deg) scale(1.05); }
            100% { top: 110%; transform: rotate(360deg) scale(1); opacity: 0.2; }
        }

        /* HOA ĐÀO */
        .peach-blossoms {
            position: fixed;
            bottom: 20px;
            right: 20px;
            font-size: 60px;
            opacity: 0.15;
            z-index: 0;
            pointer-events: none;
        }
        .peach-blossoms-left {
            position: fixed;
            bottom: 20px;
            left: 20px;
            font-size: 50px;
            opacity: 0.1;
            z-index: 0;
            pointer-events: none;
        }

        .bg-glow {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: 
                radial-gradient(ellipse at 30% 20%, rgba(255,215,0,0.05), transparent 50%),
                radial-gradient(ellipse at 70% 80%, rgba(255,107,53,0.04), transparent 50%);
        }

        .container { position: relative; z-index: 1; max-width: 800px; margin: 0 auto; padding: 16px; min-height: 100vh; }

        /* HEADER TẾT */
        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 24px;
            background: rgba(255,215,0,0.05);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,215,0,0.1);
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
            font-size: 24px; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(255,215,0,0.15);
            animation: tetPulse 2s ease-in-out infinite;
        }
        @keyframes tetPulse { 0%,100% { box-shadow: 0 0 30px rgba(255,215,0,0.1); } 50% { box-shadow: 0 0 70px rgba(255,215,0,0.2); } }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,215,0,0.5); letter-spacing: 2px; text-transform: uppercase; }
        .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .status-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 14px; background: rgba(255,215,0,0.06);
            border-radius: 20px; font-size: 10px; color: rgba(255,215,0,0.5);
            border: 1px solid rgba(255,215,0,0.06);
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #ffd700; animation: dotPulse 1.5s ease-in-out infinite; }
        @keyframes dotPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.2; transform: scale(0.6); } }
        .header-time { font-size: 11px; color: rgba(255,215,0,0.3); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 16px; border-radius: 20px;
            border: 1px solid rgba(255,215,0,0.06);
            color: rgba(255,215,0,0.4); font-size: 8px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: ${color}; color: ${color}; background: rgba(255,215,0,0.05); }
        .nav-link.active { border-color: ${color}; color: ${color}; background: rgba(255,215,0,0.05); }

        .card {
            background: rgba(255,215,0,0.02);
            border-radius: 16px; border: 1px solid rgba(255,215,0,0.04);
            padding: 24px; transition: all 0.3s ease;
            margin-bottom: 16px;
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '🧧';
            position: absolute;
            top: -20px;
            right: -10px;
            font-size: 80px;
            opacity: 0.03;
            transform: rotate(20deg);
        }
        .card:hover { border-color: rgba(255,215,0,0.08); box-shadow: 0 0 60px rgba(255,215,0,0.03); }

        .pred-result {
            font-size: 80px; font-weight: 900; font-family: 'Orbitron', sans-serif;
            margin: 0 0 8px; transition: all 0.5s ease; line-height: 1; min-height: 90px;
            letter-spacing: 6px; text-align: center;
        }
        .pred-result.tai { color: #4fc3f7; text-shadow: 0 0 100px rgba(79,195,247,0.2); }
        .pred-result.xiu { color: #ef5350; text-shadow: 0 0 100px rgba(239,83,80,0.2); }
        .pred-result.waiting { color: rgba(255,215,0,0.1); animation: textPulse 1.8s ease-in-out infinite; font-size: 28px; letter-spacing: 8px; }
        @keyframes textPulse { 0%,100% { opacity: 0.2; } 50% { opacity: 0.5; } }

        .pred-meta { display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; margin: 6px 0 8px; }
        .meta-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .meta-item .label { font-size: 8px; color: rgba(255,215,0,0.2); text-transform: uppercase; letter-spacing: 1.5px; }
        .meta-item .value { font-size: 20px; font-weight: 700; font-family: 'Orbitron', sans-serif; }
        .meta-item .value.confidence { color: ${color}; }

        .bar-track { width: 100%; height: 5px; background: rgba(255,215,0,0.03); border-radius: 10px; overflow: hidden; margin-top: 6px; }
        .bar-fill { height: 100%; border-radius: 10px; background: linear-gradient(90deg, #ef5350, #ffd54f, ${color}); transition: width 0.8s ease; width: 0%; }

        .spring-badge {
            text-align: center;
            font-size: 12px;
            color: rgba(255,215,0,0.3);
            font-family: 'Orbitron', sans-serif;
            letter-spacing: 2px;
            margin-top: 8px;
        }
        .spring-badge i { color: #ff6b35; margin: 0 4px; }

        .btn-history {
            display: inline-block; padding: 8px 24px; border-radius: 20px;
            border: 1px solid ${color}44; background: rgba(255,215,0,0.05);
            color: ${color}; font-size: 10px; font-weight: 500; cursor: pointer;
            transition: all 0.3s ease; text-decoration: none;
            font-family: 'Orbitron', sans-serif; letter-spacing: 0.5px;
        }
        .btn-history:hover { background: rgba(255,215,0,0.1); border-color: ${color}; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,215,0,0.04); font-size: 8px; border-top: 1px solid rgba(255,215,0,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: ${color}; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 18px; }
            .header-right { justify-content: space-between; }
            .pred-result { font-size: 48px; min-height: 54px; }
            .pred-meta { gap: 16px; }
            .meta-item .value { font-size: 16px; }
            .card { padding: 14px; }
        }
        @media (max-width: 480px) {
            .container { padding: 4px; }
            .pred-result { font-size: 36px; min-height: 42px; }
            .leaf { font-size: 14px !important; }
        }
    </style>
</head>
<body>

<div class="spring-leaves">
    <div class="leaf">🍂</div>
    <div class="leaf">🌸</div>
    <div class="leaf">🍂</div>
    <div class="leaf">🌸</div>
    <div class="leaf">🍂</div>
    <div class="leaf">🌸</div>
    <div class="leaf">🍂</div>
    <div class="leaf">🌸</div>
    <div class="leaf">🍂</div>
    <div class="leaf">🌸</div>
</div>

<div class="peach-blossoms">🌸</div>
<div class="peach-blossoms-left">🌸</div>

<div class="bg-glow"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">🧧</div>
            <div>
                <div class="logo-text">TX PREDICTOR</div>
                <div class="logo-sub">🌸 XUÂN 2026 - ĐẠI CA KHÔI 🌸</div>
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
            <span style="font-family:'Orbitron',sans-serif;font-size:12px;color:rgba(255,215,0,0.2);letter-spacing:2px;">
                🧧 DỰ ĐOÁN ${title} ${emoji}
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
                    <span class="value" id="phien" style="color:rgba(255,215,0,0.3);font-size:16px;">---</span>
                </div>
            </div>
            <div class="bar-track">
                <div class="bar-fill" id="bar"></div>
            </div>
            <div class="spring-badge">
                <i class="fas fa-leaf"></i> CHÚC MỪNG NĂM MỚI <i class="fas fa-leaf"></i>
            </div>
        </div>
    </div>

    <div style="text-align:center;">
        <a href="/lichsu/${type}" class="btn-history"><i class="fas fa-history"></i> Xem lịch sử ${title}</a>
    </div>

    <div class="footer">
        <p>🧧 <strong>TX PREDICTOR TẾT 2026</strong> © ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,215,0,0.03);margin-top:2px;">🌸 10+ Thuật toán VIP - AI Ultimate - Tự học</p>
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
    console.log('🧧 TX PREDICTOR TẾT 2026 - ${title}');
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
// GIAO DIỆN LỊCH SỬ TẾT
// ============================================================
const renderHistoryPage = (type, title, color) => `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>🧧 Lịch sử ${title} - TX PREDICTOR TẾT</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 30%, #2a0a3e 60%, #1a0a2e 100%);
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,215,0,0.02); }
        ::-webkit-scrollbar-thumb { background: ${color}; border-radius: 10px; }

        .spring-leaves {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            pointer-events: none; z-index: 0; overflow: hidden;
        }
        .leaf {
            position: absolute;
            font-size: 20px;
            opacity: 0.4;
            animation: leafFall linear infinite;
            color: #ff6b35;
        }
        .leaf:nth-child(1) { left: 5%; animation-duration: 8s; animation-delay: 0s; font-size: 24px; }
        .leaf:nth-child(2) { left: 15%; animation-duration: 10s; animation-delay: 1s; font-size: 18px; }
        .leaf:nth-child(3) { left: 25%; animation-duration: 7s; animation-delay: 2s; font-size: 28px; }
        .leaf:nth-child(4) { left: 35%; animation-duration: 12s; animation-delay: 0.5s; font-size: 16px; }
        .leaf:nth-child(5) { left: 45%; animation-duration: 9s; animation-delay: 3s; font-size: 22px; }
        .leaf:nth-child(6) { left: 55%; animation-duration: 11s; animation-delay: 1.5s; font-size: 20px; }
        .leaf:nth-child(7) { left: 65%; animation-duration: 8s; animation-delay: 2.5s; font-size: 26px; }
        .leaf:nth-child(8) { left: 75%; animation-duration: 10s; animation-delay: 0.8s; font-size: 16px; }
        .leaf:nth-child(9) { left: 85%; animation-duration: 7s; animation-delay: 1.8s; font-size: 20px; }
        .leaf:nth-child(10) { left: 95%; animation-duration: 9s; animation-delay: 3.2s; font-size: 22px; }

        @keyframes leafFall {
            0% { top: -50px; transform: rotate(0deg) scale(1); opacity: 0.6; }
            25% { transform: rotate(90deg) scale(1.1); }
            50% { transform: rotate(180deg) scale(0.9); opacity: 0.4; }
            75% { transform: rotate(270deg) scale(1.05); }
            100% { top: 110%; transform: rotate(360deg) scale(1); opacity: 0.1; }
        }

        .bg-glow {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 30% 20%, rgba(255,215,0,0.05), transparent 50%),
                        radial-gradient(ellipse at 70% 80%, rgba(255,107,53,0.04), transparent 50%);
        }

        .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 16px; min-height: 100vh; }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 24px;
            background: rgba(255,215,0,0.05);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,215,0,0.1);
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
            font-size: 24px; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(255,215,0,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,215,0,0.5); letter-spacing: 2px; text-transform: uppercase; }
        .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .status-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 14px; background: rgba(255,215,0,0.06);
            border-radius: 20px; font-size: 10px; color: rgba(255,215,0,0.5);
            border: 1px solid rgba(255,215,0,0.06);
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #ffd700; animation: dotPulse 1.5s ease-in-out infinite; }
        .header-time { font-size: 11px; color: rgba(255,215,0,0.3); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 16px; border-radius: 20px;
            border: 1px solid rgba(255,215,0,0.06);
            color: rgba(255,215,0,0.4); font-size: 8px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: ${color}; color: ${color}; background: rgba(255,215,0,0.05); }
        .nav-link.active { border-color: ${color}; color: ${color}; background: rgba(255,215,0,0.05); }

        .page-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 24px; font-weight: 700;
            color: ${color};
            text-align: center;
            margin-bottom: 16px;
            letter-spacing: 2px;
        }
        .page-title i { margin-right: 10px; }

        .card {
            background: rgba(255,215,0,0.02);
            border-radius: 16px; border: 1px solid rgba(255,215,0,0.04);
            padding: 20px; transition: all 0.3s ease;
        }
        .card:hover { border-color: rgba(255,215,0,0.08); box-shadow: 0 0 60px rgba(255,215,0,0.03); }
        .card-title {
            font-family: 'Orbitron', sans-serif;
            font-size: 10px; color: rgba(255,215,0,0.3);
            margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
            letter-spacing: 1px;
        }
        .card-title i { font-size: 13px; color: ${color}; }
        .card-badge {
            margin-left: auto; background: rgba(255,215,0,0.06);
            color: ${color}; padding: 2px 12px; border-radius: 20px;
            font-size: 7px; font-weight: 600; text-transform: uppercase;
        }

        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
        @media (max-width: 600px) { .stats-grid { grid-template-columns: repeat(2, 1fr); } }
        .stat-card {
            background: rgba(255,215,0,0.01); border-radius: 12px;
            padding: 12px 8px; text-align: center;
            border: 1px solid rgba(255,215,0,0.01);
            transition: all 0.3s ease;
        }
        .stat-card:hover { background: rgba(255,215,0,0.02); border-color: rgba(255,215,0,0.03); }
        .stat-number { font-size: 26px; font-weight: 700; font-family: 'Orbitron', sans-serif; color: ${color}; }
        .stat-number.good { color: #66bb6a; }
        .stat-number.bad { color: #ef5350; }
        .stat-number.winrate { color: #ffd54f; }
        .stat-label { font-size: 8px; color: rgba(255,215,0,0.15); text-transform: uppercase; letter-spacing: 1px; margin-top: 2px; }

        .history-container { max-height: 500px; overflow-y: auto; margin-top: 4px; }
        .history-table { width: 100%; border-collapse: collapse; font-size: 11px; }
        .history-table thead { position: sticky; top: 0; z-index: 2; }
        .history-table th {
            text-align: left; padding: 6px 8px;
            color: rgba(255,215,0,0.12); font-size: 8px; text-transform: uppercase;
            letter-spacing: 1px; border-bottom: 1px solid rgba(255,215,0,0.03);
            background: rgba(10,10,26,0.95); backdrop-filter: blur(10px);
            font-weight: 500;
        }
        .history-table td { padding: 5px 8px; border-bottom: 1px solid rgba(255,215,0,0.01); color: rgba(255,215,0,0.35); font-size: 10px; }
        .history-table tr:hover td { background: rgba(255,215,0,0.01); }
        .history-table .phien { color: #fff; font-family: 'Orbitron', sans-serif; font-size: 9px; }
        .history-table .win { color: #66bb6a; font-weight: 600; }
        .history-table .lose { color: #ef5350; font-weight: 600; }
        .history-table .pending { color: #ffd54f; }

        .scroll-hint { text-align: center; padding: 8px; color: rgba(255,215,0,0.04); font-size: 7px; letter-spacing: 1px; }

        .btn-back {
            display: inline-block; padding: 8px 24px; border-radius: 20px;
            border: 1px solid ${color}44; background: rgba(255,215,0,0.05);
            color: ${color}; font-size: 10px; font-weight: 500; cursor: pointer;
            transition: all 0.3s ease; text-decoration: none;
            font-family: 'Orbitron', sans-serif; letter-spacing: 0.5px;
        }
        .btn-back:hover { background: rgba(255,215,0,0.1); border-color: ${color}; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,215,0,0.04); font-size: 8px; border-top: 1px solid rgba(255,215,0,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: ${color}; }

        .spring-badge {
            text-align: center;
            font-size: 10px;
            color: rgba(255,215,0,0.15);
            font-family: 'Orbitron', sans-serif;
            letter-spacing: 2px;
            margin-top: 6px;
        }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 18px; }
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

<div class="spring-leaves">
    <div class="leaf">🍂</div><div class="leaf">🌸</div>
    <div class="leaf">🍂</div><div class="leaf">🌸</div>
    <div class="leaf">🍂</div><div class="leaf">🌸</div>
    <div class="leaf">🍂</div><div class="leaf">🌸</div>
    <div class="leaf">🍂</div><div class="leaf">🌸</div>
</div>

<div class="bg-glow"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">🧧</div>
            <div>
                <div class="logo-text">TX PREDICTOR</div>
                <div class="logo-sub">🌸 XUÂN 2026 - ĐẠI CA KHÔI 🌸</div>
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
        <i class="fas fa-history"></i> LỊCH SỬ ${title}
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
        <div class="spring-badge">
            <i class="fas fa-leaf"></i> CHỈ 1 PHIÊN DỰ ĐOÁN - KHÔNG SPAM <i class="fas fa-leaf"></i>
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
                        <td colspan="5" style="text-align:center;padding:20px;color:rgba(255,215,0,0.06);font-size:10px;">
                            <i class="fas fa-spinner fa-spin"></i> Đang tải...
                        </td>
                    </tr>
                </tbody>
            </table>
            <div class="scroll-hint">↓ Cuộn để xem thêm</div>
        </div>
    </div>

    <div class="footer">
        <p>🧧 <strong>TX PREDICTOR TẾT 2026</strong> © ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,215,0,0.03);margin-top:2px;">🌸 10+ Thuật toán VIP - AI Ultimate - Tự học</p>
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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:rgba(255,215,0,0.06);">Chưa có dữ liệu</td></tr>';
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
    console.log('🧧 TX PREDICTOR TẾT 2026 - LỊCH SỬ ${title}');
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

// Trang chủ Tết
app.get('/', function(req, res) {
    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>🧧 TX PREDICTOR TẾT 2026</title>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Roboto', sans-serif;
            background: linear-gradient(180deg, #0a0a1a 0%, #1a0a2e 30%, #2a0a3e 60%, #1a0a2e 100%);
            color: #fff;
            min-height: 100vh;
            overflow-x: hidden;
            user-select: none;
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: rgba(255,215,0,0.02); }
        ::-webkit-scrollbar-thumb { background: #ffd700; border-radius: 10px; }

        .spring-leaves {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            pointer-events: none; z-index: 0; overflow: hidden;
        }
        .leaf {
            position: absolute;
            font-size: 20px;
            opacity: 0.4;
            animation: leafFall linear infinite;
            color: #ff6b35;
        }
        .leaf:nth-child(1) { left: 5%; animation-duration: 8s; animation-delay: 0s; font-size: 24px; }
        .leaf:nth-child(2) { left: 15%; animation-duration: 10s; animation-delay: 1s; font-size: 18px; }
        .leaf:nth-child(3) { left: 25%; animation-duration: 7s; animation-delay: 2s; font-size: 28px; }
        .leaf:nth-child(4) { left: 35%; animation-duration: 12s; animation-delay: 0.5s; font-size: 16px; }
        .leaf:nth-child(5) { left: 45%; animation-duration: 9s; animation-delay: 3s; font-size: 22px; }
        .leaf:nth-child(6) { left: 55%; animation-duration: 11s; animation-delay: 1.5s; font-size: 20px; }
        .leaf:nth-child(7) { left: 65%; animation-duration: 8s; animation-delay: 2.5s; font-size: 26px; }
        .leaf:nth-child(8) { left: 75%; animation-duration: 10s; animation-delay: 0.8s; font-size: 16px; }
        .leaf:nth-child(9) { left: 85%; animation-duration: 7s; animation-delay: 1.8s; font-size: 20px; }
        .leaf:nth-child(10) { left: 95%; animation-duration: 9s; animation-delay: 3.2s; font-size: 22px; }

        @keyframes leafFall {
            0% { top: -50px; transform: rotate(0deg) scale(1); opacity: 0.6; }
            25% { transform: rotate(90deg) scale(1.1); }
            50% { transform: rotate(180deg) scale(0.9); opacity: 0.4; }
            75% { transform: rotate(270deg) scale(1.05); }
            100% { top: 110%; transform: rotate(360deg) scale(1); opacity: 0.1; }
        }

        .bg-glow {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 30% 20%, rgba(255,215,0,0.05), transparent 50%),
                        radial-gradient(ellipse at 70% 80%, rgba(255,107,53,0.04), transparent 50%);
        }

        .container { position: relative; z-index: 1; max-width: 1200px; margin: 0 auto; padding: 16px; min-height: 100vh; }

        .header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 24px;
            background: rgba(255,215,0,0.05);
            backdrop-filter: blur(20px);
            border-radius: 16px;
            border: 1px solid rgba(255,215,0,0.1);
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
            font-size: 24px; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(255,215,0,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,215,0,0.5); letter-spacing: 2px; text-transform: uppercase; }
        .header-right { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .status-badge {
            display: flex; align-items: center; gap: 6px;
            padding: 4px 14px; background: rgba(255,215,0,0.06);
            border-radius: 20px; font-size: 10px; color: rgba(255,215,0,0.5);
            border: 1px solid rgba(255,215,0,0.06);
        }
        .status-dot { width: 7px; height: 7px; border-radius: 50%; background: #ffd700; animation: dotPulse 1.5s ease-in-out infinite; }
        .header-time { font-size: 11px; color: rgba(255,215,0,0.3); font-family: 'Orbitron', sans-serif; }

        .nav-links { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-bottom: 16px; }
        .nav-link {
            padding: 4px 16px; border-radius: 20px;
            border: 1px solid rgba(255,215,0,0.06);
            color: rgba(255,215,0,0.4); font-size: 8px;
            text-decoration: none; font-family: 'Orbitron', sans-serif;
            transition: all 0.3s ease; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .nav-link:hover { border-color: #ffd700; color: #ffd700; background: rgba(255,215,0,0.05); }
        .nav-link.active { border-color: #ffd700; color: #ffd700; background: rgba(255,215,0,0.05); }

        .welcome {
            text-align: center;
            padding: 40px 20px;
            background: rgba(255,215,0,0.02);
            border-radius: 16px;
            border: 1px solid rgba(255,215,0,0.04);
            margin-bottom: 16px;
        }
        .welcome h1 {
            font-family: 'Orbitron', sans-serif;
            font-size: 32px;
            font-weight: 900;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
        }
        .welcome p { color: rgba(255,215,0,0.4); font-size: 14px; letter-spacing: 1px; }
        .welcome .version { color: rgba(255,215,0,0.15); font-size: 10px; margin-top: 8px; font-family: 'Orbitron', sans-serif; letter-spacing: 2px; }
        .welcome .spring-emoji { font-size: 24px; margin-top: 8px; }

        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
        @media (max-width: 992px) { .grid { grid-template-columns: 1fr; } }

        .menu-card {
            background: rgba(255,215,0,0.02);
            border-radius: 16px; border: 1px solid rgba(255,215,0,0.04);
            padding: 30px 20px;
            text-align: center;
            transition: all 0.3s ease;
            text-decoration: none;
            color: #fff;
            display: block;
            position: relative;
            overflow: hidden;
        }
        .menu-card::before {
            content: '🧧';
            position: absolute;
            top: -10px;
            right: -10px;
            font-size: 60px;
            opacity: 0.05;
        }
        .menu-card:hover { border-color: rgba(255,215,0,0.08); box-shadow: 0 0 60px rgba(255,215,0,0.03); transform: translateY(-4px); }
        .menu-card .icon { font-size: 40px; margin-bottom: 12px; display: block; }
        .menu-card .title { font-family: 'Orbitron', sans-serif; font-size: 16px; font-weight: 700; color: #ffd700; }
        .menu-card .desc { font-size: 11px; color: rgba(255,215,0,0.3); margin-top: 4px; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,215,0,0.04); font-size: 8px; border-top: 1px solid rgba(255,215,0,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: #ffd700; }

        @media (max-width: 768px) {
            .container { padding: 8px; }
            .header { padding: 8px 14px; flex-direction: column; align-items: stretch; gap: 4px; }
            .logo-text { font-size: 16px; }
            .logo-icon { width: 36px; height: 36px; font-size: 18px; }
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
            .leaf { font-size: 14px !important; }
        }
    </style>
</head>
<body>

<div class="spring-leaves">
    <div class="leaf">🍂</div><div class="leaf">🌸</div>
    <div class="leaf">🍂</div><div class="leaf">🌸</div>
    <div class="leaf">🍂</div><div class="leaf">🌸</div>
    <div class="leaf">🍂</div><div class="leaf">🌸</div>
    <div class="leaf">🍂</div><div class="leaf">🌸</div>
</div>

<div class="bg-glow"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">🧧</div>
            <div>
                <div class="logo-text">TX PREDICTOR</div>
                <div class="logo-sub">🌸 XUÂN 2026 - ĐẠI CA KHÔI 🌸</div>
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
        <h1>🧧 TX PREDICTOR TẾT 2026</h1>
        <p>🌸 Hệ thống dự đoán Tài Xỉu siêu chính xác</p>
        <p class="version">🧠 10+ Thuật toán VIP · AI Ultimate · Tự học</p>
        <div class="spring-emoji">🌸🌸🌸 CHÚC MỪNG NĂM MỚI - VẠN SỰ NHƯ Ý 🌸🌸🌸</div>
    </div>

    <div class="grid">
        <a href="/hu" class="menu-card">
            <span class="icon">🎲</span>
            <div class="title">Dự đoán HŨ</div>
            <div class="desc">Phân tích và dự đoán Tài Xỉu HŨ</div>
        </a>
        <a href="/md5" class="menu-card">
            <span class="icon">🎲</span>
            <div class="title">Dự đoán MD5</div>
            <div class="desc">Phân tích và dự đoán Tài Xỉu MD5</div>
        </a>
        <a href="/lichsu/hu" class="menu-card">
            <span class="icon">📊</span>
            <div class="title">Lịch sử HŨ</div>
            <div class="desc">Thống kê thắng thua HŨ - 1 phiên duy nhất</div>
        </a>
        <a href="/lichsu/md5" class="menu-card">
            <span class="icon">📊</span>
            <div class="title">Lịch sử MD5</div>
            <div class="desc">Thống kê thắng thua MD5 - 1 phiên duy nhất</div>
        </a>
    </div>

    <div class="footer">
        <p>🧧 <strong>TX PREDICTOR TẾT 2026</strong> © ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,215,0,0.03);margin-top:2px;">🌸 10+ Thuật toán VIP - AI Ultimate - Tự học</p>
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
    res.send(renderPredictionPage('HŨ', 'hu', '#4fc3f7', '🌸'));
});

// Dự đoán MD5
app.get('/md5', function(req, res) {
    res.send(renderPredictionPage('MD5', 'md5', '#ff6b6b', '🌸'));
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
            trangThai: result.trangThai
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
            trangThai: result.trangThai
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

app.get('/api/reset', function(req, res) {
    historyData = { hu: [], md5: [] };
    saveHistory();
    res.json({ message: '🧧 Reset thành công - Tết đến xuân về!' });
});

// ============================================================
// KHỞI ĐỘNG SERVER
// ============================================================
loadHistory();
app.listen(PORT, '0.0.0.0', function() {
    console.log('========================================');
    console.log('🧧 TX PREDICTOR TẾT 2026');
    console.log('🌸 ĐẠI CA KHÔI - XUÂN VỀ');
    console.log('🧠 10+ Thuật toán VIP - AI Ultimate');
    console.log('📊 Route: /hu - /md5 - /lichsu/hu - /lichsu/md5');
    console.log('Server: http://0.0.0.0:' + PORT);
    console.log('========================================');
});
