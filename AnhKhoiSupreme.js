/**
 * ════════════════════════════════════════════════════════════════════
 * ║  💀 TX_PREDICTOR_GOD — THUẬT TOÁN 5 TẦNG                    ║
 * ║  👑 TOOL ANH KHÔI - DỰ ĐOÁN CAO CẤP                          ║
 * ════════════════════════════════════════════════════════════════════
 */

const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

// ============================================================
// HÀM THỜI GIAN VIỆT NAM
// ============================================================
function vnNow() {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 420);
    return now.toISOString();
}

// ============================================================
// 💀 THUẬT TOÁN GOD PREDICTOR 5 TẦNG
// ============================================================

let stats = {
    total: 0, correct: 0, wrong: 0,
    last_prediction: null,
    start_time: vnNow(),
    history: [],
    total_predictions_made: 0,
    prediction_started: false,
    streak_correct: 0, streak_wrong: 0,
    best_streak: 0, worst_streak: 0,
    model_version: "GOD_PREDICTOR_v6.0",
    layer_performance: {
        layer1_cau: { correct: 0, total: 0 },
        layer2_diem: { correct: 0, total: 0 },
        layer3_pattern: { correct: 0, total: 0 },
        layer4_trend: { correct: 0, total: 0 },
        layer5_tonghop: { correct: 0, total: 0 }
    },
    processed_phiens: new Set(),
    last_phien: 0
};

class TX_LogicPen_GOD_PREDICTOR {
    constructor() {
        this.history = [];
        this.last_prediction = null;
        this.last_layer = null;
        this.error_streak = 0;
        this.consecutive_correct = 0;
        
        this.memory = {
            pattern4: new Map(),
            pattern5: new Map(),
            cycles: new Map(),
            perfectCau: new Map(),
            anomalyPoints: [],
            predictionLog: []
        };
        
        this.layerWeights = {
            layer1_cau: 2.5,
            layer2_diem: 2.3,
            layer3_pattern: 2.0,
            layer4_trend: 1.5,
            layer5_tonghop: 1.0
        };
        
        this.marketCondition = {
            volatility: 0,
            trendStrength: 0,
            phase: 'NEUTRAL',
            lastUpdate: 0
        };
    }
    
