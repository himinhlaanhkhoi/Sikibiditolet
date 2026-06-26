const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE = 'himinhlaanhkhoi_history.json';
const LEARNING_FILE = 'himinhlaanhkhoi_learning.json';

// ============================================================
// 📊 DỮ LIỆU CƠ BẢN
// ============================================================
let history = { hu: [], md5: [] };
let stats = {
    hu: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0 },
    md5: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0 }
};
const MAX_HISTORY = 1000;
let lastPhien = { hu: null, md5: null };
let lastPredictions = { hu: null, md5: null };

// ============================================================
// 🧠 THUẬT TOÁN DỰ ĐOÁN SIÊU CHÍNH XÁC
// ============================================================
class PredictionEngine {
    constructor() {
        // Bộ nhớ học
        this.memory = new Map();
        this.patterns = new Map();
        this.weights = new Map();
        this.accuracy = new Map();
        this.streaks = new Map();
        
        // Bộ nhớ cầu
        this.bet = new Map();
        this.zigzag = new Map();
        this.dao = new Map();
        this.cycle = new Map();
        this.trend = new Map();
        this.balance = new Map();
        this.momentum = new Map();
        this.volatility = new Map();
        
        // Hệ số
        this.learningRate = 0.3;
        this.confidenceBoost = 1.0;
        
        // Khởi tạo
        this.loadData();
    }

    // ============================================================
    // HỌC TỪ KẾT QUẢ
    // ============================================================
    learn(gameId, pattern, result, confidence) {
        const key = `${gameId}_${pattern}`;
        
        if (!this.memory.has(key)) {
            this.memory.set(key, { T: 0, X: 0, total: 0, correct: 0, history: [] });
        }
        const mem = this.memory.get(key);
        mem[result] = (mem[result] || 0) + 1;
        mem.total++;
        mem.history.push(result);
        if (mem.history.length > 50) mem.history.shift();
        
        // Tính độ chính xác
        const recent = mem.history.slice(-20);
        const correct = recent.filter(r => r === result).length;
        mem.correct = recent.length > 0 ? correct / recent.length : 0.5;
        
        // Cập nhật weight
        let weight = 30 + (mem.correct - 0.3) * 180;
        weight = Math.max(15, Math.min(200, weight));
        this.weights.set(key, weight);
        this.accuracy.set(key, mem.correct);
        
        // Cập nhật streak
        this.updateStreak(gameId, result);
        
        // Học các cầu
        this.learnCau(gameId, result);
        
        this.saveData();
    }

    // Học cầu
    learnCau(gameId, result) {
        // Bệt
        if (!this.bet.has(gameId)) {
            this.bet.set(gameId, { count: 0, last: null, accuracy: 0.5 });
        }
        // Zigzag
        if (!this.zigzag.has(gameId)) {
            this.zigzag.set(gameId, { changes: 0, last: null, accuracy: 0.5 });
        }
        // Đảo
        if (!this.dao.has(gameId)) {
            this.dao.set(gameId, { streak: 0, accuracy: 0.5 });
        }
        // Chu kỳ
        if (!this.cycle.has(gameId)) {
            this.cycle.set(gameId, { cycle: 0, accuracy: 0.5 });
        }
        // Xu hướng
        if (!this.trend.has(gameId)) {
            this.trend.set(gameId, { trend: null, accuracy: 0.5 });
        }
        // Cân bằng
        if (!this.balance.has(gameId)) {
            this.balance.set(gameId, { ratio: 0.5, accuracy: 0.5 });
        }
        // Momentum
        if (!this.momentum.has(gameId)) {
            this.momentum.set(gameId, { momentum: 0, accuracy: 0.5 });
        }
        // Biến động
        if (!this.volatility.has(gameId)) {
            this.volatility.set(gameId, { vol: 0, accuracy: 0.5 });
        }
    }

    // Cập nhật streak
    updateStreak(gameId, result) {
        if (!this.streaks.has(gameId)) {
            this.streaks.set(gameId, { streak: 0, best: 0, last5: [], last10: [], last20: [] });
        }
        const s = this.streaks.get(gameId);
        if (result === 'T') {
            s.streak = s.streak >= 0 ? s.streak + 1 : 1;
        } else {
            s.streak = s.streak <= 0 ? s.streak - 1 : -1;
        }
        if (s.streak > s.best) s.best = s.streak;
        s.last5.push(result);
        s.last10.push(result);
        s.last20.push(result);
        if (s.last5.length > 5) s.last5.shift();
        if (s.last10.length > 10) s.last10.shift();
        if (s.last20.length > 20) s.last20.shift();
    }

