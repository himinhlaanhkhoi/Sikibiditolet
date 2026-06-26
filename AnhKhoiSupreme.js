const express = require('express');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 5000;

const API_URL_HU = 'https://wtx.tele68.com/v1/tx/sessions';
const API_URL_MD5 = 'https://wtxmd52.tele68.com/v1/txmd5/sessions';
const HISTORY_FILE = 'himinhlaanhkhoi_history.json';
const LEARNING_FILE = 'himinhlaanhkhoi_learning.json';

// ============================================================
// 📊 LỊCH SỬ 1000 PHIÊN
// ============================================================
let history = {
    hu: [],
    md5: []
};

let stats = {
    hu: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0, worstStreak: 0, last10: [], last50: [] },
    md5: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0, worstStreak: 0, last10: [], last50: [] }
};

let learning = {
    hu: { patterns: {}, sequences: {}, weights: {}, history: [], adapt: {} },
    md5: { patterns: {}, sequences: {}, weights: {}, history: [], adapt: {} }
};

const MAX_HISTORY = 1000;
const AUTO_SAVE_INTERVAL = 15000;
let lastPhien = { hu: null, md5: null };
let processing = { hu: false, md5: false };

// ============================================================
// 🧠 HỆ THỐNG HỌC SÂU THÍCH NGHI
// ============================================================
class DeepLearningEngine {
    constructor() {
        this.patternDB = new Map();
        this.sequenceDB = new Map();
        this.weightDB = new Map();
        this.accuracyDB = new Map();
        this.streakDB = new Map();
        this.patternHistory = new Map();
        this.adaptiveThreshold = new Map();
    }

    // Học từ kết quả
    learn(gameId, pattern, result, confidence, sequence) {
        const key = `${gameId}_${pattern}`;
        
        // Cập nhật pattern database
        if (!this.patternDB.has(key)) {
            this.patternDB.set(key, { T: 0, X: 0, total: 0, correct: 0, history: [], confidence: [] });
        }
        const db = this.patternDB.get(key);
        db[result] = (db[result] || 0) + 1;
        db.total++;
        db.history.push(result);
        db.confidence.push(confidence);
        
        if (db.history.length > 100) db.history.shift();
        if (db.confidence.length > 100) db.confidence.shift();

        // Tính độ chính xác
        const recent = db.history.slice(-20);
        const correct = recent.filter(r => r === result).length;
        db.correct = correct / recent.length;

        // Học sequence
        if (sequence && sequence.length >= 2) {
            const seqKey = `${gameId}_${sequence}`;
            if (!this.sequenceDB.has(seqKey)) {
                this.sequenceDB.set(seqKey, { T: 0, X: 0, total: 0 });
            }
            const seq = this.sequenceDB.get(seqKey);
            seq[result] = (seq[result] || 0) + 1;
            seq.total++;
        }

        // Cập nhật weight
        let weight = 50 + (db.correct - 0.5) * 120;
        weight = Math.max(15, Math.min(180, weight));
        
        // Điều chỉnh theo confidence
        const avgConf = db.confidence.slice(-10).reduce((a,b) => a+b, 0) / Math.min(db.confidence.length, 10);
        if (avgConf > 70) weight *= 1.1;
        if (avgConf < 50) weight *= 0.9;
        
        this.weightDB.set(key, Math.min(180, Math.max(15, weight)));
        this.accuracyDB.set(key, db.correct);

        // Cập nhật streak
        if (!this.streakDB.has(gameId)) {
            this.streakDB.set(gameId, { streak: 0, best: 0, worst: 0 });
        }
        const streak = this.streakDB.get(gameId);
        if (result === 'T') {
            streak.streak = streak.streak >= 0 ? streak.streak + 1 : 1;
        } else {
            streak.streak = streak.streak <= 0 ? streak.streak - 1 : -1;
        }
        if (streak.streak > streak.best) streak.best = streak.streak;
        if (streak.streak < streak.worst) streak.worst = streak.streak;
        this.streakDB.set(gameId, streak);

        // Lưu pattern history
        if (!this.patternHistory.has(gameId)) {
            this.patternHistory.set(gameId, []);
        }
        const ph = this.patternHistory.get(gameId);
        ph.push({ pattern, result, confidence, time: Date.now() });
        if (ph.length > 500) ph.shift();
    }