    loadData(data) {
        try {
            this.history = [...data].sort((a, b) => (b.phien || 0) - (a.phien || 0));
            const arr = this._arr();
            const points = this._points();
            this.trainPatternMemory(arr);
            this.trainCycleMemory(arr);
            this.trainAnomalyPoints(points);
            this.analyzeMarket(arr, points);
            this.adjustLayerWeights();
        } catch (e) {
            // Silent fail
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
    
    trainPatternMemory(arr) {
        for (let i = 4; i < arr.length; i++) {
            const pattern = arr.slice(i-3, i+1).join('');
            const result = arr[i-4];
            if (!this.memory.pattern4.has(pattern)) {
                this.memory.pattern4.set(pattern, { TAI: 0, XIU: 0, total: 0 });
            }
            const entry = this.memory.pattern4.get(pattern);
            entry[result]++;
            entry.total++;
        }
        for (let i = 5; i < arr.length; i++) {
            const pattern = arr.slice(i-4, i+1).join('');
            const result = arr[i-5];
            if (!this.memory.pattern5.has(pattern)) {
                this.memory.pattern5.set(pattern, { TAI: 0, XIU: 0, total: 0 });
            }
            const entry = this.memory.pattern5.get(pattern);
            entry[result]++;
            entry.total++;
        }
    }
    
    trainCycleMemory(arr) {
        for (let period = 2; period <= 12; period++) {
            let matches = 0, total = 0;
            for (let i = period; i < arr.length; i++) {
                if (arr[i] === arr[i-period]) matches++;
                total++;
            }
            const accuracy = total > 0 ? matches / total : 0;
            if (accuracy > 0.55) {
                this.memory.cycles.set(period, { accuracy, matches, total, lastMatch: arr[period] === arr[0] });
            }
        }
    }
    
    trainAnomalyPoints(points) {
        if (points.length < 20) return;
        const avg = points.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
        const variance = points.slice(0, 20).reduce((a, b) => a + Math.pow(b - avg, 2), 0) / 20;
        const std = Math.sqrt(variance);
        for (let i = 0; i < Math.min(points.length, 100); i++) {
            if (Math.abs(points[i] - avg) > 2 * std) {
                const nextResult = i > 0 ? this._arr()[i-1] : null;
                this.memory.anomalyPoints.push({
                    point: points[i],
                    nextResult,
                    deviation: (points[i] - avg) / std
                });
            }
        }
    }
    
    analyzeMarket(arr, points) {
        if (arr.length < 20) return;
        let changes = 0;
        for (let i = 1; i < Math.min(arr.length, 30); i++) {
            if (arr[i] !== arr[i-1]) changes++;
        }
        this.marketCondition.volatility = changes / Math.min(arr.length - 1, 29);
        const taiRatio10 = arr.slice(0, 10).filter(x => x === 'TAI').length / 10;
        const taiRatio30 = arr.slice(0, 30).filter(x => x === 'TAI').length / 30;
        this.marketCondition.trendStrength = Math.abs(taiRatio10 - 0.5) * 2;
        if (this.marketCondition.volatility > 0.7) this.marketCondition.phase = 'VOLATILE';
        else if (this.marketCondition.trendStrength > 0.6) this.marketCondition.phase = 'TRENDING';
        else if (this.marketCondition.volatility < 0.3) this.marketCondition.phase = 'CALM';
        else this.marketCondition.phase = 'NEUTRAL';
        this.marketCondition.lastUpdate = Date.now();
    }
    
    adjustLayerWeights() {
        for (const [layer, perf] of Object.entries(stats.layer_performance)) {
            if (perf.total >= 20) {
                const accuracy = perf.correct / perf.total;
                if (accuracy >= 0.80) this.layerWeights[layer] = this.layerWeights[layer] * 1.5;
                else if (accuracy >= 0.75) this.layerWeights[layer] = this.layerWeights[layer] * 1.3;
                else if (accuracy >= 0.70) this.layerWeights[layer] = this.layerWeights[layer] * 1.1;
                else if (accuracy < 0.55) this.layerWeights[layer] = this.layerWeights[layer] * 0.7;
            }
        }
        switch (this.marketCondition.phase) {
            case 'VOLATILE': this.layerWeights.layer2_diem = 3.0; this.layerWeights.layer3_pattern = 2.5; this.layerWeights.layer1_cau = 1.5; break;
            case 'TRENDING': this.layerWeights.layer1_cau = 3.0; this.layerWeights.layer4_trend = 2.5; this.layerWeights.layer3_pattern = 1.5; break;
            case 'CALM': this.layerWeights.layer3_pattern = 3.0; this.layerWeights.layer1_cau = 2.5; this.layerWeights.layer2_diem = 2.0; break;
        }
        for (const key of Object.keys(this.layerWeights)) {
            this.layerWeights[key] = Math.max(0.5, Math.min(4.0, this.layerWeights[key]));
        }
    }
    
    // ===== TẦNG 1: PHÁT HIỆN CẦU CHUẨN =====
    layer1_DetectCau(arr) {
        if (arr.length < 5) return null;
        const results = [];
        let perfect1_1 = true;
        for (let i = 0; i < 5 && i < arr.length - 1; i++) {
            if (arr[i] === arr[i+1]) { perfect1_1 = false; break; }
        }
        if (perfect1_1) {
            results.push({ pred: arr[0] === 'TAI' ? 'XIU' : 'TAI', conf: 88, type: 'CẦU 1-1', reason: '6 phiên xen kẽ hoàn hảo', layer: 'layer1_cau', priority: 10 });
        }
        if (arr.length >= 4 && arr[0] === arr[1] && arr[2] === arr[3] && arr[0] !== arr[2]) {
            let repeatCount = 0;
            for (let i = 4; i < arr.length - 1; i += 2) {
                if (i+1 < arr.length && arr[i] === arr[i+1] && arr[i] !== arr[i-2]) repeatCount++;
                else break;
            }
            results.push({ pred: arr[2], conf: 82 + repeatCount * 2, type: `CẦU 2-2${repeatCount > 0 ? ' LẶP' : ''}`, reason: 'AABB → BB tiếp tục', layer: 'layer1_cau', priority: 9 });
        }
        if (arr.length >= 6 && arr[0] === arr[1] && arr[1] === arr[2] && arr[3] === arr[4] && arr[4] === arr[5] && arr[0] !== arr[3]) {
            results.push({ pred: arr[3], conf: 86, type: 'CẦU 3-3', reason: 'AAABBB → BBB', layer: 'layer1_cau', priority: 9 });
        }
        return results.length > 0 ? results : null;
    }
    
    // ===== TẦNG 2: PHÂN TÍCH ĐIỂM + BOLLINGER =====
    layer2_AnalyzePoints(points) {
        if (points.length < 15) return null;
        const results = [];
        const last = points[0];
        const arr15 = points.slice(0, 15);
        const avg15 = arr15.reduce((a, b) => a + b, 0) / 15;
        const variance = arr15.reduce((a, b) => a + Math.pow(b - avg15, 2), 0) / 15;
        const std = Math.sqrt(variance);
        const upperBand = avg15 + 2.5 * std;
        const lowerBand = avg15 - 2.5 * std;
        if (last >= 16) {
            const deviation = (last - avg15) / std;
            results.push({ pred: 'XIU', conf: Math.min(90, 75 + deviation * 2), type: '🎯 CỰC ĐẠI', reason: `Điểm ${last} → XIU`, layer: 'layer2_diem', priority: 10 });
        }
        if (last <= 5) {
            const deviation = (avg15 - last) / std;
            results.push({ pred: 'TAI', conf: Math.min(90, 75 + deviation * 2), type: '🎯 CỰC TIỂU', reason: `Điểm ${last} → TÀI`, layer: 'layer2_diem', priority: 10 });
        }
        if (last >= upperBand && last >= 13) {
            results.push({ pred: 'XIU', conf: 75, type: '📊 BOLLINGER TRÊN', reason: `${last} ≥ ${upperBand.toFixed(1)}`, layer: 'layer2_diem', priority: 8 });
        }
        if (last <= lowerBand && last <= 8) {
            results.push({ pred: 'TAI', conf: 75, type: '📊 BOLLINGER DƯỚI', reason: `${last} ≤ ${lowerBand.toFixed(1)}`, layer: 'layer2_diem', priority: 8 });
        }
        return results.length > 0 ? results : null;
    }
    
    // ===== TẦNG 3: PATTERN MATCHING + MARKOV =====
    layer3_PatternMatching(arr) {
        if (arr.length < 5) return null;
        const results = [];
        const pattern4 = arr.slice(0, 4).join('');
        const memory4 = this.memory.pattern4.get(pattern4);
        if (memory4 && memory4.total >= 5) {
            const taiRatio = memory4.TAI / memory4.total;
            const xiuRatio = memory4.XIU / memory4.total;
            if (Math.abs(taiRatio - 0.5) > 0.2) {
                results.push({ pred: taiRatio > xiuRatio ? 'TAI' : 'XIU', conf: Math.round(65 + Math.abs(taiRatio - 0.5) * 50), type: '🧠 PATTERN 4', reason: `Pattern "${pattern4}" ${memory4.total} lần`, layer: 'layer3_pattern', priority: 8 });
            }
        }
        const pattern5 = arr.slice(0, 5).join('');
        const memory5 = this.memory.pattern5.get(pattern5);
        if (memory5 && memory5.total >= 4) {
            const taiRatio = memory5.TAI / memory5.total;
            const xiuRatio = memory5.XIU / memory5.total;
            if (Math.abs(taiRatio - 0.5) > 0.25) {
                results.push({ pred: taiRatio > xiuRatio ? 'TAI' : 'XIU', conf: Math.round(68 + Math.abs(taiRatio - 0.5) * 50), type: '🧠 PATTERN 5', reason: `Pattern "${pattern5}" ${memory5.total} lần`, layer: 'layer3_pattern', priority: 9 });
            }
        }
        return results.length > 0 ? results : null;
    }
    
    // ===== TẦNG 4: PHÂN TÍCH XU HƯỚNG + CHU KỲ =====
    layer4_TrendCycle(arr) {
        if (arr.length < 30) return null;
        const results = [];
        const shortTAI = arr.slice(0, 5).filter(x => x === 'TAI').length / 5;
        const longTAI = arr.slice(0, 30).filter(x => x === 'TAI').length / 30;
        const divergence = Math.abs(shortTAI - longTAI);
        if (divergence > 0.3) {
            results.push({ pred: longTAI > 0.5 ? 'TAI' : 'XIU', conf: Math.round(65 + divergence * 40), type: '📊 DIVERGENCE', reason: `Ngắn=${(shortTAI*100).toFixed(0)}% Dài=${(longTAI*100).toFixed(0)}%`, layer: 'layer4_trend', priority: 6 });
        }
        const last30 = arr.slice(0, 30);
        const taiCount = last30.filter(x => x === 'TAI').length;
        const imbalance = Math.abs(taiCount - 15);
        if (imbalance >= 8) {
            results.push({ pred: taiCount > 15 ? 'XIU' : 'TAI', conf: Math.round(65 + imbalance * 2), type: '⚖️ CÂN BẰNG 30', reason: `${taiCount}T-${30-taiCount}X`, layer: 'layer4_trend', priority: 5 });
        }
        let streak = 1;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[0]) streak++;
            else break;
        }
        if (streak >= 7) {
            results.push({ pred: arr[0] === 'TAI' ? 'XIU' : 'TAI', conf: 78, type: '💥 SIÊU BỆT', reason: `Bệt ${streak} phiên → GÃY`, layer: 'layer4_trend', priority: 8 });
        }
        return results.length > 0 ? results : null;
    }
    