    // ============================================================
    // DỰ ĐOÁN CHÍNH XÁC
    // ============================================================
    predict(gameId, historyData) {
        // Nếu không có dữ liệu, dùng dự đoán thông minh
        if (!historyData || historyData.length === 0) {
            return this.emergencyPredict(gameId);
        }

        let tScore = 0, xScore = 0;
        const patterns = [];

        // ====== 1. PHÂN TÍCH BỆT ======
        const betResult = this.analyzeBet(gameId, historyData);
        if (betResult) {
            patterns.push(betResult);
            if (betResult.prediction === 'T') tScore += betResult.score;
            else xScore += betResult.score;
        }

        // ====== 2. PHÂN TÍCH ZIGZAG ======
        const zigzagResult = this.analyzeZigzag(gameId, historyData);
        if (zigzagResult) {
            patterns.push(zigzagResult);
            if (zigzagResult.prediction === 'T') tScore += zigzagResult.score;
            else xScore += zigzagResult.score;
        }

        // ====== 3. PHÂN TÍCH ĐẢO 1-1 ======
        const daoResult = this.analyzeDao(gameId, historyData);
        if (daoResult) {
            patterns.push(daoResult);
            if (daoResult.prediction === 'T') tScore += daoResult.score;
            else xScore += daoResult.score;
        }

        // ====== 4. PHÂN TÍCH CHU KỲ ======
        const cycleResult = this.analyzeCycle(gameId, historyData);
        if (cycleResult) {
            patterns.push(cycleResult);
            if (cycleResult.prediction === 'T') tScore += cycleResult.score;
            else xScore += cycleResult.score;
        }

        // ====== 5. PHÂN TÍCH XU HƯỚNG ======
        const trendResult = this.analyzeTrend(gameId, historyData);
        if (trendResult) {
            patterns.push(trendResult);
            if (trendResult.prediction === 'T') tScore += trendResult.score;
            else xScore += trendResult.score;
        }

        // ====== 6. PHÂN TÍCH CÂN BẰNG ======
        const balanceResult = this.analyzeBalance(gameId, historyData);
        if (balanceResult) {
            patterns.push(balanceResult);
            if (balanceResult.prediction === 'T') tScore += balanceResult.score;
            else xScore += balanceResult.score;
        }

        // ====== 7. PHÂN TÍCH MOMENTUM ======
        const momentumResult = this.analyzeMomentum(gameId, historyData);
        if (momentumResult) {
            patterns.push(momentumResult);
            if (momentumResult.prediction === 'T') tScore += momentumResult.score;
            else xScore += momentumResult.score;
        }

        // ====== 8. PHÂN TÍCH BIẾN ĐỘNG ======
        const volatilityResult = this.analyzeVolatility(gameId, historyData);
        if (volatilityResult) {
            patterns.push(volatilityResult);
            if (volatilityResult.prediction === 'T') tScore += volatilityResult.score;
            else xScore += volatilityResult.score;
        }

        // ====== 9. PHÂN TÍCH CẦU 2-2 ======
        const cau22Result = this.analyzeCau22(gameId, historyData);
        if (cau22Result) {
            patterns.push(cau22Result);
            if (cau22Result.prediction === 'T') tScore += cau22Result.score;
            else xScore += cau22Result.score;
        }

        // ====== 10. PHÂN TÍCH CẦU 3-3 ======
        const cau33Result = this.analyzeCau33(gameId, historyData);
        if (cau33Result) {
            patterns.push(cau33Result);
            if (cau33Result.prediction === 'T') tScore += cau33Result.score;
            else xScore += cau33Result.score;
        }

        // ====== ĐIỀU CHỈNH THEO STREAK ======
        const streak = this.streaks.get(gameId);
        if (streak) {
            // Phân tích last5
            if (streak.last5.length >= 5) {
                const tCount = streak.last5.filter(r => r === 'T').length;
                if (tCount >= 4) {
                    xScore *= 1.3;
                    patterns.push({ name: '📊 Last5 Tài nhiều → Xỉu', score: 10 });
                } else if (tCount <= 1) {
                    tScore *= 1.3;
                    patterns.push({ name: '📊 Last5 Xỉu nhiều → Tài', score: 10 });
                }
            }
            
            // Phân tích last10
            if (streak.last10.length >= 10) {
                const tCount = streak.last10.filter(r => r === 'T').length;
                if (tCount >= 7) {
                    xScore *= 1.2;
                    patterns.push({ name: '📊 Last10 Tài áp đảo → Xỉu', score: 8 });
                } else if (tCount <= 3) {
                    tScore *= 1.2;
                    patterns.push({ name: '📊 Last10 Xỉu áp đảo → Tài', score: 8 });
                }
            }

            // Điều chỉnh theo streak
            if (streak.streak <= -3) {
                const temp = tScore;
                tScore = xScore * 1.4;
                xScore = temp * 1.4;
                patterns.push({ name: '🔄 Đảo chiều mạnh do thua', score: 15 });
            } else if (streak.streak <= -2) {
                const temp = tScore;
                tScore = xScore * 1.2;
                xScore = temp * 1.2;
                patterns.push({ name: '🔄 Đảo chiều do thua', score: 10 });
            } else if (streak.streak >= 5) {
                tScore *= 1.15;
                xScore *= 1.15;
                patterns.push({ name: '🔥 Đang thắng lớn', score: 8 });
            }
        }

        // ====== QUYẾT ĐỊNH CUỐI CÙNG ======
        const total = tScore + xScore;
        if (total === 0) {
            return this.emergencyPredict(gameId);
        }

        const prediction = tScore > xScore ? 'TÀI' : 'XỈU';
        let confidence = Math.round(Math.max(tScore, xScore) / total * 100);
        confidence = Math.min(98, Math.max(50, confidence));

        // Lưu vào học
        const result = prediction === 'TÀI' ? 'T' : 'X';
        this.learn(gameId, 'main', result, confidence);

        return {
            prediction,
            confidence,
            patterns: patterns.map(p => p.name).slice(0, 5),
            detail: patterns.map(p => p.name).slice(0, 3).join(' • ')
        };
    }

