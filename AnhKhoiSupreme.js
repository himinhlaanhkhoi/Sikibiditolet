/**
 * ════════════════════════════════════════════════════════════════════
 * ║  💎 TX PREDICTOR ULTIMATE VIP - ĐẠI CA KHÔI                  ║
 * ║  🚀 HỆ THỐNG DỰ ĐOÁN TÀI XỈU THẾ HỆ MỚI                  ║
 * ║  📊 LƯU 1000 PHIÊN - THỐNG KÊ CHI TIẾT                      ║
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
// HÀM THỜI GIAN VIỆT NAM
// ============================================================
function vnNow() {
    const now = new Date();
    const offset = 7 * 60;
    now.setMinutes(now.getMinutes() + offset);
    return now.toISOString();
}

// ============================================================
// STATS TOÀN CỤC
// ============================================================
let stats = {
    total: 0, correct: 0, wrong: 0,
    last_prediction: null,
    start_time: vnNow(),
    history: [],
    total_predictions_made: 0,
    prediction_started: false,
    streak_correct: 0,
    streak_wrong: 0,
    best_streak: 0,
    worst_streak: 0,
    algorithm_stats: {},
    confidence_stats: { high: 0, medium: 0, low: 0 },
    hourly_stats: {},
    daily_profit: 0
};

// ============================================================
// THUẬT TOÁN TX_LogicPen_UltimateVIP - FIX LỖI
// ============================================================
class TX_LogicPen_UltimateVIP {
    constructor() {
        this.error_streak = 0;
        this.last_prediction = null;
        this.history = [];
        this.sessionData = [];
        
        this.aiMemory = {
            patternBank: new Map(),
            sequenceMemory: [],
            neuralWeights: this.initNeuralWeights(),
            confidenceMatrix: new Map(),
            successPatterns: new Set(),
            failPatterns: new Set()
        };
        
        this.multiLayerAnalysis = {
            shortTerm: [],
            mediumTerm: [],
            longTerm: [],
            trendStrength: 0,
            volatilityIndex: 0
        };
        
        this.smartPredictor = {
            confidenceThreshold: 65,
            adaptionRate: 0.05,
            lastPredictions: [],
            predictionAccuracy: [],
            marketSentiment: 'neutral'
        };
    }
    
    initNeuralWeights() {
        return {
            patternWeight: 0.3,
            sequenceWeight: 0.25,
            statisticalWeight: 0.2,
            trendWeight: 0.15,
            randomWeight: 0.1
        };
    }

    loadData(data) {
        this.history = [...data].sort((a, b) => (b.phien || 0) - (a.phien || 0));
        this.sessionData = this.history.slice(0, 100);
        this.analyzeMultiLayer();
        this.updateAIMemory();
    }

    _arr() {
        return this.history.map(s => 
            (s.ket_qua || '').toUpperCase().replace('XỈU', 'XIU').replace('TÀI', 'TAI')
        );
    }

    _points() {
        return this.history
            .filter(s => s.tong !== undefined && s.tong !== null)
            .map(s => s.tong);
    }
    
    // ========== CÁC HÀM PHÂN TÍCH ==========
    
    analyzeMultiLayer() {
        const arr = this._arr();
        const points = this._points();
        
        // Short term (5-10 phiên)
        if (arr.length >= 5) {
            this.multiLayerAnalysis.shortTerm = {
                data: arr.slice(0, 10),
                taiRatio: arr.slice(0, 10).filter(x => x === 'TAI').length / 10,
                streak: this.getCurrentStreak(arr.slice(0, 10)),
                momentum: this.calculateMomentum(points.slice(0, 10))
            };
        }
        
        // Medium term (10-30 phiên)
        if (arr.length >= 15) {
            this.multiLayerAnalysis.mediumTerm = {
                data: arr.slice(0, 30),
                taiRatio: arr.slice(0, 30).filter(x => x === 'TAI').length / 30,
                pattern: this.detectDominantPattern(arr.slice(0, 30)),
                stability: this.calculateStability(arr.slice(0, 30))
            };
        }
        
        // Long term (30-50 phiên)
        if (arr.length >= 30) {
            this.multiLayerAnalysis.longTerm = {
                data: arr.slice(0, 50),
                taiRatio: arr.slice(0, 50).filter(x => x === 'TAI').length / 50,
                cycleDetected: this.detectCycles(arr.slice(0, 50)),
                trendStrength: this.calculateTrendStrength(arr.slice(0, 50))
            };
        }
        
        // Tính toán chỉ số biến động
        this.multiLayerAnalysis.volatilityIndex = this.calculateVolatilityIndex(arr);
        this.multiLayerAnalysis.trendStrength = this.calculateOverallTrendStrength();
    }
    
    // ========== CÁC HÀM HỖ TRỢ ==========
    
    getCurrentStreak(arr) {
        let streak = 1;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[0]) streak++;
            else break;
        }
        return streak;
    }
    
    calculateMomentum(points) {
        if (points.length < 5) return 0;
        const shortMA = points.slice(0, 3).reduce((a,b) => a+b, 0) / 3;
        const longMA = points.slice(0, 5).reduce((a,b) => a+b, 0) / 5;
        return shortMA - longMA;
    }
    
    calculateRSI(points) {
        if (points.length < 14) return 50;
        let gains = 0, losses = 0;
        
        for (let i = 0; i < 13; i++) {
            const diff = points[i] - points[i+1];
            if (diff > 0) gains += diff;
            else losses -= diff;
        }
        
        const avgGain = gains / 14;
        const avgLoss = losses / 14;
        
        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    
    calculateStability(arr) {
        let changes = 0;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] !== arr[i-1]) changes++;
        }
        return 1 - (changes / (arr.length - 1));
    }
    
    calculateVolatilityIndex(arr) {
        let changes = 0;
        for (let i = 1; i < Math.min(arr.length, 20); i++) {
            if (arr[i] !== arr[i-1]) changes++;
        }
        return changes / Math.min(arr.length - 1, 19);
    }
    
    calculateOverallTrendStrength() {
        const arr = this._arr();
        if (arr.length < 10) return 0;
        
        const taiRatio = arr.slice(0, 10).filter(x => x === 'TAI').length / 10;
        return Math.abs(taiRatio - 0.5) * 2;
    }
    
    // ===== HÀM calculateTrendStrength - ĐÃ FIX =====
    calculateTrendStrength(arr) {
        if (!arr || arr.length < 10) return 0;
        
        const taiRatio = arr.filter(x => x === 'TAI').length / arr.length;
        const trendStrength = Math.abs(taiRatio - 0.5) * 2;
        
        // Xem xét độ dài của xu hướng
        let streak = 1;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[0]) streak++;
            else break;
        }
        
        // Kết hợp cả tỷ lệ và độ dài chuỗi
        return Math.min(1, trendStrength * 0.6 + Math.min(streak / 10, 0.4));
    }
    
    detectDominantPattern(arr) {
        const patterns = {};
        for (let i = 0; i < arr.length - 1; i++) {
            const pair = arr[i] + arr[i+1];
            patterns[pair] = (patterns[pair] || 0) + 1;
        }
        
        const total = Object.values(patterns).reduce((a,b) => a+b, 0);
        const dominant = Object.entries(patterns).sort((a,b) => b[1] - a[1])[0];
        
        return {
            pattern: dominant[0],
            frequency: dominant[1] / total
        };
    }
    
    detectCycles(arr) {
        for (let period = 2; period <= 8; period++) {
            let matches = 0;
            for (let i = period; i < arr.length; i++) {
                if (arr[i] === arr[i - period]) matches++;
            }
            const accuracy = matches / (arr.length - period);
            if (accuracy > 0.65) {
                return { period, accuracy };
            }
        }
        return null;
    }
    
    updateAIMemory() {
        const arr = this._arr();
        if (arr.length < 5) return;
        
        for (let len = 3; len <= 6; len++) {
            for (let i = 0; i < arr.length - len; i++) {
                const pattern = arr.slice(i, i + len).join('');
                const nextResult = arr[i + len - 1];
                
                if (!this.aiMemory.patternBank.has(pattern)) {
                    this.aiMemory.patternBank.set(pattern, {
                        count: 0,
                        nextTAI: 0,
                        nextXIU: 0,
                        successRate: 0,
                        lastSeen: null
                    });
                }
                
                const bank = this.aiMemory.patternBank.get(pattern);
                bank.count++;
                if (nextResult === 'TAI') bank.nextTAI++;
                else bank.nextXIU++;
                bank.successRate = (bank.nextTAI + bank.nextXIU) > 0 ? 
                    Math.max(bank.nextTAI, bank.nextXIU) / (bank.nextTAI + bank.nextXIU) : 0;
                bank.lastSeen = Date.now();
            }
        }
        
        if (arr.length >= 3) {
            this.aiMemory.sequenceMemory.push({
                sequence: arr.slice(0, 3).join(''),
                next: arr[2],
                timestamp: Date.now()
            });
            
            if (this.aiMemory.sequenceMemory.length > 1000) {
                this.aiMemory.sequenceMemory.shift();
            }
        }
    }

    // ========== CÁC THUẬT TOÁN DỰ ĐOÁN ==========
    
    cauSapPro(arr) {
        if (arr.length < 2) return null;
        let length = 1;
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[0]) length++;
            else break;
        }
        
        const bệtType = arr[0];
        const historicalBệt = this.getHistoricalStreaks(arr);
        
        if (length >= 2 && length <= 5) {
            const avgBệtLength = historicalBệt.avgLength;
            const shouldFollow = length < avgBệtLength;
            
            return { 
                pred: arr[0], 
                conf: shouldFollow ? 78 : 68, 
                type: "Đu Bệt Pro", 
                reason: `Bệt ${length} phiên (TB: ${avgBệtLength.toFixed(1)})` 
            };
        }
        if (length >= 6) {
            const breakProbability = this.calculateBreakProbability(length, historicalBệt);
            
            return { 
                pred: arr[0] === "TAI" ? "XIU" : "TAI", 
                conf: 75 + breakProbability * 15, 
                type: "Bẻ Bệt Pro", 
                reason: `Bệt dài ${length} → Gãy (${(breakProbability*100).toFixed(0)}%)` 
            };
        }
        return null;
    }
    
    getHistoricalStreaks(arr) {
        const streaks = [];
        let currentStreak = 1;
        
        for (let i = 1; i < arr.length; i++) {
            if (arr[i] === arr[i-1]) {
                currentStreak++;
            } else {
                streaks.push(currentStreak);
                currentStreak = 1;
            }
        }
        streaks.push(currentStreak);
        
        return {
            maxLength: Math.max(...streaks),
            avgLength: streaks.reduce((a,b) => a+b, 0) / streaks.length,
            total: streaks.length
        };
    }
    
    calculateBreakProbability(currentLength, historicalStreaks) {
        const longerStreaks = historicalStreaks.total > 0 ? 
            historicalStreaks.maxLength / currentLength : 0;
        return Math.min(0.9, 0.5 + longerStreaks * 0.3);
    }

    cauNoiPro(arr) {
        if (arr.length < 6) return null;
        
        let perfectAlternate = true;
        for (let i = 0; i < 5; i++) {
            if (arr[i] === arr[i + 1]) {
                perfectAlternate = false;
                break;
            }
        }
        
        if (perfectAlternate) {
            return { 
                pred: arr[0] === "TAI" ? "XIU" : "TAI", 
                conf: 85, 
                type: "Cầu Nối Pro", 
                reason: "Nhịp 1-1 hoàn hảo 6 phiên" 
            };
        }
        
        let nearPerfect = 0;
        for (let i = 0; i < 5; i++) {
            if (arr[i] !== arr[i + 1]) nearPerfect++;
        }
        
        if (nearPerfect >= 4) {
            return { 
                pred: arr[0] === "TAI" ? "XIU" : "TAI", 
                conf: 78, 
                type: "Cầu Nối Pro", 
                reason: "Nhịp 1-1 gần hoàn hảo" 
            };
        }
        
        return null;
    }

    cauDoiPro(arr) {
        if (arr.length < 4) return null;
        
        if (arr[0] === arr[1] && arr[2] === arr[3] && arr[0] !== arr[2]) {
            const patternStrength = this.checkPatternRepetition(arr, 'AABB');
            
            return { 
                pred: arr[2], 
                conf: 75 + patternStrength * 10, 
                type: "Cầu 2-2 Pro", 
                reason: `AABB → B (độ mạnh: ${(patternStrength*100).toFixed(0)}%)` 
            };
        }
        
        if (arr.length >= 6 && arr[0] === arr[1] && arr[1] === arr[2] && 
            arr[3] === arr[4] && arr[4] === arr[5] && arr[0] !== arr[3]) {
            
            return { 
                pred: arr[3], 
                conf: 82, 
                type: "Cầu 3-3 Pro", 
                reason: "AAABBB → Tiếp tục B" 
            };
        }
        
        if (arr.length >= 4 && arr[0] !== arr[1] && arr[1] === arr[2] && arr[2] === arr[3] && arr[0] !== arr[3]) {
            return { 
                pred: arr[1] === "TAI" ? "XIU" : "TAI", 
                conf: 76, 
                type: "Đối Xứng Pro", 
                reason: "ABBA → Đảo chiều" 
            };
        }
        
        return null;
    }
    
    checkPatternRepetition(arr, patternType) {
        let repeatCount = 0;
        const patternLength = patternType.length;
        
        for (let i = patternLength; i < arr.length - patternLength; i += patternLength) {
            const segment = arr.slice(i, i + patternLength);
            const expectedPattern = this.getPatternArray(patternType);
            
            let match = true;
            for (let j = 0; j < patternLength; j++) {
                if ((expectedPattern[j] === 'A' && segment[j] !== arr[0]) ||
                    (expectedPattern[j] === 'B' && segment[j] === arr[0])) {
                    match = false;
                    break;
                }
            }
            if (match) repeatCount++;
        }
        
        return Math.min(1, repeatCount / 3);
    }
    
    getPatternArray(patternType) {
        return patternType.split('');
    }

    phatHienMauLapPro(arr) {
        if (arr.length < 6) return null;
        
        const patterns = [];
        
        for (let len = 2; len <= 5; len++) {
            for (let i = len; i < arr.length - len; i++) {
                const pattern1 = arr.slice(0, len).join('');
                const pattern2 = arr.slice(i, i + len).join('');
                
                if (pattern1 === pattern2) {
                    const nextAfterPattern1 = arr[len - 1];
                    const nextAfterPattern2 = arr[i + len - 1];
                    
                    patterns.push({
                        length: len,
                        distance: i,
                        confidence: nextAfterPattern1 === nextAfterPattern2 ? 85 : 70,
                        prediction: nextAfterPattern2,
                        type: nextAfterPattern1 === nextAfterPattern2 ? "Chính xác" : "Gần đúng"
                    });
                }
            }
        }
        
        if (patterns.length > 0) {
            const bestPattern = patterns.sort((a, b) => 
                (b.confidence * (1 / b.distance)) - (a.confidence * (1 / a.distance))
            )[0];
            
            return {
                pred: bestPattern.prediction,
                conf: bestPattern.confidence,
                type: "Mẫu Lặp Pro",
                reason: `Mẫu ${bestPattern.length} phiên, cách ${bestPattern.distance} phiên (${bestPattern.type})`
            };
        }
        
        return null;
    }

    duDoanViPro() {
        const points = this._points();
        if (points.length < 10) return null;
        
        const last = points[0];
        const prev5 = points.slice(0, 5);
        const prev10 = points.slice(0, 10);
        
        const avg5 = prev5.reduce((a, b) => a + b, 0) / 5;
        const avg10 = prev10.reduce((a, b) => a + b, 0) / 10;
        const std10 = Math.sqrt(prev10.reduce((a, b) => a + Math.pow(b - avg10, 2), 0) / 10);
        
        const upperBand = avg10 + 2 * std10;
        const lowerBand = avg10 - 2 * std10;
        
        const rsi = this.calculateRSI(points);
        const trend = avg5 - avg10;
        
        if (last >= upperBand) {
            return { 
                pred: "XIU", 
                conf: 80, 
                type: "Bollinger Pro", 
                reason: `Vượt band trên (${last} > ${upperBand.toFixed(1)})` 
            };
        }
        
        if (last <= lowerBand) {
            return { 
                pred: "TAI", 
                conf: 80, 
                type: "Bollinger Pro", 
                reason: `Dưới band dưới (${last} < ${lowerBand.toFixed(1)})` 
            };
        }
        
        if (rsi > 70) {
            return { 
                pred: "XIU", 
                conf: 75, 
                type: "RSI Pro", 
                reason: `RSI=${rsi.toFixed(1)} → Quá mua` 
            };
        }
        
        if (rsi < 30) {
            return { 
                pred: "TAI", 
                conf: 75, 
                type: "RSI Pro", 
                reason: `RSI=${rsi.toFixed(1)} → Quá bán` 
            };
        }
        
        if (last >= 15) return { pred: "XIU", conf: 82, type: "Cực đại Pro", reason: `Điểm ${last} cực đại` };
        if (last <= 5) return { pred: "TAI", conf: 82, type: "Cực tiểu Pro", reason: `Điểm ${last} cực tiểu` };
        
        if (trend > 2 && last > avg5) {
            return { pred: "XIU", conf: 72, type: "Momentum Pro", reason: "Đà tăng mạnh → Đảo" };
        }
        if (trend < -2 && last < avg5) {
            return { pred: "TAI", conf: 72, type: "Momentum Pro", reason: "Đà giảm mạnh → Đảo" };
        }
        
        return null;
    }

    aiPatternPredict() {
        const arr = this._arr();
        if (arr.length < 4) return null;
        
        const currentPattern = arr.slice(0, 4).join('');
        const patternData = this.aiMemory.patternBank.get(currentPattern);
        
        if (patternData && patternData.count >= 3) {
            const taiProb = patternData.nextTAI / (patternData.nextTAI + patternData.nextXIU);
            const pred = taiProb > 0.5 ? 'TAI' : 'XIU';
            const conf = 60 + Math.abs(taiProb - 0.5) * 60;
            
            return {
                pred,
                conf,
                type: "AI Memory",
                reason: `Pattern "${currentPattern}" xuất hiện ${patternData.count} lần (${(taiProb*100).toFixed(0)}% Tài)`
            };
        }
        
        return null;
    }

    trendAnalysis() {
        const arr = this._arr();
        if (arr.length < 20) return null;
        
        const shortTerm = arr.slice(0, 5).filter(x => x === 'TAI').length / 5;
        const mediumTerm = arr.slice(0, 10).filter(x => x === 'TAI').length / 10;
        const longTerm = arr.slice(0, 20).filter(x => x === 'TAI').length / 20;
        
        const trendChange = shortTerm - longTerm;
        
        if (Math.abs(trendChange) > 0.3) {
            const pred = trendChange > 0 ? 'XIU' : 'TAI';
            const conf = 65 + Math.abs(trendChange) * 50;
            
            return {
                pred,
                conf,
                type: "Xu Hướng Pro",
                reason: `Thay đổi xu hướng ${(trendChange*100).toFixed(0)}% → Đảo`
            };
        }
        
        if (Math.abs(shortTerm - 0.5) > 0.3) {
            const pred = shortTerm > 0.5 ? 'TAI' : 'XIU';
            const conf = 70;
            
            return {
                pred,
                conf,
                type: "Xu Hướng Pro",
                reason: `Xu hướng ổn định ${(shortTerm*100).toFixed(0)}% Tài`
            };
        }
        
        return null;
    }

    statisticalAnalysis() {
        const arr = this._arr();
        if (arr.length < 30) return null;
        
        const total30 = arr.slice(0, 30);
        const taiCount = total30.filter(x => x === 'TAI').length;
        const xiuCount = 30 - taiCount;
        
        const imbalance = Math.abs(taiCount - 15);
        
        if (imbalance >= 6) {
            const pred = taiCount > 15 ? 'XIU' : 'TAI';
            const conf = 65 + imbalance * 2;
            
            return {
                pred,
                conf: Math.min(85, conf),
                type: "Cân Bằng Pro",
                reason: `Mất cân bằng (${taiCount}T-${xiuCount}X) → Cân bằng`
            };
        }
        
        const expectedTAI = 15;
        const chiSquare = Math.pow(taiCount - expectedTAI, 2) / expectedTAI + 
                         Math.pow(xiuCount - expectedTAI, 2) / expectedTAI;
        
        if (chiSquare > 3.84) {
            const pred = taiCount > expectedTAI ? 'XIU' : 'TAI';
            const conf = 70;
            
            return {
                pred,
                conf,
                type: "Thống Kê Pro",
                reason: `Phân phối bất thường (χ²=${chiSquare.toFixed(2)})`
            };
        }
        
        return null;
    }

    // ===== TỔNG HỢP SIÊU VIP =====
    tongHopSieuVIP() {
        const arr = this._arr();
        if (arr.length < 2) return null;
        
        const allPredictions = [];
        
        const algorithms = [
            { name: 'AI Pattern', fn: () => this.aiPatternPredict(), priority: 10 },
            { name: 'Xu Hướng', fn: () => this.trendAnalysis(), priority: 9 },
            { name: 'Thống Kê', fn: () => this.statisticalAnalysis(), priority: 8 },
            { name: 'Mẫu Lặp', fn: () => this.phatHienMauLapPro(arr), priority: 7 },
            { name: 'Vị Pro', fn: () => this.duDoanViPro(), priority: 6 },
            { name: 'Bệt Pro', fn: () => this.cauSapPro(arr), priority: 5 },
            { name: 'Nối Pro', fn: () => this.cauNoiPro(arr), priority: 4 },
            { name: 'Đối Pro', fn: () => this.cauDoiPro(arr), priority: 3 }
        ];
        
        for (const algo of algorithms) {
            try {
                const prediction = algo.fn();
                if (prediction) {
                    allPredictions.push({
                        ...prediction,
                        priority: algo.priority,
                        algoName: algo.name
                    });
                }
            } catch (e) {
                // Skip failed algorithms
            }
        }
        
        if (allPredictions.length === 0) {
            return { 
                pred: arr[0], 
                conf: 55, 
                type: "Theo", 
                reason: "Bám phiên cuối" 
            };
        }
        
        let taiScore = 0, xiuScore = 0;
        
        for (const pred of allPredictions) {
            const weight = pred.priority * (pred.conf / 100);
            
            if (pred.pred === 'TAI') {
                taiScore += weight;
            } else {
                xiuScore += weight;
            }
        }
        
        const totalScore = taiScore + xiuScore;
        const taiProb = taiScore / totalScore;
        const xiuProb = xiuScore / totalScore;
        
        const finalPred = taiProb > xiuProb ? 'TAI' : 'XIU';
        const confidence = Math.min(95, Math.max(60, 
            50 + Math.abs(taiProb - xiuProb) * 90
        ));
        
        const topAlgos = allPredictions
            .sort((a, b) => b.priority * (b.conf/100) - a.priority * (a.conf/100))
            .slice(0, 3)
            .map(a => `${a.algoName}(${a.pred})`);
        
        return {
            pred: finalPred,
            conf: confidence,
            type: "SIÊU VIP",
            reason: `${allPredictions.length} thuật toán → ${finalPred} | Top: ${topAlgos.join(', ')}`,
            details: {
                totalAlgos: allPredictions.length,
                taiProbability: (taiProb * 100).toFixed(1) + '%',
                xiuProbability: (xiuProb * 100).toFixed(1) + '%',
                consensus: Math.abs(taiProb - 0.5) > 0.2 ? 'Mạnh' : 'Yếu'
            }
        };
    }
    
    apDungDaoChieu(p) {
        if (!p || this.history.length < 1) return p;
        const currentResult = this._arr()[0];
        
        if (this.error_streak >= 3 && this.last_prediction && this.last_prediction !== currentResult) {
            return {
                ...p,
                pred: p.pred === "TAI" ? "XIU" : "TAI",
                conf: Math.min(90, p.conf + 5),
                type: "Đảo Chiều Pro",
                reason: `🔄 Sai ${this.error_streak} lần → Đảo: ${p.reason}`
            };
        }
        
        if (this.multiLayerAnalysis.volatilityIndex > 0.7 && p.conf < 70) {
            return {
                ...p,
                pred: p.pred === "TAI" ? "XIU" : "TAI",
                conf: Math.min(85, p.conf + 8),
                type: "Đảo Biến Động",
                reason: `🌊 Biến động cao → Đảo: ${p.reason}`
            };
        }
        
        return p;
    }

    // ===== HÀM CHÍNH =====
    predict(data) {
        this.loadData(data);
        
        let result = this.tongHopSieuVIP();
        
        if (result) {
            result = this.apDungDaoChieu(result);
        } else {
            result = { 
                pred: this._arr()[0] || "TAI", 
                conf: 50, 
                type: "Theo", 
                reason: "Không đủ dữ liệu" 
            };
        }
        
        this.last_prediction = result.pred;
        this.smartPredictor.lastPredictions.push(result);
        if (this.smartPredictor.lastPredictions.length > 100) {
            this.smartPredictor.lastPredictions.shift();
        }
        
        stats.total_predictions_made++;
        stats.last_prediction = result.pred;
        stats.prediction_started = true;
        
        return result;
    }
    
    updateStatus(actual) {
        if (this.last_prediction) {
            const a = actual.toUpperCase().replace('XỈU', 'XIU').replace('TÀI', 'TAI');
            const wasCorrect = this.last_prediction === a;
            
            if (wasCorrect) {
                this.error_streak = 0;
                stats.streak_correct++;
                stats.streak_wrong = 0;
                stats.best_streak = Math.max(stats.best_streak, stats.streak_correct);
                stats.correct++;
            } else {
                this.error_streak++;
                stats.streak_wrong++;
                stats.streak_correct = 0;
                stats.worst_streak = Math.max(stats.worst_streak, stats.streak_wrong);
                stats.wrong++;
            }
            
            stats.total++;
            
            if (this.smartPredictor.lastPredictions.length > 0) {
                const lastConf = this.smartPredictor.lastPredictions[this.smartPredictor.lastPredictions.length - 1].conf;
                if (lastConf >= 80) stats.confidence_stats.high++;
                else if (lastConf >= 65) stats.confidence_stats.medium++;
                else stats.confidence_stats.low++;
            }
            
            const hour = new Date().getHours();
            if (!stats.hourly_stats[hour]) {
                stats.hourly_stats[hour] = { correct: 0, total: 0 };
            }
            stats.hourly_stats[hour].total++;
            if (wasCorrect) stats.hourly_stats[hour].correct++;
            
            stats.history.push({
                time: vnNow(),
                prediction: this.last_prediction,
                actual: a,
                correct: wasCorrect,
                streak: stats.streak_correct
            });
            
            if (stats.history.length > 1000) {
                stats.history.shift();
            }
        }
    }
    
    getDetailedStats() {
        const accuracy = stats.total > 0 ? (stats.correct / stats.total * 100).toFixed(2) : 0;
        
        return {
            ...stats,
            accuracy: accuracy + '%',
            profit_rate: this.calculateProfitRate(),
            best_hour: this.getBestHour(),
            current_streak: stats.streak_correct > 0 ? 
                `Đúng ${stats.streak_correct} liên tiếp` : 
                `Sai ${stats.streak_wrong} liên tiếp`,
            recommendation: this.getRecommendation()
        };
    }
    
    calculateProfitRate() {
        if (stats.total === 0) return '0%';
        const profit = stats.correct * 0.95 - stats.wrong;
        return (profit / stats.total * 100).toFixed(2) + '%';
    }
    
    getBestHour() {
        let bestHour = null;
        let bestAccuracy = 0;
        
        for (const [hour, data] of Object.entries(stats.hourly_stats)) {
            if (data.total >= 5) {
                const accuracy = data.correct / data.total;
                if (accuracy > bestAccuracy) {
                    bestAccuracy = accuracy;
                    bestHour = hour;
                }
            }
        }
        
        return bestHour ? `${bestHour}h (${(bestAccuracy*100).toFixed(1)}%)` : 'Chưa đủ dữ liệu';
    }
    
    getRecommendation() {
        const accuracy = stats.total > 0 ? stats.correct / stats.total : 0;
        
        if (accuracy >= 0.7 && stats.streak_correct >= 3) {
            return '🔥 Đang nóng - Tự tin dự đoán';
        } else if (accuracy >= 0.6) {
            return '✅ Ổn định - Tiếp tục theo dõi';
        } else if (accuracy >= 0.5) {
            return '⚠️ Cẩn thận - Chỉ nên test';
        } else {
            return '🛑 Tạm dừng - Chờ cầu đẹp';
        }
    }
}

// ============================================================
// KHỞI TẠO PREDICTOR
// ============================================================
const predictor = new TX_LogicPen_UltimateVIP();

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
const HISTORY_FILE = './history_vip.json';

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
    const phien = data[0]?.Phien || 0;
    const ketQua = data[0]?.Ket_qua === 'T' ? 'TAI' : 'XIU';
    
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
        thoiGian: vnNow(),
        algorithmCount: result.details?.totalAlgos || 0,
        reason: result.reason || ''
    };
    
    if (existingIndex !== -1) {
        historyData[type][existingIndex] = record;
    } else {
        historyData[type].unshift(record);
        if (historyData[type].length > CONFIG.MAX_HISTORY) {
            historyData[type] = historyData[type].slice(0, CONFIG.MAX_HISTORY);
        }
    }
    
    // Cập nhật predictor với kết quả thực tế
    predictor.updateStatus(ketQua);
    
    saveHistory();
    
    return {
        prediction: result.pred,
        confidence: result.conf,
        phien: phien,
        ketQua: ketQua,
        trangThai: result.pred === ketQua ? 'WIN' : 'LOSE',
        algorithmCount: result.details?.totalAlgos || 0,
        reason: result.reason || ''
    };
}

// ============================================================
// HÀM RENDER GIAO DIỆN DỰ ĐOÁN VIP
// ============================================================
const renderPredictionPage = (title, type, color) => `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>💎 TX PREDICTOR VIP - ${title}</title>
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

        .bg-vip {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: 
                radial-gradient(ellipse at 20% 30%, rgba(124,77,255,0.05), transparent 50%),
                radial-gradient(ellipse at 80% 70%, rgba(0,245,255,0.03), transparent 50%);
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
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(255,215,0,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,215,0,0.3); letter-spacing: 2px; text-transform: uppercase; }
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
            border-radius: 20px; border: 1px solid rgba(255,255,255,0.04);
            padding: 24px; transition: all 0.4s ease;
            margin-bottom: 16px;
            position: relative;
            overflow: hidden;
        }
        .card::before {
            content: '💎';
            position: absolute;
            top: -20px;
            right: -10px;
            font-size: 80px;
            opacity: 0.03;
            transform: rotate(20deg);
        }
        .card:hover { border-color: rgba(124,77,255,0.08); box-shadow: 0 0 80px rgba(124,77,255,0.05); transform: translateY(-2px); }

        .pred-result {
            font-size: 80px; font-weight: 900; font-family: 'Orbitron', sans-serif;
            margin: 0 0 8px; transition: all 0.6s ease; line-height: 1; min-height: 90px;
            letter-spacing: 6px; text-align: center;
        }
        .pred-result.tai { color: #4fc3f7; text-shadow: 0 0 120px rgba(79,195,247,0.25); }
        .pred-result.xiu { color: #ef5350; text-shadow: 0 0 120px rgba(239,83,80,0.25); }
        .pred-result.waiting { color: rgba(255,255,255,0.06); animation: textPulse 1.8s ease-in-out infinite; font-size: 28px; letter-spacing: 8px; }
        @keyframes textPulse { 0%,100% { opacity: 0.2; } 50% { opacity: 0.5; } }

        .pred-meta { display: flex; justify-content: center; gap: 30px; flex-wrap: wrap; margin: 6px 0 8px; }
        .meta-item { display: flex; flex-direction: column; align-items: center; gap: 2px; }
        .meta-item .label { font-size: 8px; color: rgba(255,255,255,0.15); text-transform: uppercase; letter-spacing: 1.5px; }
        .meta-item .value { font-size: 20px; font-weight: 700; font-family: 'Orbitron', sans-serif; }
        .meta-item .value.confidence { color: ${color}; }

        .bar-track { width: 100%; height: 5px; background: rgba(255,255,255,0.03); border-radius: 10px; overflow: hidden; margin-top: 6px; }
        .bar-fill { height: 100%; border-radius: 10px; background: linear-gradient(90deg, #ef5350, #ffd54f, ${color}); transition: width 1s ease; width: 0%; }

        .vip-badge {
            text-align: center;
            font-size: 10px;
            color: rgba(255,215,0,0.15);
            font-family: 'Orbitron', sans-serif;
            letter-spacing: 2px;
            margin-top: 8px;
        }
        .vip-badge i { color: ${color}; margin: 0 4px; }

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

<div class="bg-vip"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">💎</div>
            <div>
                <div class="logo-text">TX PREDICTOR VIP</div>
                <div class="logo-sub">ĐẠI CA KHÔI - ULTIMATE</div>
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
                💎 ULTIMATE VIP - DỰ ĐOÁN ${title}
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
            <div class="vip-badge">
                <i class="fas fa-crown"></i> 8+ THUẬT TOÁN VIP <i class="fas fa-crown"></i>
            </div>
        </div>
    </div>

    <div style="text-align:center;">
        <a href="/lichsu/${type}" class="btn-history"><i class="fas fa-history"></i> Xem lịch sử ${title}</a>
    </div>

    <div class="footer">
        <p>💎 <strong>TX PREDICTOR ULTIMATE VIP</strong> © ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,255,255,0.03);margin-top:2px;">8+ Thuật toán VIP · AI Thông minh · Tự học</p>
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
    console.log('💎 TX PREDICTOR ULTIMATE VIP - ${title}');
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
// RENDER GIAO DIỆN LỊCH SỬ VIP
// ============================================================
const renderHistoryPage = (type, title, color) => `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>📊 Lịch sử ${title} - TX PREDICTOR VIP</title>
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

        .bg-vip {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 20% 30%, rgba(124,77,255,0.05), transparent 50%),
                        radial-gradient(ellipse at 80% 70%, rgba(0,245,255,0.03), transparent 50%);
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
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(255,215,0,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,215,0,0.3); letter-spacing: 2px; text-transform: uppercase; }
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

        .vip-badge {
            text-align: center;
            font-size: 8px;
            color: rgba(255,215,0,0.08);
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

<div class="bg-vip"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">📊</div>
            <div>
                <div class="logo-text">TX PREDICTOR VIP</div>
                <div class="logo-sub">ĐẠI CA KHÔI - ULTIMATE</div>
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
        <div class="vip-badge">
            <i class="fas fa-crown"></i> 8+ THUẬT TOÁN VIP <i class="fas fa-crown"></i>
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
        <p>💎 <strong>TX PREDICTOR ULTIMATE VIP</strong> © ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,255,255,0.03);margin-top:2px;">8+ Thuật toán VIP · AI Thông minh · Tự học</p>
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
    console.log('📊 TX PREDICTOR ULTIMATE VIP - LỊCH SỬ ${title}');
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
    <title>💎 TX PREDICTOR ULTIMATE VIP</title>
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
        ::-webkit-scrollbar-thumb { background: #ffd700; border-radius: 10px; }

        .bg-vip {
            position: fixed; top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
            background: radial-gradient(ellipse at 20% 30%, rgba(124,77,255,0.05), transparent 50%),
                        radial-gradient(ellipse at 80% 70%, rgba(0,245,255,0.03), transparent 50%);
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
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            border-radius: 12px;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; font-weight: 900; color: #fff;
            font-family: 'Orbitron', sans-serif;
            box-shadow: 0 0 40px rgba(255,215,0,0.15);
        }
        .logo-text {
            font-family: 'Orbitron', sans-serif;
            font-size: 20px; font-weight: 700;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .logo-sub { font-size: 9px; color: rgba(255,215,0,0.3); letter-spacing: 2px; text-transform: uppercase; }
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
        .nav-link:hover { border-color: #ffd700; color: #ffd700; background: rgba(255,215,0,0.05); }
        .nav-link.active { border-color: #ffd700; color: #ffd700; background: rgba(255,215,0,0.05); }

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
            font-size: 32px; font-weight: 900;
            background: linear-gradient(135deg, #ffd700, #ff6b35);
            -webkit-background-clip: text; -webkit-text-fill-color: transparent;
            margin-bottom: 12px;
        }
        .welcome p { color: rgba(255,215,0,0.4); font-size: 14px; letter-spacing: 1px; }
        .welcome .version { color: rgba(255,215,0,0.15); font-size: 10px; margin-top: 8px; font-family: 'Orbitron', sans-serif; letter-spacing: 2px; }

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
            position: relative;
            overflow: hidden;
        }
        .menu-card::before {
            content: '💎';
            position: absolute;
            top: -10px;
            right: -10px;
            font-size: 60px;
            opacity: 0.05;
        }
        .menu-card:hover { border-color: rgba(255,215,0,0.08); box-shadow: 0 0 80px rgba(255,215,0,0.05); transform: translateY(-4px); }
        .menu-card .icon { font-size: 40px; margin-bottom: 12px; display: block; }
        .menu-card .title { font-family: 'Orbitron', sans-serif; font-size: 16px; font-weight: 700; color: #ffd700; }
        .menu-card .desc { font-size: 11px; color: rgba(255,215,0,0.3); margin-top: 4px; }

        .footer { text-align: center; padding: 14px 20px 6px; color: rgba(255,255,255,0.04); font-size: 8px; border-top: 1px solid rgba(255,255,255,0.02); margin-top: 12px; font-family: 'Orbitron', sans-serif; letter-spacing: 1px; }
        .footer strong { color: #ffd700; }

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

<div class="bg-vip"></div>

<div class="container">

    <header class="header">
        <div class="logo">
            <div class="logo-icon">💎</div>
            <div>
                <div class="logo-text">TX PREDICTOR VIP</div>
                <div class="logo-sub">ĐẠI CA KHÔI - ULTIMATE</div>
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
        <h1>💎 TX PREDICTOR ULTIMATE VIP</h1>
        <p>🚀 Hệ thống dự đoán Tài Xỉu đẳng cấp</p>
        <p class="version">🧠 8+ Thuật toán VIP · AI Thông minh · Tự học</p>
    </div>

    <div class="grid">
        <a href="/hu" class="menu-card">
            <span class="icon">🎲</span>
            <div class="title">Dự đoán HŨ</div>
            <div class="desc">8+ thuật toán VIP dự đoán HŨ</div>
        </a>
        <a href="/md5" class="menu-card">
            <span class="icon">🎲</span>
            <div class="title">Dự đoán MD5</div>
            <div class="desc">8+ thuật toán VIP dự đoán MD5</div>
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
        <p>💎 <strong>TX PREDICTOR ULTIMATE VIP</strong> © ĐẠI CA KHÔI</p>
        <p style="font-size:6px;color:rgba(255,255,255,0.03);margin-top:2px;">8+ Thuật toán VIP · AI Thông minh · Tự học</p>
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

app.get('/hu', function(req, res) {
    res.send(renderPredictionPage('HŨ', 'hu', '#ffd700'));
});

app.get('/md5', function(req, res) {
    res.send(renderPredictionPage('MD5', 'md5', '#ffd700'));
});

app.get('/lichsu/hu', function(req, res) {
    res.send(renderHistoryPage('hu', 'HŨ', '#ffd700'));
});

app.get('/lichsu/md5', function(req, res) {
    res.send(renderHistoryPage('md5', 'MD5', '#ffd700'));
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
            reason: result.reason || ''
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
            reason: result.reason || ''
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
        prediction_started: false,
        streak_correct: 0,
        streak_wrong: 0,
        best_streak: 0,
        worst_streak: 0,
        algorithm_stats: {},
        confidence_stats: { high: 0, medium: 0, low: 0 },
        hourly_stats: {},
        daily_profit: 0
    };
    saveHistory();
    res.json({ message: '💎 Reset thành công - TX PREDICTOR ULTIMATE VIP' });
});

// ============================================================
// KHỞI ĐỘNG SERVER
// ============================================================
loadHistory();
app.listen(PORT, '0.0.0.0', function() {
    console.log('========================================');
    console.log('💎 TX PREDICTOR ULTIMATE VIP');
    console.log('🚀 ĐẠI CA KHÔI - 8+ THUẬT TOÁN VIP');
    console.log('📊 1000 PHIÊN - THỐNG KÊ CHI TIẾT');
    console.log('Server: http://0.0.0.0:' + PORT);
    console.log('========================================');
});