    // ===== TẦNG 5: TỔNG HỢP THÔNG MINH =====
    layer5_SmartEnsemble(allSignals) {
        if (allSignals.length === 0) return null;
        const taiSignals = allSignals.filter(s => s.pred === 'TAI');
        const xiuSignals = allSignals.filter(s => s.pred === 'XIU');
        let taiScore = 0, xiuScore = 0;
        for (const signal of allSignals) {
            const layerWeight = this.layerWeights[signal.layer] || 1.0;
            const effectiveWeight = signal.priority * (signal.conf / 100) * layerWeight;
            if (signal.pred === 'TAI') taiScore += effectiveWeight;
            else xiuScore += effectiveWeight;
        }
        const totalScore = taiScore + xiuScore;
        const taiProb = totalScore > 0 ? taiScore / totalScore : 0.5;
        const xiuProb = totalScore > 0 ? xiuScore / totalScore : 0.5;
        const finalPred = taiProb > xiuProb ? 'TAI' : 'XIU';
        const agreeCount = finalPred === 'TAI' ? taiSignals.length : xiuSignals.length;
        const agreeRatio = agreeCount / allSignals.length;
        const topSignal = allSignals.sort((a, b) => b.priority - a.priority)[0];
        let confidence = 55 + agreeRatio * 25;
        if (topSignal && topSignal.conf >= 80) confidence += 8;
        if (allSignals.length >= 5 && agreeRatio >= 0.8) confidence += 5;
        confidence = Math.min(92, Math.max(55, Math.round(confidence)));
        return {
            pred: finalPred,
            conf: confidence,
            type: confidence >= 80 ? '💎 GOD SIGNAL' : confidence >= 70 ? '🎯 STRONG SIGNAL' : '📊 SIGNAL',
            reason: `${allSignals.length} tín hiệu → ${finalPred} (${agreeCount}/${allSignals.length})`,
            layer: 'layer5_tonghop',
            details: {
                totalSignals: allSignals.length,
                taiSignals: taiSignals.length,
                xiuSignals: xiuSignals.length,
                agreeRatio: (agreeRatio * 100).toFixed(1) + '%',
                marketPhase: this.marketCondition.phase
            }
        };
    }
    