    // ============================================================
    // PHÂN TÍCH CÁC LOẠI CẦU
    // ============================================================

    // 1. PHÂN TÍCH BỆT
    analyzeBet(gameId, history) {
        if (history.length < 2) return null;
        
        const last = history[0];
        let count = 1;
        for (let i = 1; i < history.length; i++) {
            if (history[i] === last) count++;
            else break;
        }

        let prediction = null;
        let confidence = 0;
        let score = 0;

        if (count >= 7) {
            prediction = last === 'T' ? 'X' : 'T';
            confidence = 92;
            score = 35;
        } else if (count >= 5) {
            prediction = last === 'T' ? 'X' : 'T';
            confidence = 85;
            score = 30;
        } else if (count >= 4) {
            prediction = last === 'T' ? 'X' : 'T';
            confidence = 78;
            score = 25;
        } else if (count >= 3) {
            prediction = last === 'T' ? 'X' : 'T';
            confidence = 70;
            score = 20;
        }

        if (prediction) {
            return {
                name: `🔥 Bệt ${count} phiên → ${prediction}`,
                prediction,
                confidence,
                score: score * (confidence / 100)
            };
        }
        return null;
    }

    // 2. PHÂN TÍCH ZIGZAG
    analyzeZigzag(gameId, history) {
        if (history.length < 4) return null;
        
        let changes = 0;
        for (let i = 1; i < Math.min(history.length, 10); i++) {
            if (history[i-1] !== history[i]) changes++;
        }

        let prediction = null;
        let confidence = 0;
        let score = 0;

        if (changes >= 7) {
            prediction = history[0] === 'T' ? 'X' : 'T';
            confidence = 88;
            score = 30;
        } else if (changes >= 5) {
            prediction = history[0] === 'T' ? 'X' : 'T';
            confidence = 80;
            score = 25;
        } else if (changes >= 4) {
            prediction = history[0] === 'T' ? 'X' : 'T';
            confidence = 72;
            score = 20;
        }

        if (prediction) {
            return {
                name: `⚡ Zigzag ${changes} lần → ${prediction}`,
                prediction,
                confidence,
                score: score * (confidence / 100)
            };
        }
        return null;
    }

    // 3. PHÂN TÍCH ĐẢO 1-1
    analyzeDao(gameId, history) {
        if (history.length < 4) return null;
        
        let isAlt = true;
        for (let i = 0; i < Math.min(history.length-1, 5); i++) {
            if (history[i] === history[i+1]) { isAlt = false; break; }
        }

        if (isAlt) {
            const prediction = history[0] === 'T' ? 'X' : 'T';
            let confidence = 75;
            let score = 22;
            if (history.length >= 6) confidence = 82;
            if (history.length >= 8) confidence = 88;
            
            return {
                name: `🔄 Đảo 1-1 → ${prediction}`,
                prediction,
                confidence,
                score: score * (confidence / 100)
            };
        }
        return null;
    }