    // Dự đoán thông minh
    predict(gameId, patterns, history) {
        if (!patterns || patterns.length === 0) {
            return this.fallbackPredict(gameId, history);
        }

        let tScore = 0, xScore = 0;
        let tWeight = 0, xWeight = 0;
        let totalWeight = 0;
        const usedPatterns = [];

        for (const p of patterns) {
            const key = `${gameId}_${p.pattern}`;
            const weight = this.weightDB.get(key) || 50;
            const accuracy = this.accuracyDB.get(key) || 0.5;
            
            // Điều chỉnh weight theo độ chính xác
            const finalWeight = weight * (0.4 + accuracy * 0.6);
            
            // Điều chỉnh confidence
            let conf = p.confidence;
            if (accuracy > 0.65) conf *= 1.1;
            if (accuracy < 0.35) conf *= 0.8;
            
            const score = finalWeight * (conf / 100);
            
            if (p.prediction === 'T') {
                tScore += score;
                tWeight += finalWeight;
            } else {
                xScore += score;
                xWeight += finalWeight;
            }
            totalWeight += finalWeight;
            usedPatterns.push(p.detail);
        }

        // Phân tích sequence
        const seqResult = this.analyzeSequence(gameId, history);
        if (seqResult) {
            if (seqResult === 'T') {
                tScore *= 1.15;
            } else {
                xScore *= 1.15;
            }
        }

        // Điều chỉnh theo streak
        const streak = this.streakDB.get(gameId);
        if (streak) {
            if (streak.streak >= 4) {
                // Đang thắng nhiều, tăng độ tin cậy
                tScore *= 1.1;
                xScore *= 1.1;
            } else if (streak.streak <= -3) {
                // Đang thua nhiều, đảo chiều mạnh
                const temp = tScore;
                tScore = xScore * 1.3;
                xScore = temp * 1.3;
            }
        }

        // Phân tích xu hướng
        const trend = this.analyzeTrend(gameId, history);
        if (trend) {
            if (trend === 'T') tScore *= 1.08;
            else xScore *= 1.08;
        }

        const total = tScore + xScore;
        if (total === 0) {
            return this.fallbackPredict(gameId, history);
        }

        const prediction = tScore > xScore ? 'TÀI' : 'XỈU';
        let confidence = Math.round(Math.max(tScore, xScore) / total * 100);
        
        // Điều chỉnh confidence
        if (totalWeight > 0) {
            const avgWeight = totalWeight / patterns.length;
            if (avgWeight > 80) confidence = Math.min(98, confidence + 5);
            if (avgWeight < 30) confidence = Math.max(50, confidence - 5);
        }

        // Giới hạn confidence
        confidence = Math.min(98, Math.max(50, confidence));

        // Lưu vào lịch sử học
        const result = prediction === 'TÀI' ? 'T' : 'X';
        const patternKey = usedPatterns.join('|') || 'basic';
        this.learn(gameId, patternKey, result, confidence, history.slice(0, 5).join(''));

        return {
            prediction,
            confidence,
            patterns: usedPatterns,
            detail: usedPatterns.slice(0, 3).join(', ')
        };
    }

    // Phân tích sequence
    analyzeSequence(gameId, history) {
        if (history.length < 5) return null;
        const seq = history.slice(0, 5).join('');
        const key = `${gameId}_${seq}`;
        const db = this.sequenceDB.get(key);
        if (!db || db.total < 2) return null;
        return db.T > db.X ? 'T' : 'X';
    }

    // Phân tích xu hướng
    analyzeTrend(gameId, history) {
        if (history.length < 10) return null;
        const recent = history.slice(0, 10);
        const tCount = recent.filter(r => r === 'T').length;
        if (tCount >= 7) return 'X';
        if (tCount <= 3) return 'T';
        return null;
    }

    // Fallback thông minh
    fallbackPredict(gameId, history) {
        if (history.length < 2) return { prediction: 'TÀI', confidence: 50, patterns: [], detail: 'Fallback' };
        
        const last = history[0];
        let count = 1;
        for (let i = 1; i < history.length; i++) {
            if (history[i] === last) count++;
            else break;
        }

        if (count >= 4) {
            const pred = last === 'T' ? 'XỈU' : 'TÀI';
            return { prediction: pred, confidence: 65 + count, patterns: ['Bệt dài'], detail: `Bệt ${count} phiên` };
        }

        return { prediction: last === 'T' ? 'TÀI' : 'XỈU', confidence: 55, patterns: ['Theo chuỗi'], detail: 'Theo chuỗi' };
    }