    predict(data) {
        try {
            this.loadData(data);
            const arr = this._arr();
            const points = this._points();
            if (arr.length < 2) {
                return { pred: arr[0] || 'TAI', conf: 50, type: '⚠️ KHÔNG ĐỦ DỮ LIỆU' };
            }
            const allSignals = [];
            const layer1Results = this.layer1_DetectCau(arr);
            if (layer1Results) allSignals.push(...layer1Results);
            const layer2Results = this.layer2_AnalyzePoints(points);
            if (layer2Results) allSignals.push(...layer2Results);
            const layer3Results = this.layer3_PatternMatching(arr);
            if (layer3Results) allSignals.push(...layer3Results);
            const layer4Results = this.layer4_TrendCycle(arr);
            if (layer4Results) allSignals.push(...layer4Results);
            const finalResult = this.layer5_SmartEnsemble(allSignals);
            if (!finalResult) {
                return { pred: arr[0], conf: 55, type: '⚠️ KHÔNG TÍN HIỆU' };
            }
            this.last_prediction = finalResult.pred;
            this.last_layer = finalResult.layer;
            stats.last_prediction = finalResult.pred;
            stats.total_predictions_made++;
            stats.prediction_started = true;
            return finalResult;
        } catch (e) {
            return { pred: 'TAI', conf: 50, type: 'Fallback' };
        }
    }
    
    updateStatus(actual) {
        if (!this.last_prediction) return;
        try {
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
            if (this.last_layer && stats.layer_performance[this.last_layer]) {
                stats.layer_performance[this.last_layer].total++;
                if (wasCorrect) stats.layer_performance[this.last_layer].correct++;
            }
            stats.history.push({
                time: vnNow(),
                prediction: this.last_prediction,
                actual: a,
                correct: wasCorrect,
                streak: stats.streak_correct
            });
            if (stats.history.length > 1000) stats.history.shift();
        } catch (e) {
            // Silent fail
        }
    }
    
    getDetailedStats() {
        const accuracy = stats.total > 0 ? (stats.correct / stats.total * 100).toFixed(1) : '0.0';
        return {
            ...stats,
            accuracy: accuracy + '%',
            current_streak: stats.streak_correct > 0 ? `✅ Đúng ${stats.streak_correct} liên tiếp` : `❌ Sai ${stats.streak_wrong} liên tiếp`,
            recommendation: this.getRecommendation()
        };
    }
    
    getRecommendation() {
        const accuracy = stats.total > 0 ? stats.correct / stats.total : 0;
        if (accuracy >= 0.80) return '👑 GOD MODE — 80%+ CHÍNH XÁC';
        if (accuracy >= 0.75) return '🔥 SIÊU ĐẲNG — 75%+';
        if (accuracy >= 0.70) return '✅ XUẤT SẮC — 70%+';
        if (accuracy >= 0.65) return '📈 TỐT — ĐANG CẢI THIỆN';
        return '⚠️ CẦN THÊM DỮ LIỆU';
    }
}

// ============================================================
// KHỞI TẠO GLOBAL PREDICTOR
// ============================================================
const predictor = new TX_LogicPen_GOD_PREDICTOR();

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
// 💾 LƯU LỊCH SỬ
// ============================================================
let historyData = { hu: [], md5: [] };
const HISTORY_FILE = './history_god.json';