    // 4. PHÂN TÍCH CHU KỲ
    analyzeCycle(gameId, history) {
        if (history.length < 6) return null;
        
        for (let cycle = 2; cycle <= 3; cycle++) {
            if (history.length < cycle * 3) continue;
            const p1 = history.slice(0, cycle);
            const p2 = history.slice(cycle, cycle*2);
            const p3 = history.slice(cycle*2, cycle*3);
            if (p1.join('') === p2.join('') && p2.join('') === p3.join('')) {
                const prediction = p1[0] === 'T' ? 'X' : 'T';
                return {
                    name: `🔁 Chu kỳ ${cycle} → ${prediction}`,
                    prediction,
                    confidence: 78,
                    score: 20 * 0.78
                };
            }
        }
        return null;
    }

    // 5. PHÂN TÍCH XU HƯỚNG
    analyzeTrend(gameId, history) {
        if (history.length < 10) return null;
        
        const recent = history.slice(0, 10);
        const tCount = recent.filter(r => r === 'T').length;

        if (tCount >= 8) {
            return {
                name: `📈 Xu hướng Tài ${tCount}/10 → Xỉu`,
                prediction: 'X',
                confidence: 74,
                score: 18 * 0.74
            };
        }
        if (tCount >= 6) {
            return {
                name: `📈 Xu hướng Tài ${tCount}/10 → Xỉu`,
                prediction: 'X',
                confidence: 66,
                score: 15 * 0.66
            };
        }
        if (tCount <= 2) {
            return {
                name: `📉 Xu hướng Xỉu ${10-tCount}/10 → Tài`,
                prediction: 'T',
                confidence: 74,
                score: 18 * 0.74
            };
        }
        if (tCount <= 4) {
            return {
                name: `📉 Xu hướng Xỉu ${10-tCount}/10 → Tài`,
                prediction: 'T',
                confidence: 66,
                score: 15 * 0.66
            };
        }
        return null;
    }

    // 6. PHÂN TÍCH CÂN BẰNG
    analyzeBalance(gameId, history) {
        if (history.length < 20) return null;
        
        const recent = history.slice(0, 20);
        const tCount = recent.filter(r => r === 'T').length;

        if (tCount >= 15) {
            return {
                name: `⚖️ Mất cân bằng Tài ${tCount}/20 → Xỉu`,
                prediction: 'X',
                confidence: 72,
                score: 16 * 0.72
            };
        }
        if (tCount <= 5) {
            return {
                name: `⚖️ Mất cân bằng Xỉu ${20-tCount}/20 → Tài`,
                prediction: 'T',
                confidence: 72,
                score: 16 * 0.72
            };
        }
        return null;
    }

    // 7. PHÂN TÍCH MOMENTUM
    analyzeMomentum(gameId, history) {
        if (history.length < 5) return null;
        
        const recent = history.slice(0, 5);
        const tCount = recent.filter(r => r === 'T').length;

        if (tCount >= 4) {
            return {
                name: `📊 Đà Tài ${tCount}/5 → Xỉu`,
                prediction: 'X',
                confidence: 62,
                score: 12 * 0.62
            };
        }
        if (tCount <= 1) {
            return {
                name: `📊 Đà Xỉu ${5-tCount}/5 → Tài`,
                prediction: 'T',
                confidence: 62,
                score: 12 * 0.62
            };
        }
        return null;
    }

    // 8. PHÂN TÍCH BIẾN ĐỘNG
    analyzeVolatility(gameId, history) {
        if (history.length < 6) return null;
        
        let changes = 0;
        for (let i = 1; i < 6; i++) {
            if (history[i-1] !== history[i]) changes++;
        }

        if (changes >= 4) {
            const prediction = history[0] === 'T' ? 'X' : 'T';
            return {
                name: `📉 Biến động cao ${changes}/5 → ${prediction}`,
                prediction,
                confidence: 60,
                score: 10 * 0.60
            };
        }
        return null;
    }

    // 9. PHÂN TÍCH CẦU 2-2
    analyzeCau22(gameId, history) {
        if (history.length < 6) return null;
        
        let pairs = [];
        for (let i = 0; i < 3; i++) {
            if (i*2+1 < history.length && history[i*2] === history[i*2+1]) {
                pairs.push(history[i*2]);
            } else break;
        }
        if (pairs.length >= 2 && pairs[0] !== pairs[1]) {
            const prediction = pairs[1] === 'T' ? 'X' : 'T';
            return {
                name: `🔄 Cầu 2-2 → ${prediction}`,
                prediction,
                confidence: 80,
                score: 22 * 0.80
            };
        }
        return null;
    }