    getStats(gameId) {
        const streak = this.streakDB.get(gameId);
        const patternHistory = this.patternHistory.get(gameId) || [];
        const recentAccuracy = patternHistory.slice(-20).filter(p => p.result === 'T').length / Math.min(patternHistory.length, 20);
        
        return {
            streak: streak ? streak.streak : 0,
            bestStreak: streak ? streak.best : 0,
            worstStreak: streak ? streak.worst : 0,
            recentAccuracy: Math.round(recentAccuracy * 100),
            patternCount: this.patternDB.size,
            sequenceCount: this.sequenceDB.size
        };
    }
}

const deepLearner = new DeepLearningEngine();

// ============================================================
// 🔍 PHÂN TÍCH CẦU CHUYÊN SÂU
// ============================================================
class CauAnalyzer {
    analyze(history) {
        const patterns = [];

        // 1. Phân tích Bệt
        const bet = this.analyzeBet(history);
        if (bet) patterns.push(bet);

        // 2. Phân tích Đảo 1-1
        const dao11 = this.analyzeDao11(history);
        if (dao11) patterns.push(dao11);

        // 3. Phân tích Cầu 2-2
        const cau22 = this.analyzeCau22(history);
        if (cau22) patterns.push(cau22);

        // 4. Phân tích Cầu 3-3
        const cau33 = this.analyzeCau33(history);
        if (cau33) patterns.push(cau33);

        // 5. Phân tích Cầu 4-4
        const cau44 = this.analyzeCau44(history);
        if (cau44) patterns.push(cau44);

        // 6. Phân tích Zigzag
        const zigzag = this.analyzeZigzag(history);
        if (zigzag) patterns.push(zigzag);

        // 7. Phân tích Chu kỳ
        const cycle = this.analyzeCycle(history);
        if (cycle) patterns.push(cycle);

        // 8. Phân tích Xu hướng
        const trend = this.analyzeTrend(history);
        if (trend) patterns.push(trend);

        // 9. Phân tích Cân bằng
        const balance = this.analyzeBalance(history);
        if (balance) patterns.push(balance);

        // 10. Phân tích Gãy cầu
        const breakPattern = this.analyzeBreak(history);
        if (breakPattern) patterns.push(breakPattern);

        return patterns;
    }

    analyzeBet(history) {
        if (history.length < 2) return null;
        const last = history[0];
        let count = 1;
        for (let i = 1; i < history.length; i++) {
            if (history[i] === last) count++;
            else break;
        }

        if (count >= 3) {
            const confidence = Math.min(95, 60 + count * 4);
            const prediction = count >= 6 ? (last === 'T' ? 'X' : 'T') : last;
            return {
                pattern: 'bet',
                prediction: prediction === 'T' ? 'T' : 'X',
                confidence,
                weight: count,
                detail: `Bệt ${count} phiên ${last === 'T' ? 'Tài' : 'Xỉu'}`
            };
        }
        return null;
    }

    analyzeDao11(history) {
        if (history.length < 5) return null;
        let isAlternating = true;
        for (let i = 0; i < 4; i++) {
            if (history[i] === history[i+1]) {
                isAlternating = false;
                break;
            }
        }

        if (isAlternating) {
            const prediction = history[0] === 'T' ? 'X' : 'T';
            return {
                pattern: 'dao11',
                prediction,
                confidence: 78,
                weight: 1.5,
                detail: 'Đảo 1-1'
            };
        }

        // Kiểm tra đảo 2-2
        if (history.length >= 6) {
            const pairs = [];
            for (let i = 0; i < 3; i++) {
                if (i*2+1 < history.length && history[i*2] === history[i*2+1]) {
                    pairs.push(history[i*2]);
                } else break;
            }
            if (pairs.length >= 2 && pairs[0] !== pairs[1]) {
                const prediction = pairs[1] === 'T' ? 'X' : 'T';
                return {
                    pattern: 'dao22',
                    prediction,
                    confidence: 82,
                    weight: 1.8,
                    detail: 'Đảo 2-2'
                };
            }
        }
        return null;
    }

    analyzeCau22(history) {
        if (history.length < 8) return null;
        const last2 = history.slice(0, 2);
        const prev2 = history.slice(2, 4);
        const prevPrev2 = history.slice(4, 6);
        
        if (last2[0] === last2[1] && 
            prev2[0] === prev2[1] && 
            prevPrev2[0] === prevPrev2[1] &&
            last2[0] !== prev2[0] &&
            prev2[0] === prevPrev2[0]) {
            return {
                pattern: 'cau22',
                prediction: last2[0] === 'T' ? 'X' : 'T',
                confidence: 85,
                weight: 2,
                detail: 'Cầu 2-2'
            };
        }
        return null;
    }