function loadHistory() {
    try {
        if (fs.existsSync(HISTORY_FILE)) {
            const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
            historyData = data;
            const allPhiens = [...(historyData.hu || []), ...(historyData.md5 || [])];
            for (const item of allPhiens) {
                if (item.phien) stats.processed_phiens.add(item.phien);
            }
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
// 🎯 HÀM DỰ ĐOÁN
// ============================================================
function calculatePrediction(data, type) {
    try {
        const phien = data[0]?.Phien || 0;
        const ketQua = data[0]?.Ket_qua === 'T' ? 'TAI' : 'XIU';
        
        if (stats.processed_phiens.has(phien)) {
            const existing = historyData[type].find(r => r.phien === phien);
            if (existing) {
                return {
                    prediction: existing.duDoan,
                    confidence: parseInt(existing.doTinCay) || 50,
                    phien: phien,
                    ketQua: existing.ketQua,
                    trangThai: existing.trangThai,
                    algorithmCount: existing.algorithmCount || 0,
                    reason: existing.reason || '',
                    marketState: existing.marketState || 'UNKNOWN',
                    layerInfo: existing.layerInfo || {}
                };
            }
            return null;
        }
        
        const historyDataForPredictor = data.map(item => ({
            ket_qua: item.Ket_qua === 'T' ? 'TAI' : 'XIU',
            tong: item.Tong,
            phien: item.Phien
        }));
        
        const result = predictor.predict(historyDataForPredictor);
        
        if (phien > stats.last_phien) stats.last_phien = phien;
        stats.processed_phiens.add(phien);
        
        const existingIndex = historyData[type].findIndex(r => r.phien === phien);
        
        const record = {
            phien: phien,
            duDoan: result.pred,
            doTinCay: result.conf.toFixed(0) + '%',
            ketQua: ketQua,
            trangThai: result.pred === ketQua ? 'WIN' : 'LOSE',
            loai: type.toUpperCase(),
            thoiGian: vnNow(),
            algorithmCount: result.details?.totalSignals || 0,
            reason: result.reason || '',
            marketState: result.details?.marketPhase || 'UNKNOWN',
            confidence: result.conf.toFixed(0),
            layerInfo: {
                type: result.type,
                layer: result.layer || 'layer5_tonghop'
            }
        };
        
        if (existingIndex !== -1) {
            historyData[type][existingIndex] = record;
        } else {
            historyData[type].unshift(record);
            if (historyData[type].length > 1000) {
                const removed = historyData[type].splice(1000);
                for (const r of removed) stats.processed_phiens.delete(r.phien);
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
            algorithmCount: result.details?.totalSignals || 0,
            reason: result.reason || '',
            marketState: result.details?.marketPhase || 'UNKNOWN',
            layerInfo: {
                type: result.type,
                layer: result.layer || 'layer5_tonghop'
            }
        };
    } catch (e) {
        console.error('Calculate prediction error:', e.message);
        return null;
    }
}

// ============================================================
// 🚀 ROUTES
// ============================================================

// Serve HTML trực tiếp
app.get('/', function(req, res) {
    res.send(`<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Tool Anh Khôi - GOD PREDICTOR</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Inter', sans-serif; }
        body { background: #030406; display: flex; justify-content: center; align-items: center; min-height: 100vh; color: #fff; padding: 15px; }
        .app-wrapper {
            background: #0a0d14; width: 100%; max-width: 410px; min-height: 820px;
            border-radius: 40px; padding: 25px 22px; display: flex; flex-direction: column;
            box-shadow: 0 30px 60px rgba(0,0,0,0.9), inset 0 0 0 1px rgba(255,255,255,0.03);
            border: 1px solid rgba(255,255,255,0.05);
        }
        .header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.04); margin-bottom: 20px; }
        .brand-title { font-size: 20px; font-weight: 800; color: #ffffff; display: flex; align-items: center; gap: 8px; letter-spacing: -0.5px; }
        .brand-title span { color: #3b82f6; }
        .crown-icon { color: #fbbf24; font-size: 20px; filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.3)); }
        .status-badge { background: rgba(34, 197, 94, 0.1); padding: 6px 14px; border-radius: 30px; font-size: 11px; font-weight: 600; color: #22c55e; display: flex; align-items: center; gap: 6px; border: 1px solid rgba(34, 197, 94, 0.2); }
        .dot-online { width: 8px; height: 8px; background: #22c55e; border-radius: 50%; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0% { opacity: 0.4; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.4; transform: scale(0.9); } }
        .content-area { flex: 1; display: flex; flex-direction: column; gap: 20px; overflow-y: auto; }
        .content-area::-webkit-scrollbar { width: 3px; }
        .content-area::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 10px; }
        #homeScreen { display: flex; flex-direction: column; gap: 20px; animation: fadeUp 0.5s ease; flex: 1; }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
        .hero-box { 
            background: linear-gradient(145deg, rgba(18, 22, 32, 0.6), rgba(8, 10, 16, 0.8)); 
            border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 30px 20px; text-align: center; 
            box-shadow: 0 20px 40px -10px rgba(0,0,0,0.8);
        }
        .hero-title { font-size: 26px; font-weight: 900; margin-bottom: 12px; background: linear-gradient(135deg, #fbbf24 0%, #3b82f6 50%, #22c55e 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .hero-sub { color: #8892a8; font-size: 14px; line-height: 1.6; font-weight: 500; }
        .hero-sub strong { color: #e2e8f0; -webkit-text-fill-color: #e2e8f0; }
        .decor-line { width: 60px; height: 3px; background: linear-gradient(90deg, #3b82f6, #22c55e); margin: 15px auto 0 auto; border-radius: 10px; }
        .sys-stats { 
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; 
            background: rgba(18, 22, 32, 0.4); border-radius: 20px; padding: 15px 10px;
            border: 1px solid rgba(255,255,255,0.03);
        }
        .s-item { text-align: center; }
        .s-item i { color: #3b82f6; font-size: 18px; margin-bottom: 4px; display: block; }
        .s-item span { font-size: 12px; font-weight: 700; color: #e2e8f0; display: block; margin-bottom: 2px; }
        .s-item small { font-size: 10px; color: #5b687e; }
        .tool-grid { display: flex; flex-direction: column; gap: 12px; margin-top: 5px; }
        .tool-btn { 
            background: rgba(18, 22, 32, 0.6); border: 1px solid rgba(255,255,255,0.04); border-radius: 20px; 
            padding: 20px 20px; display: flex; align-items: center; gap: 20px; cursor: pointer; transition: all 0.3s ease; 
            box-shadow: 0 10px 20px -5px rgba(0,0,0,0.5);
        }
        .tool-btn:hover { transform: translateY(-2px); border-color: rgba(59, 130, 246, 0.3); background: rgba(25, 30, 45, 0.7); }
        .tool-btn:active { transform: scale(0.96); }
        .tool-btn i { font-size: 36px; width: 45px; text-align: center; }
        .tool-btn h4 { font-size: 18px; font-weight: 700; margin-bottom: 2px; color: #fff; }
        .tool-btn p { font-size: 12px; color: #8892a8; }
        .icon-hu { color: #f59e0b; }
        .icon-md5 { color: #3b82f6; }
        #predictScreen { display: none; flex-direction: column; gap: 15px; height: 100%; animation: fadeUp 0.3s ease; }
        .top-nav { display: flex; align-items: center; gap: 10px; margin-bottom: 5px; }
        .btn-back { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 30px; color: #8892a8; padding: 8px 18px; font-size: 13px; font-weight: 600; cursor: pointer; transition: 0.2s; display: flex; align-items: center; gap: 8px; }
        .btn-back:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .btn-back i { font-size: 14px; }
        .card-predict { background: rgba(18, 22, 32, 0.6); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.06); border-radius: 24px; padding: 25px; text-align: center; transition: all 0.4s ease; }
        .card-predict.tai-mode { border-color: rgba(59, 130, 246, 0.3); box-shadow: 0 0 30px rgba(59, 130, 246, 0.05); }
        .card-predict.xiu-mode { border-color: rgba(239, 68, 68, 0.3); box-shadow: 0 0 30px rgba(239, 68, 68, 0.05); }
        .result-main { font-size: 70px; font-weight: 900; line-height: 1; margin: 15px 0; transition: all 0.3s; }
        .result-main.tai { color: #3b82f6; text-shadow: 0 0 30px rgba(59, 130, 246, 0.2); }
        .result-main.xiu { color: #ef4444; text-shadow: 0 0 30px rgba(239, 68, 68, 0.2); }
        .mini-stats { display: flex; justify-content: space-around; padding-top: 15px; border-top: 1px solid rgba(255,255,255,0.05); }
        .m-box { display: flex; flex-direction: column; gap: 4px; }
        .m-box span:first-child { font-size: 10px; color: #8892a8; font-weight: 700; text-transform: uppercase; }
        .m-box span:last-child { font-size: 18px; font-weight: 800; }
        .layer-badge { display: inline-block; padding: 3px 12px; border-radius: 20px; font-size: 9px; font-weight: 700; background: rgba(59, 130, 246, 0.1); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.1); }
        .history-panel { background: rgba(18, 22, 32, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 20px; flex: 1; display: flex; flex-direction: column; overflow: hidden; min-height: 250px; }
        .his-header { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr 1.5fr; padding: 12px 10px; background: rgba(0,0,0,0.4); border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 10px; font-weight: 700; color: #8892a8; text-transform: uppercase; }
        .his-col { text-align: center; }
        .his-col:first-child { text-align: left; }
        .his-scroll { flex: 1; overflow-y: auto; padding: 0 0 10px 0; }
        .his-scroll::-webkit-scrollbar { width: 3px; }
        .his-scroll::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 10px; }
        .his-row { display: grid; grid-template-columns: 1.5fr 1fr 1fr 1fr 1.5fr; padding: 14px 10px; border-bottom: 1px solid rgba(255,255,255,0.03); align-items: center; }
        .h-id { font-size: 11px; font-weight: 600; color: #6b788e; font-family: monospace; }
        .h-r { font-size: 13px; font-weight: 700; }
        .h-p { font-size: 12px; font-weight: 700; color: #3b82f6; }
        .h-status { display: flex; justify-content: center; }
        .pill { padding: 3px 12px; border-radius: 20px; font-size: 10px; font-weight: 800; border: 1px solid transparent; }
        .pill.win { background: rgba(34, 197, 94, 0.15); color: #22c55e; border-color: rgba(34, 197, 94, 0.2); }
        .pill.lose { background: rgba(239, 68, 68, 0.15); color: #ef4444; border-color: rgba(239, 68, 68, 0.2); }
        .pill.pending { background: rgba(251, 191, 36, 0.15); color: #fbbf24; border-color: rgba(251, 191, 36, 0.2); }
        @media (max-width: 480px) {
            .app-wrapper { padding: 15px 12px; min-height: 700px; }
            .result-main { font-size: 48px; }
            .hero-title { font-size: 20px; }
            .sys-stats { grid-template-columns: 1fr 1fr 1fr; gap: 5px; padding: 10px 5px; }
            .s-item i { font-size: 14px; }
            .s-item span { font-size: 10px; }
            .s-item small { font-size: 8px; }
            .tool-btn { padding: 14px 14px; gap: 12px; }
            .tool-btn i { font-size: 28px; width: 35px; }
            .tool-btn h4 { font-size: 15px; }
            .his-header { font-size: 8px; }
            .his-row { padding: 10px 6px; }
            .h-id { font-size: 9px; }
            .h-r { font-size: 11px; }
            .h-p { font-size: 10px; }
            .pill { font-size: 8px; padding: 2px 8px; }
            .card-predict { padding: 16px; }
            .mini-stats .m-box span:last-child { font-size: 14px; }
        }
    </style>
</head>
<body>
    <div class="app-wrapper">
        <div class="header">
            <div class="brand-title" id="brandTitle">
                <i class="fas fa-crown crown-icon"></i> ANH <span>KHÔI</span>
            </div>
            <div class="status-badge">
                <span class="dot-online"></span> Online
            </div>
        </div>
        <div class="content-area">
            <div id="homeScreen">
                <div class="hero-box">
                    <h1 class="hero-title">💀 GOD PREDICTOR</h1>
                    <div class="hero-sub">
                        Thuật toán <strong>5 tầng</strong> siêu hủy diệt.<br>
                        Phân tích <strong>cầu chuẩn, điểm số, pattern, xu hướng</strong> và <strong>tổng hợp thông minh</strong>.
                    </div>
                    <div class="decor-line"></div>
                </div>
                <div class="sys-stats">
                    <div class="s-item">
                        <i class="fas fa-brain"></i>
                        <span>5 Tầng AI</span>
                        <small>Thuật toán thông minh</small>
                    </div>
                    <div class="s-item">
                        <i class="fas fa-chart-line"></i>
                        <span>Độ chính xác</span>
                        <small id="homeAccuracy">Đang cập nhật...</small>
                    </div>
                    <div class="s-item">
                        <i class="fas fa-database"></i>
                        <span>1000 Phiên</span>
                        <small>Lưu trữ đầy đủ</small>
                    </div>
                </div>
                <div class="tool-grid">
                    <div class="tool-btn" onclick="openTool('Hũ')">
                        <i class="fas fa-dice-d6 icon-hu"></i>
                        <div>
                            <h4>Dự Đoán Hũ</h4>
                            <p>Phân tích đa thuật toán chuyên sâu</p>
                        </div>
                    </div>
                    <div class="tool-btn" onclick="openTool('MD5')">
                        <i class="fas fa-lock icon-md5"></i>
                        <div>
                            <h4>Dự Đoán MD5</h4>
                            <p>Giải mã chuỗi MD5 nhanh chóng</p>
                        </div>
                    </div>
                </div>
            </div>
            <div id="predictScreen">
                <div class="top-nav">
                    <button class="btn-back" onclick="goHome()"><i class="fas fa-arrow-left"></i> Quay lại</button>
                    <span style="font-size:12px;color:#8892a8;margin-left:auto;" id="toolTitle">HŨ</span>
                </div>
                <div class="card-predict xiu-mode" id="predictCard">
                    <div style="color:#8892a8; font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px;">Kết quả dự đoán</div>
                    <div class="result-main xiu" id="predictResultText">---</div>
                    <div style="margin-bottom:8px;">
                        <span class="layer-badge" id="layerBadge">Tầng 5</span>
                    </div>
                    <div class="mini-stats">
                        <div class="m-box"><span>Độ Tin Cậy</span><span style="color:#3b82f6;" id="confDisplay">0%</span></div>
                        <div class="m-box"><span>Thuật Toán</span><span style="color:#fff;" id="algoDisplay">0</span></div>
                        <div class="m-box"><span>Trạng Thái</span><span style="color:#fbbf24; font-size:14px;" id="statusDisplay">Đang chạy</span></div>
                    </div>
                </div>
                <div class="history-panel">
                    <div class="his-header">
                        <div class="his-col">Phiên</div>
                        <div class="his-col">Dự Đoán</div>
                        <div class="his-col">Kết quả</div>
                        <div class="his-col">Tin Cậy</div>
                        <div class="his-col">Trạng thái</div>
                    </div>
                    <div class="his-scroll" id="historyContainer"></div>
                </div>
            </div>
        </div>
    </div>
    <script>
        let sessionCount = 0;
        let currentMode = ""; 
        let runningInterval = null;
        const homeScreen = document.getElementById('homeScreen');
        const predictScreen = document.getElementById('predictScreen');
        const historyContainer = document.getElementById('historyContainer');
        const predictCard = document.getElementById('predictCard');
        const predictResultText = document.getElementById('predictResultText');
        const confDisplay = document.getElementById('confDisplay');
        const algoDisplay = document.getElementById('algoDisplay');
        const statusDisplay = document.getElementById('statusDisplay');
        const brandTitle = document.getElementById('brandTitle');
        const toolTitle = document.getElementById('toolTitle');
        const layerBadge = document.getElementById('layerBadge');
        const homeAccuracy = document.getElementById('homeAccuracy');

        async function fetchAPI(endpoint) {
            try {
                const res = await fetch(endpoint);
                if (!res.ok) throw new Error('Network error');
                return await res.json();
            } catch (e) { return null; }
        }

        async function fetchStats() {
            const data = await fetchAPI('/api/stats');
            if (data && data.accuracy) {
                homeAccuracy.textContent = data.accuracy;
            }
        }

        function openTool(mode) {
            currentMode = mode;
            const modeDisplay = mode === 'Hũ' ? 'HŨ' : 'MD5';
            toolTitle.textContent = modeDisplay;
            brandTitle.innerHTML = '<i class="fas fa-crown crown-icon"></i> ANH <span>KHÔI</span> <span style="font-weight:400; color:#8892a8; font-size:13px; margin-left:6px;">| ' + modeDisplay + '</span>';
            homeScreen.style.display = 'none';
            predictScreen.style.display = 'flex';
            clearInterval(runningInterval);
            sessionCount = 0;
            historyContainer.innerHTML = '';
            loadHistory(mode);
            runningInterval = setInterval(function() { generateData(mode); }, 5000);
            generateData(mode);
        }

        async function loadHistory(mode) {
            const endpoint = mode === 'Hũ' ? '/api/history/hu' : '/api/history/md5';
            const data = await fetchAPI(endpoint);
            if (data && data.history) {
                historyContainer.innerHTML = '';
                const history = data.history.slice(0, 40);
                for (const item of history) {
                    addHistoryRow(item);
                }
                sessionCount = history.length;
            }
        }

        function addHistoryRow(item) {
            const prefix = item.loai === 'HU' ? 'HU' : 'MD5';
            const sessionId = '#' + prefix + String(item.phien).padStart(6, '0');
            const colorPredict = item.duDoan === 'TAI' ? '#3b82f6' : '#ef4444';
            const colorActual = item.ketQua === 'TAI' ? '#3b82f6' : '#ef4444';
            const statusClass = item.trangThai === 'WIN' ? 'win' : (item.trangThai === 'LOSE' ? 'lose' : 'pending');
            const statusText = item.trangThai === 'WIN' ? 'THẮNG' : (item.trangThai === 'LOSE' ? 'THUA' : 'CHỜ');
            const row = document.createElement('div');
            row.className = 'his-row';
            row.innerHTML = '<div class="h-id">' + sessionId + '</div><div class="h-r" style="color: ' + colorPredict + ';">' + (item.duDoan || '---') + '</div><div class="h-r" style="color: ' + colorActual + ';">' + (item.ketQua || '---') + '</div><div class="h-p">' + (item.doTinCay || '0%') + '</div><div class="h-status"><span class="pill ' + statusClass + '">' + statusText + '</span></div>';
            historyContainer.prepend(row);
        }

        async function generateData(mode) {
            const endpoint = mode === 'Hũ' ? '/api/hu' : '/api/md5';
            const data = await fetchAPI(endpoint);
            if (data) {
                sessionCount++;
                const duDoan = data.duDoan || '---';
                const doTinCay = data.doTinCay || '0%';
                const phien = data.phien || sessionCount;
                const trangThai = data.trangThai || 'PENDING';
                const algoCount = data.algorithmCount || 0;
                const layerType = data.layerInfo?.type || 'Tầng 5';
                predictResultText.textContent = duDoan;
                confDisplay.textContent = doTinCay;
                algoDisplay.textContent = algoCount;
                layerBadge.textContent = layerType;
                if (duDoan === 'TAI') {
                    predictResultText.className = 'result-main tai';
                    predictCard.className = 'card-predict tai-mode';
                } else if (duDoan === 'XIU') {
                    predictResultText.className = 'result-main xiu';
                    predictCard.className = 'card-predict xiu-mode';
                } else {
                    predictResultText.className = 'result-main';
                    predictCard.className = 'card-predict';
                }
                if (trangThai === 'WIN') {
                    statusDisplay.textContent = 'THẮNG';
                    statusDisplay.style.color = '#22c55e';
                } else if (trangThai === 'LOSE') {
                    statusDisplay.textContent = 'THUA';
                    statusDisplay.style.color = '#ef4444';
                } else {
                    statusDisplay.textContent = 'CHỜ...';
                    statusDisplay.style.color = '#fbbf24';
                }
                if (data.phien && data.duDoan && data.duDoan !== '---') {
                    const prefix = mode === 'Hũ' ? 'HU' : 'MD5';
                    const existingRows = historyContainer.querySelectorAll('.his-row');
                    let exists = false;
                    for (const row of existingRows) {
                        if (row.querySelector('.h-id')?.textContent === '#' + prefix + String(data.phien).padStart(6, '0')) {
                            exists = true;
                            break;
                        }
                    }
                    if (!exists) {
                        const item = {
                            phien: data.phien,
                            duDoan: data.duDoan,
                            ketQua: data.ketQua || '---',
                            doTinCay: data.doTinCay || '0%',
                            trangThai: data.trangThai || 'PENDING',
                            loai: prefix
                        };
                        addHistoryRow(item);
                        while (historyContainer.children.length > 40) {
                            historyContainer.removeChild(historyContainer.lastChild);
                        }
                    }
                }
                fetchStats();
            }
        }

        function goHome() {
            clearInterval(runningInterval);
            predictScreen.style.display = 'none';
            homeScreen.style.display = 'flex';
            brandTitle.innerHTML = '<i class="fas fa-crown crown-icon"></i> ANH <span>KHÔI</span>';
            fetchStats();
        }

        fetchStats();
        setInterval(fetchStats, 10000);
    </script>
</body>
</html>`);
});

app.get('/api/hu', async function(req, res) {
    try {
        const data = await fetchHu();
        if (!data) return res.status(500).json({ error: 'Không thể lấy dữ liệu HU' });
        const result = calculatePrediction(data, 'hu');
        if (!result) {
            return res.json({
                phien: data[0]?.Phien || 0,
                duDoan: '---',
                doTinCay: '0%',
                ketQua: '---',
                trangThai: 'PENDING',
                reason: 'Đã xử lý trước đó',
                algorithmCount: 0,
                marketState: 'UNKNOWN',
                layerInfo: { type: 'Cached' }
            });
        }
        res.json({
            phien: result.phien,
            duDoan: result.prediction,
            doTinCay: result.confidence.toFixed(0) + '%',
            ketQua: result.ketQua,
            trangThai: result.trangThai,
            reason: result.reason || '',
            algorithmCount: result.algorithmCount || 0,
            marketState: result.marketState || 'UNKNOWN',
            layerInfo: result.layerInfo || { type: 'Unknown' }
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
        if (!result) {
            return res.json({
                phien: data[0]?.Phien || 0,
                duDoan: '---',
                doTinCay: '0%',
                ketQua: '---',
                trangThai: 'PENDING',
                reason: 'Đã xử lý trước đó',
                algorithmCount: 0,
                marketState: 'UNKNOWN',
                layerInfo: { type: 'Cached' }
            });
        }
        res.json({
            phien: result.phien,
            duDoan: result.prediction,
            doTinCay: result.confidence.toFixed(0) + '%',
            ketQua: result.ketQua,
            trangThai: result.trangThai,
            reason: result.reason || '',
            algorithmCount: result.algorithmCount || 0,
            marketState: result.marketState || 'UNKNOWN',
            layerInfo: result.layerInfo || { type: 'Unknown' }
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
    const cleanStats = { ...detailedStats };
    delete cleanStats.processed_phiens;
    res.json(cleanStats);
});

// ============================================================
// 🚀 KHỞI ĐỘNG SERVER
// ============================================================
loadHistory();
app.listen(PORT, '0.0.0.0', function() {
    console.log('========================================');
    console.log('💀 GOD PREDICTOR - 5 TẦNG SIÊU HỦY DIỆT');
    console.log('👑 TOOL ANH KHÔI - DỰ ĐOÁN CAO CẤP');
    console.log('✅ Đã fix lỗi Exited with status 1');
    console.log('Server: http://0.0.0.0:' + PORT);
    console.log('========================================');
});