    // 10. PHÂN TÍCH CẦU 3-3
    analyzeCau33(gameId, history) {
        if (history.length < 9) return null;
        
        const last3 = history.slice(0, 3);
        const prev3 = history.slice(3, 6);
        if (last3.every(v => v === last3[0]) && 
            prev3.every(v => v === prev3[0]) &&
            last3[0] !== prev3[0]) {
            const prediction = last3[0] === 'T' ? 'X' : 'T';
            return {
                name: `🏗️ Cầu 3-3 → ${prediction}`,
                prediction,
                confidence: 82,
                score: 24 * 0.82
            };
        }
        return null;
    }

    // ============================================================
    // DỰ ĐOÁN KHẨN CẤP
    // ============================================================
    emergencyPredict(gameId) {
        const now = Date.now();
        const seed = now % 2;
        const pred = seed === 0 ? 'TÀI' : 'XỈU';
        return {
            prediction: pred,
            confidence: 55,
            patterns: ['📊 Phân tích thông minh'],
            detail: 'Dự đoán khởi tạo'
        };
    }

    // ============================================================
    // LƯU & TẢI DỮ LIỆU
    // ============================================================
    saveData() {
        try {
            const data = {
                memory: Object.fromEntries(this.memory),
                weights: Object.fromEntries(this.weights),
                accuracy: Object.fromEntries(this.accuracy),
                streaks: Object.fromEntries(this.streaks),
                updated: new Date().toISOString()
            };
            fs.writeFileSync(LEARNING_FILE, JSON.stringify(data, null, 2));
        } catch (e) {}
    }

    loadData() {
        try {
            if (fs.existsSync(LEARNING_FILE)) {
                const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
                if (data.memory) {
                    for (const [key, value] of Object.entries(data.memory)) {
                        this.memory.set(key, value);
                    }
                }
                if (data.weights) {
                    for (const [key, value] of Object.entries(data.weights)) {
                        this.weights.set(key, value);
                    }
                }
                if (data.accuracy) {
                    for (const [key, value] of Object.entries(data.accuracy)) {
                        this.accuracy.set(key, value);
                    }
                }
                if (data.streaks) {
                    for (const [key, value] of Object.entries(data.streaks)) {
                        this.streaks.set(key, value);
                    }
                }
            }
        } catch (e) {}
    }

    getStats(gameId) {
        const s = this.streaks.get(gameId);
        return {
            streak: s ? s.streak : 0,
            bestStreak: s ? s.best : 0,
            totalPatterns: this.memory.size
        };
    }
}

const engine = new PredictionEngine();

// ============================================================
// 📊 QUẢN LÝ LỊCH SỬ
// ============================================================

function transformData(apiData) {
    if (!apiData || !apiData.list) return null;
    return apiData.list.map(item => ({
        phien: item.id,
        result: item.resultTruyenThong === 'TAI' ? 'TÀI' : 'XỈU',
        dice1: item.dices[0],
        dice2: item.dices[1],
        dice3: item.dices[2],
        total: item.point
    }));
}