    analyzeCau33(history) {
        if (history.length < 9) return null;
        const last3 = history.slice(0, 3);
        const prev3 = history.slice(3, 6);
        
        if (last3.every(v => v === last3[0]) && 
            prev3.every(v => v === prev3[0]) &&
            last3[0] !== prev3[0]) {
            return {
                pattern: 'cau33',
                prediction: last3[0] === 'T' ? 'X' : 'T',
                confidence: 84,
                weight: 1.8,
                detail: 'Cầu 3-3'
            };
        }
        return null;
    }

    analyzeCau44(history) {
        if (history.length < 12) return null;
        const last4 = history.slice(0, 4);
        const prev4 = history.slice(4, 8);
        
        if (last4.every(v => v === last4[0]) && 
            prev4.every(v => v === prev4[0]) &&
            last4[0] !== prev4[0]) {
            return {
                pattern: 'cau44',
                prediction: last4[0] === 'T' ? 'X' : 'T',
                confidence: 88,
                weight: 2.2,
                detail: 'Cầu 4-4'
            };
        }
        return null;
    }

    analyzeZigzag(history) {
        if (history.length < 6) return null;
        let changes = 0;
        for (let i = 1; i < Math.min(history.length, 10); i++) {
            if (history[i-1] !== history[i]) changes++;
        }
        if (changes >= 7) {
            const prediction = history[0] === 'T' ? 'X' : 'T';
            return {
                pattern: 'zigzag',
                prediction,
                confidence: 82,
                weight: 1.6,
                detail: `Zigzag ${changes} lần`
            };
        }
        return null;
    }

    analyzeCycle(history) {
        if (history.length < 9) return null;
        for (let cycle = 2; cycle <= 4; cycle++) {
            if (history.length < cycle * 3) continue;
            const p1 = history.slice(0, cycle);
            const p2 = history.slice(cycle, cycle*2);
            const p3 = history.slice(cycle*2, cycle*3);
            
            if (p1.join('') === p2.join('') && p2.join('') === p3.join('')) {
                return {
                    pattern: 'cycle',
                    prediction: p1[0] === 'T' ? 'X' : 'T',
                    confidence: 80,
                    weight: 1.5,
                    detail: `Chu kỳ ${cycle}`
                };
            }
        }
        return null;
    }

    analyzeTrend(history) {
        if (history.length < 12) return null;
        const recent = history.slice(0, 12);
        const tCount = recent.filter(v => v === 'T').length;
        
        if (tCount >= 9) {
            return {
                pattern: 'trend',
                prediction: 'X',
                confidence: 76,
                weight: 1.4,
                detail: `Xu hướng Tài ${tCount}/12`
            };
        }
        if (tCount <= 3) {
            return {
                pattern: 'trend',
                prediction: 'T',
                confidence: 76,
                weight: 1.4,
                detail: `Xu hướng Xỉu ${12-tCount}/12`
            };
        }
        return null;
    }

    analyzeBalance(history) {
        if (history.length < 20) return null;
        const recent = history.slice(0, 20);
        const tCount = recent.filter(v => v === 'T').length;
        
        if (tCount >= 15) {
            return {
                pattern: 'balance',
                prediction: 'X',
                confidence: 72,
                weight: 1.2,
                detail: `Mất cân bằng Tài ${tCount}/20`
            };
        }
        if (tCount <= 5) {
            return {
                pattern: 'balance',
                prediction: 'T',
                confidence: 72,
                weight: 1.2,
                detail: `Mất cân bằng Xỉu ${20-tCount}/20`
            };
        }
        return null;
    }

    analyzeBreak(history) {
        if (history.length < 6) return null;
        const last = history[0];
        let count = 1;
        for (let i = 1; i < history.length; i++) {
            if (history[i] === last) count++;
            else break;
        }
        
        if (count >= 4 && history.length > count) {
            const breakResult = history[count];
            if (breakResult !== last) {
                return {
                    pattern: 'break',
                    prediction: breakResult === 'T' ? 'T' : 'X',
                    confidence: 70,
                    weight: 1.2,
                    detail: `Gãy cầu ${last} → ${breakResult}`
                };
            }
        }
        return null;
    }
}

const analyzer = new CauAnalyzer();

// ============================================================
// 🎯 DỰ ĐOÁN THÔNG MINH
// ============================================================
class SmartPredictor {
    async predict(gameId) {
        try {
            const url = gameId === 'hu' ? API_URL_HU : API_URL_MD5;
            const response = await axios.get(url, { timeout: 10000 });
            const data = response.data;
            
            if (!data || !data.list || data.list.length === 0) {
                return this.fallback('Không có dữ liệu');
            }

            // Lấy lịch sử
            const items = data.list.slice(0, 50).reverse();
            const historyData = items.map(item => {
                const r = (item.resultTruyenThong || '').toUpperCase();
                return r.includes('TAI') ? 'T' : r.includes('XIU') ? 'X' : null;
            }).filter(r => r !== null);

            if (historyData.length < 3) {
                return this.fallback('Lịch sử quá ngắn');
            }

            // Phân tích cầu
            const patterns = analyzer.analyze(historyData);
            
            // Dự đoán bằng deep learning
            const result = deepLearner.predict(gameId, patterns, historyData);
            
            // Lưu vào lịch sử học
            const predResult = result.prediction === 'TÀI' ? 'T' : 'X';
            
            return {
                prediction: result.prediction,
                confidence: result.confidence,
                patterns: result.patterns || [],
                detail: result.detail || 'Phân tích cầu',
                totalPatterns: patterns.length
            };

        } catch (error) {
            console.error(`Error predicting ${gameId}:`, error.message);
            return this.fallback(error.message);
        }
    }

    fallback(error) {
        return {
            prediction: 'TÀI',
            confidence: 50,
            patterns: [],
            detail: `Fallback: ${error}`,
            totalPatterns: 0
        };
    }
}

const predictor = new SmartPredictor();

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
        console.error(`Error fetching ${type}:`, error.message);
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
            console.log('📂 Loaded history: HU=' + history.hu.length + ', MD5=' + history.md5.length);
        }
        if (fs.existsSync(LEARNING_FILE)) {
            const data = JSON.parse(fs.readFileSync(LEARNING_FILE, 'utf8'));
            learning = data;
            console.log('🧠 Loaded learning data');
        }
    } catch (error) {
        console.error('Error loading data:', error.message);
    }
}

function saveHistory() {
    try {
        fs.writeFileSync(HISTORY_FILE, JSON.stringify({ 
            history, 
            stats, 
            lastPhien,
            updated: new Date().toISOString()
        }, null, 2));
    } catch (error) {
        console.error('Error saving history:', error.message);
    }
}

function saveLearning() {
    try {
        fs.writeFileSync(LEARNING_FILE, JSON.stringify(learning, null, 2));
    } catch (error) {
        console.error('Error saving learning:', error.message);
    }
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
        if (s.streak < s.worstStreak) s.worstStreak = s.streak;
    }
    s.accuracy = Math.round((s.correct / s.total) * 100);
    
    // Cập nhật last10 và last50
    s.last10.push(isCorrect ? 1 : 0);
    s.last50.push(isCorrect ? 1 : 0);
    if (s.last10.length > 10) s.last10.shift();
    if (s.last50.length > 50) s.last50.shift();
}

function verifyAndUpdate(type, data) {
    if (!data || data.length === 0 || processing[type]) return;
    processing[type] = true;
    
    try {
        let updated = 0;
        for (const record of history[type]) {
            if (record.status && record.status !== '') continue;
            
            const actual = data.find(d => d.phien.toString() === record.phien_hien_tai);
            if (actual) {
                const isCorrect = record.prediction === actual.result;
                record.status = isCorrect ? '✅' : '❌';
                record.actual = actual.result;
                record.actual_time = new Date().toISOString();
                updateStats(type, isCorrect);
                
                // Cập nhật deep learning
                const patternKey = record.patterns ? record.patterns.join('|') : 'basic';
                const result = record.prediction === 'TÀI' ? 'T' : 'X';
                deepLearner.learn(type, patternKey, result, record.confidence, []);
                
                updated++;
            }
        }
        
        if (updated > 0) {
            saveHistory();
            saveLearning();
            console.log(`✅ Verified ${updated} records for ${type}`);
        }
    } finally {
        processing[type] = false;
    }
}

// ============================================================
// ⚡ AUTO PROCESS
// ============================================================