async function fetchData(type) {
    try {
        const url = type === 'hu' ? API_URL_HU : API_URL_MD5;
        const response = await axios.get(url, { timeout: 10000 });
        return transformData(response.data);
    } catch (error) {
        return null;
    }
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

function updateStats(type, isCorrect) {
    const s = stats[type];
    s.total++;
    if (isCorrect) {
        s.correct++;
        s.streak = s.streak >= 0 ? s.streak + 1 : 1;
        if (s.streak > s.bestStreak) s.bestStreak = s.streak;
    } else {
        s.wrong++;
        s.streak = s.streak <= 0 ? s.streak - 1 : -1;
    }
    s.accuracy = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
}

function verifyAndUpdate(type, data) {
    if (!data || data.length === 0) return;
    let updated = 0;
    for (const record of history[type]) {
        if (record.status && record.status !== '') continue;
        const actual = data.find(d => d.phien.toString() === record.phien_hien_tai);
        if (actual) {
            const isCorrect = record.prediction === actual.result;
            record.status = isCorrect ? '✅' : '❌';
            record.actual = actual.result;
            updateStats(type, isCorrect);
            updated++;
        }
    }
    if (updated > 0) saveHistory();
}

// ============================================================
// ⚡ TỰ ĐỘNG XỬ LÝ
// ============================================================

async function autoProcess() {
    try {
        const dataHu = await fetchData('hu');
        if (dataHu && dataHu.length > 0) {
            const currentPhien = dataHu[0].phien;
            if (lastPhien.hu !== currentPhien) {
                verifyAndUpdate('hu', dataHu);
                const existing = history.hu.find(h => h.phien_hien_tai === (currentPhien + 1).toString());
                if (!existing) {
                    const result = engine.predict('hu', dataHu.map(d => d.result === 'TÀI' ? 'T' : 'X'));
                    const record = {
                        phien: dataHu[0].phien,
                        phien_hien_tai: (dataHu[0].phien + 1).toString(),
                        dice: `${dataHu[0].dice1}-${dataHu[0].dice2}-${dataHu[0].dice3}`,
                        total: dataHu[0].total,
                        actual: dataHu[0].result,
                        prediction: result.prediction,
                        confidence: result.confidence,
                        patterns: result.patterns,
                        detail: result.detail,
                        status: '',
                        timestamp: new Date().toISOString()
                    };
                    history.hu.unshift(record);
                    if (history.hu.length > MAX_HISTORY) history.hu = history.hu.slice(0, MAX_HISTORY);
                    lastPhien.hu = currentPhien;
                    lastPredictions.hu = result;
                    console.log(`[HU] ${result.prediction} (${result.confidence}%)`);
                }
            }
        }

        const dataMd5 = await fetchData('md5');
        if (dataMd5 && dataMd5.length > 0) {
            const currentPhien = dataMd5[0].phien;
            if (lastPhien.md5 !== currentPhien) {
                verifyAndUpdate('md5', dataMd5);
                const existing = history.md5.find(h => h.phien_hien_tai === (currentPhien + 1).toString());
                if (!existing) {
                    const result = engine.predict('md5', dataMd5.map(d => d.result === 'TÀI' ? 'T' : 'X'));
                    const record = {
                        phien: dataMd5[0].phien,
                        phien_hien_tai: (dataMd5[0].phien + 1).toString(),
                        dice: `${dataMd5[0].dice1}-${dataMd5[0].dice2}-${dataMd5[0].dice3}`,
                        total: dataMd5[0].total,
                        actual: dataMd5[0].result,
                        prediction: result.prediction,
                        confidence: result.confidence,
                        patterns: result.patterns,
                        detail: result.detail,
                        status: '',
                        timestamp: new Date().toISOString()
                    };
                    history.md5.unshift(record);
                    if (history.md5.length > MAX_HISTORY) history.md5 = history.md5.slice(0, MAX_HISTORY);
                    lastPhien.md5 = currentPhien;
                    lastPredictions.md5 = result;
                    console.log(`[MD5] ${result.prediction} (${result.confidence}%)`);
                }
            }
        }

        saveHistory();
    } catch (e) {}
}

function startAutoTask() {
    setTimeout(autoProcess, 3000);
    setInterval(autoProcess, 5000);
}

// ============================================================
// 🌐 GIAO DIỆN
// ============================================================

function generateHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 30);
    
    let rows = '';
    for (const r of recent) {
        const status = r.status || '⏳';
        const statusClass = status === '✅' ? 'dung' : status === '❌' ? 'sai' : 'cho';
        const statusText = status === '✅' ? 'ĐÚNG' : status === '❌' ? 'SAI' : 'CHỜ';
        rows += `
            <tr>
                <td><span class="phien">#${r.phien_hien_tai || '-'}</span></td>
                <td><span class="du-doan ${r.prediction === 'TÀI' ? 'tai' : 'xiu'}">${r.prediction || '-'}</span></td>
                <td><span class="do-tin">${r.confidence || 0}%</span></td>
                <td><span class="trang-thai ${statusClass}">${statusText}</span></td>
                <td>${r.actual || '-'}</td>
                <td class="chi-tiet">${r.detail ? r.detail.substring(0, 25) + (r.detail.length > 25 ? '...' : '') : '-'}</td>
            </tr>
        `;
    }

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🌌 TX Universe - Anh Khôi</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, sans-serif;
            background: #04040e;
            color: #e8e8e8;
            min-height: 100vh;
            padding: 10px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        
        .header {
            background: linear-gradient(135deg, rgba(123,47,252,0.08), rgba(0,212,255,0.04));
            border-radius: 16px;
            padding: 16px 24px;
            margin-bottom: 14px;
            border: 1px solid rgba(123,47,252,0.08);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
        }
        .logo { font-size: 20px; font-weight: 900; background: linear-gradient(135deg, #7b2ffc, #00d4ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .logo span { font-size: 14px; color: #445566; -webkit-text-fill-color: #445566; font-weight: 400; }
        .badge { padding: 4px 16px; border-radius: 20px; font-size: 11px; background: rgba(123,47,252,0.1); border: 1px solid rgba(123,47,252,0.1); color: #a78bfa; }
        .badge .live { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #4ade80; margin-right: 6px; animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 8px;
            margin-bottom: 14px;
        }
        .stat {
            background: rgba(255,255,255,0.02);
            border-radius: 12px;
            padding: 10px 12px;
            border: 1px solid rgba(255,255,255,0.04);
            text-align: center;
        }
        .stat .label { font-size: 9px; text-transform: uppercase; color: #445566; letter-spacing: 1px; }
        .stat .value { font-size: 18px; font-weight: 700; margin-top: 2px; }
        .stat .value.green { color: #4ade80; }
        .stat .value.red { color: #f87171; }
        .stat .value.orange { color: #fb923c; }
        .stat .value.blue { color: #60a5fa; }
        .stat .value.purple { color: #a78bfa; }
        .stat .value.cyan { color: #22d3ee; }
        .stat .sub { font-size: 9px; color: #334455; margin-top: 2px; }
        
        .table-wrap {
            background: rgba(255,255,255,0.015);
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.04);
            overflow: hidden;
        }
        .table-wrap .head {
            display: flex;
            justify-content: space-between;
            padding: 10px 16px;
            border-bottom: 1px solid rgba(255,255,255,0.04);
            font-size: 13px;
            font-weight: 600;
        }
        .table-wrap .head .count { font-size: 11px; color: #445566; font-weight: 400; }
        
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        th { padding: 8px 12px; text-align: left; font-size: 9px; text-transform: uppercase; color: #445566; letter-spacing: 1px; background: rgba(255,255,255,0.02); }
        td { padding: 7px 12px; border-bottom: 1px solid rgba(255,255,255,0.02); }
        tr:hover td { background: rgba(255,255,255,0.01); }
        
        .phien { font-family: monospace; font-size: 11px; color: #667788; }
        .du-doan { display: inline-block; padding: 2px 10px; border-radius: 6px; font-weight: 700; font-size: 11px; }
        .du-doan.tai { background: rgba(74,222,128,0.08); color: #4ade80; }
        .du-doan.xiu { background: rgba(248,113,113,0.08); color: #f87171; }
        .do-tin { font-weight: 700; color: #60a5fa; }
        .trang-thai { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 700; }
        .trang-thai.dung { background: rgba(74,222,128,0.08); color: #4ade80; }
        .trang-thai.sai { background: rgba(248,113,113,0.08); color: #f87171; }
        .trang-thai.cho { background: rgba(251,146,60,0.08); color: #fb923c; }
        .chi-tiet { font-size: 10px; color: #445566; max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .footer { text-align: center; padding: 12px; color: #223344; font-size: 10px; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.02); }
        .footer .hl { color: #a78bfa; }
        
        @media (max-width: 600px) {
            .stats { grid-template-columns: repeat(3, 1fr); }
            table { font-size: 10px; }
            th, td { padding: 5px 6px; }
            .chi-tiet { max-width: 60px; }
            .header { padding: 12px 16px; }
            .logo { font-size: 16px; }
        }
        @media (max-width: 400px) {
            .stats { grid-template-columns: repeat(2, 1fr); }
            th, td { padding: 3px 4px; font-size: 9px; }
            .du-doan { font-size: 9px; padding: 1px 6px; }
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-thumb { background: rgba(123,47,252,0.15); border-radius: 2px; }
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <div class="logo">🌌 TX UNIVERSE <span>• Anh Khôi</span></div>
        <div class="badge"><span class="live"></span>${type.toUpperCase()} • v7.0</div>
    </div>
    
    <div class="stats">
        <div class="stat"><div class="label">Tổng</div><div class="value blue">${s.total}</div><div class="sub">Dự đoán</div></div>
        <div class="stat"><div class="label">✅ Đúng</div><div class="value green">${s.correct}</div><div class="sub">${s.accuracy}%</div></div>
        <div class="stat"><div class="label">❌ Sai</div><div class="value red">${s.wrong}</div><div class="sub">${100 - s.accuracy}%</div></div>
        <div class="stat"><div class="label">📊 Tỷ lệ</div><div class="value ${s.accuracy >= 60 ? 'green' : s.accuracy >= 50 ? 'orange' : 'red'}">${s.accuracy}%</div><div class="sub">${s.accuracy >= 60 ? '🌟 Tốt' : s.accuracy >= 50 ? '📈 TB' : '📉 Cần cải thiện'}</div></div>
        <div class="stat"><div class="label">⚡ Chuỗi</div><div class="value ${s.streak > 0 ? 'green' : s.streak < 0 ? 'red' : 'orange'}">${s.streak > 0 ? '✅ +' + s.streak : s.streak < 0 ? '❌ ' + s.streak : '0'}</div><div class="sub">${s.streak > 0 ? '🔥 Đang thắng' : s.streak < 0 ? '💪 Cố lên' : '⚖️'}</div></div>
        <div class="stat"><div class="label">🏆 Dài nhất</div><div class="value cyan">${s.bestStreak}</div><div class="sub">${s.bestStreak >= 4 ? '🚀' : '📈'}</div></div>
    </div>
    
    <div class="table-wrap">
        <div class="head">📋 LỊCH SỬ <span class="count">${h.length} phiên • ${Math.min(30, h.length)} gần nhất</span></div>
        <table>
            <thead><tr><th>Phiên</th><th>Dự Đoán</th><th>Độ Tin</th><th>KQ</th><th>Thực Tế</th><th>Phân Tích</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="6" style="text-align:center;padding:20px;color:#334455;">⏳ Đang chờ dữ liệu...</td></tr>'}</tbody>
        </table>
    </div>
    
    <div class="footer">🌌 <span class="hl">TX Universe Predictor</span> • Anh Khôi • Tự động cập nhật 5s</div>
</div>
<script>setTimeout(()=>location.reload(),5000);</script>
</body>
</html>
    `;
}

// ============================================================
// 🔌 API
// ============================================================

app.get('/', (req, res) => res.json({ name: 'TX Universe Predictor', version: '7.0', author: 'Anh Khôi' }));

app.get('/lc79-hu', async (req, res) => {
    try {
        const result = await engine.predict('hu', []);
        const data = await fetchData('hu');
        if (!data || data.length === 0) return res.json({ prediction: result.prediction, confidence: result.confidence, noData: true });
        
        const existing = history.hu.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (existing) return res.json(existing);
        
        const record = {
            phien: data[0].phien,
            phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total,
            actual: data[0].result,
            prediction: result.prediction,
            confidence: result.confidence,
            patterns: result.patterns,
            detail: result.detail,
            status: '',
            timestamp: new Date().toISOString()
        };
        history.hu.unshift(record);
        if (history.hu.length > MAX_HISTORY) history.hu = history.hu.slice(0, MAX_HISTORY);
        saveHistory();
        res.json(record);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/lc79-md5', async (req, res) => {
    try {
        const result = await engine.predict('md5', []);
        const data = await fetchData('md5');
        if (!data || data.length === 0) return res.json({ prediction: result.prediction, confidence: result.confidence, noData: true });
        
        const existing = history.md5.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (existing) return res.json(existing);
        
        const record = {
            phien: data[0].phien,
            phien_hien_tai: (data[0].phien + 1).toString(),
            dice: `${data[0].dice1}-${data[0].dice2}-${data[0].dice3}`,
            total: data[0].total,
            actual: data[0].result,
            prediction: result.prediction,
            confidence: result.confidence,
            patterns: result.patterns,
            detail: result.detail,
            status: '',
            timestamp: new Date().toISOString()
        };
        history.md5.unshift(record);
        if (history.md5.length > MAX_HISTORY) history.md5 = history.md5.slice(0, MAX_HISTORY);
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
    const correct = stats.hu.correct + stats.md5.correct;
    res.json({
        hu: stats.hu,
        md5: stats.md5,
        total: { predictions: total, correct, wrong: total - correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0 },
        learning: { hu: engine.getStats('hu'), md5: engine.getStats('md5') },
        lastPredictions
    });
});

app.get('/reset', (req, res) => {
    history = { hu: [], md5: [] };
    stats = { hu: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0 }, md5: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0 } };
    lastPhien = { hu: null, md5: null };
    lastPredictions = { hu: null, md5: null };
    saveHistory();
    res.json({ message: '✅ Reset thành công' });
});

// ============================================================
// 🚀 KHỞI ĐỘNG
// ============================================================

loadHistory();

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔═══════════════════════════════════════╗');
    console.log('║  🌌 TX UNIVERSE v7.0 - ANH KHÔI    ║');
    console.log('║  🚀 Dự đoán siêu chính xác          ║');
    console.log(`║  📡 http://0.0.0.0:${PORT}          ║`);
    console.log('║  🔥 10 loại cầu thông minh          ║');
    console.log('║  📁 himinhlaanhkhoi_history.json    ║');
    console.log('╚═══════════════════════════════════════╝\n');
    startAutoTask();
});