async function autoProcess() {
    try {
        // Xử lý HU
        const dataHu = await fetchData('hu');
        if (dataHu && dataHu.length > 0) {
            const currentPhien = dataHu[0].phien;
            if (lastPhien.hu !== currentPhien) {
                // Verify kết quả cũ
                verifyAndUpdate('hu', dataHu);
                
                // Chỉ dự đoán nếu chưa có
                const existing = history.hu.find(h => h.phien_hien_tai === (currentPhien + 1).toString());
                if (!existing) {
                    const result = await predictor.predict('hu');
                    const newRecord = {
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
                    
                    history.hu.unshift(newRecord);
                    if (history.hu.length > MAX_HISTORY) {
                        history.hu = history.hu.slice(0, MAX_HISTORY);
                    }
                    
                    lastPhien.hu = currentPhien;
                    console.log(`[Auto] HU: ${result.prediction} (${result.confidence}%) - ${result.detail}`);
                }
            }
        }

        // Xử lý MD5
        const dataMd5 = await fetchData('md5');
        if (dataMd5 && dataMd5.length > 0) {
            const currentPhien = dataMd5[0].phien;
            if (lastPhien.md5 !== currentPhien) {
                verifyAndUpdate('md5', dataMd5);
                
                const existing = history.md5.find(h => h.phien_hien_tai === (currentPhien + 1).toString());
                if (!existing) {
                    const result = await predictor.predict('md5');
                    const newRecord = {
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
                    
                    history.md5.unshift(newRecord);
                    if (history.md5.length > MAX_HISTORY) {
                        history.md5 = history.md5.slice(0, MAX_HISTORY);
                    }
                    
                    lastPhien.md5 = currentPhien;
                    console.log(`[Auto] MD5: ${result.prediction} (${result.confidence}%) - ${result.detail}`);
                }
            }
        }

        saveHistory();
        saveLearning();
    } catch (error) {
        console.error('[Auto] Error:', error.message);
    }
}

function startAutoTask() {
    console.log(`⏰ Auto-task started (every ${AUTO_SAVE_INTERVAL/1000}s)`);
    setTimeout(autoProcess, 3000);
    setInterval(autoProcess, AUTO_SAVE_INTERVAL);
}

// ============================================================
// 🌐 HTML THỐNG KÊ
// ============================================================

function generateStatsHTML(type) {
    const s = stats[type];
    const h = history[type] || [];
    const recent = h.slice(0, 20);
    
    let rows = '';
    for (const r of recent) {
        const status = r.status || '⏳';
        const statusColor = status === '✅' ? 'green' : status === '❌' ? 'red' : 'orange';
        rows += `
            <tr>
                <td>${r.phien_hien_tai || '-'}</td>
                <td>${r.prediction || '-'}</td>
                <td>${r.confidence || 0}%</td>
                <td style="color: ${statusColor}; font-weight: bold;">${status}</td>
                <td>${r.actual || '-'}</td>
                <td style="font-size: 11px; color: #666;">${r.detail || '-'}</td>
            </tr>
        `;
    }

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>TX Universe Predictor - ${type.toUpperCase()}</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #0a0a1a 0%, #1a1a3e 100%);
                color: #e0e0e0;
                padding: 20px;
                min-height: 100vh;
            }
            .container { max-width: 1200px; margin: 0 auto; }
            .header {
                background: rgba(255,255,255,0.05);
                border-radius: 16px;
                padding: 24px 32px;
                margin-bottom: 24px;
                border: 1px solid rgba(255,255,255,0.08);
            }
            .header h1 {
                font-size: 28px;
                font-weight: 700;
                background: linear-gradient(90deg, #00d4ff, #7b2ffc);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                margin-bottom: 8px;
            }
            .header .sub {
                color: #8899aa;
                font-size: 14px;
            }
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 16px;
                margin-bottom: 24px;
            }
            .stat-card {
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                padding: 16px 20px;
                border: 1px solid rgba(255,255,255,0.06);
                text-align: center;
            }
            .stat-card .label { font-size: 12px; color: #8899aa; text-transform: uppercase; letter-spacing: 0.5px; }
            .stat-card .value { font-size: 24px; font-weight: 700; margin-top: 4px; }
            .stat-card .value.green { color: #4ade80; }
            .stat-card .value.red { color: #f87171; }
            .stat-card .value.orange { color: #fb923c; }
            .stat-card .value.blue { color: #60a5fa; }
            
            .table-wrap {
                background: rgba(255,255,255,0.05);
                border-radius: 12px;
                overflow: hidden;
                border: 1px solid rgba(255,255,255,0.06);
            }
            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 14px;
            }
            th {
                background: rgba(255,255,255,0.08);
                padding: 12px 16px;
                text-align: left;
                font-weight: 600;
                color: #8899aa;
                text-transform: uppercase;
                font-size: 11px;
                letter-spacing: 0.5px;
            }
            td {
                padding: 10px 16px;
                border-bottom: 1px solid rgba(255,255,255,0.05);
            }
            tr:hover { background: rgba(255,255,255,0.03); }
            .badge {
                display: inline-block;
                padding: 2px 10px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
            }
            .badge.green { background: rgba(74,222,128,0.2); color: #4ade80; }
            .badge.red { background: rgba(248,113,113,0.2); color: #f87171; }
            .badge.orange { background: rgba(251,146,60,0.2); color: #fb923c; }
            .badge.purple { background: rgba(123,47,252,0.2); color: #a78bfa; }
            
            .footer {
                text-align: center;
                padding: 20px;
                color: #556677;
                font-size: 13px;
                margin-top: 20px;
            }
            @media (max-width: 600px) {
                .stats-grid { grid-template-columns: repeat(2, 1fr); }
                table { font-size: 12px; }
                th, td { padding: 8px 10px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🌌 TX Universe Predictor</h1>
                <div class="sub">${type.toUpperCase()} • ${new Date().toLocaleString()} • Tổng: ${h.length} phiên</div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="label">Tổng Dự Đoán</div>
                    <div class="value blue">${s.total}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Đúng</div>
                    <div class="value green">${s.correct}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Sai</div>
                    <div class="value red">${s.wrong}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Tỷ Lệ Đúng</div>
                    <div class="value ${s.accuracy >= 60 ? 'green' : s.accuracy >= 50 ? 'orange' : 'red'}">${s.accuracy}%</div>
                </div>
                <div class="stat-card">
                    <div class="label">Chuỗi Hiện Tại</div>
                    <div class="value ${s.streak > 0 ? 'green' : s.streak < 0 ? 'red' : 'orange'}">${s.streak > 0 ? '✅ +' + s.streak : s.streak < 0 ? '❌ ' + s.streak : '0'}</div>
                </div>
                <div class="stat-card">
                    <div class="label">Chuỗi Dài Nhất</div>
                    <div class="value green">✅ ${s.bestStreak}</div>
                </div>
            </div>

            <div class="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Phiên</th>
                            <th>Dự Đoán</th>
                            <th>Độ Tin</th>
                            <th>Kết Quả</th>
                            <th>Thực Tế</th>
                            <th>Phân Tích</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows || '<tr><td colspan="6" style="text-align:center; padding:30px; color:#556677;">Chưa có dữ liệu</td></tr>'}
                    </tbody>
                </table>
            </div>
            
            <div class="footer">
                ⚡ TX Universe Predictor v3.0 • himinhlaanhkhoi • Tự động cập nhật mỗi 15s
            </div>
        </div>
    </body>
    </html>
    `;
}

// ============================================================
// 🔌 API ENDPOINTS
// ============================================================

app.get('/', (req, res) => {
    res.json({
        name: 'TX Universe Predictor',
        version: '3.0',
        author: 'himinhlaanhkhoi',
        endpoints: [
            '/lc79-hu',
            '/lc79-md5',
            '/lc79-hu/history',
            '/lc79-md5/history',
            '/stats',
            '/analysis'
        ]
    });
});

// Dự đoán HU
app.get('/lc79-hu', async (req, res) => {
    try {
        const result = await predictor.predict('hu');
        const data = await fetchData('hu');
        if (!data || data.length === 0) {
            return res.status(500).json({ error: 'Không có dữ liệu' });
        }

        // Kiểm tra trùng
        const existing = history.hu.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (existing) {
            return res.json({
                phien_hien_tai: existing.phien_hien_tai,
                prediction: existing.prediction,
                confidence: existing.confidence + '%',
                detail: existing.detail,
                status: existing.status || '⏳ Chờ',
                cached: true
            });
        }

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
        if (history.hu.length > MAX_HISTORY) {
            history.hu = history.hu.slice(0, MAX_HISTORY);
        }
        saveHistory();

        res.json({
            phien_hien_tai: record.phien_hien_tai,
            prediction: record.prediction,
            confidence: `${record.confidence}%`,
            detail: record.detail,
            patterns: record.patterns,
            status: '⏳ Chờ kết quả',
            dice: record.dice,
            total: record.total
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Dự đoán MD5
app.get('/lc79-md5', async (req, res) => {
    try {
        const result = await predictor.predict('md5');
        const data = await fetchData('md5');
        if (!data || data.length === 0) {
            return res.status(500).json({ error: 'Không có dữ liệu' });
        }

        const existing = history.md5.find(h => h.phien_hien_tai === (data[0].phien + 1).toString());
        if (existing) {
            return res.json({
                phien_hien_tai: existing.phien_hien_tai,
                prediction: existing.prediction,
                confidence: existing.confidence + '%',
                detail: existing.detail,
                status: existing.status || '⏳ Chờ',
                cached: true
            });
        }

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
        if (history.md5.length > MAX_HISTORY) {
            history.md5 = history.md5.slice(0, MAX_HISTORY);
        }
        saveHistory();

        res.json({
            phien_hien_tai: record.phien_hien_tai,
            prediction: record.prediction,
            confidence: `${record.confidence}%`,
            detail: record.detail,
            patterns: record.patterns,
            status: '⏳ Chờ kết quả',
            dice: record.dice,
            total: record.total
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lịch sử HU - HTML
app.get('/lc79-hu/history', async (req, res) => {
    const data = await fetchData('hu');
    if (data) verifyAndUpdate('hu', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateStatsHTML('hu'));
});

// Lịch sử MD5 - HTML
app.get('/lc79-md5/history', async (req, res) => {
    const data = await fetchData('md5');
    if (data) verifyAndUpdate('md5', data);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(generateStatsHTML('md5'));
});

// Lịch sử JSON
app.get('/lc79-hu/json', async (req, res) => {
    const data = await fetchData('hu');
    if (data) verifyAndUpdate('hu', data);
    res.json({
        type: 'HU',
        total: history.hu.length,
        stats: stats.hu,
        records: history.hu.slice(0, 50)
    });
});

app.get('/lc79-md5/json', async (req, res) => {
    const data = await fetchData('md5');
    if (data) verifyAndUpdate('md5', data);
    res.json({
        type: 'MD5',
        total: history.md5.length,
        stats: stats.md5,
        records: history.md5.slice(0, 50)
    });
});

// Thống kê tổng hợp
app.get('/stats', (req, res) => {
    const total = stats.hu.total + stats.md5.total;
    const correct = stats.hu.correct + stats.md5.correct;
    res.json({
        hu: stats.hu,
        md5: stats.md5,
        total: {
            predictions: total,
            correct: correct,
            wrong: total - correct,
            accuracy: total > 0 ? Math.round((correct / total) * 100) : 0
        },
        learning: {
            hu: deepLearner.getStats('hu'),
            md5: deepLearner.getStats('md5')
        }
    });
});

// Phân tích
app.get('/analysis', async (req, res) => {
    const [hu, md5] = await Promise.all([
        predictor.predict('hu'),
        predictor.predict('md5')
    ]);
    
    res.json({
        hu: {
            prediction: hu.prediction,
            confidence: hu.confidence,
            patterns: hu.patterns,
            detail: hu.detail,
            totalPatterns: hu.totalPatterns
        },
        md5: {
            prediction: md5.prediction,
            confidence: md5.confidence,
            patterns: md5.patterns,
            detail: md5.detail,
            totalPatterns: md5.totalPatterns
        }
    });
});

// Reset
app.get('/reset', (req, res) => {
    history = { hu: [], md5: [] };
    stats = {
        hu: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0, worstStreak: 0, last10: [], last50: [] },
        md5: { total: 0, correct: 0, wrong: 0, accuracy: 0, streak: 0, bestStreak: 0, worstStreak: 0, last10: [], last50: [] }
    };
    lastPhien = { hu: null, md5: null };
    saveHistory();
    res.json({ message: '✅ Reset thành công' });
});

// ============================================================
// 🚀 KHỞI ĐỘNG
// ============================================================

loadHistory();

app.listen(PORT, '0.0.0.0', () => {
    console.log('\n═══════════════════════════════════════════════════');
    console.log('🌌 TX UNIVERSE PREDICTOR v3.0 - Siêu Chính Xác');
    console.log('═══════════════════════════════════════════════════');
    console.log(`🚀 Server: http://0.0.0.0:${PORT}`);
    console.log('📊 Lịch sử: 1000 phiên tối đa');
    console.log('🧠 Học sâu thích nghi với 10+ loại cầu');
    console.log('📁 himinhlaanhkhoi_history.json');
    console.log('📁 himinhlaanhkhoi_learning.json');
    console.log('');
    console.log('🔗 ENDPOINTS:');
    console.log('  📈 /lc79-hu          - Dự đoán HU');
    console.log('  📈 /lc79-md5         - Dự đoán MD5');
    console.log('  📊 /lc79-hu/history  - Thống kê HU (HTML)');
    console.log('  📊 /lc79-md5/history - Thống kê MD5 (HTML)');
    console.log('  📋 /stats            - Thống kê tổng hợp');
    console.log('  🔍 /analysis         - Phân tích chi tiết');
    console.log('═══════════════════════════════════════════════════\n');
    
    startAutoTask();
});
